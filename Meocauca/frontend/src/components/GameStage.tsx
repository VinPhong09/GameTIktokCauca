import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PondScene } from '../game/scenes/PondScene';
import { GameSocket } from '../services/socket';
import { useGameStore } from '../services/store';
import Header from './hud/Header';
import RankingPanel from './hud/RankingPanel';
import RulesPanel from './hud/RulesPanel';
import { BannerLayer, NotificationsLayer } from './hud/Notifications';
import BottomHud from './hud/BottomHud';
import LeaderboardPopup from './hud/LeaderboardPopup';
import GiftGuidePopup from './hud/GiftGuidePopup';
import BackgroundMusic from './BackgroundMusic';
import { ChillMusic } from '../game/audio/ChillMusic';
import { VoicePlayer } from '../game/audio/VoicePlayer';

export const STAGE_W = 1080;
export const STAGE_H = 1920;

interface Props {
  mode: 'game' | 'overlay';
  transparent?: boolean;
  /** Overlay: render at native 1080x1920 without fitting to the window. */
  fixedScale?: boolean;
  hud?: boolean;
}

/** 1080×1920 TikTok stage: Three.js canvas + HUD, scaled to fit the window. */
export default function GameStage({ mode, transparent, fixedScale, hud = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<PondScene | null>(null);
  const [scale, setScale] = useState(1);
  const safe = useGameStore((s) => s.config?.ui.safeZone ?? { top: 110, bottom: 330, left: 24, right: 24 });
  const showSafe = useGameStore((s) => s.config?.ui.showSafeZone ?? false);
  const quality = useGameStore((s) => s.config?.ui.quality);
  const connected = useGameStore((s) => s.connected);
  const showRules = useGameStore((s) => s.config?.ui.showRules ?? true);
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  /** Free area (stage px) between the top HUD and the bottom HUD – the camera fits the pond into it. */
  const [band, setBand] = useState({ top: 0, bottom: STAGE_H });

  // Fit the 9:16 stage into the window.
  useEffect(() => {
    const fit = () => {
      const s = fixedScale ? 1 : Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
      setScale(s);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [fixedScale]);

  // 3D scene + socket lifecycle (scene is created once; players are added incrementally).
  useEffect(() => {
    const canvas = canvasRef.current!;
    const q = new URLSearchParams(location.search).get('quality') as 'low' | 'medium' | 'high' | null;
    const scene = new PondScene(canvas, { overlay: mode === 'overlay', transparent, quality: q ?? 'high' });
    sceneRef.current = scene;
    (window as unknown as { __pond?: PondScene }).__pond = scene;
    (window as unknown as { __music?: ChillMusic }).__music = ChillMusic.get();
    const voiceAllowed = new URLSearchParams(location.search).get('voice') !== '0';
    const socket = new GameSocket(mode);
    const store = useGameStore.getState();
    const off = socket.on((msg) => {
      store.apply(msg);
      scene.handle(msg);
      if (msg.type === 'catch_result' && useGameStore.getState().config?.ui.music?.catchChimes) ChillMusic.get().chime(msg.result.rarity);
      if (msg.type === 'speak' && voiceAllowed) VoicePlayer.get().enqueue(msg.speech);
    });
    const offStatus = socket.onStatus((c) => useGameStore.getState().setConnected(c));
    socket.connect();
    return () => {
      off();
      offStatus();
      socket.close();
      scene.dispose();
      sceneRef.current = null;
    };
  }, [mode, transparent]);

  // Measure the HUD so the 3D pond is framed in the space left between top and bottom panels.
  useLayoutEffect(() => {
    const measure = () => {
      const t = hud && topRef.current ? topRef.current.offsetTop + topRef.current.offsetHeight + 6 : 12;
      const b = hud && bottomRef.current ? bottomRef.current.offsetTop - 6 : STAGE_H - 12;
      setBand((cur) => (cur.top === t && cur.bottom === b ? cur : { top: t, bottom: b }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (topRef.current) ro.observe(topRef.current);
    if (bottomRef.current) ro.observe(bottomRef.current);
    return () => ro.disconnect();
  }, [hud, safe.top, safe.bottom, safe.left, safe.right]);

  useEffect(() => {
    sceneRef.current?.cameraDirector.setBand(band.top / STAGE_H, band.bottom / STAGE_H);
  }, [band, mode, transparent]);

  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    const fpsParam = new URLSearchParams(location.search).get('fps');
    const ratio = Math.min(1.5, Math.max(0.5, dpr * scale * (quality === 'low' ? 0.7 : 1)));
    sceneRef.current?.setSize(STAGE_W, STAGE_H, ratio);
    if (fpsParam === '30') sceneRef.current?.engine.setFpsCap(30);
  }, [scale, quality]);

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden" style={{ background: transparent ? 'transparent' : '#0b1020' }}>
      <BackgroundMusic showUnlockButton={mode === 'game'} />
      <div
        className="relative shrink-0 overflow-hidden"
        style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: fixedScale ? 'top left' : 'center', position: fixedScale ? 'absolute' : 'relative', left: fixedScale ? 0 : undefined, top: fixedScale ? 0 : undefined }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 block" style={{ width: STAGE_W, height: STAGE_H }} />
        {hud && (
          <div className="pointer-events-none absolute inset-0 select-none">
            <div ref={topRef} className="absolute flex flex-col gap-3" style={{ top: safe.top, left: safe.left, right: safe.right }}>
              <Header />
              <div className={`grid gap-3 ${showRules ? 'grid-cols-2' : 'grid-cols-1 px-[22%]'}`}>
                <RankingPanel />
                {showRules && <RulesPanel />}
              </div>
            </div>
            <div ref={bottomRef} className="absolute" style={{ bottom: safe.bottom, left: safe.left, right: safe.right }}>
              <BottomHud />
            </div>
            {/* Toasts sit over the open water in the middle of the pond, not over the cats. */}
            <div className="absolute left-0 right-0 flex justify-center" style={{ top: band.top + (band.bottom - band.top) * 0.36 }}>
              <NotificationsLayer />
            </div>
            <div className="absolute left-0 right-0 flex justify-center" style={{ top: band.top + 20 }}>
              <BannerLayer />
            </div>
            <div className="absolute left-0 right-0 flex justify-center" style={{ top: 480 }}>
              <LeaderboardPopup />
            </div>
            <div className="absolute left-0 right-0 flex justify-center" style={{ top: safe.top + 200 }}>
              <GiftGuidePopup />
            </div>
            {!connected && (
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 rounded-3xl bg-slate-900/80 px-8 py-4 text-[34px] font-bold text-white">Đang kết nối máy chủ…</div>
            )}
            {showSafe && (
              <div className="absolute inset-0">
                <div className="absolute left-0 right-0 top-0 bg-red-500/25" style={{ height: safe.top }} />
                <div className="absolute bottom-0 left-0 right-0 bg-red-500/25" style={{ height: safe.bottom }} />
                <div className="absolute bottom-0 left-0 top-0 bg-red-500/20" style={{ width: safe.left }} />
                <div className="absolute bottom-0 right-0 top-0 bg-red-500/20" style={{ width: safe.right }} />
                <div className="absolute left-1/2 -translate-x-1/2 rounded bg-red-600 px-3 text-[22px] font-bold text-white" style={{ bottom: safe.bottom - 36 }}>TikTok safe zone</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
