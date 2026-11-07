import { formatKg } from '@shared/text';
import { RARITY_ORDER } from '@shared/types';
import { useGameStore } from '../services/store';
import { Card } from './ui';

function Stat({ label, value, color = 'text-slate-800' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-xs font-bold uppercase text-slate-500">{label}</div>
      <div className={`text-3xl font-extrabold ${color}`}>{value}</div>
    </div>
  );
}

export function StatsPanel() {
  const s = useGameStore((x) => x.stats);
  const rarities = useGameStore((x) => x.config?.rarities ?? []);
  const community = useGameStore((x) => x.community);
  if (!s) return null;
  const total = Math.max(1, s.totalCatches);
  return (
    <div className="flex flex-col gap-4">
      <Card title="📈 Thống kê">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <Stat label="Tổng người chơi" value={s.totalPlayers} />
          <Stat label="Đang trong hồ" value={s.activePlayers} color="text-sky-600" />
          <Stat label="Tổng cá câu được" value={s.totalCatches} color="text-cyan-600" />
          <Stat label="Tổng cân nặng" value={formatKg(s.totalWeight)} color="text-emerald-600" />
          <Stat label="Tổng quà" value={s.totalGifts} color="text-pink-600" />
          <Stat label="Tổng kim cương" value={`${s.totalDiamonds} 💎`} color="text-violet-600" />
          <Stat label="Lượt thích" value={s.totalLikes} color="text-rose-500" />
          <Stat label="Chia sẻ" value={s.totalShares} />
          <Stat label="Theo dõi" value={s.totalFollows} />
          <Stat label="Sự kiện đã xử lý" value={s.eventsProcessed} />
          <Stat label="Trùng lặp bị loại" value={s.duplicatesDropped} color="text-amber-600" />
          <Stat label="May mắn cộng đồng" value={`x${community?.communityLuck.toFixed(2) ?? '1.00'}`} color="text-emerald-600" />
        </div>
      </Card>
      <Card title="🐟 Theo độ hiếm (thực tế vs. cấu hình)">
        <div className="flex flex-col gap-2">
          {RARITY_ORDER.map((r) => {
            const cfg = rarities.find((x) => x.id === r);
            const n = s.byRarity[r];
            return (
              <div key={r} className="flex items-center gap-3">
                <span className="w-28 font-extrabold" style={{ color: cfg?.color }}>{cfg?.labelVi ?? r}</span>
                <div className="h-5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${(n / total) * 100}%`, background: cfg?.color }} />
                </div>
                <span className="w-44 text-right font-mono text-sm">{n} ({((n / total) * 100).toFixed(2)}% / cấu hình {cfg?.baseProbability}%)</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
