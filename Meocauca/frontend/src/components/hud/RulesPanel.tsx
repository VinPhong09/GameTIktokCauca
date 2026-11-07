import { useMemo } from 'react';
import { computeRarityDistribution } from '@shared/probability';
import { useGameStore } from '../../services/store';
import { pct } from '../../game/probability';
import { TOP_PANEL_HEIGHT } from './RankingPanel';

/** Short "how to play" card. The full gift list lives in the gift guide popup ("quà"). */
export default function RulesPanel() {
  const config = useGameStore((s) => s.config);
  const community = useGameStore((s) => s.community);
  const dist = useMemo(() => (config ? computeRarityDistribution(config.rarities, { luck: community?.communityLuck ?? 1 }) : null), [config, community?.communityLuck]);
  if (!config || !config.ui.showRules) return null;
  const cmd = config.game.commands.fish[0] ?? 'câu';
  const giftCmd = config.game.commands.gifts?.[0];
  const lucks = config.gifts.filter((g) => g.enabled).map((g) => g.luck);
  const minL = lucks.length ? Math.min(...lucks) : 1;
  const maxL = lucks.length ? Math.max(...lucks) : 1;

  return (
    <div className="panel flex flex-col overflow-hidden !rounded-[26px] !border-4" style={{ height: TOP_PANEL_HEIGHT }}>
      <div className="bg-gradient-to-r from-[#38bdf8] to-[#3b82f6] px-4 py-1 text-[24px] font-extrabold text-white">🎮 Cách chơi</div>
      <div className="flex flex-1 flex-col justify-center gap-0.5 px-3 py-1 text-[21px] font-bold leading-tight text-slate-700">
        <div className="rounded-lg bg-orange-100 px-2 py-0.5 text-orange-700">
          💬 <b>"{cmd}"</b> → câu cá 🎣
        </div>
        {giftCmd && (
          <div className="px-2">
            💬 <b className="text-pink-600">"{giftCmd}"</b> → xem bảng quà
          </div>
        )}
        <div className="px-2">
          🎁 Tặng quà → <span className="text-emerald-600">🍀 x{minL}–x{maxL}</span>
        </div>
        <div className="px-2">❤️ Thả tim → thử thách chung</div>
        {config.luck.joinLuck.enabled && config.luck.joinLuck.max > config.luck.joinLuck.min && (
          <div className="px-2">
            🐱 Vào hồ → <span className="text-emerald-600">🍀 x{config.luck.joinLuck.min}–x{config.luck.joinLuck.max}</span> ngẫu nhiên
          </div>
        )}
        <div className="mt-1 grid grid-cols-5 gap-0.5 text-center text-[15px] leading-tight">
          {config.rarities.map((r) => (
            <div key={r.id} className="rounded-md py-0.5 text-white" style={{ background: r.color }}>
              <div className="truncate font-extrabold">{r.labelVi}</div>
              <div>{dist ? pct(dist[r.id], 1) : r.baseProbability + '%'}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
