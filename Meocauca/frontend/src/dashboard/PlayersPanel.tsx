import { useState } from 'react';
import type { PlayerDTO } from '@shared/types';
import { formatKg } from '@shared/text';
import { useGameStore } from '../services/store';
import { api } from '../services/api';
import { CatAvatar } from '../components/Icons';
import { Btn, Card, run } from './ui';

export function PlayersPanel() {
  const players = useGameStore((s) => s.players);
  const config = useGameStore((s) => s.config);
  const queue = useGameStore((s) => s.game?.queue ?? []);
  const [q, setQ] = useState('');
  const list = Object.values(players)
    .filter((p) => !q || p.nickname.toLowerCase().includes(q.toLowerCase()) || p.uniqueId.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.seat ?? 999) - (b.seat ?? 999));

  return (
    <div className="flex flex-col gap-4">
      <Card
        title={`🐱 Mèo đang hoạt động (${list.filter((p) => p.seat !== null).length}/${config?.game.maxPlayers ?? 0}) · Hàng chờ ${queue.length}`}
        actions={<input className="admin-input w-56" placeholder="Tìm tên…" value={q} onChange={(e) => setQ(e.target.value)} />}
      >
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="p-2">Ghế</th>
                <th className="p-2">Người chơi</th>
                <th className="p-2">Ngoại hình mèo</th>
                <th className="p-2">Trạng thái</th>
                <th className="p-2">May mắn</th>
                <th className="p-2">Cá</th>
                <th className="p-2">Tổng kg</th>
                <th className="p-2">Lớn nhất</th>
                <th className="p-2">Hiếm/Sử thi/HT</th>
                <th className="p-2">Quà</th>
                <th className="p-2">Hạng</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="p-2 font-bold">{p.seat ?? `⏳${queue.indexOf(p.id) + 1}`}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <CatAvatar catId={p.catId} size={36} />
                      <div>
                        <div className="font-bold text-slate-800">
                          {p.bot && <span title="Người xem giả lập (Simulator) – nhường chỗ cho người xem thật" className="mr-1 rounded bg-slate-100 px-1 text-xs">🤖</span>}
                          {p.nickname}
                        </div>
                        <div className="text-xs text-slate-400">@{p.uniqueId}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-2">
                    <select className="admin-input w-40" value={p.catId} onChange={(e) => run(api.post(`/players/${encodeURIComponent(p.id)}/appearance`, { catId: e.target.value }), 'Đã đổi mèo')}>
                      {config?.cats.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} · {c.breed}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${p.status === 'fishing' ? 'bg-sky-100 text-sky-700' : p.status === 'queued' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{p.status}</span>
                  </td>
                  <td className="p-2"><LuckCell p={p} /></td>
                  <td className="p-2">{p.stats.fishCount}</td>
                  <td className="p-2">{formatKg(p.stats.totalWeight)}</td>
                  <td className="p-2">{formatKg(p.stats.largestWeight)}</td>
                  <td className="p-2">{p.stats.rareCount}/{p.stats.epicCount}/{p.stats.legendaryCount}</td>
                  <td className="p-2">{p.stats.totalGifts} ({p.stats.totalDiamonds}💎)</td>
                  <td className="p-2">{p.rank || '—'}</td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      <Btn kind="ghost" title="Câu ngay" onClick={() => run(api.post(`/players/${encodeURIComponent(p.id)}/cast`))}>🎣</Btn>
                      <Btn kind="warn" title="Reset thống kê" onClick={() => confirm(`Reset thống kê của ${p.nickname}?`) && run(api.post(`/players/${encodeURIComponent(p.id)}/reset`), 'Đã reset')}>↺</Btn>
                      <Btn kind="danger" title="Xoá khỏi hồ" onClick={() => run(api.del(`/players/${encodeURIComponent(p.id)}`), 'Đã xoá khỏi hồ')}>✕</Btn>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={12} className="p-6 text-center text-slate-400">Chưa có mèo nào. Dùng Simulator hoặc kết nối LIVE.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

const SOURCE_LABEL: Record<PlayerDTO['personalLuckSource'], { text: string; cls: string; title: string }> = {
  random: { text: '🎲', cls: 'bg-slate-100 text-slate-600', title: 'Ngẫu nhiên khi vào hồ' },
  admin: { text: '✋', cls: 'bg-sky-100 text-sky-700', title: 'Admin đặt – chỉ lượt này (hết khi mèo rời hồ)' },
  fixed: { text: '📌', cls: 'bg-violet-100 text-violet-700', title: 'Admin đặt – cố định, áp dụng mọi lần vào hồ' },
};

/** Effective luck + personal luck, with an inline editor to set any cat's luck. */
function LuckCell({ p }: { p: PlayerDTO }) {
  const maxLuck = useGameStore((s) => s.config?.luck.maxLuck ?? 5);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(p.personalLuck);
  const [persist, setPersist] = useState(p.personalLuckSource === 'fixed');
  const src = SOURCE_LABEL[p.personalLuckSource] ?? SOURCE_LABEL.random;
  const url = `/players/${encodeURIComponent(p.id)}/luck`;
  const save = async () => {
    if (!(value > 0)) return;
    await run(api.post(url, { luck: value, persist }), persist ? `Đã đặt cố định x${value} cho ${p.nickname}` : `Đã đặt x${value} cho ${p.nickname}`);
    setOpen(false);
  };
  const clear = async () => {
    await run(api.post(url, { luck: null }), `${p.nickname}: trở về luck ngẫu nhiên`);
    setOpen(false);
  };

  if (!open) {
    return (
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <span className="font-bold text-emerald-600" title="May mắn hiện tại (đã gồm quà, share, sự kiện)">x{p.luck.toFixed(2)}</span>
        {p.boostAttempts ? <span className="text-xs text-slate-400">({p.boostAttempts})</span> : null}
        <button
          type="button"
          title={`Luck riêng: x${p.personalLuck.toFixed(2)} · ${src.title}. Bấm để đặt.`}
          className={`rounded-full px-2 py-0.5 text-xs font-bold hover:ring-2 hover:ring-emerald-300 ${src.cls}`}
          onClick={() => {
            setValue(p.personalLuck);
            setPersist(p.personalLuckSource === 'fixed');
            setOpen(true);
          }}
        >
          {src.text} x{p.personalLuck.toFixed(2)} ✎
        </button>
      </div>
    );
  }
  return (
    <div className="flex min-w-[250px] flex-col gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 p-2">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-bold text-slate-600">Luck riêng x</span>
        <input
          type="number"
          className="admin-input w-20"
          step={0.1}
          min={0.1}
          value={value}
          autoFocus
          onChange={(e) => setValue(parseFloat(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save();
            if (e.key === 'Escape') setOpen(false);
          }}
        />
        {[1, 1.5, 2, 3].map((v) => (
          <button key={v} type="button" className="rounded bg-white px-1.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200" onClick={() => setValue(v)}>
            {v}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-1.5 text-xs text-slate-600">
        <input type="checkbox" checked={persist} onChange={(e) => setPersist(e.target.checked)} />
        📌 Cố định (lưu lại, áp dụng mọi lần vào hồ)
      </label>
      {value * 1 > maxLuck && <div className="text-xs text-amber-600">Tổng may mắn vẫn bị giới hạn bởi Max Luck = x{maxLuck}.</div>}
      <div className="flex gap-1">
        <Btn kind="success" onClick={save}>Lưu</Btn>
        <Btn kind="ghost" title="Bỏ luck do admin đặt, quay về luck ngẫu nhiên" onClick={clear}>🎲 Ngẫu nhiên</Btn>
        <Btn kind="ghost" onClick={() => setOpen(false)}>Huỷ</Btn>
      </div>
    </div>
  );
}
