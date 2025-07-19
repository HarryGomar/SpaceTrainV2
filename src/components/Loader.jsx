// src/components/Loader.jsx
import { useEffect } from 'react';
import { useProgress } from '@react-three/drei';
import useStore from '../store/useStore';
import { preloadModel } from '../utils/loader';

const Loader = () => {
  // Note: The useProgress hook is for models loaded via <Suspense>
  // The custom preloadModel function manages its own progress state.
  // This component can be used to trigger the preload.
  
  useEffect(() => {
    // This ensures the model preloading starts as soon as the app mounts.
    preloadModel();
  }, []);


  return null; // This component doesn't render anything itself
};

export default Loader;
