// src/App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { preloadModel } from './utils/loader'; // Import the new loader

import Landing from './components/Landing';
import Projects from './components/Projects/Projects';
import ProjectDetail from './components/Projects/ProjectDetail';
import Experience from './components/Experience/Experience';
import useStore from './store/useStore';

function App() {
  const enterExperience = useStore((state) => state.enterExperience);

  // Use useEffect to call our preloader once when the app mounts.
  useEffect(() => {
    preloadModel();
  }, []);

  return (
    <Router>
        <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route
                path="/experience"
                element={enterExperience ? <Experience /> : <Navigate to="/" />}
            />
        </Routes>
    </Router>
  );
}

export default App;