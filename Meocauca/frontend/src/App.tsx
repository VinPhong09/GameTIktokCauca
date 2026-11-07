import { Navigate, Route, Routes } from 'react-router-dom';
import GamePage from './pages/GamePage';
import OverlayPage from './pages/OverlayPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  return (
    <Routes>
      <Route path="/game" element={<GamePage />} />
      <Route path="/overlay" element={<OverlayPage />} />
      <Route path="/admin/*" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/game" replace />} />
    </Routes>
  );
}
