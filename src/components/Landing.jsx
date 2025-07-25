// src/components/Landing.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import Point from './Point';
import Popup from './Popup';
import MainContainer from './MainContainer';
import SpinningSphere from './SpinningSphere';
import './GlitchButton.css';
import './ScanButton.css';

const pointsOfInterest = [
    { id: 1, x: '20%', y: '52%', tab: 'Move', title: 'Move', text: 'Move using [W] and [S] when inside the train', image: '/Landing/Walk.png' },
    { id: 2, x: '55%', y: '48%', tab: 'Interact', title: 'Interact', text: 'Interactable objects are highlighted when hovered', image: '/Landing/Interact.png' },
    { id: 3, x: '70%', y: '50%', tab: 'Explore', title: 'Explore', text: 'Discover details about me', image: '/Landing/Find.png' },
    { id: 4, x: '85%', y: '45%', tab: 'Find', title: 'Find', text: 'Enter the train to explore its secrets', image: '/Landing/Explore.png' },
];

const TABS = ['Move', 'Interact', 'Explore', 'Find'];

// Hook to get window width for mobile detection
const useWindowWidth = () => {
    const [width, setWidth] = useState(window.innerWidth);
    useEffect(() => {
        const handleResize = () => setWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return width;
};

// Hook to get window height for small screen detection (for sphere)
const useWindowHeight = () => {
    const [height, setHeight] = useState(window.innerHeight);
    useEffect(() => {
        const handleResize = () => setHeight(window.innerHeight);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return height;
};

const Landing = () => {
    const navigate = useNavigate();
    const { loading, progress, statusText, setEnterExperience } = useStore();
    const [activeTab, setActiveTab] = useState(null);
    const [selectedPoint, setSelectedPoint] = useState(null);
    const blueprintRef = useRef(null);

    const windowWidth = useWindowWidth();
    const windowHeight = useWindowHeight();

    const isMobile = windowWidth < 500;
    // Restore original logic for hiding sphere on short screens
    const isSmallScreen = windowHeight < 400;

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

        if (isMobile) {
            setTimeout(() => {
                blueprintRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    };

    const handleClosePopup = () => {
        setSelectedPoint(null);
        setActiveTab(null);
    };
    
    const responsiveGap = isMobile ? '1.5rem' : '1.1cqi';

    return (
        <MainContainer isMobile={isMobile}>
            {/* Progress bar */}
            <div className="absolute top-0 left-0 w-full bg-transparent z-20" style={{ height: '0.55cqi' }}>
                <div className="h-full bg-[var(--accent-color)] transition-all duration-100 ease-linear" style={{ width: `${progress}%` }}></div>
            </div>

            {/* Main layout container */}
            <div
                className={`w-full h-full ${isMobile ? 'flex flex-col' : ''}`}
                style={isMobile
                    ? { gap: responsiveGap, padding: '3rem 1.5rem 1rem' }
                    : { padding: '1.1cqi', paddingTop: '1.65cqi' }
                }
            >
                {/* DESKTOP LAYOUT WRAPPER */}
                <div className={`w-full h-full ${isMobile ? '' : 'flex flex-col'}`} style={{gap: isMobile ? '' : responsiveGap}}>

                    {/* TOP ROW (Desktop) / MOBILE ORDERING CONTAINER */}
                    <div className={`w-full ${isMobile ? 'flex flex-col order-1' : 'h-[92%] flex'}`} style={{gap: responsiveGap}}>
                        {/* Cell 1,1: Blueprint Area (Desktop) / Order 4 (Mobile) */}
                        <div
                            ref={blueprintRef}
                            className={`relative ${isMobile ? 'order-4' : 'w-[75%] h-full'}`}
                            style={isMobile ? { width: '100%', height: 'auto', aspectRatio: '1 / 1', marginBottom: '1rem' } : {}}
                        >
                            <div className="w-full h-full" style={{ backgroundImage: `url('/Landing/blueprint.png')`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>
                                {pointsOfInterest.map(point => (
                                    <Point key={point.id} point={point} onClick={handlePointClick} isSelected={selectedPoint?.id === point.id} />
                                ))}
                                {selectedPoint && <Popup point={selectedPoint} onClose={handleClosePopup} isMobile={isMobile} />}
                            </div>
                        </div>

                        {/* Cell 1,2: Header & Description Area (Desktop) / Order 1 (Mobile) */}
                        <div className={`flex flex-col ${isMobile ? 'order-1' : 'w-[25%] h-full'}`} style={{gap: responsiveGap}}>
                            {/* Header Text */}
                            <div className="w-full flex flex-col justify-center items-start text-left">
                                <h2 className="font-bold leading-none" style={{ fontSize: isMobile ? '2.75rem' : '6cqi' }}>HARRY</h2>
                                <h2 className="font-bold leading-none" style={{ fontSize: isMobile ? '2.75rem' : '6cqi' }}>GOMAR</h2>
                                <p className="leading-tight text-white/80 mt-2" style={{ fontSize: isMobile ? '1rem' : '1.5cqi' }}>Computer Engineering student</p>
                                <p className="text-white/50 leading-tight" style={{ fontSize: isMobile ? '1rem' : '1.5cqi' }}>harrygomardawson@gmail.com</p>
                            </div>
                            {/* Description Container */}
                            <div className="flex-grow border-2 border-white/80 bg-[var(--container-background)] rounded shadow-lg shadow-white/5 flex flex-col min-h-0" style={{ padding: isMobile ? '1rem' : '1.1cqi' }}>
                                <div className="flex flex-col justify-start" style={{ flex: '3 1 0%', gap: isMobile ? '1rem' : '1.1cqi' }}>
                                    <p className="text-white/70 leading-snug" style={{ fontSize: isMobile ? '1rem' : '1.6cqi' }}>This personal site serves as a digital portfolio. Use the nodes on the blueprint to learn more.</p>
                                    <div className="w-full border-t-2 border-white/20"></div>
                                    <p className="text-white/50 leading-snug" style={{ fontSize: isMobile ? '1rem' : '1.5cqi' }}>Skip directly to my projects if not interested in the experience.</p>
                                    <div className="flex justify-center items-center">
                                        <button onClick={handleViewProjects} className="scan-button" style={{ fontSize: isMobile ? '1rem' : '1.5cqi', padding: '0.75em 1.5em' }}><span>ARCHIVES</span></button>
                                    </div>
                                </div>

                                {/* Sphere container - logic restored */}
                                {!isMobile && (
                                    <div className="flex flex-col justify-center items-center min-h-0" style={{ flex: '2 1 0%', gap: '0.55cqi', paddingTop: '0.2cqi' }}>
                                        <p className="font-bold flex items-center justify-center text-center flex-shrink-0 text-[var(--accent-color)]" style={{ fontSize: '1.3cqi' }}>
                                            {statusText}
                                            {loading && progress < 100 && ` (${Math.round(progress)}%)`}
                                        </p>
                                        <div className="w-full h-full relative"><SpinningSphere /></div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* BOTTOM ROW (Desktop) / MOBILE ORDERING CONTAINER */}
                    <div className={`w-full ${isMobile ? 'flex flex-col' : 'h-[8%] flex'}`} style={{gap: responsiveGap}}>
                        {/* Cell 2,1: Tabs Area (Desktop) / Order 3 (Mobile) */}
                        <div className={`${isMobile ? 'order-3' : 'w-[75%] h-full'}`}>
                            <div className={`w-full h-full grid ${isMobile ? 'grid-cols-2' : 'grid-cols-4'}`} style={{ gap: responsiveGap }}>
                                {TABS.map(tab => (
                                    <button key={tab} onClick={() => handleTabClick(tab)} className={`w-full h-full border-2 transition-all duration-300 flex items-end justify-start bg-[var(--container-background)] rounded shadow-lg shadow-white/5 ${activeTab === tab ? 'border-[var(--selection-color)] text-[var(--selection-color)] button-glow' : 'text-white border-white hover:border-[var(--selection-color)] hover:text-[var(--selection-color)]'}`} style={{fontSize: isMobile ? '1rem' : '2.2cqi', padding: isMobile ? '1rem' : '0.8cqi', minHeight: isMobile ? '80px' : 'auto', borderTopWidth: activeTab === tab ? (isMobile ? '4px' : '0.55cqi') : '2px',}}><span className="leading-none">{tab}</span></button>
                                ))}
                            </div>
                        </div>
                        {/* Cell 2,2: Initiate Button Area (Desktop) / Order 2 (Mobile) */}
                        <div className={`${isMobile ? 'order-2' : 'w-[25%] h-full'}`} style={isMobile ? { height: '60px' } : {}}>
                            <button onClick={handleEnterExperience} disabled={loading} className="glitch-button w-full h-full disabled:opacity-50 disabled:cursor-not-allowed" style={{ fontSize: isMobile ? '1.5rem' : '3cqi' }}><span aria-hidden></span>{loading ? 'LOADING' : 'INITIATE'}<span className="glitch-button__glitch" aria-hidden>{loading ? 'LOADING' : 'INITIATE'}</span><span className="glitch-button__tag" aria-hidden>EXP</span></button>
                        </div>
                    </div>
                </div>
            </div>
        </MainContainer>
    );
};

export default Landing;
