import { useEffect, useState } from 'react';
import { useGameStore } from '../../services/store';

function useNow(interval = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}

/** Compact title + one row of status chips (keeps the top of the stage free for the pond). */
export default function Header() {
  const title = useGameStore((s) => s.config?.ui.title ?? 'HỒ CÂU CÁ MÈO');
  const connection = useGameStore((s) => s.connection);
  const connected = useGameStore((s) => s.connected);
  const players = useGameStore((s) => Object.values(s.players).filter((p) => p.seat !== null).length);
  const max = useGameStore((s) => s.config?.game.maxPlayers ?? 40);
  const queue = useGameStore((s) => s.game?.queue.length ?? 0);
  const catches = useGameStore((s) => s.stats?.totalCatches ?? 0);
  const legendary = useGameStore((s) => s.stats?.byRarity.legendary ?? 0);
  const events = useGameStore((s) => s.events);
  const paused = useGameStore((s) => s.game?.status === 'paused');
  const autoFish = useGameStore((s) => s.config?.game.autoFishAll ?? false);
  const now = useNow();
  const ev = events.find((e) => e.endsAt > now);

  const live = connected && connection?.state === 'connected';
  const provider = connection?.provider === 'mock' ? 'MOCK' : connection?.provider === 'tiktok' ? 'LIVE' : connection?.provider === 'baltik' ? 'BRIDGE' : 'OFFLINE';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-3 rounded-[32px] border-[5px] border-white/90 bg-gradient-to-b from-[#ffb347] to-[#ff7b29] px-8 py-0.5 shadow-[0_7px_0_rgba(120,50,0,0.35),0_14px_28px_rgba(0,0,0,0.25)]">
        <span className="text-[46px] leading-none drop-shadow">🐱</span>
        <h1 className="text-[56px] font-extrabold leading-[1.1] tracking-wide text-[#fff6d6]" style={{ WebkitTextStroke: '5px #5a2d0c', paintOrder: 'stroke fill' }}>
          {title}
        </h1>
        <span className="text-[46px] leading-none drop-shadow">🎣</span>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 text-[24px] font-bold">
        <span className={`flex items-center gap-2 rounded-full px-4 py-0.5 text-white shadow ${live ? (provider === 'MOCK' ? 'bg-violet-500' : 'bg-rose-500') : 'bg-slate-500'}`}>
          <span className={`inline-block h-3 w-3 rounded-full bg-white ${live ? 'animate-pulse' : 'opacity-50'}`} />
          {live ? provider : 'OFFLINE'}
        </span>
        <span className="rounded-full bg-white/90 px-4 py-0.5 text-slate-800 shadow">
          🐾 {players}/{max}
          {queue > 0 ? ` · ⏳ ${queue}` : ''}
        </span>
        <span className="rounded-full bg-white/90 px-4 py-0.5 text-slate-800 shadow">🐟 {catches}</span>
        {legendary > 0 && <span className="rounded-full bg-amber-300 px-4 py-0.5 text-amber-950 shadow">🌟 {legendary}</span>}
        {autoFish && <span className="rounded-full bg-emerald-400 px-4 py-0.5 text-emerald-950 shadow">🎣 Tự câu</span>}
        {paused && <span className="rounded-full bg-amber-400 px-4 py-0.5 text-amber-950 shadow">⏸ Tạm dừng</span>}
        {ev && (
          <span className="animate-pop rounded-full px-4 py-0.5 text-white shadow" style={{ background: ev.color }}>
            🎉 {ev.nameVi} · {Math.max(0, Math.ceil((ev.endsAt - now) / 1000))}s
          </span>
        )}
      </div>
    </div>
  );
}
