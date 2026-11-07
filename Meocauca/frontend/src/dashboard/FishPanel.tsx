import { useState } from 'react';
import type { FishDef, FishEffect, FishExtra, FishPattern, FishShape, Rarity } from '@shared/types';
import { RARITY_ORDER } from '@shared/types';
import { FishIcon } from '../components/Icons';
import { useGameStore } from '../services/store';
import { Btn, Card, Field, Num, SaveBar, Select, Text, Toggle, useDraft } from './ui';

const SHAPES: FishShape[] = ['carp', 'slim', 'round', 'catfish', 'koi', 'trout', 'crystal', 'dragon', 'emperor', 'phoenix', 'moon', 'butterfly', 'spirit'];
const PATTERNS: FishPattern[] = ['none', 'spots', 'stripes', 'koi', 'rainbow', 'gradient', 'scales'];
const EFFECTS: FishEffect[] = ['none', 'sparkle', 'glow', 'aura', 'legendary'];
const EXTRAS: FishExtra[] = ['whiskers', 'horns', 'crown', 'longFins', 'wings', 'crescent', 'crystalSpikes', 'mane', 'halo'];

export function FishPanel() {
  const { draft, setDraft, save, revert, reset, isDirty } = useDraft('fish');
  const rarities = useGameStore((s) => s.config?.rarities ?? []);
  const events = useGameStore((s) => s.config?.events ?? []);
  const [editing, setEditing] = useState<string | null>(null);
  const [filter, setFilter] = useState<Rarity | 'all'>('all');
  if (!draft) return null;

  const upd = (id: string, fn: (f: FishDef) => void) => setDraft((list) => {
    const f = list.find((x) => x.id === id);
    if (f) fn(f);
  });
  const add = () => {
    const id = 'fish-' + Date.now().toString(36);
    setDraft((list) => {
      const base = structuredClone(list.find((f) => f.rarity === (filter === 'all' ? 'common' : filter)) ?? list[0]);
      list.push({ ...base, id, name: 'New Fish', nameVi: 'Cá Mới', enabled: true });
    });
    setEditing(id);
  };
  const shown = draft.filter((f) => filter === 'all' || f.rarity === filter);
  const groupTotal = (r: Rarity) => draft.filter((f) => f.rarity === r && f.enabled).reduce((s, f) => s + f.baseChance, 0);
  const color = (r: Rarity) => rarities.find((x) => x.id === r)?.color ?? '#999';

  return (
    <Card
      title={`🐟 Quản lý cá (${draft.length})`}
      actions={
        <>
          <Select value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Tất cả độ hiếm' }, ...RARITY_ORDER.map((r) => ({ value: r, label: r }))]} className="w-40" />
          <Btn kind="primary" onClick={add}>➕ Thêm cá</Btn>
          <SaveBar isDirty={isDirty} save={save} revert={revert} reset={reset} />
        </>
      }
    >
      <p className="mb-3 text-xs text-slate-500">"Tỉ lệ trong nhóm" là trọng số tương đối giữa các loài cùng độ hiếm. Độ hiếm được chọn trước bằng hệ thống xác suất + May mắn (tab May mắn).</p>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="p-2">Icon</th>
              <th className="p-2">Tên</th>
              <th className="p-2">Độ hiếm</th>
              <th className="p-2">Cân nặng (kg)</th>
              <th className="p-2">Tỉ lệ trong nhóm</th>
              <th className="p-2">Điểm/kg</th>
              <th className="p-2">Hiệu ứng</th>
              <th className="p-2">Bật</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {shown.map((f) => (
              <FishRow key={f.id} f={f} color={color(f.rarity)} share={groupTotal(f.rarity) ? (f.baseChance / groupTotal(f.rarity)) * 100 : 0} upd={upd} editing={editing === f.id} onEdit={() => setEditing(editing === f.id ? null : f.id)} onRemove={() => setDraft((l) => { const i = l.findIndex((x) => x.id === f.id); if (i >= 0) l.splice(i, 1); })} events={events.map((e) => ({ value: e.id, label: e.nameVi }))} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function FishRow({ f, color, share, upd, editing, onEdit, onRemove, events }: {
  f: FishDef; color: string; share: number; upd: (id: string, fn: (f: FishDef) => void) => void; editing: boolean; onEdit: () => void; onRemove: () => void; events: { value: string; label: string }[];
}) {
  const v = f.visual;
  return (
    <>
      <tr className="border-t border-slate-100">
        <td className="p-2"><FishIcon fish={f} size={48} /></td>
        <td className="p-2">
          <Text value={f.nameVi} onChange={(x) => upd(f.id, (d) => (d.nameVi = x))} className="mb-1 w-44 font-bold" />
          <Text value={f.name} onChange={(x) => upd(f.id, (d) => (d.name = x))} className="w-44 text-xs" />
        </td>
        <td className="p-2">
          <span className="mb-1 inline-block h-2 w-full rounded" style={{ background: color }} />
          <Select value={f.rarity} onChange={(x) => upd(f.id, (d) => (d.rarity = x))} options={RARITY_ORDER} className="w-32" />
        </td>
        <td className="p-2">
          <div className="flex gap-1">
            <Num value={f.weightMin} step={0.1} onChange={(x) => upd(f.id, (d) => (d.weightMin = x))} className="w-20" />
            <Num value={f.weightMax} step={0.1} onChange={(x) => upd(f.id, (d) => (d.weightMax = x))} className="w-20" />
          </div>
        </td>
        <td className="p-2">
          <Num value={f.baseChance} onChange={(x) => upd(f.id, (d) => (d.baseChance = x))} className="w-20" />
          <div className="text-xs text-slate-400">{share.toFixed(1)}% nhóm</div>
        </td>
        <td className="p-2"><Num value={f.scorePerKg} onChange={(x) => upd(f.id, (d) => (d.scorePerKg = x))} className="w-20" /></td>
        <td className="p-2"><Select value={f.effect} onChange={(x) => upd(f.id, (d) => (d.effect = x))} options={EFFECTS} className="w-28" /></td>
        <td className="p-2"><Toggle value={f.enabled} onChange={(x) => upd(f.id, (d) => (d.enabled = x))} /></td>
        <td className="p-2">
          <div className="flex gap-1">
            <Btn kind="ghost" onClick={onEdit}>{editing ? '▲' : '🎨'}</Btn>
            <Btn kind="danger" onClick={() => confirm(`Xoá ${f.nameVi}?`) && onRemove()}>✕</Btn>
          </div>
        </td>
      </tr>
      {editing && (
        <tr className="bg-slate-50">
          <td colSpan={9} className="p-3">
            <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-6">
              <Field label="Hình dáng"><Select value={v.shape} onChange={(x) => upd(f.id, (d) => (d.visual.shape = x))} options={SHAPES} /></Field>
              <Field label="Hoa văn"><Select value={v.pattern} onChange={(x) => upd(f.id, (d) => (d.visual.pattern = x))} options={PATTERNS} /></Field>
              {(['bodyColor', 'bellyColor', 'accentColor', 'finColor'] as const).map((k) => (
                <Field key={k} label={k}>
                  <input type="color" className="h-8 w-full cursor-pointer rounded" value={v[k]} onChange={(e) => upd(f.id, (d) => (d.visual[k] = e.target.value))} />
                </Field>
              ))}
              <Field label="Phát sáng (màu)">
                <input type="color" className="h-8 w-full cursor-pointer rounded" value={v.emissive ?? '#000000'} onChange={(e) => upd(f.id, (d) => (d.visual.emissive = e.target.value))} />
              </Field>
              <Field label="Cường độ sáng"><Num value={v.emissiveIntensity ?? 0} step={0.05} onChange={(x) => upd(f.id, (d) => (d.visual.emissiveIntensity = x))} /></Field>
              <Field label="Kích thước"><Num value={v.scale ?? 1} step={0.05} onChange={(x) => upd(f.id, (d) => (d.visual.scale = x))} /></Field>
              <Field label="Độ trong"><Num value={v.opacity ?? 1} step={0.05} min={0.2} max={1} onChange={(x) => upd(f.id, (d) => (d.visual.opacity = x))} /></Field>
              <Field label="Hệ số cân nặng"><Num value={f.weightMultiplier} step={0.1} onChange={(x) => upd(f.id, (d) => (d.weightMultiplier = x))} /></Field>
              <Field label="Model GLB (tuỳ chọn)" hint="vd: fish/koi.glb trong thư mục assets">
                <Text value={f.model ?? ''} onChange={(x) => upd(f.id, (d) => (d.model = x.trim() || null))} placeholder="procedural" />
              </Field>
              <Field label="Chỉ trong sự kiện">
                <Select value={f.eventOnly ?? ''} onChange={(x) => upd(f.id, (d) => (d.eventOnly = x || null))} options={[{ value: '', label: '— luôn có —' }, ...events]} />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              {EXTRAS.map((e) => (
                <Toggle key={e} label={e} value={!!v.extras?.includes(e)} onChange={(on) => upd(f.id, (d) => {
                  const set = new Set(d.visual.extras ?? []);
                  if (on) set.add(e); else set.delete(e);
                  d.visual.extras = [...set];
                })} />
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
