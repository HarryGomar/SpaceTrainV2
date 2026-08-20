// src/components/ProjectDetail.jsx

import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import projectsData from './projects.json';
import MainContainer from '../MainContainer'; 

const parseDescription = (description = '') => {
    return description
        .trim()
        .split(/\n\s*\n/)
        .filter(Boolean)
        .flatMap((block) => {
            const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
            const firstListItem = lines.findIndex(line => line.startsWith('- '));

            if (firstListItem === -1) {
                return [{ type: 'paragraph', text: lines.join(' ') }];
            }

            const parsedBlocks = [];
            const introduction = lines.slice(0, firstListItem).join(' ');

            if (introduction) {
                parsedBlocks.push({
                    type: introduction.endsWith(':') ? 'heading' : 'paragraph',
                    text: introduction,
                });
            }

            parsedBlocks.push({
                type: 'list',
                items: lines.slice(firstListItem).map(line => line.replace(/^-\s*/, '')),
            });

            return parsedBlocks;
        });
};

const useWindowWidth = () => {
    const [width, setWidth] = useState(window.innerWidth);
    useEffect(() => {
        const handleResize = () => setWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return width;
};

const ProjectDetail = ({ embedded = false }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const project = projectsData.find(p => p.id === parseInt(id));
    const [currentPage, setCurrentPage] = useState(0);
    const windowWidth = useWindowWidth();
    const isEmbedded = embedded || window.location.pathname === '/experience';
    const isMobile = !isEmbedded && windowWidth < 768;

    const contentSections = useMemo(() => {
        if (!project) return [];
        const sections = [{
            id: 'overview',
            label: 'Overview',
            type: 'description',
            blocks: parseDescription(project.description),
        }];
        if (project.publications && project.publications.length > 0) {
            sections.push({ id: 'publications', label: 'Publications', title: 'Publications & Seminars', items: project.publications });
        }
        if (project.presentations && project.presentations.length > 0) {
            sections.push({ id: 'presentations', label: 'Presentations', title: 'Presentations', items: project.presentations });
        }
        return sections;
    }, [project]);

    useEffect(() => {
        setCurrentPage(0);
    }, [id]);

    const activeSection = contentSections[currentPage] || contentSections[0];
    const handleReturn = () => navigate(isEmbedded ? '/projects' : '/', { replace: !isEmbedded });

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
            <MainContainer isMobile={isMobile} contained={isEmbedded}>
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-4">
                    <h1 className="text-2xl text-center">Project Not Found</h1>
                    <button onClick={handleReturn} className="px-6 py-2 border-2 border-[var(--foreground-color)] bg-[var(--container-background)] text-lg hover:border-[var(--selection-color)] hover:text-[var(--selection-color)] transition-colors duration-300">{isEmbedded ? 'Return to Archives' : 'Return to Main'}</button>
                </div>
            </MainContainer>
        );
    }

    return (
        <MainContainer isMobile={isMobile} contained={isEmbedded}>
            <div className="flex h-full flex-col gap-6 min-h-0 p-4">
                {/* Header Section */}
                <div className="flex justify-between items-start gap-4">
                    <div>
                        <h1 className={`${isMobile ? 'text-3xl' : 'text-4xl'} font-bold text-[var(--selection-color)] leading-tight balance-text`}>{project.title}</h1>
                        <p className={`${isMobile ? 'text-base' : 'text-lg'} text-[var(--accent-color)] mt-1`}>{project.category}</p>
                    </div>
                    {!isMobile && <button onClick={handleReturn} className="flex-shrink-0 px-3 py-1 border-b-2 border-[var(--foreground-color)] text-[var(--foreground-color)] hover:border-[var(--selection-color)] hover:text-[var(--selection-color)] transition-colors duration-300">&larr; {isEmbedded ? 'Return to Archives' : 'Return to Main'}</button>}
                </div>

                {/* Main Content: two columns on desktop, one on mobile */}
                <div data-testid="project-detail-layout" className={`flex ${isMobile ? 'flex-col' : 'flex-row'} gap-8 flex-grow min-h-0`}>
                    {/* Left Column (Desktop) / Second block (Mobile) */}
                    <div className={`${isMobile ? 'w-full order-2' : 'w-1/2 order-1'} flex flex-col gap-4 min-h-0`}>
                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--accent-color)] font-mono">
                            <span className="bg-[var(--container-background)] px-2 py-1"><strong>Scope:</strong> {project.scope}</span>
                            <span className="bg-[var(--container-background)] px-2 py-1"><strong>Motivation:</strong> {project.motivation}</span>
                            <span className="bg-[var(--container-background)] px-2 py-1"><strong>Years:</strong> {project.years}</span>
                        </div>

                        <div className={`flex-grow flex flex-col overflow-hidden border-2 border-[var(--foreground-color)] ${isMobile ? 'p-4 min-h-[250px]' : 'p-6 min-h-0'} bg-[var(--container-background)]`}>
                            {contentSections.length > 1 && (
                                <div role="tablist" aria-label="Project information" className="flex flex-wrap gap-2 pb-4 mb-4 border-b border-[var(--foreground-color)]/30">
                                    {contentSections.map((section, index) => (
                                        <button
                                            key={section.id}
                                            type="button"
                                            role="tab"
                                            aria-selected={index === currentPage}
                                            onClick={() => setCurrentPage(index)}
                                            className={`px-3 py-2 border ${isMobile ? 'text-xs' : 'text-sm'} transition-colors duration-200 ${index === currentPage ? 'border-[var(--selection-color)] bg-[var(--selection-color)] text-black' : 'border-[var(--foreground-color)]/50 hover:border-[var(--selection-color)] hover:text-[var(--selection-color)]'}`}
                                        >
                                            {section.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div role="tabpanel" className="min-h-0 overflow-y-auto pr-2">
                                {activeSection?.type === 'description' ? (
                                    <div className="space-y-4 text-sm leading-relaxed">
                                        {activeSection.blocks.map((block, index) => {
                                            if (block.type === 'heading') {
                                                return <h3 key={index} className="text-base font-semibold text-[var(--accent-color)]">{block.text}</h3>;
                                            }
                                            if (block.type === 'list') {
                                                return (
                                                    <ul key={index} className="space-y-3">
                                                        {block.items.map((item, itemIndex) => (
                                                            <li key={itemIndex} className="flex gap-3">
                                                                <span aria-hidden="true" className="text-[var(--selection-color)]">&gt;</span>
                                                                <span>{item}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                );
                                            }
                                            return <p key={index}>{block.text}</p>;
                                        })}
                                    </div>
                                ) : (
                                    <ExtraInfoSection title={activeSection?.title} items={activeSection?.items} />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column (Desktop) / First block (Mobile) */}
                    <div className={`${isMobile ? 'w-full order-1' : 'w-1/2 order-2'} flex flex-col gap-4 min-h-0`}>
                        <div className="w-full flex-grow min-h-[220px] overflow-hidden bg-black border-2 border-white/10">
                            <img src={project.image} alt={project.title} className="w-full h-full object-contain" />
                        </div>
                        <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-3'} gap-2`}>
                            {project.skills.map(skill => (
                                <div key={skill} className="border-2 border-[var(--foreground-color)] bg-[var(--container-background)] p-2 flex items-center justify-center">
                                    <span className="text-sm text-center text-[var(--accent-color)]">{skill}</span>
                                </div>
                            ))}
                        </div>
                        <div className={`flex ${isMobile ? 'flex-col' : 'flex-row'} gap-4`}>
                            {project.githubUrl && <ThemedButton href={project.githubUrl}>GitHub</ThemedButton>}
                            {project.liveUrl && <ThemedButton href={project.liveUrl} isPrimary={true}>Live Demo</ThemedButton>}
                        </div>
                    </div>
                </div>
                {isMobile && <button onClick={handleReturn} className="mt-4 w-full text-center py-3 border-2 border-[var(--foreground-color)] bg-[var(--container-background)]">&larr; {isEmbedded ? 'Return to Archives' : 'Return to Main'}</button>}
            </div>
        </MainContainer>
    );
};

export default ProjectDetail;
