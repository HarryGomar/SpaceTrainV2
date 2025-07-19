// src/components/ProjectDetail.jsx

import React, { useRef, useLayoutEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import projectsData from './projects.json';
import MainContainer from '../MainContainer'; 

const ProjectDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const project = projectsData.find(p => p.id === parseInt(id));
    const titleRef = useRef(null);
    const [currentPage, setCurrentPage] = useState(0);

    useLayoutEffect(() => {
        const element = titleRef.current;
        if (!element) return;
        const style = window.getComputedStyle(element);
        const lineHeight = parseFloat(style.lineHeight);
        element.style.maxHeight = 'none';
        const twoLineHeight = lineHeight * 2.1;
        if (element.scrollHeight > twoLineHeight) {
            let currentFontSize = parseFloat(style.fontSize);
            while (element.scrollHeight > twoLineHeight && currentFontSize > 12) {
                currentFontSize--;
                element.style.fontSize = `${currentFontSize}px`;
            }
        }
        element.style.maxHeight = `${twoLineHeight}px`;
        element.style.overflow = 'hidden';
    }, [project?.title]);

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
        const baseClasses = "px-4 py-2 text-sm sm:text-base border-2 transition-colors duration-300";
        const themeClasses = isPrimary 
            ? "border-[var(--selection-color)] bg-[var(--selection-color)] text-[var(--background-color)] hover:bg-transparent hover:text-[var(--selection-color)]"
            : "border-[var(--foreground-color)] bg-transparent text-[var(--foreground-color)] hover:border-[var(--selection-color)] hover:text-[var(--selection-color)]";
        if (href) {
            return <a href={href} target="_blank" rel="noopener noreferrer" className={`${baseClasses} ${themeClasses} inline-block text-center`}>{children}</a>;
        }
        return <button onClick={onClick} className={`${baseClasses} ${themeClasses}`}>{children}</button>;
    };
    
    const ExtraInfoSection = ({ title, items }) => {
        if (!items || items.length === 0) return null;
        return (
            <div>
                <h3 className="text-lg font-semibold text-[var(--accent-color)] mb-2">{title}</h3>
                <ul className="list-disc list-inside text-xs sm:text-sm space-y-2">
                    {items.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
            </div>
        );
    };

    if (!project) {
        return (
            <MainContainer>
                <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                    <h1 className="text-2xl sm:text-3xl md:text-4xl">Project Not Found</h1>
                    <button onClick={() => navigate('/projects')} className="px-4 py-2 sm:px-6 sm:py-2 border-4 border-[var(--foreground-color)] bg-[var(--container-background)] text-lg sm:text-xl md:text-2xl hover:border-[var(--selection-color)] hover:text-[var(--selection-color)] transition-colors duration-300">Return to Archives</button>
                </div>
            </MainContainer>
        );
    }

    return (
        <MainContainer>
            <div className="flex flex-col md:flex-row gap-8 flex-grow min-h-0">
                <div className="w-full md:w-1/2 flex flex-col gap-4">
                    <div>
                        <h1 ref={titleRef} className="text-3xl sm:text-4xl md:text-5xl font-bold mb-1 text-[var(--selection-color)] leading-tight">{project.title}</h1>
                        <p className="text-base sm:text-lg md:text-xl text-[var(--accent-color)]">{project.category}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-[var(--accent-color)] font-mono">
                            <span className="bg-[var(--container-background)] px-2 py-1"><strong>Scope:</strong> {project.scope}</span>
                            <span className="bg-[var(--container-background)] px-2 py-1"><strong>Motivation:</strong> {project.motivation}</span>
                            <span className="bg-[var(--container-background)] px-2 py-1"><strong>Years:</strong> {project.years}</span>
                        </div>
                    </div>

                    <div className="flex-grow flex flex-col border-2 border-[var(--foreground-color)] p-4 sm:p-6 bg-[var(--container-background)] min-h-0">
                        <div className="overflow-hidden flex-grow">
                            {typeof contentPages[currentPage] === 'string' ? (
                                <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-line h-full">{contentPages[currentPage]}</p>
                            ) : (
                                <ExtraInfoSection title={contentPages[currentPage].title} items={contentPages[currentPage].items} />
                            )}
                        </div>
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-4 pt-4 mt-auto">
                                <button onClick={() => handlePageNavigation(-1)} className="text-xl hover:text-[var(--selection-color)] transition-colors">&lt;</button>
                                <div className="flex items-center gap-3 text-[var(--foreground-color)] tracking-widest">
                                    {Array.from({ length: totalPages }).map((_, index) => (
                                        <span key={index} className={index === currentPage ? 'text-[var(--selection-color)]' : 'opacity-50'}>-</span>
                                    ))}
                                </div>
                                <button onClick={() => handlePageNavigation(1)} className="text-xl hover:text-[var(--selection-color)] transition-colors">&gt;</button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="w-full md:w-1/2 flex flex-col">
                    <div>
                        <button onClick={() => navigate('/projects')} className="px-3 py-1 border-b-2 border-[var(--foreground-color)] text-[var(--foreground-color)] hover:border-[var(--selection-color)] hover:text-[var(--selection-color)] transition-colors duration-300">&larr; Return to Archives</button>
                    </div>
                    <div className="mt-auto flex flex-col gap-6 pt-6">
                        <div className="w-full">
                            <img src={project.image} alt={project.title} className="w-full h-auto object-cover" />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {project.skills.map(skill => (
                                <div key={skill} className="border-2 border-[var(--foreground-color)] bg-[var(--container-background)] p-2 flex items-center justify-center">
                                    <span className="text-sm text-center text-[var(--accent-color)]">{skill}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-4">
                            {project.githubUrl && <ThemedButton href={project.githubUrl}>GitHub</ThemedButton>}
                            {project.liveUrl && <ThemedButton href={project.liveUrl} isPrimary={true}>Live Demo</ThemedButton>}
                        </div>
                    </div>
                </div>
            </div>
        </MainContainer>
    );
};

export default ProjectDetail;