import React from 'react';
import { Routes, Route } from 'react-router-dom';
import MainPage from './pages/MainPage';
import HotelsUpload from './pages/HotelsUpload';
import HotelsPage from './pages/HotelsPage';
import LifestylePage from './pages/LifestylePage';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/hotels" element={<HotelsUpload />} />
          <Route path="/hotels-management" element={<HotelsPage />} />
          <Route path="/lifestyle" element={<LifestylePage />} />
        </Routes>
      </div>
    </ErrorBoundary>
  );
}

export default App;
