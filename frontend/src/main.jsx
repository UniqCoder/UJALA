import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
import '@fontsource-variable/schibsted-grotesk';
import './styles.css';
import { useStore } from './store.js';
import Landing from './pages/Landing.jsx';
import Planner from './pages/Planner.jsx';
import Lab from './pages/Lab.jsx';

function OfflineBanner() {
  const offline = useStore((s) => s.offline);
  const call = useStore((s) => s.call);
  if (!offline) return null;
  return (
    <div className="offline" role="alert">
      <span>
        Can't reach the Ujala server on port 4000. Start it with <code>npm run dev</code> in the backend folder.
      </span>
      <button className="btn ghost" onClick={() => call('/health').catch(() => {})}>
        Try again
      </button>
    </div>
  );
}

function Shell({ children, overlay = false }) {
  return (
    <>
      <header className={`topbar ${overlay ? 'overlay' : ''}`}>
        <Link to="/" className="wordmark">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="8.5" r="5.5" />
            <rect x="7.5" y="15" width="5" height="3" rx="1" />
          </svg>
          Ujala
        </Link>
        <nav>
          <NavLink to="/planner">Planner</NavLink>
          <NavLink to="/lab">Algorithm lab</NavLink>
        </nav>
      </header>
      <OfflineBanner />
      {children}
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Shell overlay><Landing /></Shell>} />
        <Route path="/planner" element={<Shell><Planner /></Shell>} />
        <Route path="/lab" element={<Shell><Lab /></Shell>} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
