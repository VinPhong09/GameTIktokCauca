import { useEffect, useState } from 'react';
import type { LeaderboardCategory } from '@shared/types';
import { shortName } from '@shared/text';
import { useGameStore } from '../../services/store';
import { CatAvatar } from '../Icons';
import { CATEGORY_ICON, CATEGORY_LABEL, MEDAL, formatValue } from '../../game/leaderboard/leaderboard';
import { formatKg } from '@shared/text';

const CYCLE: LeaderboardCategory[] = ['weight', 'largest', 'count', 'rare', 'epic', 'legendary'];

/** Full leaderboard shown when a viewer comments "top". Cycles through categories. */
export default function LeaderboardPopup() {
  const popup = useGameStore((s) => s.leaderboardPopup);
  const lb = useGameStore((s) => s.leaderboard);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!popup) return;
    setI(0);
    const t = setInterval(() => setI((x) => x + 1), 3000);
    return () => clearInterval(t);
  }, [popup]);
  if (!popup) return null;
  const cats = CYCLE.filter((c) => lb[c].length > 0);
  const cat = cats.length ? cats[i % cats.length] : 'weight';
  const rows = lb[cat].slice(0, 8);

  return (
    <div className="panel animate-pop w-[860px] overflow-hidden">
      <div className="flex items-center gap-3 bg-gradient-to-r from-[#7c3aed] to-[#db2777] px-6 py-3 text-[44px] font-extrabold text-white">
        <span>{CATEGORY_ICON[cat]}</span>
        <span>BẢNG XẾP HẠNG · {CATEGORY_LABEL[cat]}</span>
      </div>
      {popup.requestedBy && <div className="bg-violet-100 px-6 py-1 text-[24px] font-bold text-violet-700">Yêu cầu bởi {popup.requestedBy}</div>}
      <div className="flex flex-col gap-2 px-5 py-4">
        {rows.length === 0 && <div className="py-8 text-center text-[34px] font-bold text-slate-500">Chưa có dữ liệu 🎣</div>}
        {rows.map((r, idx) => (
          <div key={r.playerId} className={`flex items-center gap-3 rounded-3xl px-3 py-2 ${idx < 3 ? 'bg-gradient-to-r from-amber-100 to-white' : 'bg-slate-50'}`}>
            <span className="w-[64px] text-center text-[40px] font-extrabold text-slate-600">{idx < 3 ? MEDAL[idx] : idx + 1}</span>
            <CatAvatar catId={r.catId} size={76} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[34px] font-extrabold text-slate-800">{shortName(r.nickname, 18)}</div>
              <div className="text-[22px] font-bold text-slate-500">🐟 {r.fishCount} con · ⚖️ {formatKg(r.totalWeight)}</div>
            </div>
            <span className="text-[36px] font-extrabold text-sky-700">{formatValue(cat, r.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
