// src/utils/loader.js
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import useStore from '../store/useStore';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

/**
 * Preloads the main 3D model and updates the global store with more verbose, thematic progress.
 */
export const preloadModel = () => {
    const { setProgress, setLoading, setStatusText } = useStore.getState();

    setLoading(true);
    setStatusText('Connecting to orbital systems...');

    // Simulate some initial steps for better user feedback
    setTimeout(() => {
        setStatusText('Authenticating credentials...');
    }, 1000);


    gltfLoader.load(
        './Train/SpaceTrainV1.glb',
        // onLoad
        (gltf) => {
            setStatusText('Decompressing model data...');
            setProgress(100);

            setTimeout(() => {
                setStatusText('Calibrating sensor array...');
                setTimeout(() => {
                    setLoading(false);
                    setStatusText('System online. Ready for initiation.');
                }, 750);
            }, 500);
        },
        // onProgress
        (progressEvent) => {
            // Start showing progress after the initial simulated steps
            if (progressEvent.lengthComputable) {
                const percentComplete = (progressEvent.loaded / progressEvent.total) * 100;
                setProgress(percentComplete);

                const loadedKB = Math.round(progressEvent.loaded / 1024);
                const totalKB = Math.round(progressEvent.total / 1024);
                setStatusText(`Downloading schematics...`);
            }
        },
        // onError
        (error) => {
            console.error('An error occurred while loading the model:', error);
            setStatusText('Error: Connection timed out.');
        }
    );
};
