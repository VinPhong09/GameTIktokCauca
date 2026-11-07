import { useEffect, useState } from 'react';
import type { VoiceEngine, VoiceEventKind, VoiceSettings } from '@shared/types';
import { VOICE_EVENT_KINDS } from '@shared/types';
import { useGameStore } from '../services/store';
import { api } from '../services/api';
import { VoicePlayer } from '../game/audio/VoicePlayer';
import { Btn, Card, Field, Num, Select, Toggle, notify, run } from './ui';

interface TtsStatus {
  edge: { state: 'unknown' | 'ok' | 'error'; error?: string };
  windows: { supported: boolean; voices: { name: string; lang: string }[]; vietnamese: string[]; error?: string };
}

const EVENT_LABEL: Record<VoiceEventKind, string> = {
  join: '🐱 Mèo vào hồ',
  follow: '💖 Theo dõi',
  gift: '🎁 Tặng quà',
  share: '📣 Chia sẻ',
  catch: '🐟 Câu cá thường',
  rare: '💎 Cá hiếm',
  epic: '✨ Cá sử thi',
  legendary: '🌟 Cá huyền thoại',
  fail: '💨 Cá thoát',
  leave: '👋 Rời hồ',
  event: '🎉 Sự kiện bắt đầu',
};

/** Sample values for "Nghe thử". */
const SAMPLE = { name: 'Ngọc Anh', fish: 'Cá Koi Bướm', kg: '8,7', gift: '3 Rose', event: 'Giờ Cá Vàng' };
const fill = (t: string) => t.replace(/\{(\w+)\}/g, (_, k: keyof typeof SAMPLE) => SAMPLE[k] ?? '');

const EDGE_VOICES = [
  { value: 'vi-VN-HoaiMyNeural', label: 'Hoài My (nữ)' },
  { value: 'vi-VN-NamMinhNeural', label: 'Nam Minh (nam)' },
];

/** Admin tab: automatic voice announcements (text-to-speech). */
export function VoicePanel() {
  const saved = useGameStore((s) => s.config?.ui.voice);
  const [draft, setDraft] = useState<VoiceSettings | null>(null);
  const [status, setStatus] = useState<TtsStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [banned, setBanned] = useState('');

  const dirty = !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved);
  useEffect(() => {
    if (saved && !dirty) {
      setDraft(JSON.parse(JSON.stringify(saved)));
      setBanned(saved.bannedWords.join(', '));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(saved)]);

  const check = async (probe: boolean) => {
    setChecking(true);
    try {
      setStatus(await api.get<TtsStatus>(`/tts/status${probe ? '?probe=1' : ''}`));
    } catch (e) {
      notify((e as Error).message, false);
    } finally {
      setChecking(false);
    }
  };
  useEffect(() => {
    void check(false);
  }, []);
  useEffect(() => () => VoicePlayer.get().stopAll(), []);

  if (!draft || !saved) return null;
  const set = (fn: (d: VoiceSettings) => void) =>
    setDraft((d) => {
      if (!d) return d;
      const n: VoiceSettings = JSON.parse(JSON.stringify(d));
      fn(n);
      return n;
    });
  const save = () => run(api.patch('/config/ui', { voice: draft }), 'Đã lưu cài đặt giọng nói');
  const preview = (text: string) => {
    if (dirty) notify('Đang nghe thử với cài đặt ĐÃ LƯU – bấm 💾 Lưu để nghe giọng/tốc độ mới', true);
    VoicePlayer.get().setOptions({ enabled: true, volume: draft.volume / 100 });
    VoicePlayer.get().preview(text).catch((e: Error) => notify(`Không đọc được: ${e.message}`, false));
  };

  const vi = status?.windows.vietnamese ?? [];
  const edgeBadge =
    status?.edge.state === 'ok' ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">✓ Hoạt động</span>
    : status?.edge.state === 'error' ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700" title={status.edge.error}>✗ Lỗi: {status.edge.error}</span>
    : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">Chưa kiểm tra</span>;

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="🔊 Giọng nói tự động"
        actions={
          <>
            <Btn kind="ghost" disabled={!dirty} onClick={() => { setDraft(JSON.parse(JSON.stringify(saved))); setBanned(saved.bannedWords.join(', ')); }}>Hoàn tác</Btn>
            <Btn kind="success" disabled={!dirty} onClick={save}>💾 Lưu</Btn>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-500">
          Đọc to các sự kiện trên LIVE (mèo vào hồ, quà, câu được cá hiếm…). Giọng được tạo ở máy chủ và phát qua trang <b>/game</b> / <b>/overlay</b>,
          nên OBS thu được khi bật <i>Control audio via OBS</i>. Nhạc nền tự nhỏ lại khi đang đọc. Thêm <code>?voice=0</code> vào URL để tắt giọng ở một trang.
        </p>
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <div className="flex items-end pb-1">
            <Toggle label="Bật giọng nói" value={draft.enabled} onChange={(v) => set((d) => (d.enabled = v))} />
          </div>
          <Field label="Nguồn giọng">
            <Select<VoiceEngine>
              value={draft.engine}
              onChange={(v) => set((d) => (d.engine = v))}
              options={[
                { value: 'auto', label: 'Tự động (Edge → Windows)' },
                { value: 'edge', label: 'Edge Online' },
                { value: 'windows', label: 'Windows offline' },
              ]}
            />
          </Field>
          <Field label="Giọng Edge">
            <Select value={draft.edgeVoice} onChange={(v) => set((d) => (d.edgeVoice = v))} options={EDGE_VOICES} />
          </Field>
          <Field label="Giọng Windows" hint={vi.length ? '' : 'Chưa cài giọng tiếng Việt'}>
            <Select
              value={draft.windowsVoice}
              onChange={(v) => set((d) => (d.windowsVoice = v))}
              options={[{ value: '', label: 'Tiếng Việt đầu tiên' }, ...(status?.windows.voices ?? []).map((x) => ({ value: x.name, label: `${x.name} (${x.lang})` }))]}
            />
          </Field>
          <Field label={`Tốc độ: ${draft.rate > 0 ? '+' : ''}${draft.rate}%`}>
            <input type="range" min={-50} max={50} value={draft.rate} onChange={(e) => set((d) => (d.rate = Number(e.target.value)))} />
          </Field>
          <Field label={`Âm lượng: ${draft.volume}%`}>
            <input type="range" min={0} max={100} value={draft.volume} onChange={(e) => set((d) => (d.volume = Number(e.target.value)))} />
          </Field>
          <Field label="Hàng đợi tối đa" hint="Đọc không kịp thì bỏ bớt câu ít quan trọng">
            <Num value={draft.maxQueue} min={1} max={20} onChange={(v) => set((d) => (d.maxQueue = Math.round(v)))} />
          </Field>
          <div className="col-span-2 flex items-end pb-1">
            <Toggle label="🤖 Không đọc sự kiện của mèo bot" value={draft.skipBots} onChange={(v) => set((d) => (d.skipBots = v))} />
          </div>
          <Field label="Từ cấm (cách nhau dấu phẩy)" hint="Tên chứa từ này sẽ không được đọc">
            <input
              className="admin-input"
              value={banned}
              placeholder="vd: từ tục, quảng cáo…"
              onChange={(e) => {
                setBanned(e.target.value);
                set((d) => (d.bannedWords = e.target.value.split(',').map((w) => w.trim()).filter(Boolean)));
              }}
            />
          </Field>
        </div>
      </Card>

      <Card title="🗣️ Câu đọc cho từng sự kiện">
        <p className="mb-2 text-xs text-slate-500">
          Biến: <code>{'{name}'}</code> tên người xem · <code>{'{fish}'}</code> tên cá · <code>{'{kg}'}</code> cân nặng · <code>{'{gift}'}</code> quà (vd “3 Rose”) ·{' '}
          <code>{'{event}'}</code> tên sự kiện. Tên được tự làm sạch (bỏ emoji, ký tự trang trí; “user123…” đọc thành “bạn mới”).
        </p>
        <div className="flex flex-col gap-2">
          {VOICE_EVENT_KINDS.map((k) => (
            <div key={k} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 p-2">
              <div className="w-44">
                <Toggle label={EVENT_LABEL[k]} value={draft.events[k].enabled} onChange={(v) => set((d) => (d.events[k].enabled = v))} />
              </div>
              <input className="admin-input min-w-[260px] flex-1" value={draft.events[k].template} onChange={(e) => set((d) => (d.events[k].template = e.target.value))} />
              <Btn kind="ghost" title={fill(draft.events[k].template)} onClick={() => preview(fill(draft.events[k].template))}>▶ Nghe thử</Btn>
            </div>
          ))}
        </div>
      </Card>

      <Card title="🩺 Trạng thái nguồn giọng" actions={<Btn kind="primary" disabled={checking} onClick={() => check(true)}>{checking ? 'Đang kiểm tra…' : '🔄 Kiểm tra lại'}</Btn>}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-slate-100 p-3 text-sm">
            <div className="mb-1 flex items-center gap-2 font-bold">🌐 Edge Online {edgeBadge}</div>
            <p className="text-slate-500">Giọng thần kinh rất tự nhiên của Microsoft Edge, miễn phí, cần internet. Tên người xem được gửi tới máy chủ Microsoft để đọc. Dịch vụ không chính thức, có thể thay đổi bất cứ lúc nào.</p>
          </div>
          <div className="rounded-lg border border-slate-100 p-3 text-sm">
            <div className="mb-1 flex items-center gap-2 font-bold">
              💻 Windows offline{' '}
              {vi.length ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">✓ {vi.join(', ')}</span>
              ) : (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">Chưa có giọng tiếng Việt</span>
              )}
            </div>
            <p className="text-slate-500">
              Không cần mạng, dự phòng khi Edge lỗi. Cài giọng tiếng Việt: <b>Settings → Time &amp; Language → Speech → Add voices → Tiếng Việt</b>, rồi bấm 🔄 Kiểm tra lại.
              {status?.windows.error && <span className="block text-rose-600">{status.windows.error}</span>}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
