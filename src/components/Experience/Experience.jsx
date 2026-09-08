// src/components/Experience.jsx
import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, KeyboardControls, Html, useProgress } from '@react-three/drei';
import SpaceBox from './SpaceBox';
import Train from './Train';
import OnScreenControls from './OnScreenControls';

function TrainLoading() {
    const { progress } = useProgress();
    return <Html center><p role="status" style={{color:'#ffeffe',whiteSpace:'nowrap',fontSize:'14px'}}>Loading train{Number.isFinite(progress)&&progress>0?` · ${Math.round(progress)}%`:''}</p></Html>;
}

const Experience = () => {
    return (
        <KeyboardControls
            map={[
                { name: 'forward', keys: ['ArrowUp', 'w', 'W'] },
                { name: 'backward', keys: ['ArrowDown', 's', 'S'] },
            ]}
        >
            <div className="relative w-screen h-screen overflow-hidden bg-black">
                <Canvas
                    shadows
                    camera={{
                        position: [-3, 2, 5], // Start slightly left and above for a more cinematic angle
                        near: 0.01,
                        far: 2000,
                    }}
                >
                    <Suspense fallback={<TrainLoading />}>
                        <OrbitControls
                            makeDefault
                            panSpeed={0.1}
                            minAzimuthAngle={-2.3}
                            maxAzimuthAngle={0}
                            maxDistance={9}
                            minDistance={3} // cap zoom-in so the camera cannot clip the train
                            maxPolarAngle={1.7}
                        />
                        <SpaceBox />
                        <ambientLight intensity={1} />
                        <Train scale={0.04} position={[0, 0, -1]} />
                    </Suspense>
                </Canvas>
                <OnScreenControls />
            </div>
        </KeyboardControls>
    );
};

export default Experience;
