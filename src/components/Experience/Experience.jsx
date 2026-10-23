// src/components/Experience.jsx
import React, { Suspense,useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, KeyboardControls, Html, useProgress } from '@react-three/drei';
import SpaceBox from './SpaceBox';
import Train from './Train';
import OnScreenControls from './OnScreenControls';
import MobileDisplay from './MobileDisplay';
import useCompactViewport from '../../hooks/useCompactViewport';
import useTrainStore from '../../store/useTrainStore';

function TrainLoading() {
    const { progress } = useProgress();
    return <Html center><p role="status" style={{color:'#ffeffe',whiteSpace:'nowrap',fontSize:'14px'}}>Loading train{Number.isFinite(progress)&&progress>0?` · ${Math.round(progress)}%`:''}</p></Html>;
}

const Experience = () => {
    const compact=useCompactViewport();
    const [mobileScreen,setMobileScreen]=useState(null);
    const projectsVisible=useTrainStore(state=>state.projectsVisible);
    const iframeVisible=useTrainStore(state=>state.iframeVisible);
    const requestFocusExit=useTrainStore(state=>state.requestFocusExit);
    const screen=compact?(mobileScreen||(projectsVisible?'projects':iframeVisible?'terminal':null)):null;
    const closeScreen=()=>{setMobileScreen(null);if(projectsVisible||iframeVisible)requestFocusExit();};
    return (
        <KeyboardControls
            map={[
                { name: 'forward', keys: ['ArrowUp', 'w', 'W'] },
                { name: 'backward', keys: ['ArrowDown', 's', 'S'] },
            ]}
        >
            <div className="experience-shell">
                <Canvas
                    shadows={!compact}
                    dpr={[1,compact?1.5:2]}
                    frameloop={screen?'demand':'always'}
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
                        <Train compact={compact} scale={0.04} position={[0, 0, -1]} />
                    </Suspense>
                </Canvas>
                {screen?<MobileDisplay screen={screen} onClose={closeScreen}/>:<OnScreenControls onOpenProjects={()=>setMobileScreen('projects')} onOpenTerminal={()=>setMobileScreen('terminal')}/>}
            </div>
        </KeyboardControls>
    );
};

export default Experience;
