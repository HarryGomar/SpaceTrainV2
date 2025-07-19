// src/components/Experience.jsx
import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, KeyboardControls } from '@react-three/drei';
import SpaceBox from './SpaceBox';
import Train from './Train';

const Experience = () => {
    return (
        <KeyboardControls
            map={[
                { name: 'forward', keys: ['ArrowUp', 'w', 'W'] },
                { name: 'backward', keys: ['ArrowDown', 's', 'S'] },
            ]}
        >
            <div className="w-screen h-screen">
                <Canvas shadows>
                    <Suspense fallback={null}>
                        <OrbitControls
                            makeDefault
                            panSpeed={0.1}
                            minAzimuthAngle={-2.3}
                            maxAzimuthAngle={0}
                            maxDistance={9}
                            minDistance={0}
                            maxPolarAngle={1.7}
                        />
                        <SpaceBox />
                        <ambientLight intensity={1} />
                        <Train scale={0.04} position={[0, 0, -1]} />
                    </Suspense>
                </Canvas>
            </div>
        </KeyboardControls>
    );
};

export default Experience;