// src/components/ProjectDetail.jsx

import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import projectsData from './projects.json';
import MainContainer from '../MainContainer'; 

const useWindowWidth = () => {
    const [width, setWidth] = useState(window.innerWidth);
    useEffect(() => {
        const handleResize = () => setWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return width;
};

const ProjectDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const project = projectsData.find(p => p.id === parseInt(id));
    const [currentPage, setCurrentPage] = useState(0);
    const windowWidth = useWindowWidth();
    const isMobile = windowWidth < 768; // Use md breakpoint

    const contentPages = useMemo(() => {
        if (!project) return [];
        const pages = [];
        if (project.description) {
            pages.push(...project.description.split(/\n\s*\n/).filter(p => p.trim() !== ''));
        }
        if (project.publications && project.publications.length > 0) {
            pages.push({ type: 'publications', title: "Publications & Seminars", items: project.publications });
        }
        if (project.presentations && project.presentations.length > 0) {
            pages.push({ type: 'presentations', title: "Presentations", items: project.presentations });
        }
        return pages;
    }, [project]);
    
    const totalPages = contentPages.length;
    const handlePageNavigation = (direction) => {
        setCurrentPage(prev => (prev + direction + totalPages) % totalPages);
    };

    const ThemedButton = ({ onClick, href, children, isPrimary = false }) => {
        const baseClasses = "w-full text-center px-4 py-3 text-base border-2 transition-colors duration-300";
        const themeClasses = isPrimary 
            ? "border-[var(--selection-color)] bg-[var(--selection-color)] text-[var(--background-color)] hover:bg-transparent hover:text-[var(--selection-color)]"
            : "border-[var(--foreground-color)] bg-transparent text-[var(--foreground-color)] hover:border-[var(--selection-color)] hover:text-[var(--selection-color)]";
        if (href) {
            return <a href={href} target="_blank" rel="noopener noreferrer" className={`${baseClasses} ${themeClasses}`}>{children}</a>;
        }
        return <button onClick={onClick} className={`${baseClasses} ${themeClasses}`}>{children}</button>;
    };
    
    const ExtraInfoSection = ({ title, items }) => {
        if (!items || items.length === 0) return null;
        return (
            <div>
                <h3 className="text-lg font-semibold text-[var(--accent-color)] mb-2">{title}</h3>
                <ul className="list-disc list-inside text-sm space-y-2">
                    {items.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
            </div>
        );
    };

    if (!project) {
        return (
            <MainContainer isMobile={isMobile}>
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-4">
                    <h1 className="text-2xl text-center">Project Not Found</h1>
                    <button onClick={() => navigate('/projects')} className="px-6 py-2 border-2 border-[var(--foreground-color)] bg-[var(--container-background)] text-lg hover:border-[var(--selection-color)] hover:text-[var(--selection-color)] transition-colors duration-300">Return to Archives</button>
                </div>
            </MainContainer>
        );
    }

    return (
        <MainContainer isMobile={isMobile}>
            <div className="flex flex-col gap-6 flex-grow min-h-0 p-4">
                {/* Header Section */}
                <div className="flex justify-between items-start gap-4">
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-bold text-[var(--selection-color)] leading-tight balance-text">{project.title}</h1>
                        <p className="text-base sm:text-lg text-[var(--accent-color)] mt-1">{project.category}</p>
                    </div>
                     <button onClick={() => navigate('/projects')} className="hidden md:block flex-shrink-0 px-3 py-1 border-b-2 border-[var(--foreground-color)] text-[var(--foreground-color)] hover:border-[var(--selection-color)] hover:text-[var(--selection-color)] transition-colors duration-300">&larr; Return</button>
                </div>

                {/* Main Content: two columns on desktop, one on mobile */}
                <div className="flex flex-col md:flex-row gap-8 flex-grow min-h-0">
                    {/* Left Column (Desktop) / Second block (Mobile) */}
                    <div className="w-full md:w-1/2 flex flex-col gap-4 order-2 md:order-1">
                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--accent-color)] font-mono">
                            <span className="bg-[var(--container-background)] px-2 py-1"><strong>Scope:</strong> {project.scope}</span>
                            <span className="bg-[var(--container-background)] px-2 py-1"><strong>Motivation:</strong> {project.motivation}</span>
                            <span className="bg-[var(--container-background)] px-2 py-1"><strong>Years:</strong> {project.years}</span>
                        </div>

                        <div className="flex-grow flex flex-col border-2 border-[var(--foreground-color)] p-4 sm:p-6 bg-[var(--container-background)] min-h-[250px] md:min-h-0">
                            <div className="overflow-y-auto flex-grow pr-2">
                                {typeof contentPages[currentPage] === 'string' ? (
                                    <p className="text-sm leading-relaxed whitespace-pre-line h-full">{contentPages[currentPage]}</p>
                                ) : (
                                    <ExtraInfoSection title={contentPages[currentPage].title} items={contentPages[currentPage].items} />
                                )}
                            </div>
                            {totalPages > 1 && (
                                <div className="flex items-center justify-center gap-4 pt-4 mt-auto">
                                    <button onClick={() => handlePageNavigation(-1)} className="text-2xl hover:text-[var(--selection-color)] transition-colors">&lt;</button>
                                    <div className="flex items-center gap-3 text-[var(--foreground-color)] tracking-widest">
                                        {Array.from({ length: totalPages }).map((_, index) => (
                                            <span key={index} className={index === currentPage ? 'text-[var(--selection-color)]' : 'opacity-50'}>-</span>
                                        ))}
                                    </div>
                                    <button onClick={() => handlePageNavigation(1)} className="text-2xl hover:text-[var(--selection-color)] transition-colors">&gt;</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column (Desktop) / First block (Mobile) */}
                    <div className="w-full md:w-1/2 flex flex-col gap-4 order-1 md:order-2">
                        <div className="w-full">
                            <img src={project.image} alt={project.title} className="w-full h-auto object-cover border-2 border-white/10" />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {project.skills.map(skill => (
                                <div key={skill} className="border-2 border-[var(--foreground-color)] bg-[var(--container-background)] p-2 flex items-center justify-center">
                                    <span className="text-sm text-center text-[var(--accent-color)]">{skill}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4">
                            {project.githubUrl && <ThemedButton href={project.githubUrl}>GitHub</ThemedButton>}
                            {project.liveUrl && <ThemedButton href={project.liveUrl} isPrimary={true}>Live Demo</ThemedButton>}
                        </div>
                    </div>
                </div>
                 <button onClick={() => navigate('/projects')} className="block md:hidden mt-4 w-full text-center py-3 border-2 border-[var(--foreground-color)] bg-[var(--container-background)]">&larr; Return to Archives</button>
            </div>
        </MainContainer>
    );
};

export default ProjectDetail;
