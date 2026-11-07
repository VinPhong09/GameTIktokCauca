import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import type { VoiceSettings } from '@shared/types';
import { ROOT_DIR, uid } from '../settings';
import { Logger } from '../services/Logger';

export interface TtsAudio {
  buf: Buffer;
  mime: string;
  engine: 'edge' | 'windows';
}

export interface TtsStatus {
  edge: { state: 'unknown' | 'ok' | 'error'; error?: string };
  windows: { supported: boolean; voices: { name: string; lang: string }[]; vietnamese: string[]; error?: string };
}

/** Escape text for the SSML envelope (msedge-tts inserts input verbatim). */
export function escapeSsml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${what}: quá thời gian ${ms / 1000}s`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/**
 * Text-to-speech for the voice announcer.
 *  - edge:    Microsoft Edge online neural voices (vi-VN-HoaiMyNeural / NamMinhNeural) via msedge-tts.
 *  - windows: offline Windows OneCore voices (e.g. "Microsoft An") through a persistent PowerShell worker.
 *  - auto:    edge first, windows when edge fails.
 * Results are cached (same sentence + voice → same audio).
 */
export class TtsService {
  private edge: MsEdgeTTS | null = null;
  private edgeKey = '';
  private edgeChain: Promise<unknown> = Promise.resolve();
  private edgeState: TtsStatus['edge'] = { state: 'unknown' };

  private worker: ChildProcessWithoutNullStreams | null = null;
  private workerBuf = '';
  private pending = new Map<string, (r: { ok?: boolean; error?: string; voices?: { name: string; lang: string }[] }) => void>();
  private tmpDir = path.join(os.tmpdir(), 'cat-fishing-tts');

  private cache = new Map<string, Promise<TtsAudio>>();

  async synthesize(text: string, v: VoiceSettings): Promise<TtsAudio> {
    const clean = text.replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!clean) throw new Error('Không có nội dung để đọc');
    const key = `${v.engine}|${v.edgeVoice}|${v.windowsVoice}|${v.rate}|${clean}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const p = this.run(clean, v);
    this.cache.set(key, p);
    p.catch(() => this.cache.delete(key));
    if (this.cache.size > 150) this.cache.delete(this.cache.keys().next().value as string);
    return p;
  }

  private async run(text: string, v: VoiceSettings): Promise<TtsAudio> {
    const order: ('edge' | 'windows')[] = v.engine === 'edge' ? ['edge'] : v.engine === 'windows' ? ['windows'] : ['edge', 'windows'];
    let last: Error | null = null;
    for (const engine of order) {
      try {
        return engine === 'edge' ? await this.viaEdge(text, v) : await this.viaWindows(text, v);
      } catch (e) {
        last = e as Error;
        Logger.warn(`TTS ${engine} lỗi: ${last.message}`);
      }
    }
    throw last ?? new Error('TTS không khả dụng');
  }

  // ------------------------------------------------------------------ Edge online
  private viaEdge(text: string, v: VoiceSettings): Promise<TtsAudio> {
    // One websocket, one request at a time.
    const job = this.edgeChain.then(() => withTimeout(this.edgeOnce(text, v), 12_000, 'Edge TTS'));
    this.edgeChain = job.catch(() => undefined);
    return job.then(
      (a) => {
        this.edgeState = { state: 'ok' };
        return a;
      },
      (e: Error) => {
        this.edgeState = { state: 'error', error: e.message };
        this.edge?.close();
        this.edge = null;
        throw e;
      },
    );
  }

  private async edgeOnce(text: string, v: VoiceSettings): Promise<TtsAudio> {
    const voice = v.edgeVoice || 'vi-VN-HoaiMyNeural';
    if (!this.edge || this.edgeKey !== voice) {
      this.edge?.close();
      this.edge = new MsEdgeTTS();
      await this.edge.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      this.edgeKey = voice;
    }
    const rate = `${v.rate >= 0 ? '+' : ''}${Math.round(v.rate)}%`;
    const { audioStream } = this.edge.toStream(escapeSsml(text), { rate });
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      audioStream.on('data', (c: Buffer) => chunks.push(c));
      audioStream.on('end', () => resolve());
      audioStream.on('close', () => resolve());
      audioStream.on('error', reject);
    });
    const buf = Buffer.concat(chunks);
    if (buf.length < 500) throw new Error('Edge TTS trả về âm thanh rỗng');
    return { buf, mime: 'audio/mpeg', engine: 'edge' };
  }

  // ------------------------------------------------------------------ Windows offline
  private ensureWorker(): ChildProcessWithoutNullStreams {
    if (process.platform !== 'win32') throw new Error('Giọng Windows chỉ có trên Windows');
    if (this.worker && !this.worker.killed && this.worker.exitCode === null) return this.worker;
    const script = path.join(ROOT_DIR, 'backend', 'tts', 'windows-tts.ps1');
    const w = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script], { windowsHide: true });
    w.stdout.setEncoding('utf8');
    w.stdout.on('data', (d: string) => {
      this.workerBuf += d;
      let i: number;
      while ((i = this.workerBuf.indexOf('\n')) >= 0) {
        const line = this.workerBuf.slice(0, i).trim();
        this.workerBuf = this.workerBuf.slice(i + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line);
          const key = msg.voices ? '__voices' : String(msg.id ?? '');
          const cb = this.pending.get(key);
          if (cb) {
            this.pending.delete(key);
            cb(msg);
          }
        } catch {
          /* ignore non-JSON output */
        }
      }
    });
    w.stderr.on('data', (d) => Logger.warn(`Windows TTS: ${String(d).trim().slice(0, 200)}`));
    w.on('exit', () => {
      for (const cb of this.pending.values()) cb({ ok: false, error: 'Tiến trình giọng Windows đã dừng' });
      this.pending.clear();
      this.worker = null;
    });
    this.worker = w;
    fs.mkdirSync(this.tmpDir, { recursive: true });
    return w;
  }

  private request(key: string, payload: object, timeoutMs: number) {
    const w = this.ensureWorker();
    const p = new Promise<{ ok?: boolean; error?: string; voices?: { name: string; lang: string }[] }>((resolve) => this.pending.set(key, resolve));
    w.stdin.write(JSON.stringify(payload) + '\n');
    return withTimeout(p, timeoutMs, 'Giọng Windows').finally(() => this.pending.delete(key));
  }

  private async viaWindows(text: string, v: VoiceSettings): Promise<TtsAudio> {
    const id = uid('w');
    const out = path.join(this.tmpDir, `${id}.wav`);
    const r = await this.request(id, { id, text, voice: v.windowsVoice || '', rate: Math.max(0.5, Math.min(3, 1 + v.rate / 100)), out }, 20_000);
    if (!r.ok) throw new Error(r.error ?? 'Giọng Windows lỗi');
    const buf = await fs.promises.readFile(out);
    fs.promises.unlink(out).catch(() => {});
    return { buf, mime: 'audio/wav', engine: 'windows' };
  }

  async status(probeEdge: boolean, v: VoiceSettings): Promise<TtsStatus> {
    const windows: TtsStatus['windows'] = { supported: process.platform === 'win32', voices: [], vietnamese: [] };
    if (windows.supported) {
      try {
        const r = await this.request('__voices', { cmd: 'voices' }, 15_000);
        windows.voices = r.voices ?? [];
        windows.vietnamese = windows.voices.filter((x) => x.lang.toLowerCase().startsWith('vi')).map((x) => x.name);
      } catch (e) {
        windows.error = (e as Error).message;
      }
    }
    if (probeEdge) {
      await this.viaEdge('Xin chào', v).catch(() => undefined);
    }
    return { edge: this.edgeState, windows };
  }

  dispose() {
    this.edge?.close();
    this.edge = null;
    this.worker?.kill();
    this.worker = null;
  }
}
