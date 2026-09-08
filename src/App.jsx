// src/App.jsx
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './components/Home/Home';

const Experience = lazy(() => import('./components/Experience/Experience'));

function App() {
  return (
    <Router>
      <Suspense fallback={<div className="experience-loading"><p role="status">Loading Space Train…</p><Link to="/">Return to homepage</Link></div>}>
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/projects" element={<Home />} />
            <Route path="/projects/:id" element={<Home />} />
            <Route path="/experience" element={<Experience />} />
            <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
