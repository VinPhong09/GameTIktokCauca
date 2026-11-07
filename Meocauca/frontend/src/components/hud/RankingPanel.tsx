import { useEffect, useState } from 'react';
import type { LeaderboardCategory } from '@shared/types';
import { shortName } from '@shared/text';
import { useGameStore } from '../../services/store';
import { CatAvatar } from '../Icons';
import { CATEGORY_ICON, CATEGORY_LABEL, MEDAL, formatValue } from '../../game/leaderboard/leaderboard';

const ROTATION: LeaderboardCategory[] = ['weight', 'largest', 'count'];
/** Fixed height so the camera framing never jumps when the first fish is caught. */
export const TOP_PANEL_HEIGHT = 246;

export default function RankingPanel() {
  const lb = useGameStore((s) => s.leaderboard);
  const size = useGameStore((s) => Math.min(5, s.config?.ui.rankingSize ?? 5));
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % ROTATION.length), 12000);
    return () => clearInterval(t);
  }, []);
  const cat = idx === 0 || !lb[ROTATION[idx]].length ? 'weight' : ROTATION[idx];
  const rows = lb[cat].slice(0, size);

  return (
    <div className="panel flex flex-col overflow-hidden !rounded-[26px] !border-4" style={{ height: TOP_PANEL_HEIGHT }}>
      <div className="flex items-center gap-2 bg-gradient-to-r from-[#ffcf33] to-[#ff9f1c] px-4 py-1 text-[24px] font-extrabold text-[#5a2d00]">
        <span>🏆</span>
        <span className="truncate">BXH · {CATEGORY_LABEL[cat]}</span>
        <span className="ml-auto">{CATEGORY_ICON[cat]}</span>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-0.5 px-2 py-1">
        {rows.length === 0 && (
          <div className="px-2 text-center text-[22px] font-bold leading-snug text-slate-500">
            Chưa có ai câu được cá!
            <br />
            Bình luận <b className="text-orange-500">"câu"</b> nhé 🎣
          </div>
        )}
        {rows.map((r, i) => (
          <div key={r.playerId} className={`flex h-[36px] items-center gap-1.5 rounded-xl px-1.5 ${i === 0 ? 'bg-amber-100' : i === 1 ? 'bg-slate-100' : i === 2 ? 'bg-orange-50' : ''}`}>
            <span className="w-[32px] text-center text-[22px] font-extrabold text-slate-600">{i < 3 ? MEDAL[i] : i + 1}</span>
            <CatAvatar catId={r.catId} size={30} />
            <span className="min-w-0 flex-1 truncate text-[21px] font-bold text-slate-800">{shortName(r.nickname, 12)}</span>
            <span className="text-[20px] font-extrabold text-sky-700">{formatValue(cat, r.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
