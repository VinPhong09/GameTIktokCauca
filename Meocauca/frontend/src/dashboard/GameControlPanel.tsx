import { useEffect, useState, type ReactNode } from 'react';
import type { MusicSettings, TimeOfDay } from '@shared/types';
import { ChillMusic } from '../game/audio/ChillMusic';
import { useGameStore } from '../services/store';
import { api } from '../services/api';
import { Btn, Card, Field, Num, SaveBar, Select, Text, Toggle, run, useDraft } from './ui';

export function GameControlPanel() {
  const game = useGameStore((s) => s.game);
  const autoFish = useGameStore((s) => s.config?.game.autoFishAll ?? false);
  const g = useDraft('game');
  const ui = useDraft('ui');
  const action = (a: string, label: string, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    run(api.post(`/game/${a}`), label);
  };
  if (!g.draft || !ui.draft) return null;
  const list = (v: string[]) => v.join(', ');
  const parse = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <Card title="🎮 Điều khiển">
        <div className="mb-3 text-sm font-bold text-slate-600">
          Trạng thái: <span className={game?.status === 'running' ? 'text-emerald-600' : 'text-amber-600'}>{game?.status}</span> · Phiên: {game?.sessionId} · Bắt đầu {game ? new Date(game.sessionStartedAt).toLocaleTimeString() : ''}
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn kind="success" onClick={() => action('start', 'Phiên mới')}>▶ Bắt đầu phiên câu</Btn>
          <Btn kind="warn" onClick={() => action('pause', 'Đã tạm dừng')}>⏸ Tạm dừng</Btn>
          <Btn kind="primary" onClick={() => action('resume', 'Tiếp tục')}>⏯ Tiếp tục</Btn>
          <Btn kind="danger" onClick={() => action('restart', 'Khởi động lại', 'Khởi động lại? Tất cả mèo sẽ rời hồ.')}>🔄 Khởi động lại</Btn>
          <Btn kind="danger" onClick={() => action('reset-leaderboard', 'Đã reset BXH', 'Xoá toàn bộ bảng xếp hạng?')}>🗑 Reset BXH</Btn>
          <Btn kind="violet" onClick={() => action('show-leaderboard', 'Hiện BXH')}>🏆 Hiện BXH trên màn hình</Btn>
          <Btn kind="pink" onClick={() => action('show-gift-guide', 'Đang hiện bảng quà tặng')}>🎁 Hiện bảng quà tặng</Btn>
        </div>
        <div className={`mt-3 flex flex-wrap items-center gap-3 rounded-xl border p-3 ${autoFish ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
          <Toggle
            label="🎣 Tất cả tự động câu"
            value={autoFish}
            onChange={(v) => run(api.patch('/config/game', { autoFishAll: v }), v ? 'Tất cả mèo tự động câu' : 'Đã tắt tự động câu')}
          />
          <span className="text-sm text-slate-500">
            {autoFish
              ? 'Đang bật: mọi mèo trong hồ tự câu liên tục, không cần comment "câu".'
              : 'Bật để mọi mèo trong hồ tự câu liên tục mà không cần comment.'}{' '}
            Mèo của người đã rời LIVE vẫn tự rời hồ sau thời gian không tương tác.
          </span>
        </div>
      </Card>

      <Card title="⚙️ Cài đặt trò chơi" actions={<SaveBar {...g} />}>
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Field label="Số mèo tối đa (≤60)"><Num value={g.draft.maxPlayers} onChange={(v) => g.setDraft((d) => (d.maxPlayers = v))} /></Field>
          <Field label="Hàng chờ tối đa"><Num value={g.draft.maxQueue} onChange={(v) => g.setDraft((d) => (d.maxQueue = v))} /></Field>
          <Field label="Hồi chiêu câu (s)"><Num value={g.draft.fishingCooldownSec} step={0.5} onChange={(v) => g.setDraft((d) => (d.fishingCooldownSec = v))} /></Field>
          <Field label="Chống spam lệnh (s)"><Num value={g.draft.commandCooldownSec} step={0.5} onChange={(v) => g.setDraft((d) => (d.commandCooldownSec = v))} /></Field>
          <Field label="Rời hồ khi không tương tác (phút)" hint="Comment/tim/quà/share giữ mèo ở lại. 0 = tắt"><Num value={g.draft.idleTimeoutMin} onChange={(v) => g.setDraft((d) => (d.idleTimeoutMin = v))} /></Field>
          <Field label="Tỉ lệ cá thoát (%)"><Num value={g.draft.escapeChance} onChange={(v) => g.setDraft((d) => (d.escapeChance = v))} /></Field>
          <Field label="Chờ cá cắn min (s)"><Num value={g.draft.waitMinSec} step={0.5} onChange={(v) => g.setDraft((d) => (d.waitMinSec = v))} /></Field>
          <Field label="Chờ cá cắn max (s)"><Num value={g.draft.waitMaxSec} step={0.5} onChange={(v) => g.setDraft((d) => (d.waitMaxSec = v))} /></Field>
          <Field label="Thời gian trong ngày">
            <Select<TimeOfDay> value={g.draft.timeOfDay} onChange={(v) => g.setDraft((d) => (d.timeOfDay = v))} options={[{ value: 'auto', label: 'Tự động' }, { value: 'day', label: 'Ngày' }, { value: 'sunset', label: 'Hoàng hôn' }, { value: 'night', label: 'Đêm' }]} />
          </Field>
          <Field label="Tự câu: nghỉ giữa các lượt (s)" hint="Khi bật “Tất cả tự động câu” (+0–2s ngẫu nhiên)"><Num value={g.draft.autoFishPauseSec} step={0.5} min={0} onChange={(v) => g.setDraft((d) => (d.autoFishPauseSec = v))} /></Field>
          <Field label="Chu kỳ ngày/đêm (phút)"><Num value={g.draft.dayCycleMinutes} onChange={(v) => g.setDraft((d) => (d.dayCycleMinutes = v))} /></Field>
          <div className="col-span-2 flex flex-col justify-end gap-2">
            <Toggle label="Hàng chờ khi hồ đầy" value={g.draft.queueEnabled} onChange={(v) => g.setDraft((d) => (d.queueEnabled = v))} />
            <Toggle label="Tự câu tiếp (xếp 1 lượt)" value={g.draft.autoContinue} onChange={(v) => g.setDraft((d) => (d.autoContinue = v))} />
          </div>
          <div className="col-span-2 flex flex-col justify-end gap-2">
            <Toggle label="Tự thêm mèo khi viewer vào LIVE" value={g.draft.autoJoinOnViewerJoin} onChange={(v) => g.setDraft((d) => (d.autoJoinOnViewerJoin = v))} />
            <Toggle label='Tự thêm mèo khi comment "câu"' value={g.draft.autoJoinOnComment} onChange={(v) => g.setDraft((d) => (d.autoJoinOnComment = v))} />
            <Toggle label="Xoá hết mèo khi LIVE kết thúc" value={g.draft.leaveOnLiveEnd} onChange={(v) => g.setDraft((d) => (d.leaveOnLiveEnd = v))} />
            <Toggle label="🤖 Mèo giả lập nhường chỗ cho người xem thật" value={g.draft.botsYieldToViewers} onChange={(v) => g.setDraft((d) => (d.botsYieldToViewers = v))} />
          </div>
          <Field label="Lệnh câu cá"><Text value={list(g.draft.commands.fish)} onChange={(v) => g.setDraft((d) => (d.commands.fish = parse(v)))} /></Field>
          <Field label="Lệnh tham gia"><Text value={list(g.draft.commands.join)} onChange={(v) => g.setDraft((d) => (d.commands.join = parse(v)))} /></Field>
          <Field label="Lệnh BXH"><Text value={list(g.draft.commands.top)} onChange={(v) => g.setDraft((d) => (d.commands.top = parse(v)))} /></Field>
          <Field label="Lệnh xem bảng quà"><Text value={list(g.draft.commands.gifts ?? [])} onChange={(v) => g.setDraft((d) => (d.commands.gifts = parse(v)))} /></Field>
          <Field label="Lệnh rời hồ"><Text value={list(g.draft.commands.leave ?? [])} onChange={(v) => g.setDraft((d) => (d.commands.leave = parse(v)))} /></Field>
        </div>
      </Card>

      <MusicCard music={ui.draft.music} set={(fn) => ui.setDraft((d) => fn(d.music))} saveBar={<SaveBar {...ui} />} />

      <Card title="📱 Giao diện 9:16, camera & vùng an toàn TikTok" actions={<SaveBar {...ui} />}>
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Field label="Tiêu đề"><Text value={ui.draft.title} onChange={(v) => ui.setDraft((d) => (d.title = v))} /></Field>
          <Field label="Safe top (px)"><Num value={ui.draft.safeZone.top} onChange={(v) => ui.setDraft((d) => (d.safeZone.top = v))} /></Field>
          <Field label="Safe bottom (px)"><Num value={ui.draft.safeZone.bottom} onChange={(v) => ui.setDraft((d) => (d.safeZone.bottom = v))} /></Field>
          <Field label="Safe left (px)"><Num value={ui.draft.safeZone.left} onChange={(v) => ui.setDraft((d) => (d.safeZone.left = v))} /></Field>
          <Field label="Safe right (px)"><Num value={ui.draft.safeZone.right} onChange={(v) => ui.setDraft((d) => (d.safeZone.right = v))} /></Field>
          <Field label="Số dòng BXH"><Num value={ui.draft.rankingSize} onChange={(v) => ui.setDraft((d) => (d.rankingSize = v))} /></Field>
          <Field label="Thông báo (s)"><Num value={ui.draft.notificationSec} step={0.5} onChange={(v) => ui.setDraft((d) => (d.notificationSec = v))} /></Field>
          <Field label="Camera FOV"><Num value={ui.draft.camera.fov} onChange={(v) => ui.setDraft((d) => (d.camera.fov = v))} /></Field>
          <Field label="Góc nhìn (độ)" hint="Camera tự canh vừa hồ giữa các bảng"><Num value={ui.draft.camera.elevationDeg} onChange={(v) => ui.setDraft((d) => (d.camera.elevationDeg = v))} /></Field>
          <Field label="Zoom"><Num value={ui.draft.camera.zoom} step={0.05} onChange={(v) => ui.setDraft((d) => (d.camera.zoom = v))} /></Field>
          <Field label="Dịch tâm (Z)" hint="Mặc định 0"><Num value={ui.draft.camera.offsetZ} step={0.5} onChange={(v) => ui.setDraft((d) => (d.camera.offsetZ = v))} /></Field>
          <Field label="FPS tối đa">
            <Select value={String(ui.draft.fpsCap) as '30' | '60'} onChange={(v) => ui.setDraft((d) => (d.fpsCap = Number(v) as 30 | 60))} options={['60', '30']} />
          </Field>
          <Field label="Chất lượng">
            <Select value={ui.draft.quality} onChange={(v) => ui.setDraft((d) => (d.quality = v))} options={['high', 'medium', 'low']} />
          </Field>
          <Field label="Bảng quà: lặp lại mỗi (giây)" hint="0 = chỉ khi có lệnh"><Num value={ui.draft.giftGuide.intervalSec} onChange={(v) => ui.setDraft((d) => (d.giftGuide.intervalSec = v))} /></Field>
          <Field label="Bảng quà: hiển thị (giây)"><Num value={ui.draft.giftGuide.durationSec} onChange={(v) => ui.setDraft((d) => (d.giftGuide.durationSec = v))} /></Field>
          <Field label="Chúc mừng mèo mới (giây)" hint="Camera dừng ở mèo mới bao lâu (1–15)"><Num value={ui.draft.camera.welcomeSec} step={0.5} min={1} max={15} onChange={(v) => ui.setDraft((d) => (d.camera.welcomeSec = v))} /></Field>
          <Field label="Bảng quà: lần đầu sau (giây)"><Num value={ui.draft.giftGuide.firstDelaySec} onChange={(v) => ui.setDraft((d) => (d.giftGuide.firstDelaySec = v))} /></Field>
          <div className="col-span-3 flex flex-wrap items-end gap-4 pb-1">
            <Toggle label="Tự hiện bảng quà tặng" value={ui.draft.giftGuide.enabled} onChange={(v) => ui.setDraft((d) => (d.giftGuide.enabled = v))} />
            <Toggle label="Hiện vùng an toàn" value={ui.draft.showSafeZone} onChange={(v) => ui.setDraft((d) => (d.showSafeZone = v))} />
            <Toggle label="Hiện luật chơi" value={ui.draft.showRules} onChange={(v) => ui.setDraft((d) => (d.showRules = v))} />
            <Toggle label="Camera focus cá hiếm" value={ui.draft.camera.focusEnabled} onChange={(v) => ui.setDraft((d) => (d.camera.focusEnabled = v))} />
            <Toggle label="Camera chúc mừng mèo mới vào hồ" value={ui.draft.camera.welcomeFocus} onChange={(v) => ui.setDraft((d) => (d.camera.welcomeFocus = v))} />
          </div>
        </div>
      </Card>
    </div>
  );
}

/** Background music settings + a local preview that plays in this admin tab only. */
function MusicCard({ music, set, saveBar }: { music: MusicSettings; set: (fn: (m: MusicSettings) => void) => void; saveBar: ReactNode }) {
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    ChillMusic.get().setOptions({ volume: music.volume / 100, bpm: music.bpm, ambience: music.ambience });
  }, [music.volume, music.bpm, music.ambience]);
  useEffect(() => () => ChillMusic.get().stop(), []);
  const toggle = () => {
    const m = ChillMusic.get();
    if (preview) m.stop();
    else {
      m.start();
      m.unlock();
    }
    setPreview(!preview);
  };
  return (
    <Card title="🎵 Nhạc nền (lo-fi chill, không bản quyền)" actions={saveBar}>
      <p className="mb-3 text-sm text-slate-500">
        Nhạc được <b>tạo trực tiếp bằng code</b> trong trình duyệt (piano điện, pad, bass, trống nhẹ, kalimba, tiếng đĩa than + nước hồ) –
        không dùng file nhạc nào nên 100% không vi phạm bản quyền. Giai điệu, hợp âm và tông tự thay đổi liên tục. Phát trên trang <b>/game</b> và <b>/overlay</b>
        (thêm <code>?music=0</code> vào URL để tắt nhạc ở một trang, ví dụ khi mở cả hai). Trên trang game, phím <b>M</b> để tắt/bật tiếng tạm thời.
      </p>
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Field label={`Âm lượng: ${music.volume}%`}>
          <input type="range" min={0} max={100} value={music.volume} onChange={(e) => set((m) => (m.volume = Number(e.target.value)))} />
        </Field>
        <Field label="Nhịp (BPM)" hint="55–100, mặc định 72"><Num value={music.bpm} min={55} max={100} onChange={(v) => set((m) => (m.bpm = v))} /></Field>
        <div className="col-span-3 flex flex-wrap items-end gap-4 pb-1">
          <Toggle label="Bật nhạc nền" value={music.enabled} onChange={(v) => set((m) => (m.enabled = v))} />
          <Toggle label="Tiếng đĩa than + nước hồ" value={music.ambience} onChange={(v) => set((m) => (m.ambience = v))} />
          <Toggle label="Chuông khi câu cá hiếm" value={music.catchChimes} onChange={(v) => set((m) => (m.catchChimes = v))} />
        </div>
        <div className="flex items-end gap-2 pb-1">
          <Btn kind={preview ? 'warn' : 'success'} onClick={toggle}>{preview ? '⏹ Dừng nghe thử' : '▶ Nghe thử'}</Btn>
          {preview && <Btn kind="violet" onClick={() => ChillMusic.get().chime('legendary')}>✨ Thử chuông</Btn>}
        </div>
      </div>
    </Card>
  );
}
