// src/store/useTrainStore.js
import { create } from 'zustand';
import gsap from 'gsap';
import * as THREE from 'three';

const useTrainStore = create((set, get) => ({
    // STATE
    inTrain: false,
    inTerminal: false,
    inProjects: false,
    inProjector: false,
    isTransitioning: false,
    iframeVisible: false,
    projectsVisible: false,
    hoveredObject: null,
    lastCameraPos: new THREE.Vector3(),
    lastCameraTarget: new THREE.Vector3(),
    focusExitRequest: 0,
    moveForward: false,
    moveBackward: false,

    // ACTIONS
    setHoveredObject: (objectName) => set({ hoveredObject: objectName }),
    setMovement: (direction, isPressed) => set((state) => {
        const stateKey = direction === 'forward'
            ? 'moveForward'
            : direction === 'backward'
                ? 'moveBackward'
                : null;

        if (!stateKey || state[stateKey] === isPressed) return state;
        return { [stateKey]: isPressed };
    }),
    clearMovement: () => set((state) => {
        if (!state.moveForward && !state.moveBackward) return state;
        return { moveForward: false, moveBackward: false };
    }),
    requestFocusExit: () => set((state) => ({ focusExitRequest: state.focusExitRequest + 1 })),
    resetExperience: () => set({
        inTrain: false,
        inTerminal: false,
        inProjects: false,
        inProjector: false,
        isTransitioning: false,
        iframeVisible: false,
        projectsVisible: false,
        hoveredObject: null,
        moveForward: false,
        moveBackward: false,
    }),

    /**
     * Resets camera controls to a free-roam state inside the train.
     */
    enableFreeRoamControls: (controls) => {
        if (!controls) return;
        controls.maxAzimuthAngle = Infinity;
        controls.minAzimuthAngle = -Infinity;
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
        if (get().inTrain || get().isTransitioning || !camera || !controls || !doorRef?.current) return;

        get().disableControls(controls);

        if (openDoorAction) {
            openDoorAction.setLoop(THREE.LoopOnce).reset().play();
        }

        const targetDoor = new THREE.Vector3();
        doorRef.current.getWorldPosition(targetDoor);
        
        camera.getWorldPosition(get().lastCameraPos); // Save position before entering
        
        controls.minDistance = 0;

        set({ isTransitioning: true }); // Start transition, but keep exterior visible

        const tl = gsap.timeline({
            onComplete: () => {
                get().enableFreeRoamControls(controls);
                set({ inTrain: true, isTransitioning: false }); // Now inside, hide exterior and end transition
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

    },

    /**
     * Handles the camera animation to focus on the terminal screen.
     */
    enterTerminal: (camera, controls, terminalRef) => {
        if (!get().inTrain || get().inTerminal || get().inProjects || get().isTransitioning || !camera || !controls || !terminalRef?.current) return;

        set({ isTransitioning: true });
        get().disableControls(controls);
        camera.getWorldPosition(get().lastCameraPos);
        get().lastCameraTarget.copy(controls.target);
        const targetTer = new THREE.Vector3();
        terminalRef.current.getWorldPosition(targetTer);

        gsap.to(camera.position, {
            duration: 2,
            x: targetTer.x,
            y: targetTer.y + 0.03,
            z: targetTer.z - 0.1,
            ease: 'power3.inOut',
        });

        gsap.to(controls.target, {
            duration: 2,
            x: targetTer.x,
            y: targetTer.y + 0.03,
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
            x: get().lastCameraTarget.x,
            y: get().lastCameraTarget.y,
            z: get().lastCameraTarget.z,
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
        if (!get().inTrain || get().inProjects || get().inTerminal || get().isTransitioning || !camera || !controls || !projectsRef?.current) return;

        set({ isTransitioning: true });
        get().disableControls(controls);
        camera.getWorldPosition(get().lastCameraPos);
        get().lastCameraTarget.copy(controls.target);
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
            x: get().lastCameraTarget.x,
            y: get().lastCameraTarget.y,
            z: get().lastCameraTarget.z,
            ease: 'power3.inOut',
            onComplete: () => {
                get().enableFreeRoamControls(controls);
                set({ inProjects: false, isTransitioning: false });
            }
        });
    },
}));

export default useTrainStore;
