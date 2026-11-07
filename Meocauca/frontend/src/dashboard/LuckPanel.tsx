import { useMemo, useState } from 'react';
import type { GameConfig, RarityConfig, StackingMode } from '@shared/types';
import { RARITY_ORDER } from '@shared/types';
import { baseProbabilityTotal, computeRarityDistribution, fishProbabilityTable, pct } from '../game/probability';
import { useGameStore } from '../services/store';
import { Btn, Card, Field, Num, SaveBar, Select, Toggle, useDraft } from './ui';

const PREVIEW_LUCKS = [1, 1.15, 1.5, 2, 2.5, 3, 5];

export function LuckPanel() {
  const rar = useDraft('rarities');
  const luck = useDraft('luck');
  const config = useGameStore((s) => s.config);
  const [previewLuck, setPreviewLuck] = useState(1);
  if (!rar.draft || !luck.draft || !config) return null;
  const total = baseProbabilityTotal(rar.draft);
  const okTotal = Math.abs(total - 100) < 0.001;

  const normalize = () => rar.setDraft((list) => {
    const t = list.reduce((s, r) => s + r.baseProbability, 0) || 1;
    for (const r of list) r.baseProbability = Math.round((r.baseProbability / t) * 100000) / 1000;
    const diff = 100 - list.reduce((s, r) => s + r.baseProbability, 0);
    list[0].baseProbability = Math.round((list[0].baseProbability + diff) * 1000) / 1000;
  });

  return (
    <div className="flex flex-col gap-4">
      <Card title="🎲 Xác suất độ hiếm" actions={<SaveBar {...rar} />}>
        <div className={`mb-3 rounded-lg px-3 py-2 text-sm font-bold ${okTotal ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          Tổng xác suất gốc: {total}% {okTotal ? '✓' : '— phải bằng 100% (hệ thống sẽ tự chuẩn hoá khi tính)'}
          {!okTotal && <Btn kind="warn" className="ml-3" onClick={normalize}>Chuẩn hoá = 100%</Btn>}
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="p-2">Độ hiếm</th>
                <th className="p-2">Gốc %</th>
                <th className="p-2" title="weight = base × luck^exponent">Hệ số Luck (mũ)</th>
                <th className="p-2" title="Giới hạn tối đa sau khi áp may mắn">Trần %</th>
                <th className="p-2">Cân nặng (kg)</th>
                <th className="p-2">Điểm/kg</th>
                <th className="p-2">Camera focus</th>
                <th className="p-2">Thông báo lớn</th>
                <th className="p-2">Màu</th>
              </tr>
            </thead>
            <tbody>
              {rar.draft.map((r) => (
                <RarityRow key={r.id} r={r} set={(fn) => rar.setDraft((l) => fn(l.find((x) => x.id === r.id)!))} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="🍀 Hệ thống May mắn" actions={<SaveBar {...luck} />}>
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <span className="font-extrabold text-emerald-800">🐱 Luck ngẫu nhiên khi mèo vào hồ</span>
            <Toggle label="Bật" value={luck.draft.joinLuck.enabled} onChange={(v) => luck.setDraft((d) => (d.joinLuck.enabled = v))} />
          </div>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Field label="Từ (x)"><Num value={luck.draft.joinLuck.min} step={0.05} min={0.1} onChange={(v) => luck.setDraft((d) => (d.joinLuck.min = v))} /></Field>
            <Field label="Đến (x)"><Num value={luck.draft.joinLuck.max} step={0.05} min={0.1} onChange={(v) => luck.setDraft((d) => (d.joinLuck.max = v))} /></Field>
            <p className="col-span-2 self-end text-xs text-slate-500 lg:col-span-4">
              Mỗi mèo vào hồ được bốc ngẫu nhiên một hệ số trong khoảng này (giữ nguyên tới khi rời hồ). Hệ số <b>nhân</b> với may mắn từ quà, share, sự kiện;
              tổng vẫn bị giới hạn bởi Max Luck. Ví dụ 1 → 1.5: mèo nhận x1.00 – x1.50. Đặt luck riêng cho từng mèo ở tab <b>🐱 Người chơi</b>.
              {luck.draft.joinLuck.max < luck.draft.joinLuck.min && <b className="text-rose-600"> “Đến” phải ≥ “Từ”.</b>}
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Field label="Base Luck"><Num value={luck.draft.baseLuck} step={0.05} onChange={(v) => luck.setDraft((d) => (d.baseLuck = v))} /></Field>
          <Field label="Max Luck"><Num value={luck.draft.maxLuck} step={0.1} onChange={(v) => luck.setDraft((d) => (d.maxLuck = v))} /></Field>
          <Field label="Min Luck"><Num value={luck.draft.minLuck} step={0.1} onChange={(v) => luck.setDraft((d) => (d.minLuck = v))} /></Field>
          <Field label="Cộng dồn (stacking)">
            <Select<StackingMode> value={luck.draft.stacking} onChange={(v) => luck.setDraft((d) => (d.stacking = v))} options={[{ value: 'max', label: 'Lấy cao nhất' }, { value: 'additive', label: 'Cộng dồn' }, { value: 'multiplicative', label: 'Nhân dồn' }]} />
          </Field>
          <Field label="Số boost tối đa"><Num value={luck.draft.maxActiveBoosts} onChange={(v) => luck.setDraft((d) => (d.maxActiveBoosts = v))} /></Field>
          <Field label="Lượt boost tối đa"><Num value={luck.draft.maxAttempts} onChange={(v) => luck.setDraft((d) => (d.maxAttempts = v))} /></Field>
          <Field label="Ảnh hưởng luck lên cân nặng"><Num value={luck.draft.weightLuckInfluence} step={0.05} onChange={(v) => luck.setDraft((d) => (d.weightLuckInfluence = v))} /></Field>
          <Field label="Share: +luck mỗi lượt"><Num value={luck.draft.shareBonus.perShare} step={0.01} onChange={(v) => luck.setDraft((d) => (d.shareBonus.perShare = v))} /></Field>
          <Field label="Share: tối đa"><Num value={luck.draft.shareBonus.max} step={0.05} onChange={(v) => luck.setDraft((d) => (d.shareBonus.max = v))} /></Field>
          <Field label="Share: thời gian (s)"><Num value={luck.draft.shareBonus.durationSec} onChange={(v) => luck.setDraft((d) => (d.shareBonus.durationSec = v))} /></Field>
          <Field label="Like: ngưỡng cộng đồng"><Num value={luck.draft.community.likeThreshold} onChange={(v) => luck.setDraft((d) => (d.community.likeThreshold = v))} /></Field>
          <Field label="Like: thời gian sự kiện (s)"><Num value={luck.draft.community.durationSec} onChange={(v) => luck.setDraft((d) => (d.community.durationSec = v))} /></Field>
          <Field label="Quà lạ: luck"><Num value={luck.draft.unknownGift.luck} step={0.05} onChange={(v) => luck.setDraft((d) => (d.unknownGift.luck = v))} /></Field>
          <Field label="Quà lạ: số lượt"><Num value={luck.draft.unknownGift.attempts} onChange={(v) => luck.setDraft((d) => (d.unknownGift.attempts = v))} /></Field>
          <div className="flex flex-col justify-end gap-2">
            <Toggle label="Streak quà cộng lượt" value={luck.draft.repeatExtendsAttempts} onChange={(v) => luck.setDraft((d) => (d.repeatExtendsAttempts = v))} />
            <Toggle label="Like: tất cả cùng câu" value={luck.draft.community.autoCastAll} onChange={(v) => luck.setDraft((d) => (d.community.autoCastAll = v))} />
          </div>
        </div>
      </Card>

      <DistributionPreview config={{ ...config, rarities: rar.draft, luck: luck.draft }} previewLuck={previewLuck} setPreviewLuck={setPreviewLuck} />
    </div>
  );
}

function RarityRow({ r, set }: { r: RarityConfig; set: (fn: (r: RarityConfig) => void) => void }) {
  return (
    <tr className="border-t border-slate-100">
      <td className="p-2 font-extrabold" style={{ color: r.color }}>{r.labelVi} <span className="text-xs text-slate-400">({r.id})</span></td>
      <td className="p-2"><Num value={r.baseProbability} step={0.1} onChange={(v) => set((x) => (x.baseProbability = v))} className="w-24" /></td>
      <td className="p-2"><Num value={r.luckExponent} step={0.1} onChange={(v) => set((x) => (x.luckExponent = v))} className="w-20" /></td>
      <td className="p-2"><Num value={r.maxProbability} step={0.5} onChange={(v) => set((x) => (x.maxProbability = v))} className="w-20" /></td>
      <td className="p-2">
        <div className="flex gap-1">
          <Num value={r.weightMin} step={0.1} onChange={(v) => set((x) => (x.weightMin = v))} className="w-20" />
          <Num value={r.weightMax} step={1} onChange={(v) => set((x) => (x.weightMax = v))} className="w-20" />
        </div>
      </td>
      <td className="p-2"><Num value={r.scorePerKg} onChange={(v) => set((x) => (x.scorePerKg = v))} className="w-20" /></td>
      <td className="p-2"><Toggle value={r.cameraFocus} onChange={(v) => set((x) => (x.cameraFocus = v))} /></td>
      <td className="p-2"><Toggle value={r.screenAlert} onChange={(v) => set((x) => (x.screenAlert = v))} /></td>
      <td className="p-2"><input type="color" value={r.color} onChange={(e) => set((x) => (x.color = e.target.value))} className="h-8 w-12 cursor-pointer rounded" /></td>
    </tr>
  );
}

function DistributionPreview({ config, previewLuck, setPreviewLuck }: { config: GameConfig; previewLuck: number; setPreviewLuck: (v: number) => void }) {
  const rows = useMemo(() => PREVIEW_LUCKS.map((l) => ({ luck: l, dist: computeRarityDistribution(config.rarities, { luck: Math.min(config.luck.maxLuck, l) }) })), [config]);
  const table = useMemo(() => fishProbabilityTable(config, { luck: Math.min(config.luck.maxLuck, previewLuck) }), [config, previewLuck]);
  const color = (id: string) => config.rarities.find((r) => r.id === id)?.color ?? '#999';
  return (
    <Card title="📊 Phân phối xác suất (xem trước)">
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="p-2">Luck</th>
              {RARITY_ORDER.map((r) => <th key={r} className="p-2" style={{ color: color(r) }}>{r}</th>)}
              <th className="p-2">Phân bố</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ luck, dist }) => (
              <tr key={luck} className="border-t border-slate-100">
                <td className="p-2 font-bold">x{luck}</td>
                {RARITY_ORDER.map((r) => <td key={r} className="p-2 font-mono">{pct(dist[r], 3)}</td>)}
                <td className="w-[40%] p-2">
                  <div className="flex h-4 overflow-hidden rounded-full">
                    {RARITY_ORDER.map((r) => <div key={r} style={{ width: `${dist[r] * 100}%`, background: color(r) }} />)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <span className="text-sm font-bold text-slate-600">Luck xem trước: x{previewLuck.toFixed(2)}</span>
        <input type="range" min={0.5} max={Math.max(1, config.luck.maxLuck)} step={0.05} value={previewLuck} onChange={(e) => setPreviewLuck(parseFloat(e.target.value))} className="w-80" />
      </div>
      <div className="mt-3 grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-4">
        {table.rows.map(({ fish, probability }) => (
          <div key={fish.id} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1">
            <span className="truncate font-bold" style={{ color: color(fish.rarity) }}>{fish.nameVi}</span>
            <span className="font-mono">{pct(probability, 3)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
