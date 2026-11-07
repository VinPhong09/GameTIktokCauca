import { useEffect, useState } from 'react';
import type { FishingEventDef } from '@shared/types';
import { RARITY_ORDER } from '@shared/types';
import { useGameStore } from '../services/store';
import { api } from '../services/api';
import { Btn, Card, Field, Num, SaveBar, Text, Toggle, run, useDraft } from './ui';

export function EventsPanel() {
  const { draft, setDraft, save, revert, reset, isDirty } = useDraft('events');
  const active = useGameStore((s) => s.events);
  const fish = useGameStore((s) => s.config?.fish ?? []);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!draft) return null;
  const upd = (id: string, fn: (e: FishingEventDef) => void) => setDraft((l) => fn(l.find((e) => e.id === id)!));
  const add = () => setDraft((l) => l.push({ id: 'event-' + Date.now().toString(36), name: 'New Event', nameVi: 'Sự kiện mới', description: 'Mô tả sự kiện', color: '#22c55e', enabled: false, durationSec: 120, luckMultiplier: 1.5, rarityMultipliers: {}, fishBoost: { fishIds: [], multiplier: 1 }, unlockFishIds: [], intervalMin: 0 }));

  return (
    <Card title="🎉 Sự kiện câu cá" actions={<><Btn onClick={add}>➕ Thêm sự kiện</Btn><SaveBar isDirty={isDirty} save={save} revert={revert} reset={reset} /></>}>
      <div className="grid gap-4 xl:grid-cols-2">
        {draft.map((e) => {
          const a = active.find((x) => x.eventId === e.id && x.endsAt > now);
          return (
            <div key={e.id} className="rounded-2xl border-2 p-3" style={{ borderColor: e.color }}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <input type="color" value={e.color} onChange={(ev) => upd(e.id, (x) => (x.color = ev.target.value))} className="h-8 w-10 rounded" />
                <Text value={e.nameVi} onChange={(v) => upd(e.id, (x) => (x.nameVi = v))} className="w-48 font-bold" />
                {a ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">ĐANG CHẠY · {Math.ceil((a.endsAt - now) / 1000)}s</span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">tắt</span>
                )}
                <div className="ml-auto flex gap-1">
                  <Btn kind="success" onClick={() => run(api.post(`/events/${e.id}/start`, {}), `Bắt đầu ${e.nameVi}`)}>▶ Bắt đầu</Btn>
                  <Btn kind="danger" onClick={() => run(api.post(`/events/${e.id}/stop`), 'Đã dừng')}>■</Btn>
                  <Btn kind="ghost" onClick={() => setDraft((l) => l.splice(l.findIndex((x) => x.id === e.id), 1))}>✕</Btn>
                </div>
              </div>
              <Text value={e.description} onChange={(v) => upd(e.id, (x) => (x.description = v))} className="mb-2" />
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Field label="Thời lượng (s)"><Num value={e.durationSec} onChange={(v) => upd(e.id, (x) => (x.durationSec = v))} /></Field>
                <Field label="Nhân Luck"><Num value={e.luckMultiplier} step={0.1} onChange={(v) => upd(e.id, (x) => (x.luckMultiplier = v))} /></Field>
                <Field label="Tự chạy mỗi (phút)" hint="0 = thủ công"><Num value={e.intervalMin} onChange={(v) => upd(e.id, (x) => (x.intervalMin = v))} /></Field>
                <div className="flex items-end pb-1"><Toggle label="Cho phép lịch" value={e.enabled} onChange={(v) => upd(e.id, (x) => (x.enabled = v))} /></div>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {RARITY_ORDER.slice(1).map((r) => (
                  <Field key={r} label={`x ${r}`}><Num value={e.rarityMultipliers[r] ?? 1} step={0.1} onChange={(v) => upd(e.id, (x) => (x.rarityMultipliers = { ...x.rarityMultipliers, [r]: v }))} /></Field>
                ))}
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-[1fr_120px]">
                <Field label="Cá được tăng tỉ lệ (giữ Ctrl để chọn nhiều)">
                  <select multiple className="admin-input h-24" value={e.fishBoost.fishIds} onChange={(ev) => upd(e.id, (x) => (x.fishBoost = { ...x.fishBoost, fishIds: [...ev.target.selectedOptions].map((o) => o.value) }))}>
                    {fish.map((f) => <option key={f.id} value={f.id}>{f.nameVi} ({f.rarity})</option>)}
                  </select>
                </Field>
                <Field label="Hệ số"><Num value={e.fishBoost.multiplier} step={0.5} onChange={(v) => upd(e.id, (x) => (x.fishBoost = { ...x.fishBoost, multiplier: v }))} /></Field>
              </div>
              <Field label="Cá đặc biệt mở khoá (cá 'chỉ trong sự kiện')">
                <select multiple className="admin-input h-20" value={e.unlockFishIds} onChange={(ev) => upd(e.id, (x) => (x.unlockFishIds = [...ev.target.selectedOptions].map((o) => o.value)))}>
                  {fish.filter((f) => f.eventOnly).map((f) => <option key={f.id} value={f.id}>{f.nameVi}</option>)}
                </select>
              </Field>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
