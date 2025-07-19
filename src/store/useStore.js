// src/store/useStore.js
import { create } from 'zustand';

const useStore = create((set) => ({
  // Indicates if the initial assets are loading.
  loading: true,
  setLoading: (isLoading) => set({ loading: isLoading }),
  
  // Represents the loading progress from 0 to 100.
  progress: 0,
  setProgress: (newProgress) => set({ progress: newProgress }),

  // Holds the detailed status message for the UI.
  statusText: 'Initializing...',
  setStatusText: (text) => set({ statusText: text }),

  // Manages whether the user has entered the main 3D experience.
  enterExperience: false,
  setEnterExperience: (enter) => set({ enterExperience: enter }),
}));

export default useStore;
