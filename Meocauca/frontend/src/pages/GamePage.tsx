import { useEffect } from 'react';
import GameStage from '../components/GameStage';

/** http://localhost:3000/game – full 9:16 game, fitted to the window. */
export default function GamePage() {
  useEffect(() => {
    document.title = 'Hồ Câu Cá Mèo – Game';
  }, []);
  return <GameStage mode="game" />;
}
