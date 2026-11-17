import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AppShell } from './components/AppShell';
import { Home } from './pages/Home';
import { SinglePlayer } from './pages/SinglePlayer';
import { Play } from './pages/Play';

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AppShell>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/single" element={<SinglePlayer />} />
          <Route path="/play" element={<Play />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
