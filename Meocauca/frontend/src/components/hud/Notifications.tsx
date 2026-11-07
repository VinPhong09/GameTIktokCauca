import { useEffect } from 'react';
import type { NotificationDTO } from '@shared/types';
import { useGameStore } from '../../services/store';
import { CatAvatar, FishIcon } from '../Icons';

const KIND_STYLE: Record<string, string> = {
  catch: 'from-sky-500 to-cyan-500',
  rare: 'from-sky-500 to-blue-700',
  epic: 'from-fuchsia-500 to-purple-700',
  legendary: 'from-amber-400 to-orange-600',
  gift: 'from-pink-500 to-rose-500',
  join: 'from-emerald-500 to-green-600',
  follow: 'from-rose-400 to-pink-600',
  share: 'from-indigo-500 to-violet-600',
  leave: 'from-slate-500 to-slate-600',
  event: 'from-amber-400 to-yellow-500',
  info: 'from-slate-600 to-slate-700',
  fail: 'from-slate-500 to-slate-600',
  queue: 'from-slate-500 to-slate-600',
};

function Toast({ n }: { n: NotificationDTO }) {
  const fish = useGameStore((s) => (n.fishId ? s.config?.fish.find((f) => f.id === n.fishId) : undefined));
  return (
    <div className={`animate-slideDown flex w-[600px] items-center gap-2 rounded-[22px] border-[3px] border-white/90 bg-gradient-to-r px-3 py-1 text-white shadow-[0_8px_18px_rgba(0,0,0,0.3)] ${KIND_STYLE[n.kind] ?? KIND_STYLE.info}`}>
      {fish ? <FishIcon fish={fish} size={52} /> : n.catId ? <CatAvatar catId={n.catId} size={46} className="border-[3px] border-white/80" /> : null}
      <div className="min-w-0 flex-1">
        <div className="text-[23px] font-extrabold leading-tight">{n.title}</div>
        <div className="truncate text-[20px] font-bold leading-tight opacity-95">{n.message}</div>
      </div>
    </div>
  );
}

/** Big center banner for Epic / Legendary catches and fishing events. */
function Banner({ n }: { n: NotificationDTO }) {
  const fish = useGameStore((s) => (n.fishId ? s.config?.fish.find((f) => f.id === n.fishId) : undefined));
  const legendary = n.kind === 'legendary';
  return (
    <div className="animate-pop flex flex-col items-center">
      <div
        className={`relative flex w-[1000px] flex-col items-center overflow-hidden rounded-[44px] border-[8px] px-6 py-3 text-center shadow-[0_0_80px_rgba(255,200,0,0.6)] ${legendary ? 'border-yellow-200' : 'border-white/90'}`}
        style={{
          background: legendary
            ? 'linear-gradient(135deg,#ff9a00,#ffd23f 30%,#ff6fd8 60%,#7d5fff 85%,#00d2ff)'
            : n.kind === 'epic'
              ? 'linear-gradient(135deg,#a855f7,#ec4899)'
              : `linear-gradient(135deg, ${n.color ?? '#f59e0b'}, #f97316)`,
        }}
      >
        {legendary && <div className="pointer-events-none absolute inset-0 animate-pulse bg-[radial-gradient(circle,rgba(255,255,255,0.45),transparent_60%)]" />}
        <div className={`relative whitespace-nowrap font-extrabold leading-none text-white text-outline ${legendary ? 'text-[72px]' : 'text-[60px]'}`}>{n.title}</div>
        <div className="relative mt-1 flex items-center gap-4">
          {fish && <FishIcon fish={fish} size={legendary ? 150 : 120} className="animate-floaty drop-shadow-[0_6px_10px_rgba(0,0,0,0.35)]" />}
          <div className="text-left text-[38px] font-extrabold leading-tight text-white text-outline">{n.message}</div>
        </div>
      </div>
    </div>
  );
}

export function NotificationsLayer() {
  const toasts = useGameStore((s) => s.toasts);
  const dismiss = useGameStore((s) => s.dismissExpired);
  useEffect(() => {
    const t = setInterval(() => dismiss(Date.now()), 250);
    return () => clearInterval(t);
  }, [dismiss]);
  return (
    <div className="flex flex-col items-center gap-1.5">
      {toasts.map((t) => (
        <Toast key={t.id} n={t} />
      ))}
    </div>
  );
}

export function BannerLayer() {
  const banner = useGameStore((s) => s.banner);
  if (!banner) return null;
  return <Banner key={banner.id} n={banner} />;
}
