import { useEffect, useState } from 'react';
import { GameSocket } from '../services/socket';
import { useGameStore } from '../services/store';
import { AdminToasts } from '../dashboard/ui';
import { ConnectionPanel } from '../dashboard/ConnectionPanel';
import { SimulatorPanel } from '../dashboard/SimulatorPanel';
import { PlayersPanel } from '../dashboard/PlayersPanel';
import { FishPanel } from '../dashboard/FishPanel';
import { LuckPanel } from '../dashboard/LuckPanel';
import { GiftsPanel } from '../dashboard/GiftsPanel';
import { EventsPanel } from '../dashboard/EventsPanel';
import { GameControlPanel } from '../dashboard/GameControlPanel';
import { StatsPanel } from '../dashboard/StatsPanel';
import { VoicePanel } from '../dashboard/VoicePanel';

const TABS = [
  { id: 'sim', label: '🧪 Simulator', el: <SimulatorPanel /> },
  { id: 'live', label: '🔌 Kết nối LIVE', el: <ConnectionPanel /> },
  { id: 'players', label: '🐱 Người chơi', el: <PlayersPanel /> },
  { id: 'game', label: '🎮 Điều khiển', el: <GameControlPanel /> },
  { id: 'luck', label: '🍀 May mắn & Xác suất', el: <LuckPanel /> },
  { id: 'gifts', label: '🎁 Quà tặng', el: <GiftsPanel /> },
  { id: 'fish', label: '🐟 Cá', el: <FishPanel /> },
  { id: 'events', label: '🎉 Sự kiện', el: <EventsPanel /> },
  { id: 'voice', label: '🔊 Giọng nói', el: <VoicePanel /> },
  { id: 'stats', label: '📈 Thống kê', el: <StatsPanel /> },
];

function readTab() {
  try {
    return localStorage.getItem('cfl.adminTab') ?? 'sim';
  } catch {
    return 'sim';
  }
}

/** http://localhost:3000/admin */
export default function AdminPage() {
  const [tab, setTab] = useState(readTab);
  const connected = useGameStore((s) => s.connected);
  const conn = useGameStore((s) => s.connection);
  const game = useGameStore((s) => s.game);
  const stats = useGameStore((s) => s.stats);

  useEffect(() => {
    document.title = 'Hồ Câu Cá Mèo – Admin';
    document.body.style.background = '#f1f5f9';
    const socket = new GameSocket('admin');
    const off = socket.on((m) => useGameStore.getState().apply(m));
    const offS = socket.onStatus((c) => useGameStore.getState().setConnected(c));
    socket.connect();
    return () => {
      off();
      offS();
      socket.close();
    };
  }, []);

  const select = (id: string) => {
    setTab(id);
    try {
      localStorage.setItem('cfl.adminTab', id);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800">
      <header className="sticky top-0 z-40 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-2 shadow-sm backdrop-blur">
        <span className="text-2xl">🐱🎣</span>
        <h1 className="text-xl font-extrabold">CAT FISHING LIVE · Admin</h1>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold text-white ${connected ? 'bg-emerald-500' : 'bg-rose-500'}`}>{connected ? 'Server OK' : 'Mất kết nối server'}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold">{conn?.provider ?? '—'} · {conn?.state}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold">Game: {game?.status}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold">🐟 {stats?.totalCatches ?? 0} · 🐱 {stats?.activePlayers ?? 0}</span>
        <div className="ml-auto flex gap-2 text-sm font-bold">
          <a className="rounded-lg bg-sky-600 px-3 py-1 text-white" href="/game" target="_blank" rel="noreferrer">Mở /game</a>
          <a className="rounded-lg bg-violet-600 px-3 py-1 text-white" href="/overlay" target="_blank" rel="noreferrer">Mở /overlay</a>
        </div>
      </header>
      <div className="flex">
        <nav className="sticky top-[49px] hidden h-[calc(100vh-49px)] w-56 shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-2 md:flex">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => select(t.id)} className={`rounded-xl px-3 py-2 text-left text-sm font-bold ${tab === t.id ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              {t.label}
            </button>
          ))}
        </nav>
        <main className="min-w-0 flex-1 p-4">
          <div className="mb-3 flex gap-1 overflow-x-auto md:hidden">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => select(t.id)} className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${tab === t.id ? 'bg-sky-600 text-white' : 'bg-white'}`}>
                {t.label}
              </button>
            ))}
          </div>
          {TABS.find((t) => t.id === tab)?.el ?? TABS[0].el}
        </main>
      </div>
      <AdminToasts />
    </div>
  );
}
