import { useState } from 'react';
import type { LiveEventType } from '@shared/types';
import { useGameStore } from '../services/store';
import { api } from '../services/api';
import { Btn, Card, Field, Num, Select, Text, Toggle, run } from './ui';
import { AutoAudienceCard } from './AutoAudienceCard';

interface SimUser {
  userId: string;
  uniqueId: string;
  nickname: string;
}

const GIFTS = [
  { label: '🌹 Rose', name: 'Rose', diamonds: 1 },
  { label: '🫰 Finger Heart', name: 'Finger Heart', diamonds: 5 },
  { label: '🍩 Doughnut', name: 'Doughnut', diamonds: 30 },
  { label: '🫶 Hand Heart', name: 'Hand Heart', diamonds: 100 },
  { label: '🎁 Large Gift (Galaxy)', name: 'Galaxy', diamonds: 1000 },
];

export function SimulatorPanel() {
  const players = useGameStore((s) => s.players);
  const list = Object.values(players);
  const [target, setTarget] = useState<string>('new');
  const [nick, setNick] = useState('');
  const [comment, setComment] = useState('câu');
  const [repeat, setRepeat] = useState(1);
  const [showPreview, setShowPreview] = useState(true);

  const user = (): SimUser | undefined => {
    if (target === 'new') {
      if (!nick.trim()) return undefined;
      const id = 'mock_' + nick.trim().toLowerCase().replace(/\s+/g, '_');
      return { userId: id, uniqueId: id, nickname: nick.trim() };
    }
    const p = players[target];
    return p ? { userId: p.id, uniqueId: p.uniqueId, nickname: p.nickname } : undefined;
  };

  const send = (type: LiveEventType, extra: Record<string, unknown> = {}) => run(api.post('/mock/event', { type, user: user(), ...extra }));

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-4">
        <Card title="🧪 Mock TikTok LIVE Simulator">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Người xem">
              <Select
                value={target}
                onChange={setTarget}
                options={[{ value: 'new', label: '➕ Người xem mới / tên tự đặt' }, ...list.map((p) => ({ value: p.id, label: `${p.nickname}${p.seat === null ? ' (chờ)' : ''}` }))]}
              />
            </Field>
            {target === 'new' && (
              <Field label="Tên (trống = ngẫu nhiên)">
                <Text value={nick} onChange={setNick} placeholder="Mèo Câu Thủ" />
              </Field>
            )}
            <Field label="Số lượng quà (streak)">
              <Num value={repeat} min={1} max={99} onChange={(v) => setRepeat(Math.max(1, Math.round(v)))} />
            </Field>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Btn kind="success" onClick={() => send('VIEWER_JOIN')}>👀 Viewer mới</Btn>
            <Btn kind="pink" onClick={() => send('FOLLOW')}>💖 Follow</Btn>
            <Btn kind="primary" onClick={() => send('COMMENT', { comment: 'câu' })}>🎣 Comment "câu"</Btn>
            <Btn kind="primary" onClick={() => send('COMMENT', { comment: 'join' })}>🐱 Comment "join"</Btn>
            <Btn kind="violet" onClick={() => send('COMMENT', { comment: 'top' })}>🏆 Comment "top"</Btn>
            <Btn kind="pink" onClick={() => send('COMMENT', { comment: 'quà' })}>🎁 Comment "quà"</Btn>
            <Btn kind="warn" onClick={() => send('LIKE', { likeCount: 50 })}>❤️ Like x50</Btn>
            <Btn kind="warn" onClick={() => send('LIKE', { likeCount: 500 })}>❤️ Like x500</Btn>
            <Btn kind="ghost" onClick={() => send('SHARE')}>📣 Share</Btn>
            <Btn kind="danger" disabled={target === 'new'} title="Chọn một người xem đang ở hồ" onClick={() => send('VIEWER_LEAVE')}>👋 Rời LIVE</Btn>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {GIFTS.map((g) => (
              <Btn key={g.name} kind="pink" onClick={() => send('GIFT', { giftName: g.name, diamonds: g.diamonds, repeatCount: repeat })}>
                {g.label}
              </Btn>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <Field label="Bình luận tuỳ ý">
              <Text value={comment} onChange={setComment} className="w-64" />
            </Field>
            <Btn onClick={() => send('COMMENT', { comment })}>💬 Gửi</Btn>
            <Btn kind="ghost" onClick={() => send('LIVE_START')}>LIVE_START</Btn>
            <Btn kind="ghost" onClick={() => send('LIVE_END')}>LIVE_END</Btn>
            <Btn kind="ghost" title="Gửi 2 lần cùng event id để kiểm tra chống trùng" onClick={() => {
              const id = 'dup_' + Date.now();
              send('FOLLOW', { id });
              setTimeout(() => send('FOLLOW', { id }), 100);
            }}>🔁 Test duplicate</Btn>
          </div>
        </Card>

        <AutoAudienceCard />

        <Card title="⚡ Thêm nhanh">
          <div className="flex flex-wrap items-end gap-3">
            <Btn kind="success" onClick={() => run(api.post('/mock/spawn', { count: 10 }), '+10 mèo')}>+10 mèo câu cá</Btn>
            <Btn kind="success" onClick={() => run(api.post('/mock/spawn', { count: 30 }), '+30 mèo')}>+30 mèo</Btn>
            <Btn kind="primary" onClick={() => run(api.post('/game/cast-all'), 'Tất cả cùng câu!')}>🎣 Tất cả cùng câu</Btn>
          </div>
        </Card>
      </div>
      <Card title="📺 Xem trước" actions={<Toggle value={showPreview} onChange={setShowPreview} />}>
        {showPreview ? (
          <div className="relative mx-auto aspect-[9/16] w-full max-w-[340px] overflow-hidden rounded-xl bg-slate-900">
            <iframe title="preview" src="/game?quality=medium&music=0&voice=0" className="absolute inset-0 h-full w-full border-0" />
          </div>
        ) : (
          <p className="text-sm text-slate-500">Bật để xem trực tiếp trò chơi.</p>
        )}
      </Card>
    </div>
  );
}
