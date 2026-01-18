import { HashRouter, Routes, Route } from 'react-router-dom';
import SelectFile from './pages/SelectFile';
import Processing from './pages/Processing';
import Review from './pages/Review';

function App() {
  return (
    <HashRouter>
      <div className="min-h-screen bg-zinc-950">
        <Routes>
          <Route path="/" element={<SelectFile />} />
          <Route path="/processing" element={<Processing />} />
          <Route path="/review" element={<Review />} />
        </Routes>
      </div>
    </HashRouter>
  );
}

export default App;
