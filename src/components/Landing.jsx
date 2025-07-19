// src/components/Landing.jsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import Point from './Point';
import Popup from './Popup';
import MainContainer from './MainContainer';
import SpinningSphere from './SpinningSphere';
import './GlitchButton.css'; // Renamed for reusability

const pointsOfInterest = [
    { id: 1, x: '20%', y: '52%', tab: 'Move', title: 'Move', text: 'Move using [W] and [S]', image: '/Landing/Walk.png' },
    { id: 2, x: '55%', y: '48%', tab: 'Interact', title: 'Interact', text: 'Learn all about my projects', image: '/Landing/Interact.png' },
    { id: 3, x: '70%', y: '50%', tab: 'Explore', title: 'Sensor Array', text: 'Discover details', image: '/Landing/Find.png' },
    { id: 4, x: '85%', y: '45%', tab: 'Find', title: 'Find', text: 'Locate hidden artifacts.', image: '/Landing/Explore.png' },
];

const TABS = ['Move', 'Interact', 'Explore', 'Find'];

const Landing = () => {
    const navigate = useNavigate();
    const { loading, progress, statusText, setEnterExperience } = useStore();
    const [activeTab, setActiveTab] = useState(null);
    const [selectedPoint, setSelectedPoint] = useState(null);

    const handleEnterExperience = () => {
        setEnterExperience(true);
        navigate('/experience');
    };

    const handleViewProjects = () => {
        navigate('/projects');
    };

    const handlePointClick = (point) => {
        if (selectedPoint?.id === point.id) {
            setSelectedPoint(null);
            setActiveTab(null);
        } else {
            setSelectedPoint(point);
            setActiveTab(point.tab);
        }
    };

    const handleTabClick = (tab) => {
        const pointForTab = pointsOfInterest.find(p => p.tab === tab);
        if (!pointForTab) return;

        if (selectedPoint?.id === pointForTab.id) {
            setSelectedPoint(null);
            setActiveTab(null);
        } else {
            setSelectedPoint(pointForTab);
            setActiveTab(tab);
        }
    };

    const handleClosePopup = () => {
        setSelectedPoint(null);
        setActiveTab(null);
    };

    return (
        <MainContainer>
            <div className="absolute top-0 left-0 w-full h-2 bg-transparent">
                <div className="h-full bg-[var(--accent-color)] transition-all duration-100 ease-linear" style={{ width: `${progress}%` }}></div>
            </div>

            <div className="flex flex-grow gap-2 pt-4">
                <div className="w-[75%] h-full relative" style={{ backgroundImage: `url('/Landing/blueprint.png')`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>
                    {pointsOfInterest.map(point => (
                        <Point key={point.id} point={point} onClick={handlePointClick} isSelected={selectedPoint?.id === point.id} />
                    ))}
                    {selectedPoint && <Popup point={selectedPoint} onClose={handleClosePopup} />}
                </div>

                <div className="w-[25%] flex flex-col gap-2">
                    <div>
                        <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold">HARRY GOMAR</h2>
                        <p className="text-base sm:text-lg md:text-sm leading-tight">Computer Engineering student</p>
                        <p className="text-base text-white/50 text-xs leading-tight">harrygomardawson@gmail.com</p>
                    </div>

                    {/* -- UPDATED STATUS COMPONENT -- */}
                    <div className="border-2 border-white/80 flex-grow bg-[var(--container-background)] rounded shadow-lg shadow-white/5 overflow-hidden flex flex-col p-4 gap-2">
                        <p className="text-xs text-white/70">
                            This personal site serves as a digital portfolio. Use the nodes on the blueprint to learn more. 
                        </p>
                        
                        <div className="w-full border-t-2 border-white/20"></div>

                        <p className="text-xs text-white/50">
                            Skip directly to my projects if not interested in the experience. 
                        </p>

                        <div className="flex justify-center">
                            <button onClick={handleViewProjects} className="glitch-button w-fit">
                                <span aria-hidden></span>ARCHIVES
                                <span className="glitch-button__glitch" aria-hidden>ARCHIVES</span>
                                <span className="glitch-button__tag" aria-hidden>PRJ</span>
                            </button>
                        </div>
                        
                        <div className="flex flex-col justify-center items-center gap-2 py-2 flex-grow">
                            <p className="text-sm text-[var(--accent-color)] h-12 font-bold flex items-center justify-center text-center">
                                {statusText}
                                {loading && progress < 100 && ` (${Math.round(progress)}%)`}
                            </p>
                            <div className="w-full h-30 relative">
                                <SpinningSphere />
                            </div>
                        </div>

                    </div>

                   

                </div>
            </div>

            <div className="w-full flex justify-between items-stretch gap-2">
                <div className="w-[75%] grid grid-cols-4 gap-2">
                    {TABS.map(tab => (
                        <button key={tab} onClick={() => handleTabClick(tab)} className={`h-14 w-full border-2 text-white text-base sm:text-lg md:text-xl transition-all duration-300 flex items-end justify-start p-2 bg-[var(--container-background)] rounded shadow-lg shadow-white/5 ${activeTab === tab ? 'border-t-[8px] border-[var(--selection-color)] text-[var(--selection-color)] button-glow' : 'border-white hover:border-[var(--selection-color)] hover:text-[var(--selection-color)]'}`}>
                            {tab}
                        </button>
                    ))}
                </div>
                <div className="w-[25%]">
                    <button onClick={handleEnterExperience} disabled={loading} className="glitch-button w-full h-14 text-xl sm:text-2xl md:text-3xl disabled:opacity-50 disabled:cursor-not-allowed">
                        <span aria-hidden></span>{loading ? 'LOADING' : 'INITIATE'}
                        <span className="glitch-button__glitch" aria-hidden>{loading ? 'LOADING' : 'INITIATE'}</span>
                        <span className="glitch-button__tag" aria-hidden>EXP</span>
                    </button>
                </div>
            </div>
        </MainContainer>
    );
};

export default Landing;
