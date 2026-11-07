import { useEffect, useRef, useState } from 'react';
import type { ProviderId } from '@shared/types';
import { useGameStore } from '../services/store';
import { api } from '../services/api';
import { Btn, Card, Field, Select, Text, run } from './ui';

export function ConnectionPanel() {
  const status = useGameStore((s) => s.connection);
  const [provider, setProvider] = useState<ProviderId>('tiktok');
  const [username, setUsername] = useState(() => localStorage.getItem('cfl.username') ?? '');
  const [url, setUrl] = useState(() => localStorage.getItem('cfl.bridge') ?? 'ws://127.0.0.1:21213/');
  const [busy, setBusy] = useState(false);
  // Not persisted in the browser; for a permanent key use config/settings.json → live.tiktok.signApiKey.
  const [apiKey, setApiKey] = useState('');

  const connect = async () => {
    setBusy(true);
    try {
      localStorage.setItem('cfl.username', username);
      localStorage.setItem('cfl.bridge', url);
    } catch {
      /* ignore */
    }
    const tiktokOpts: Record<string, string> = { username };
    if (apiKey.trim()) tiktokOpts.signApiKey = apiKey.trim();
    await run(api.post('/connect', { provider, options: provider === 'tiktok' ? tiktokOpts : provider === 'baltik' ? { url } : {} }), 'Đã kết nối');
    setBusy(false);
  };

  const color = status?.state === 'connected' ? 'bg-emerald-500' : status?.state === 'connecting' ? 'bg-amber-500' : status?.state === 'error' ? 'bg-rose-500' : 'bg-slate-400';

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card title="🔌 Kết nối LIVE">
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <span className={`h-4 w-4 rounded-full ${color}`} />
          <div>
            <div className="font-extrabold text-slate-800">{status?.provider?.toUpperCase() ?? '—'} · {status?.state ?? 'unknown'}</div>
            <div className="text-sm text-slate-500">{status?.message ?? ''}</div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Provider">
            <Select value={provider} onChange={setProvider} options={[{ value: 'tiktok', label: 'TikTok Live Connector' }, { value: 'baltik', label: 'Baltik Live Bridge (WebSocket)' }, { value: 'mock', label: 'Mock Provider' }]} />
          </Field>
          {provider === 'tiktok' && (
            <Field label="TikTok username" hint="Kênh phải đang LIVE. Không cần @">
              <Text value={username} onChange={setUsername} placeholder="vd: meocauca_official" />
            </Field>
          )}
          {provider === 'tiktok' && (
            <Field label="Euler Stream API key (tuỳ chọn)" hint="Để trống vẫn dùng được (giới hạn miễn phí). Lưu cố định: config/settings.json">
              <input type="password" autoComplete="off" className="admin-input" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="để trống nếu không có" />
            </Field>
          )}
          {provider === 'baltik' && (
            <Field label="Bridge WebSocket URL" hint="Nhận JSON {event, data} hoặc định dạng chuẩn hoá">
              <Text value={url} onChange={setUrl} />
            </Field>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <Btn kind="success" onClick={connect} disabled={busy}>▶ Kết nối</Btn>
          <Btn kind="danger" onClick={() => run(api.post('/disconnect'), 'Đã ngắt kết nối')}>■ Ngắt</Btn>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          Lưu ý: TikTok không cung cấp API sự kiện LIVE chính thức không giới hạn. "TikTok Live Connector" là thư viện cộng đồng (có thể thay đổi khi TikTok cập nhật).
          Sự kiện từ Mock Simulator luôn đi qua cùng một pipeline với sự kiện thật.
        </p>
      </Card>
      <LogsPanel />
    </div>
  );
}

export function LogsPanel() {
  const logs = useGameStore((s) => s.logs);
  const [initial, setInitial] = useState<typeof logs>([]);
  const [filter, setFilter] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    api.get<typeof logs>('/logs').then(setInitial).catch(() => {});
  }, []);
  const all = [...initial.filter((l) => !logs.some((x) => x.id === l.id)), ...logs].slice(-400);
  const shown = filter ? all.filter((l) => l.message.toLowerCase().includes(filter.toLowerCase())) : all;
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [shown.length]);
  return (
    <Card title="📜 Event logs" actions={<input className="admin-input w-48" placeholder="Lọc…" value={filter} onChange={(e) => setFilter(e.target.value)} />}>
      <div ref={box} className="h-[420px] overflow-auto rounded-xl bg-slate-950 p-3 font-mono text-xs leading-5">
        {shown.map((l) => (
          <div key={l.id} className={l.level === 'error' ? 'text-rose-400' : l.level === 'warn' ? 'text-amber-300' : l.level === 'event' ? 'text-sky-300' : 'text-slate-300'}>
            <span className="text-slate-500">{new Date(l.time).toLocaleTimeString()}</span> {l.message}
          </div>
        ))}
      </div>
    </Card>
  );
}
