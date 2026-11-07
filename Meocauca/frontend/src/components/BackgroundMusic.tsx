import { useEffect, useState } from 'react';
import { ChillMusic } from '../game/audio/ChillMusic';
import { VoicePlayer } from '../game/audio/VoicePlayer';
import { useGameStore } from '../services/store';

/**
 * Drives the procedural lo-fi music from the live config (admin → 🎵 Nhạc nền).
 *  - `?music=0` in the URL disables music on that page (e.g. when /game and /overlay are both open).
 *  - Browsers block audio until the first click/key press: a small button appears until then
 *    (OBS / TikTok LIVE Studio browser sources normally allow autoplay, so nothing shows there).
 *  - Key "M" mutes / unmutes locally.
 */
export default function BackgroundMusic({ showUnlockButton }: { showUnlockButton: boolean }) {
  const music = useGameStore((s) => s.config?.ui.music);
  const voice = useGameStore((s) => s.config?.ui.voice);
  const [locked, setLocked] = useState(false);
  const [voiceLocked, setVoiceLocked] = useState(false);
  const voiceAllowed = new URLSearchParams(location.search).get('voice') !== '0';
  const [muted, setMuted] = useState(false);
  const allowed = new URLSearchParams(location.search).get('music') !== '0';
  const enabled = allowed && !!music?.enabled;

  useEffect(() => {
    if (!music) return;
    ChillMusic.get().setOptions({ volume: music.volume / 100, bpm: music.bpm, ambience: music.ambience });
  }, [music?.volume, music?.bpm, music?.ambience]);

  useEffect(() => {
    const m = ChillMusic.get();
    if (enabled) m.start();
    else m.stop();
  }, [enabled]);

  useEffect(() => {
    if (!voice) return;
    VoicePlayer.get().setOptions({ enabled: voiceAllowed && voice.enabled, volume: voice.volume / 100, maxQueue: voice.maxQueue });
  }, [voice?.enabled, voice?.volume, voice?.maxQueue, voiceAllowed]);

  useEffect(() => {
    const m = ChillMusic.get();
    const vp = VoicePlayer.get();
    const off = m.onLockChange(setLocked);
    const offVoice = vp.onLockChange(setVoiceLocked);
    setLocked(m.isLocked());
    setVoiceLocked(vp.isLocked());
    const unlock = () => {
      m.unlock();
      vp.unlock();
    };
    const onKey = (e: KeyboardEvent) => {
      unlock();
      if (e.key === 'm' || e.key === 'M') {
        m.setMuted(!m.isMuted());
        setMuted(m.isMuted());
      }
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', onKey);
    return () => {
      off();
      offVoice();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', onKey);
      m.stop();
    };
  }, []);

  if (!showUnlockButton) return null;
  if ((enabled && locked) || voiceLocked) {
    return (
      <button
        type="button"
        onClick={() => {
          ChillMusic.get().unlock();
          VoicePlayer.get().unlock();
        }}
        className="fixed bottom-4 right-4 z-50 rounded-full bg-slate-900/85 px-4 py-2 text-sm font-bold text-white shadow-lg ring-1 ring-white/20 hover:bg-slate-800"
      >
        🔊 Bấm để bật âm thanh (nhạc + giọng đọc)
      </button>
    );
  }
  if (enabled && muted) {
    return <div className="pointer-events-none fixed bottom-4 right-4 z-50 rounded-full bg-slate-900/70 px-3 py-1 text-xs font-bold text-white">🔇 Nhạc tắt (phím M)</div>;
  }
  return null;
}
