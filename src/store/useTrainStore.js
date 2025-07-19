// src/store/useTrainStore.js
import { create } from 'zustand';
import gsap from 'gsap';
import * as THREE from 'three';

const useTrainStore = create((set, get) => ({
    // STATE
    inTrain: false,
    inTerminal: false,
    inProjector: false,
    isTransitioning: false,
    iframeVisible: false,
    projectsVisible: false,
    hoveredObject: null,
    lastCameraPos: new THREE.Vector3(),

    // ACTIONS
    setHoveredObject: (objectName) => set({ hoveredObject: objectName }),

    /**
     * Resets camera controls to a free-roam state inside the train.
     */
    enableFreeRoamControls: (controls) => {
        if (!controls) return;
        controls.maxAzimuthAngle = Infinity;
        controls.minAzimuthAngle = Infinity;
        controls.maxPolarAngle = Math.PI;
        controls.minPolarAngle = 0;
        controls.enableZoom = false;
        controls.enableRotate = true;
        controls.enablePan = true;
    },

    /**
     * Locks camera controls for focused views or during transitions.
     */
    disableControls: (controls) => {
        if (!controls) return;
        controls.enableRotate = false;
        controls.enablePan = false;
    },

    /**
     * Handles the camera animation to enter the train.
     * The interior is made visible immediately for a better visual transition.
     */
    enterTrain: (camera, controls, doorRef, openDoorAction) => {
        if (get().inTrain || get().isTransitioning) return;

        get().disableControls(controls);

        openDoorAction?.setLoop(THREE.LoopOnce).play().reset();

        const targetDoor = new THREE.Vector3();
        doorRef.current.getWorldPosition(targetDoor);
        
        camera.getWorldPosition(get().lastCameraPos); // Save position before entering
        
        controls.minDistance = 0;

        const tl = gsap.timeline({
            onComplete: () => {
                get().enableFreeRoamControls(controls);
                set({ isTransitioning: false }); // End transition
            }
        });

        tl.to(camera.position, {
            duration: 1,
            x: targetDoor.x - 1.5,
            y: targetDoor.y + 0.11,
            z: targetDoor.z,
            ease: 'power2.inOut',
        }, 0);

        tl.to(controls.target, {
            duration: 1,
            x: targetDoor.x,
            y: targetDoor.y + 0.11,
            z: targetDoor.z,
            ease: 'power2.inOut',
        }, 0);

        tl.to(camera.position, {
            duration: 1,
            x: targetDoor.x + 0.2,
            ease: 'power2.inOut',
        }, 1.2);

        tl.to(controls.target, {
            duration: 1,
            x: targetDoor.x + 0.21,
            ease: 'power2.inOut',
        }, 1.2);

        set({ inTrain: true, isTransitioning: true }); // Show interior immediately and start transition

    },

    /**
     * Handles the camera animation to focus on the terminal screen.
     */
    enterTerminal: (camera, controls, terminalRef) => {
        if (get().inTerminal || get().isTransitioning) return;

        set({ isTransitioning: true });
        get().disableControls(controls);
        camera.getWorldPosition(get().lastCameraPos);
        const targetTer = new THREE.Vector3();
        terminalRef.current.getWorldPosition(targetTer);

        gsap.to(camera.position, {
            duration: 2,
            x: targetTer.x,
            y: targetTer.y + 0.05,
            z: targetTer.z - 0.05,
            ease: 'power3.inOut',
        });

        gsap.to(controls.target, {
            duration: 2,
            x: targetTer.x,
            y: targetTer.y + 0.05,
            z: targetTer.z,
            ease: 'power3.inOut',
            onComplete: () => {
                set({ inTerminal: true, iframeVisible: true, isTransitioning: false });
            }
        });
    },
    
    /**
     * Handles the camera animation to exit the terminal view.
     */
    exitTerminal: (camera, controls) => {
        if (!get().inTerminal || get().isTransitioning) return;

        set({ isTransitioning: true, iframeVisible: false });
        get().disableControls(controls);

        gsap.to(camera.position, {
            duration: 2,
            x: get().lastCameraPos.x,
            y: get().lastCameraPos.y,
            z: get().lastCameraPos.z,
            ease: 'power3.inOut',
        });

        gsap.to(controls.target, {
            duration: 2,
            x: get().lastCameraPos.x,
            y: get().lastCameraPos.y,
            z: get().lastCameraPos.z + 0.025,
            ease: 'power3.inOut',
            onComplete: () => {
                get().enableFreeRoamControls(controls);
                set({ inTerminal: false, isTransitioning: false });
            }
        });
    },

    /**
     * Handles the camera animation to focus on the project screen.
     */
    enterProjects: (camera, controls, projectsRef) => {
        if (get().inProjects || get().isTransitioning) return;

        set({ isTransitioning: true });
        get().disableControls(controls);
        camera.getWorldPosition(get().lastCameraPos);
        const targetProj = new THREE.Vector3();
        projectsRef.current.getWorldPosition(targetProj);

        gsap.to(camera.position, {
            duration: 2,
            x: targetProj.x - 0.15,
            y: targetProj.y,
            z: targetProj.z,
            ease: 'power3.inOut',
        });

        gsap.to(controls.target, {
            duration: 2,
            x: targetProj.x - 0.05,
            y: targetProj.y,
            z: targetProj.z,
            ease: 'power3.inOut',
            onComplete: () => {
                set({ inProjects: true, projectsVisible: true, isTransitioning: false });
            }
        });
    },

    /**
     * Handles the camera animation to exit the project screen view.
     */
    exitProjects: (camera, controls) => {
        if (!get().inProjects || get().isTransitioning) return;

        set({ isTransitioning: true, projectsVisible: false });
        get().disableControls(controls);

        gsap.to(camera.position, {
            duration: 2,
            x: get().lastCameraPos.x,
            y: get().lastCameraPos.y,
            z: get().lastCameraPos.z,
            ease: 'power3.inOut',
        });

        gsap.to(controls.target, {
            duration: 2,
            x: get().lastCameraPos.x,
            y: get().lastCameraPos.y,
            z: get().lastCameraPos.z + 0.025,
            ease: 'power3.inOut',
            onComplete: () => {
                get().enableFreeRoamControls(controls);
                set({ inProjects: false, isTransitioning: false });
            }
        });
    },
}));

export default useTrainStore;