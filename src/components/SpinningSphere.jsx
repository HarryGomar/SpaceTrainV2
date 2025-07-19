// src/components/SpinningSphere.jsx

import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import { EffectComposer, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import useStore from '../store/useStore';
import * as THREE from 'three';

// Define colors for different loading states
const COLORS = {
    IDLE: new THREE.Color('#C8A2C8'), // Default soft lavender
    INITIATING: new THREE.Color('#ff5f1f'), // Orange-red for starting
    DOWNLOADING: new THREE.Color('#ffd700'), // Gold for progress
    READY: new THREE.Color('#9F70FD'), // Vibrant neon lavender for ready
    ERROR: new THREE.Color('#ff0000'), // Red for error
};

const SphereMesh = () => {
    const { statusText } = useStore();
    const mainMeshRef = useRef();
    const innerMeshRef = useRef();
    const materialRef = useRef();
    const innerMaterialRef = useRef();

    const [targetColor, setTargetColor] = useState(COLORS.IDLE);

    // Update the target color based on the global status text
    useEffect(() => {
        if (statusText.toLowerCase().includes('error')) {
            setTargetColor(COLORS.ERROR);
        } else if (statusText.toLowerCase().includes('ready') || statusText.toLowerCase().includes('online')) {
            setTargetColor(COLORS.READY);
        } else if (statusText.toLowerCase().includes('downloading')) {
            setTargetColor(COLORS.DOWNLOADING);
        } else if (statusText.toLowerCase().includes('connecting') || statusText.toLowerCase().includes('authenticating')) {
            setTargetColor(COLORS.INITIATING);
        } else {
            setTargetColor(COLORS.IDLE);
        }
    }, [statusText]);

    useFrame((state, delta) => {
        // Rotate the spheres at a slower speed
        if (mainMeshRef.current) {
            mainMeshRef.current.rotation.y += delta * 0.1;
            mainMeshRef.current.rotation.x += delta * 0.025;
        }
        // Smoothly transition the colors
        if (materialRef.current) {
            materialRef.current.color.lerp(targetColor, delta * 2);
            materialRef.current.emissive.lerp(targetColor, delta * 2);
        }
        if (innerMaterialRef.current) {
            innerMaterialRef.current.color.lerp(targetColor, delta * 2);
            innerMaterialRef.current.emissive.lerp(targetColor, delta * 2);
        }
    });

    return (
        <group>
            {/* --- CHANGE: Sphere is larger and has fewer faces --- */}
            <Sphere ref={mainMeshRef} args={[1.5, 12, 12]}>
                <meshStandardMaterial
                    ref={materialRef}
                    wireframe={true}
                    emissiveIntensity={1.5}
                />
            </Sphere>
            {/* --- CHANGE: Inner sphere is also larger with fewer faces --- */}
            <Sphere ref={innerMeshRef} args={[0.8, 12, 12]}>
                <meshStandardMaterial
                    ref={innerMaterialRef}
                    wireframe={true}
                    emissiveIntensity={0.5}
                    transparent={true}
                    opacity={0.2}
                />
            </Sphere>
        </group>
    );
};

const SpinningSphere = () => {
    return (
        <div className="absolute inset-0">
            <Canvas
                camera={{ position: [0, 0, 2.5] }}
                gl={{ antialias: false, alpha: true }}
                onCreated={({ gl }) => {
                    gl.setClearColor(0x000000, 0);
                }}
            >
                <SphereMesh />
                <EffectComposer>
                    <Noise
                        premultiply
                        blendFunction={BlendFunction.ADD}
                        opacity={0.1}
                    />
                </EffectComposer>
            </Canvas>
        </div>
    );
};

export default SpinningSphere;
