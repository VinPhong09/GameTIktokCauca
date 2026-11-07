import type { Rarity } from '@shared/types';
import { RARITY_ORDER } from '@shared/types';
import { useGameStore } from '../../services/store';
import { TIER_STYLE, formatDuration, formatLuck, giftEmoji } from './giftVisuals';

/**
 * Big "how gifts work" guide for viewers. Shown on a timer (config ui.giftGuide),
 * when someone comments "quà", or from the admin dashboard.
 */
export default function GiftGuidePopup() {
  const popup = useGameStore((s) => s.giftGuidePopup);
  const leaderboardOpen = useGameStore((s) => !!s.leaderboardPopup);
  const config = useGameStore((s) => s.config);
  if (!popup || !config || leaderboardOpen) return null;

  const rarities = config.rarities;
  const rarityLabel = (r: Rarity) => rarities.find((x) => x.id === r)?.labelVi ?? r;
  const rarityColor = (r: Rarity) => rarities.find((x) => x.id === r)?.color ?? '#999';
  const gifts = config.gifts.filter((g) => g.enabled).sort((a, b) => a.luck - b.luck).slice(0, 6);
  const fishCmd = config.game.commands.fish[0] ?? 'câu';
  const L = config.luck;

  return (
    <div key={popup.id} className="panel animate-pop w-[960px] overflow-hidden">
      <div className="relative bg-gradient-to-r from-[#ff5d8f] via-[#ff8a3d] to-[#ffcf33] px-6 pb-2 pt-3 text-center">
        <div className="text-stroke whitespace-nowrap text-[54px] font-extrabold leading-none text-white">🎁 TẶNG QUÀ · TĂNG MAY MẮN 🍀</div>
        <div className="mt-1 text-[30px] font-extrabold text-white text-outline">Quà càng lớn → càng dễ câu cá Hiếm & Huyền Thoại!</div>
      </div>
      {popup.requestedBy && <div className="bg-pink-50 px-6 py-1 text-[24px] font-bold text-pink-600">Theo yêu cầu của {popup.requestedBy} 💌</div>}

      <div className="flex flex-col gap-2 px-5 py-3">
        {gifts.map((g) => {
          const boosts = RARITY_ORDER.filter((r) => (g.rarityBoost[r] ?? 1) > 1);
          return (
            <div key={g.id} className="flex items-center gap-4 rounded-[26px] bg-white/80 px-3 py-2 shadow-sm">
              <div className="flex h-[96px] w-[96px] shrink-0 items-center justify-center rounded-full p-[5px]" style={{ background: TIER_STYLE[g.tier].ring }}>
                <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-[58px] leading-none">{giftEmoji(g)}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-[40px] font-extrabold leading-tight text-slate-800">{g.giftName}</span>
                  {g.minDiamonds > 0 && <span className="shrink-0 text-[24px] font-bold text-slate-400">≥{g.minDiamonds}💎</span>}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[22px] font-bold">
                  {g.global ? (
                    <span className="rounded-full bg-amber-100 px-3 text-amber-700">🌊 Cả hồ cùng hưởng</span>
                  ) : (
                    <span className="rounded-full bg-sky-100 px-3 text-sky-700">🐱 Cho mèo của bạn</span>
                  )}
                  {g.autoCast && <span className="rounded-full bg-emerald-100 px-3 text-emerald-700">🎣 Tự câu ngay</span>}
                  {g.durationSec > 0 && <span className="rounded-full bg-slate-100 px-3 text-slate-600">⏱ {formatDuration(g.durationSec)}</span>}
                  {boosts.map((r) => (
                    <span key={r} className="rounded-full px-3 text-white" style={{ background: rarityColor(r) }}>
                      {rarityLabel(r)} x{g.rarityBoost[r]}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end">
                <span className="rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-600 px-4 text-[44px] font-extrabold leading-tight text-white shadow">🍀{formatLuck(g.luck)}</span>
                {g.attempts > 0 && <span className="mt-0.5 text-[26px] font-extrabold text-slate-600">{g.attempts} lượt câu</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-2 px-5 pb-3 text-center text-[22px] font-bold leading-tight">
        <div className="rounded-2xl bg-orange-100 px-2 py-2 text-orange-700">💬 Bình luận <b>"{fishCmd}"</b><br />câu miễn phí</div>
        <div className="rounded-2xl bg-rose-100 px-2 py-2 text-rose-700">❤️ Thả tim {L.community.likeThreshold}<br />→ cả hồ cùng câu</div>
        <div className="rounded-2xl bg-indigo-100 px-2 py-2 text-indigo-700">📣 Chia sẻ LIVE<br />+{Math.round(L.shareBonus.perShare * 100)}% may mắn cả hồ</div>
      </div>
      <div className="h-[10px] bg-slate-200">
        <div className="h-full bg-gradient-to-r from-pink-500 to-amber-400" style={{ animation: `giftGuideTimer ${popup.durationSec}s linear forwards` }} />
      </div>
    </div>
  );
}
