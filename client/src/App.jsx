import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Display from './pages/Display.jsx';
import Control from './pages/Control.jsx';
import Buzzer from './pages/Buzzer.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/display" element={<Display />} />
        <Route path="/control" element={<Control />} />
        <Route path="/buzzer" element={<Buzzer />} />
        <Route path="/" element={<Navigate to="/display" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
