import type { GiftRule, GiftTier } from '@shared/types';
import { RARITY_ORDER } from '@shared/types';
import { Btn, Card, Num, SaveBar, Select, Text, Toggle, useDraft } from './ui';

const TIERS: GiftTier[] = ['small', 'medium', 'large', 'mega'];

export function GiftsPanel() {
  const { draft, setDraft, save, revert, reset, isDirty } = useDraft('gifts');
  if (!draft) return null;
  const upd = (id: string, fn: (g: GiftRule) => void) => setDraft((l) => fn(l.find((g) => g.id === id)!));
  const add = () => setDraft((l) => l.push({ id: 'gift-' + Date.now().toString(36), giftName: 'New Gift', aliases: [], minDiamonds: 0, luck: 1.2, attempts: 3, durationSec: 180, global: false, tier: 'small', autoCast: true, rarityBoost: {}, enabled: true }));

  return (
    <Card title="🎁 Quà tặng → May mắn" actions={<><Btn onClick={add}>➕ Thêm quà</Btn><SaveBar isDirty={isDirty} save={save} revert={revert} reset={reset} /></>}>
      <p className="mb-3 text-xs text-slate-500">
        Quà tăng May mắn của người tặng trong N lượt câu (hoặc đến hết thời gian). Quà KHÔNG đảm bảo cá Huyền Thoại – chỉ tăng xác suất (có giới hạn trần).
        "Kim cương tối thiểu" dùng để khớp quà chưa có trong danh sách theo giá trị. Bật "Toàn hồ" để quà áp dụng cho mọi người chơi.
      </p>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="p-2">Tên quà / bí danh</th>
              <th className="p-2">Luck</th>
              <th className="p-2">Số lượt</th>
              <th className="p-2">Thời gian (s)</th>
              <th className="p-2">💎 tối thiểu</th>
              <th className="p-2">Cấp hiệu ứng</th>
              <th className="p-2">Tăng độ hiếm (x)</th>
              <th className="p-2">Tự câu</th>
              <th className="p-2">Toàn hồ</th>
              <th className="p-2">Bật</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {draft.map((g) => (
              <tr key={g.id} className="border-t border-slate-100 align-top">
                <td className="p-2">
                  <Text value={g.giftName} onChange={(v) => upd(g.id, (x) => (x.giftName = v))} className="mb-1 w-40 font-bold" />
                  <Text value={g.aliases.join(', ')} onChange={(v) => upd(g.id, (x) => (x.aliases = v.split(',').map((s) => s.trim()).filter(Boolean)))} placeholder="bí danh, cách nhau dấu phẩy" className="w-40 text-xs" />
                </td>
                <td className="p-2"><Num value={g.luck} step={0.05} onChange={(v) => upd(g.id, (x) => (x.luck = v))} className="w-20" /></td>
                <td className="p-2"><Num value={g.attempts} onChange={(v) => upd(g.id, (x) => (x.attempts = v))} className="w-20" /></td>
                <td className="p-2"><Num value={g.durationSec} onChange={(v) => upd(g.id, (x) => (x.durationSec = v))} className="w-20" /></td>
                <td className="p-2"><Num value={g.minDiamonds} onChange={(v) => upd(g.id, (x) => (x.minDiamonds = v))} className="w-20" /></td>
                <td className="p-2"><Select value={g.tier} onChange={(v) => upd(g.id, (x) => (x.tier = v))} options={TIERS} className="w-24" /></td>
                <td className="p-2">
                  <div className="grid grid-cols-2 gap-1">
                    {RARITY_ORDER.slice(1).map((r) => (
                      <label key={r} className="flex items-center gap-1 text-[10px] text-slate-500">
                        {r.slice(0, 4)}
                        <Num value={g.rarityBoost[r] ?? 1} step={0.1} onChange={(v) => upd(g.id, (x) => (x.rarityBoost = { ...x.rarityBoost, [r]: v }))} className="w-14 !px-1 !py-0 text-xs" />
                      </label>
                    ))}
                  </div>
                </td>
                <td className="p-2"><Toggle value={g.autoCast} onChange={(v) => upd(g.id, (x) => (x.autoCast = v))} /></td>
                <td className="p-2"><Toggle value={g.global} onChange={(v) => upd(g.id, (x) => (x.global = v))} /></td>
                <td className="p-2"><Toggle value={g.enabled} onChange={(v) => upd(g.id, (x) => (x.enabled = v))} /></td>
                <td className="p-2"><Btn kind="danger" onClick={() => setDraft((l) => l.splice(l.findIndex((x) => x.id === g.id), 1))}>✕</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
