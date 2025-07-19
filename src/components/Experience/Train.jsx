// src/components/Train.jsx
import * as THREE from 'three';
import React, { useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, useAnimations, useGLTF, useKeyboardControls } from '@react-three/drei';
import { Selection, Select, EffectComposer, Outline } from '@react-three/postprocessing';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import gsap from 'gsap';
import useTrainStore from '../../store/useTrainStore';
import Projects from '../Projects/Projects';
import ProjectDetail from '../Projects/ProjectDetail';

export default function Train(props) {
  // Asset and animation setup
  const group = useRef();
  const { nodes, materials, animations } = useGLTF("./Train/SpaceTrainV1.glb");
  const { actions } = useAnimations(animations, group);

  // R3F hooks
  const { camera, controls } = useThree();
  const [subscribeKeys, getKeys] = useKeyboardControls();
  
  // Refs for interactive objects
  const interior = useRef();
  const door = useRef();
  const terminal = useRef();
  const projectScreen = useRef();

  // Zustand store for state management
  const {
    inTrain, inTerminal, inProjects, isTransitioning, iframeVisible, projectsVisible, hoveredObject,
    setHoveredObject, enterTrain, enterTerminal, exitTerminal, enterProjects, exitProjects
  } = useTrainStore();

  // Set cursor style on hover
  useEffect(() => {
    document.body.style.cursor = hoveredObject && !isTransitioning ? 'pointer' : 'auto';
  }, [hoveredObject, isTransitioning]);

  // Memoize handlers for useEffect dependency arrays
  const handleEnterTrain = useCallback((e) => { e.stopPropagation(); enterTrain(camera, controls, door, actions.OpenDoor); }, [camera, controls, door, actions, enterTrain]);
  const handleEnterTerminal = useCallback((e) => { e.stopPropagation(); enterTerminal(camera, controls, terminal); }, [camera, controls, terminal, enterTerminal]);
  const handleExitTerminal = useCallback(() => { exitTerminal(camera, controls); }, [camera, controls, exitTerminal]);
  const handleEnterProjects = useCallback((e) => { e.stopPropagation(); enterProjects(camera, controls, projectScreen); }, [camera, controls, projectScreen, enterProjects]);
  const handleExitProjects = useCallback(() => { exitProjects(camera, controls); }, [camera, controls, exitProjects]);

  // Keyboard listener to exit views with ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (inTerminal) handleExitTerminal();
        if (inProjects) handleExitProjects();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inTerminal, inProjects, handleExitTerminal, handleExitProjects]);
  
  // Player movement inside the train
  useFrame(() => {
    const { forward, backward } = getKeys();
    const isFocused = inTerminal || inProjects || isTransitioning;

    if (inTrain && !isFocused && interior.current) {
        const pos = interior.current.position;

        if (forward && pos.z > -60) {
            let targetY = pos.y;
            if (pos.z <= -30 && pos.z >= -45) {
                targetY -= 0.17;
            }
            gsap.to(pos, { duration: 0.2, z: pos.z - 0.4, y: targetY });
        }

        if (backward && pos.z < 32) {
            let targetY = pos.y;
            if (pos.z <= -30 && pos.z >= -45) {
                targetY += 0.17;
            }
            gsap.to(pos, { duration: 0.2, z: pos.z + 0.4, y: targetY });
        }
    }
  });

  return (
    <group {...props} dispose={null} ref={group}>
      <group name="Interior" ref={interior}>
        <Selection>
          <EffectComposer autoClear={false}>
            <Outline visibleEdgeColor="white" hiddenEdgeColor="white" blur width={500} edgeStrength={100} />
          </EffectComposer>
          
          {/* Door is interactable from the outside */}
          <group name="DoorRight" position={[-5.775, 3.426, 3.837]} rotation={[Math.PI / 2, 0, -Math.PI]} scale={[0.904, 0.904, 0.956]}>
            <Select name="DoorRight_1" enabled={!inTrain && hoveredObject === "DoorRight_1"}>
              <mesh
                ref={door}
                name="DoorRight_1"
                geometry={nodes.DoorRight_1.geometry}
                material={materials.DoorMetal}
                onClick={handleEnterTrain}
                onPointerEnter={(e) => { e.stopPropagation(); if (!inTrain) setHoveredObject("DoorRight_1"); }}
                onPointerLeave={(e) => { e.stopPropagation(); setHoveredObject(null); }}
              />
            </Select>
            <mesh name="DoorRight_2" geometry={nodes.DoorRight_2.geometry} material={materials.GlowRed} />
          </group>

          {/* These interactables are only available when inside the train */}
          {inTrain && (
            <group>
              {/* -- Projects SCREEN -- */}
              <Select name="ProjectsScreen_3" enabled={!inProjects && hoveredObject === "ProjectsScreen_3"}>
                <mesh
                  ref={projectScreen}
                  name="ProjectsScreen_3"
                  geometry={nodes.ProjectsScreen_3.geometry}
                  material={materials.MonitorProject}
                  position={[5.61, 4.731, 15.969]}
                  rotation={[0, 0, -Math.PI / 2]}
                  scale={0.938}
                  onClick={handleEnterProjects}
                  onPointerEnter={(e) => { e.stopPropagation(); setHoveredObject("ProjectsScreen_3"); }}
                  onPointerLeave={(e) => { e.stopPropagation(); setHoveredObject(null); }}
                />
              </Select>

              {projectsVisible && (
                  <group position={[5.60, 4.6, 15.95]} rotation={[0, -Math.PI / 2, 0]} scale={[0.2, 0.2, 0.2]}>
                      <Html
                          transform
                          occlude="blending"
                          className="w-[1000px] h-[800px] bg-transparent select-none" // 4x the original resolution
                          pointerEvents="auto"
                      >
                          <MemoryRouter initialEntries={['/projects']}>
                              <div className="w-full h-full bg-black/80 rounded-lg overflow-hidden">
                                  <Routes>
                                      <Route path="/projects" element={<Projects />} />
                                      <Route path="/projects/:id" element={<ProjectDetail />} />
                                  </Routes>
                              </div>
                          </MemoryRouter>
                      </Html>
                  </group>
              )}

              {inProjects && (
                <Select name="ExitProjects" enabled={hoveredObject === "ExitProjects"}>
                  <mesh name="ExitProjects" onClick={handleExitProjects} position={[5.3, 3.5, 13.5]} scale={0.05} onPointerEnter={(e) => { e.stopPropagation(); setHoveredObject("ExitProjects"); }} onPointerLeave={(e) => { e.stopPropagation(); setHoveredObject(null); }} >
                    <cylinderGeometry args={[1, 1, 1, 10]} />
                    <meshStandardMaterial color="red" emissive="red" emissiveIntensity={2} />
                  </mesh>
                </Select>
              )}

              {/* -- TERMINAL SCREEN -- */}
              <Select name="DisplayTerminal" enabled={!inTerminal && hoveredObject === "DisplayTerminal"}>
                <mesh
                  ref={terminal}
                  name="DisplayTerminal"
                  geometry={nodes.DisplayTerminal.geometry}
                  material={materials.Terminal}
                  position={[-4.276, 8.332, 73.726]}
                  rotation={[-Math.PI, 0, -Math.PI]}
                  scale={1.162}
                  onClick={handleEnterTerminal}
                  onPointerEnter={(e) => { e.stopPropagation(); setHoveredObject("DisplayTerminal"); }}
                  onPointerLeave={(e) => { e.stopPropagation(); setHoveredObject(null); }}
                />
              </Select>
              {iframeVisible && (
                <Html position={[-4.33, 9.3, 73.2]} rotation={[0, Math.PI, 0]} transform occlude="blending" scale={0.07} pointerEvents="auto">
                  <iframe title="Terminal" className="w-[1060px] h-[900px] border-none bg-black rounded-lg select-none" src='https://terminal-inner-website.vercel.app/' />
                </Html>
              )}
              {inTerminal && (
                <Select name="ButtonTerminal" enabled={hoveredObject === "ButtonTerminal"}>
                  <mesh name="ButtonTerminal" onClick={handleExitTerminal} position={[-5.386, 8.355, 72.526]} scale={0.05} onPointerEnter={(e) => { e.stopPropagation(); setHoveredObject("ButtonTerminal"); }} onPointerLeave={(e) => { e.stopPropagation(); setHoveredObject(null); }} >
                    <cylinderGeometry args={[1, 1, 1, 10]} />
                    <meshStandardMaterial color="red" emissive="red" emissiveIntensity={2} />
                  </mesh>
                </Select>
              )}



            </group>
          )}
        </Selection>

        {/* Static meshes are always loaded but only visible when inside the train */}
        <group >

          <group name="Hide" visible={inTrain}>
              <mesh name="ControlWalls" geometry={nodes.ControlWalls.geometry} material={materials.ControlWalls} position={[-0.312, 2.053, 69.486]} scale={0.191} />
              <mesh name="ControlObjects" geometry={nodes.ControlObjects.geometry} material={materials.ControlObjects} position={[-3.283, 8.447, 71.846]} rotation={[1.575, 0, Math.PI / 2]} scale={0.132} />
          </group>

          <group name="Loose">
              <group name="Tablet" position={[3.94258, 2.31633, -0.4522]} rotation={[0, -0.97512, 0]} scale={5.25435}>
                  <mesh name="Tablet_1" geometry={nodes.Tablet_1.geometry} material={materials.Tablet_white} />
                  <mesh name="Tablet_2" geometry={nodes.Tablet_2.geometry} material={materials.Handle} />
                  <mesh name="Tablet_3" geometry={nodes.Tablet_3.geometry} material={materials.TabletGlow} />
              </group>
              <mesh name="RadarPlane" geometry={nodes.RadarPlane.geometry} material={materials.Controller} position={[-1.44281, 8.5418, 72.88918]} rotation={[Math.PI / 2, 0, 2.76649]} scale={0.77296} />
              <group name="Puzzle" position={[0.49346, 0.75457, -29.20572]} scale={8.31741}>
                  <mesh name="Puzzle_1" geometry={nodes.Puzzle_1.geometry} material={materials['JigsawPuzzleFront.001']} />
                  <mesh name="Puzzle_2" geometry={nodes.Puzzle_2.geometry} material={materials['JigsawPuzzleBack.001']} />
              </group>
              <mesh name="PaintingsBorder" geometry={nodes.PaintingsBorder.geometry} material={materials.PaintingBorder} position={[-5.92163, 5.46794, 14.41192]} rotation={[1.57453, -0.00001, Math.PI / 2]} scale={0.13227} />
              <mesh name="Painting5" geometry={nodes.Painting5.geometry} material={materials.Painting5} position={[5.78982, 5.23937, 43.31192]} rotation={[1.56706, 0.00001, -Math.PI / 2]} scale={0.13337} />
              <group name="Painting4" position={[-5.81018, 5.10591, 43.41192]} rotation={[1.57453, -0.00001, Math.PI / 2]} scale={0.13123}><mesh name="Painting2_1" geometry={nodes.Painting2_1.geometry} material={materials.PaintingBorder} /><mesh name="Painting2_2" geometry={nodes.Painting2_2.geometry} material={materials.Painting4} /></group>
              <group name="Painting3" position={[-5.77261, 4.56798, 21.77623]} rotation={[Math.PI, 0, Math.PI / 2]} scale={0.18}><mesh name="Painting3_1" geometry={nodes.Painting3_1.geometry} material={materials.PaintingBorder} /><mesh name="Painting3_2" geometry={nodes.Painting3_2.geometry} material={materials.Painting1} /></group>
              <group name="Painting2" position={[-5.67114, 4.49911, -9.08524]} rotation={[Math.PI, 0, Math.PI / 2]} scale={0.17183}><mesh name="Painting4_1" geometry={nodes.Painting4_1.geometry} material={materials.PaintingBorder} /><mesh name="Painting4_2" geometry={nodes.Painting4_2.geometry} material={materials.Painting3} /></group>
              <group name="Painting" position={[-5.92163, 5.46794, 14.41192]} rotation={[1.57453, -0.00001, Math.PI / 2]} scale={0.13227}><mesh name="Painting5_1" geometry={nodes.Painting5_1.geometry} material={materials.PaintingBorder} /><mesh name="Painting5_2" geometry={nodes.Painting5_2.geometry} material={materials.Painting2} /></group>
              <group name="Levers" position={[-7.99804, 8.45675, 71.8767]} scale={0.11154}><mesh name="Levers_1" geometry={nodes.Levers_1.geometry} material={materials['M_Controls.001']} /><mesh name="Levers_2" geometry={nodes.Levers_2.geometry} material={materials['M_Controls.002']} /></group>
              <mesh name="Cricket_Ball" geometry={nodes.Cricket_Ball.geometry} material={materials['Cricket Ball.002']} position={[-5.62088, 2.6681, 28.22861]} rotation={[Math.PI, -0.63312, Math.PI]} scale={1.42172} />
          </group>
          <group name="Baked">
            <mesh name="Walls" geometry={nodes.Walls.geometry} material={materials.Walls} position={[-5.83, 3.593, 19.997]} rotation={[Math.PI / 2, -1.571, 0]} scale={[1, 1, 0.424]} />
            <mesh name="Roof" geometry={nodes.Roof.geometry} material={materials.Roof} position={[-0.312, 2.053, 69.486]} scale={0.191} />
            <mesh name="Plants" geometry={nodes.Plants.geometry} material={materials.Plants} position={[6.074, 3.271, -14.589]} rotation={[0, 0.379, 0]} scale={[1, 0.521, 1]} />
            <mesh name="Papers" geometry={nodes.Papers.geometry} material={materials.Papers} position={[4.56, 1.678, 9.963]} rotation={[0, -1.258, 0]} scale={4.656} />
            <mesh name="Objects" geometry={nodes.Objects.geometry} material={materials.Objects} position={[-5.922, 5.468, 14.412]} rotation={[1.575, 0, Math.PI / 2]} scale={0.132} />
            <mesh name="Floor" geometry={nodes.Floor.geometry} material={materials.Floor} position={[-0.312, 2.053, 69.486]} scale={0.191} />
            <mesh name="Books" geometry={nodes.Books.geometry} material={materials.Books} position={[-6.245, 6.43, 28.701]} rotation={[Math.PI / 2, 0, -Math.PI / 2]} scale={[1.814, 1.732, 1.732]} />
            <mesh name="Plants2" geometry={nodes.Plants2.geometry} material={materials.Plants2} position={[6.074, 3.271, -14.589]} rotation={[0, 0.379, 0]} scale={[1, 0.521, 1]} />
          </group>
          <group name="Lights">
            <pointLight intensity={0.1} decay={2} color="#fffdd3" position={[0.018, 6.714, -28.742]} rotation={[-Math.PI / 2, 0, 0]} />
            <pointLight intensity={0.1} decay={2} color="#f0e7ff" position={[0.018, 10.273, -13.14]} rotation={[-Math.PI / 2, 0, 0]} />
            <pointLight intensity={0.1} decay={2} color="#f0e7ff" position={[0.018, 10.852, 48.849]} rotation={[-Math.PI / 2, 0, 0]} />
          </group>
        </group>
      </group>

      {/* Exterior model is only visible when outside the train */}
      <group name="Exterior" position={[0.276, 17.189, 43.572]} scale={32.078} visible={!inTrain}>
          <mesh castShadow receiveShadow geometry={nodes.Train_1.geometry} material={materials.PanelMetal} />
          <mesh castShadow receiveShadow geometry={nodes.Train_2.geometry} material={materials['Solar Panel']} />
          <mesh castShadow receiveShadow geometry={nodes.Train_3.geometry} material={materials.TrainWalls} />
          <mesh castShadow receiveShadow geometry={nodes.Train_4.geometry} material={materials.under} />
          <mesh castShadow receiveShadow geometry={nodes.Train_5.geometry} material={materials.TrainLight} />
          <mesh castShadow receiveShadow geometry={nodes.Train_6.geometry} material={materials.CubeMetal} />
          <mesh castShadow receiveShadow geometry={nodes.Train_7.geometry} material={materials.rails} />
          <mesh castShadow receiveShadow geometry={nodes.Train_8.geometry} material={materials.PaintOutsideWhite} />
          <mesh castShadow receiveShadow geometry={nodes.Train_9.geometry} material={materials.GreyPaint} />
          <mesh castShadow receiveShadow geometry={nodes.Train_10.geometry} material={materials.Vent} />
          <mesh castShadow receiveShadow geometry={nodes.Train_11.geometry} material={materials.Tanks} />
          <mesh castShadow receiveShadow geometry={nodes.Train_12.geometry} material={materials.Turbine} />
          <mesh castShadow receiveShadow geometry={nodes.Train_13.geometry} material={materials.PointTurbine} />
          <mesh castShadow receiveShadow geometry={nodes.Train_14.geometry} material={materials.Pipe} />
          <mesh castShadow receiveShadow geometry={nodes.Train_15.geometry} material={materials.Antena} />
          <mesh castShadow receiveShadow geometry={nodes.Train_16.geometry} material={materials.GlowCentre} />
          <mesh castShadow receiveShadow geometry={nodes.Train_17.geometry} material={materials.MetalOutside} />
          <mesh castShadow receiveShadow geometry={nodes.Train_18.geometry} material={materials.GlowRed} />
          <mesh castShadow receiveShadow geometry={nodes.Train_19.geometry} material={materials.Cables} />

          
      </group>

      {/* Train Head interior is only visible when inside the train */}
      <group name="TrainHead" position={[0.036, -29.953, 9.104]} scale={0.453} visible ={!inTrain}>
          <mesh name="TrainHead_1" geometry={nodes.TrainHead_1.geometry} material={materials.Glass} />
          <mesh name="TrainHead_2" geometry={nodes.TrainHead_2.geometry} material={materials.TrainWalls} />
          <mesh name="TrainHead_3" geometry={nodes.TrainHead_3.geometry} material={materials['PaintOutsideWhite.001']} />
      </group>
    
      {/* Exterior lighting is only visible when outside the train */}
      <group visible={!inTrain}>
        <directionalLight castShadow position={[-90, 60, 60]} intensity={3} shadow-normalBias={0.04} />
        <directionalLight castShadow position={[-4.33, 60, 120]} intensity={3} shadow-normalBias={0.04} />
      </group>
    </group>
  );
}

useGLTF.preload('./Train/SpaceTrainV1.glb');