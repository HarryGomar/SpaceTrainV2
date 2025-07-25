// src/components/Projects.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import projectsData from './projects.json';
import MainContainer from '../MainContainer';
import ProjectGraph from './ProjectGraph';

const DESKTOP_PAGE_SIZE = 4;
const MOBILE_PAGE_SIZE = 6;

// Hook to check window width for responsive logic
const useWindowWidth = () => {
    const [width, setWidth] = useState(window.innerWidth);
    useEffect(() => {
        const handleResize = () => setWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return width;
};

// Hook to get unique values for filters from the data
const useUniqueValues = (data, key) => {
    return useMemo(() => {
        const values = new Set(data.flatMap(item => Array.isArray(item[key]) ? item[key] : [item[key]]));
        return ['All', ...Array.from(values).sort()];
    }, [data, key]);
};

// --- Reusable Filter Components ---

const SelectFilter = ({ title, options, active, onChange }) => (
    <div>
        <h3 className="text-sm font-semibold tracking-widest text-[var(--accent-color)] mb-2">{title}</h3>
        <div className="relative">
            <select value={active} onChange={(e) => onChange(e.target.value)} className="w-full appearance-none bg-[var(--container-background)] border-2 border-[var(--foreground-color)] text-[var(--foreground-color)] text-sm py-2 px-2 pr-8 focus:outline-none focus:border-[var(--selection-color)] transition-colors duration-200">
                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--foreground-color)]">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
        </div>
    </div>
);

const CategoryListFilter = ({ options, active, onChange }) => (
    <div>
        <h3 className="text-sm font-semibold tracking-widest text-[var(--accent-color)] mb-2">CATEGORY</h3>
        <div className="flex flex-col items-start gap-1">
            {options.map(opt => {
                const isActive = active === opt;
                return (
                    <button key={opt} onClick={() => onChange(opt)} className={`flex items-center gap-2 text-left transition-all duration-200 ${isActive ? 'text-[var(--selection-color)] text-base font-bold' : 'text-[var(--foreground-color)] text-sm hover:text-[var(--selection-color)]'}`}>
                        <span className={`transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-0'}`}>&gt;</span>
                        <span>{opt === 'All' ? 'All Categories' : opt}</span>
                    </button>
                );
            })}
        </div>
    </div>
);

const StatusFilter = ({ active, onChange }) => {
    const options = ['All', 'Active', 'Inactive'];
    return (
        <div>
            <h3 className="text-sm font-semibold tracking-widest text-[var(--accent-color)] mb-2">STATUS</h3>
            <div className="flex w-full border-2 border-[var(--foreground-color)] p-1 gap-1 bg-[var(--container-background)]">
                {options.map(opt => (
                    <button key={opt} onClick={() => onChange(opt)} className={`flex-1 py-1 text-xs font-mono transition-all duration-200 ${active === opt ? 'bg-[var(--selection-color)] text-black shadow-inner' : 'bg-transparent text-[var(--foreground-color)] hover:bg-[var(--selection-color)]/20'}`}>{opt.toUpperCase()}</button>
                ))}
            </div>
        </div>
    );
};

const Projects = () => {
    const [projects, setProjects] = useState([]);
    const [currentPage, setCurrentPage] = useState(0);
    const [filters, setFilters] = useState({ category: 'All', status: 'All', scope: 'All', motivation: 'All' });
    const [isGraphView, setIsGraphView] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const navigate = useNavigate();
    const windowWidth = useWindowWidth();
    const isMobile = windowWidth < 1024;

    const pageSize = isMobile ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE;

    useEffect(() => { setProjects(projectsData); }, []);

    const categories = ['All', 'NLP', 'Data', 'Software', 'Hardware'];
    const scopes = useUniqueValues(projects, 'scope');
    const motivations = useUniqueValues(projects, 'motivation');

    const filteredProjects = useMemo(() => {
        return projects.filter(p =>
            (filters.category === 'All' || p.category === filters.category) &&
            (filters.status === 'All' || p.status === filters.status) &&
            (filters.scope === 'All' || p.scope === filters.scope) &&
            (filters.motivation === 'All' || p.motivation === filters.motivation)
        );
    }, [projects, filters]);

    useEffect(() => { setCurrentPage(0); }, [filters, pageSize]);

    const totalPages = Math.ceil(filteredProjects.length / pageSize);
    const paginatedProjects = useMemo(() => {
        return filteredProjects.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
    }, [filteredProjects, currentPage, pageSize]);

    const gridProjects = useMemo(() => {
        if (isMobile) return paginatedProjects;
        const items = Array(DESKTOP_PAGE_SIZE).fill(null);
        paginatedProjects.forEach((project, index) => {
            items[index] = project;
        });
        return items;
    }, [paginatedProjects, isMobile]);

    const handleFilterChange = (type, value) => setFilters(prev => ({ ...prev, [type]: value }));

    const handleNavigation = (direction) => {
        setCurrentPage(prev => (prev + direction + totalPages) % totalPages);
    };

    const responsiveGap = '1.1cqi';

    const FilterPanel = () => (
        <div className="border-2 border-[var(--foreground-color)] bg-[var(--container-background)] p-4 flex flex-col gap-4">
            <CategoryListFilter options={categories} active={filters.category} onChange={(v) => handleFilterChange('category', v)} />
            <SelectFilter title="SCOPE" options={scopes} active={filters.scope} onChange={(v) => handleFilterChange('scope', v)} />
            <SelectFilter title="MOTIVATION" options={motivations} active={filters.motivation} onChange={(v) => handleFilterChange('motivation', v)} />
            <StatusFilter active={filters.status} onChange={(v) => handleFilterChange('status', v)} />
        </div>
    );

    const PaginationControls = () => (
        <div className="flex flex-col gap-3">
            <div className="flex gap-3">
                <button onClick={() => handleNavigation(-1)} disabled={totalPages <= 1} className="w-1/2 h-14 border-2 border-[var(--foreground-color)] bg-[var(--container-background)] text-3xl hover:border-[var(--selection-color)] hover:text-[var(--selection-color)] transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed">&lt;</button>
                <button onClick={() => handleNavigation(1)} disabled={totalPages <= 1} className="w-1/2 h-14 border-2 border-[var(--foreground-color)] bg-[var(--container-background)] text-3xl hover:border-[var(--selection-color)] hover:text-[var(--selection-color)] transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed">&gt;</button>
            </div>
            <div className="flex items-center justify-center w-full h-5 border-2 border-[var(--foreground-color)] bg-[var(--container-background)]">
                {totalPages > 0 &&
                    <div className="flex w-full h-full items-center gap-2">
                        {Array.from({ length: totalPages }).map((_, index) => (
                            <div key={index} className={`h-full w-full transition-colors duration-200 ${index === currentPage ? 'bg-[var(--selection-color)]' : 'bg-[var(--foreground-color)] opacity-25'}`}></div>
                        ))}
                    </div>
                }
            </div>
        </div>
    );

    return (
        <MainContainer isMobile={isMobile}>
            <div
                className="w-full h-full"
                style={!isMobile ? { padding: responsiveGap } : { padding: '3rem 1.5rem 1rem' }}
            >
                {/* --- Main Layout Container --- */}
                <div className={`w-full h-full ${isMobile ? 'flex flex-col' : 'flex'}`} style={{ gap: responsiveGap }}>

                    {/* --- Left Column (Main Content) --- */}
                    <div className={`w-full ${isMobile ? 'order-2' : 'lg:w-4/5'} flex flex-col min-h-0`}>
                        {isGraphView ? (
                            <div className="w-full h-full border-2 border-[var(--foreground-color)] bg-[var(--container-background)]"><ProjectGraph projects={filteredProjects} isMobile={isMobile} /></div>
                        ) : (
                            <div className="flex-grow grid grid-cols-2 grid-rows-2 min-h-0" style={{ gap: responsiveGap }}>
                                {gridProjects.map((project, index) => (
                                    project ? (
                                        <div key={project.id} onClick={() => navigate(`/projects/${project.id}`)} className="cursor-pointer group flex flex-col min-h-0">
                                            <div className="flex-grow overflow-hidden min-h-0">
                                                <img src={project.image} alt={project.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                            </div>
                                            <div className="p-2 border-2 border-[var(--foreground-color)] bg-[var(--container-background)] group-hover:border-[var(--selection-color)] group-hover:text-[var(--selection-color)] transition-colors duration-300">
                                                <h2 className="font-mono text-sm whitespace-nowrap overflow-hidden text-ellipsis">{project.title}</h2>
                                                <p className="text-xs text-[var(--accent-color)]">{project.years}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div key={`placeholder-${index}`} className="hidden lg:block w-full h-full border-2 border-[var(--foreground-color)]/50 bg-transparent"></div>
                                    )
                                ))}
                                {filteredProjects.length === 0 && (
                                    <div className="col-span-2 row-span-2 flex items-center justify-center h-full border-2 border-[var(--foreground-color)]/50">
                                        <p className="text-lg text-[var(--accent-color)]">No projects match the current filters.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* --- Right Column (Sidebar) --- */}
                    <div className={`w-full ${isMobile ? 'order-1' : 'lg:w-1/5'} flex flex-col`} style={{ gap: responsiveGap }}>
                        <div className="flex justify-between items-center lg:hidden mb-4">
                            <h2 className="text-3xl font-bold">PROJECTS</h2>
                            <button onClick={() => setShowFilters(!showFilters)} className="py-2 px-4 border-2 border-[var(--foreground-color)] bg-[var(--container-background)] text-sm">
                                {showFilters ? 'Hide Filters' : 'Show Filters'}
                            </button>
                        </div>

                        <div className={`lg:flex flex-col h-full ${isMobile && !showFilters ? 'hidden' : 'flex'}`} style={{ gap: responsiveGap }}>
                            <div className="hidden lg:block">
                                <h2 className="text-4xl font-bold">PROJECTS</h2>
                            </div>
                            <button onClick={() => setIsGraphView(!isGraphView)} className="w-full py-2 text-sm font-mono tracking-widest uppercase border-y-2 border-[var(--foreground-color)] bg-transparent text-[var(--foreground-color)] transition-all duration-300 hover:border-[var(--selection-color)] hover:text-[var(--selection-color)] hover:bg-[var(--selection-color)]/20 hover:shadow-[0_0_15px_3px_var(--glow-color)]">
                                {isGraphView ? 'View Grid' : 'View Graph'}
                            </button>
                            <FilterPanel />
                            
                            {/* Spacer to push pagination down */}
                            <div className="flex-grow" />

                            {!isGraphView && (
                                <div className="hidden lg:block">
                                    <PaginationControls />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* --- Mobile-only pagination --- */}
                    <div className="lg:hidden order-3 mt-4">
                        {!isGraphView && filteredProjects.length > 0 && <PaginationControls />}
                    </div>
                </div>
            </div>
        </MainContainer>
    );
};

export default Projects;