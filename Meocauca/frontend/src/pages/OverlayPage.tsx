import { useEffect } from 'react';
import GameStage from '../components/GameStage';

/**
 * http://localhost:3000/overlay – OBS / TikTok LIVE Studio browser source (1080×1920).
 *   ?bg=transparent   hide sky + far background (transparent page)
 *   ?fit=1            fit to window instead of native 1080×1920
 *   ?hud=0            3D only, no HUD
 *   ?fps=30           cap the frame rate
 */
export default function OverlayPage() {
  const params = new URLSearchParams(location.search);
  const transparent = params.get('bg') === 'transparent';
  const fit = params.get('fit') === '1';
  const hud = params.get('hud') !== '0';
  useEffect(() => {
    document.title = 'Hồ Câu Cá Mèo – Overlay';
    document.body.classList.add('transparent-bg');
    return () => document.body.classList.remove('transparent-bg');
  }, []);
  return <GameStage mode="overlay" transparent={transparent} fixedScale={!fit} hud={hud} />;
}
