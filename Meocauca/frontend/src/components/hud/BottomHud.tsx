import { useGameStore } from '../../services/store';

const FEED_ICON: Record<string, string> = {
  catch: '🐟', rare: '💎', epic: '✨', legendary: '🌟', gift: '🎁', join: '🐱', follow: '💖', share: '📣', event: '🎉', info: 'ℹ️', fail: '💨', queue: '⏳', leave: '👋',
};

/** Slim bottom bar: community energy + the two latest events. */
export default function BottomHud() {
  const community = useGameStore((s) => s.community);
  const feed = useGameStore((s) => s.feed);
  const energy = community ? Math.min(1, community.likeEnergy / Math.max(1, community.likeThreshold)) : 0;
  const luck = community?.communityLuck ?? 1;

  return (
    <div className="panel-dark flex w-full flex-col gap-1 !rounded-[24px] px-4 py-2">
      <div className="flex items-center gap-3">
        <span className="text-[26px]">❤️</span>
        <div className="relative h-[30px] flex-1 overflow-hidden rounded-full border-[3px] border-white/70 bg-slate-900/50">
          <div className="h-full rounded-full bg-gradient-to-r from-pink-500 via-rose-400 to-amber-300 transition-[width] duration-500" style={{ width: `${energy * 100}%` }} />
          <div className="absolute inset-0 flex items-center justify-center text-[19px] font-extrabold text-white text-outline">
            {community ? `${Math.floor(community.likeEnergy)} / ${community.likeThreshold} ❤ → Thử thách cộng đồng` : '…'}
          </div>
        </div>
        <span className="whitespace-nowrap rounded-full bg-amber-300/90 px-3 text-[21px] font-extrabold text-amber-950">🍀 x{luck.toFixed(2)}</span>
      </div>
      <div className="flex flex-col">
        {feed.slice(0, 2).map((n) => (
          <div key={n.id} className="truncate text-[20px] font-bold leading-snug text-white/95">
            {FEED_ICON[n.kind] ?? '•'} {n.message}
          </div>
        ))}
        {feed.length === 0 && <div className="text-[20px] font-bold leading-snug text-white/70">Chờ sự kiện đầu tiên… 🎣</div>}
      </div>
    </div>
  );
}
