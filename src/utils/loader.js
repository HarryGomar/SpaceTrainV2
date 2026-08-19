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
    setProgress(null);
    setStatusText('Connecting to systems...');

    const loadingStatusTimer = setTimeout(() => {
        const currentState = useStore.getState();
        if (currentState.loading && !Number.isFinite(currentState.progress)) {
            setStatusText('Loading train model...');
        }
    }, 750);


    gltfLoader.load(
        '/Train/SpaceTrainV1.glb',
        // onLoad
        (gltf) => {
            clearTimeout(loadingStatusTimer);
            setStatusText('Preparing train model...');
            setProgress(100);

            setTimeout(() => {
                setStatusText('Calibrating sensor array...');
                setTimeout(() => {
                    setLoading(false);
                    setStatusText('System online.');
                }, 750);
            }, 500);
        },
        // onProgress
        (progressEvent) => {
            if (progressEvent.lengthComputable && progressEvent.total > 0) {
                const percentComplete = Math.min(99, (progressEvent.loaded / progressEvent.total) * 100);
                setProgress(percentComplete);
                setStatusText('Downloading train model...');
            } else if (progressEvent.loaded > 0) {
                const loadedMB = (progressEvent.loaded / (1024 * 1024)).toFixed(1);
                setProgress(null);
                setStatusText(`Downloading train model... ${loadedMB} MB`);
            }
        },
        // onError
        (error) => {
            clearTimeout(loadingStatusTimer);
            console.error('An error occurred while loading the model:', error);
            setStatusText('Error: Connection timed out.');
        }
    );
};
