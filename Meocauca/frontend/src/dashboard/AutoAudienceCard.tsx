import { useEffect, useState } from 'react';
import type { AutoAudienceSettings } from '@shared/types';
import { useGameStore } from '../services/store';
import { api } from '../services/api';
import { Btn, Card, Field, Num, Toggle, run } from './ui';

interface AudienceStatus {
  enabled: boolean;
  botsSeated: number;
  botsQueued: number;
  realSeated: number;
  realQueued: number;
  freeSeats: number;
  maxPlayers: number;
  maxBots: number;
  roomForBots: number;
}

type Preset = Omit<AutoAudienceSettings, 'enabled'>;
const PRESETS: { label: string; hint: string; value: Preset }[] = [
  { label: '🌙 Vắng', hint: 'Vài mèo câu thong thả', value: { maxBots: 6, joinsPerMinute: 2, keepFreeSeats: 5, stayMinMin: 4, stayMaxMin: 12, castsPerMinute: 2, likesPerMinute: 8, giftsPerMinute: 0.2, sharesPerMinute: 0.1 } },
  { label: '☀️ Vừa', hint: 'Hồ có không khí, vẫn nhiều chỗ trống', value: { maxBots: 15, joinsPerMinute: 6, keepFreeSeats: 3, stayMinMin: 3, stayMaxMin: 10, castsPerMinute: 3, likesPerMinute: 20, giftsPerMinute: 0.5, sharesPerMinute: 0.3 } },
  { label: '🔥 Đông', hint: 'Hồ nhộn nhịp, mèo ra vào liên tục', value: { maxBots: 30, joinsPerMinute: 15, keepFreeSeats: 2, stayMinMin: 2, stayMaxMin: 6, castsPerMinute: 4, likesPerMinute: 60, giftsPerMinute: 1.5, sharesPerMinute: 0.6 } },
];

/** Admin card: automatic simulated audience with limits and rates. */
export function AutoAudienceCard() {
  const saved = useGameStore((s) => s.config?.game.autoAudience);
  const maxPlayers = useGameStore((s) => s.config?.game.maxPlayers ?? 40);
  const [draft, setDraft] = useState<AutoAudienceSettings | null>(null);
  const [status, setStatus] = useState<AudienceStatus | null>(null);

  // Keep the draft in sync with the server unless the admin is editing.
  const dirty = !!draft && !!saved && JSON.stringify({ ...draft, enabled: saved.enabled }) !== JSON.stringify(saved);
  useEffect(() => {
    if (saved && !dirty) setDraft({ ...saved });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(saved)]);

  useEffect(() => {
    let alive = true;
    const load = () => api.get<AudienceStatus>('/audience/status').then((s) => alive && setStatus(s)).catch(() => {});
    load();
    const t = setInterval(load, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (!draft || !saved) return null;
  const set = <K extends keyof AutoAudienceSettings>(k: K, v: AutoAudienceSettings[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const save = (patch: Partial<AutoAudienceSettings>, msg: string) => run(api.patch('/config/game', { autoAudience: patch }), msg);
  const { enabled: _e, ...settingsOnly } = draft;
  const overSeats = draft.maxBots + draft.keepFreeSeats > maxPlayers;

  return (
    <Card
      title="🤖 Khán giả tự động"
      actions={
        <>
          <Btn kind="ghost" disabled={!dirty} onClick={() => setDraft({ ...saved })}>Hoàn tác</Btn>
          <Btn kind="success" disabled={!dirty} onClick={() => save(settingsOnly, 'Đã lưu cài đặt khán giả tự động')}>💾 Lưu</Btn>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Toggle
          value={saved.enabled}
          label={saved.enabled ? 'Đang bật – mèo bot tự vào/ra hồ' : 'Tắt'}
          onChange={(v) => save({ enabled: v }, v ? 'Đã bật khán giả tự động' : 'Đã tắt khán giả tự động')}
        />
        {status && (
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">🤖 {status.botsSeated}/{status.maxBots} mèo bot{status.botsQueued ? ` (+${status.botsQueued} chờ)` : ''}</span>
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">👤 {status.realSeated} người thật{status.realQueued ? ` (+${status.realQueued} chờ)` : ''}</span>
            <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-700">🪑 {status.freeSeats}/{status.maxPlayers} ghế trống</span>
            {status.enabled && status.roomForBots === 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">⏸ Bot ngừng vào: {status.realQueued ? 'có người thật đang chờ' : 'đã đủ giới hạn / ghế chừa sẵn'}</span>
            )}
          </div>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-500">Mẫu nhanh:</span>
        {PRESETS.map((p) => (
          <Btn key={p.label} kind="ghost" title={p.hint} onClick={() => setDraft((d) => (d ? { ...d, ...p.value } : d))}>{p.label}</Btn>
        ))}
        <span className="text-xs text-slate-400">(chọn mẫu rồi bấm 💾 Lưu)</span>
      </div>

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Field label="Giới hạn số mèo bot" hint={`Tối đa trong hồ (hồ có ${maxPlayers} ghế)`}>
          <Num value={draft.maxBots} min={0} max={60} onChange={(v) => set('maxBots', Math.round(v))} />
        </Field>
        <Field label="Mèo mới vào / phút" hint="Tốc độ bot vào hồ khi còn chỗ">
          <Num value={draft.joinsPerMinute} step={0.5} min={0} max={120} onChange={(v) => set('joinsPerMinute', v)} />
        </Field>
        <Field label="Luôn chừa ghế trống" hint="Giữ sẵn cho người xem thật">
          <Num value={draft.keepFreeSeats} min={0} max={60} onChange={(v) => set('keepFreeSeats', Math.round(v))} />
        </Field>
        <Field label="Ở lại từ (phút)">
          <Num value={draft.stayMinMin} step={0.5} min={0} max={240} onChange={(v) => set('stayMinMin', v)} />
        </Field>
        <Field label="Ở lại đến (phút)" hint="0 = ở mãi, không tự rời">
          <Num value={draft.stayMaxMin} step={0.5} min={0} max={240} onChange={(v) => set('stayMaxMin', v)} />
        </Field>
        <Field label="Mỗi mèo câu (lần/phút)" hint="Độ chăm câu của bot">
          <Num value={draft.castsPerMinute} step={0.5} min={0} max={30} onChange={(v) => set('castsPerMinute', v)} />
        </Field>
        <Field label="Thả tim (lượt/phút)" hint="Mỗi lượt 5–30 tim">
          <Num value={draft.likesPerMinute} min={0} max={600} onChange={(v) => set('likesPerMinute', v)} />
        </Field>
        <Field label="Tặng quà (lần/phút)" hint="Chủ yếu Rose, hiếm khi quà lớn">
          <Num value={draft.giftsPerMinute} step={0.1} min={0} max={30} onChange={(v) => set('giftsPerMinute', v)} />
        </Field>
        <Field label="Chia sẻ (lần/phút)">
          <Num value={draft.sharesPerMinute} step={0.1} min={0} max={30} onChange={(v) => set('sharesPerMinute', v)} />
        </Field>
        <div className="flex items-end">
          <Btn kind="danger" onClick={() => confirm('Cho tất cả mèo bot rời hồ?') && run(api.post<{ removed: number }>('/audience/clear'), 'Đã xoá mèo bot')}>🧹 Xoá hết mèo bot</Btn>
        </div>
      </div>
      {overSeats && (
        <p className="mt-2 text-xs font-bold text-amber-600">
          Giới hạn bot + ghế chừa ({draft.maxBots + draft.keepFreeSeats}) lớn hơn số ghế ({maxPlayers}): bot sẽ chỉ vào tới {Math.max(0, maxPlayers - draft.keepFreeSeats)} con.
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500">
        Mèo bot có tên giống người xem thật và đi qua đúng luồng sự kiện như TikTok. Bot ngừng vào khi có người thật đang chờ và luôn nhường ghế cho người thật
        (xem tab 🎮 Điều khiển). Có thể bật cả khi đang LIVE thật.
      </p>
    </Card>
  );
}
