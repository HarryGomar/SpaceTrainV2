import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as d3 from 'd3';

const scopeRadius = { Small: 7, Medium: 10, Large: 13, Massive: 16 };
const shorten = (text, length) => text.length > length ? `${text.slice(0, length - 1)}…` : text;

const ProjectGraph = ({ projects, isMobile }) => {
    const ref = useRef();
    const navigate = useNavigate();

    useEffect(() => {
        if (!projects || !ref.current) return undefined;

        const element = ref.current;
        const { width, height } = element.getBoundingClientRect();
        const svg = d3.select(element);
        svg.selectAll('*').remove();
        svg.attr('viewBox', `0 0 ${width} ${height}`)
            .attr('role', 'img')
            .attr('aria-label', 'Projects grouped by category. Select a project to open it.');

        if (!projects.length) {
            svg.append('text').attr('x', width / 2).attr('y', height / 2)
                .attr('text-anchor', 'middle').attr('fill', 'var(--accent-color)')
                .text('No projects match the current filters.');
            return undefined;
        }

        const css = getComputedStyle(document.body);
        const selection = css.getPropertyValue('--selection-color').trim() || '#bd95dd';
        const foreground = css.getPropertyValue('--foreground-color').trim() || '#ffeffe';
        const accent = css.getPropertyValue('--accent-color').trim() || '#b7aebe';
        const background = css.getPropertyValue('--background-color').trim() || '#1a1a1a';
        const panel = css.getPropertyValue('--container-background').trim() || '#242124';
        const center = { x: width / 2, y: height / 2 };
        const ring = Math.min(width, height) * (isMobile ? 0.24 : 0.29);
        const categories = [...new Set(projects.map(project => project.category))];

        const nodes = [
            { id: 'root', label: 'PROJECTS', type: 'center', radius: isMobile ? 20 : 26, x: center.x, y: center.y, fx: center.x, fy: center.y },
            ...categories.map((category, index) => {
                const angle = index / categories.length * Math.PI * 2 - Math.PI / 2;
                return { id: `category-${category}`, label: category.toUpperCase(), type: 'category', radius: isMobile ? 13 : 17, x: center.x + Math.cos(angle) * ring, y: center.y + Math.sin(angle) * ring };
            }),
            ...projects.map(project => ({ id: `project-${project.id}`, label: project.title, type: 'project', radius: (scopeRadius[project.scope] || 9) * (isMobile ? 0.82 : 1), data: project })),
        ];
        const links = [
            ...categories.map(category => ({ source: 'root', target: `category-${category}`, type: 'category' })),
            ...projects.map(project => ({ source: `category-${project.category}`, target: `project-${project.id}`, type: 'project' })),
        ];

        const viewport = svg.append('g');
        svg.call(d3.zoom().scaleExtent([0.65, 2.2]).on('zoom', event => viewport.attr('transform', event.transform)))
            .on('dblclick.zoom', null);

        const link = viewport.append('g').selectAll('line').data(links).join('line')
            .attr('stroke', item => item.type === 'category' ? selection : foreground)
            .attr('stroke-opacity', item => item.type === 'category' ? 0.42 : 0.18)
            .attr('stroke-width', item => item.type === 'category' ? 1.5 : 1);

        const node = viewport.append('g').selectAll('g').data(nodes).join('g')
            .attr('tabindex', item => item.type === 'project' ? 0 : null)
            .attr('role', item => item.type === 'project' ? 'button' : null)
            .attr('aria-label', item => item.type === 'project' ? `${item.label}, ${item.data.years}` : null);

        const openProject = (_, item) => {
            if (item.type === 'project') navigate(`/projects/${item.data.id}`, { replace: true });
        };
        node.on('click', openProject).on('keydown', (event, item) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openProject(event, item);
            }
        });

        node.append('circle')
            .attr('r', item => item.radius)
            .attr('fill', item => item.type === 'center' ? selection : item.type === 'category' ? panel : item.data.status === 'Active' ? selection : foreground)
            .attr('fill-opacity', item => item.type === 'project' && item.data.status !== 'Active' ? 0.55 : 1)
            .attr('stroke', item => item.type === 'category' ? selection : background)
            .attr('stroke-width', item => item.type === 'category' ? 2.5 : 2)
            .style('cursor', item => item.type === 'project' ? 'pointer' : 'grab');

        node.filter(item => item.type === 'project').append('title')
            .text(item => `${item.data.title}\n${item.data.category} · ${item.data.scope} · ${item.data.status}\n${item.data.years}`);

        node.append('text')
            .text(item => item.type === 'project' ? shorten(item.label, isMobile ? 19 : 30) : item.label)
            .attr('x', item => item.type === 'center' ? 0 : item.radius + 6).attr('y', 4)
            .attr('text-anchor', item => item.type === 'center' ? 'middle' : 'start')
            .attr('fill', item => item.type === 'center' ? background : foreground)
            .style('font', item => `${item.type !== 'project' ? '700' : '400'} ${item.type === 'category' ? (isMobile ? 10 : 12) : (isMobile ? 8 : 11)}px monospace`)
            .style('paint-order', 'stroke').style('stroke', background).style('stroke-width', 3)
            .style('stroke-linejoin', 'round').style('pointer-events', 'none');

        node.on('mouseenter', function (_, item) {
            if (item.type !== 'project') return;
            d3.select(this).raise().select('circle').attr('stroke', selection).attr('stroke-width', 4);
            d3.select(this).select('text').attr('fill', selection).style('font-weight', 700);
        }).on('mouseleave', function (_, item) {
            if (item.type !== 'project') return;
            d3.select(this).select('circle').attr('stroke', background).attr('stroke-width', 2);
            d3.select(this).select('text').attr('fill', foreground).style('font-weight', 400);
        });

        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(item => item.id).distance(item => item.type === 'category' ? ring : (isMobile ? 48 : 82)).strength(item => item.type === 'category' ? 0.85 : 0.55))
            .force('charge', d3.forceManyBody().strength(item => item.type === 'project' ? (isMobile ? -90 : -180) : -320))
            .force('x', d3.forceX(center.x).strength(0.035)).force('y', d3.forceY(center.y).strength(0.035))
            .force('collide', d3.forceCollide().radius(item => item.radius + (isMobile ? 9 : 15)).iterations(2));

        node.call(d3.drag()
            .on('start', (event, item) => { if (!event.active) simulation.alphaTarget(0.25).restart(); item.fx = item.x; item.fy = item.y; })
            .on('drag', (event, item) => { item.fx = event.x; item.fy = event.y; })
            .on('end', (event, item) => { if (!event.active) simulation.alphaTarget(0); if (item.type !== 'center') { item.fx = null; item.fy = null; } }));

        const padding = isMobile ? 18 : 30;
        simulation.on('tick', () => {
            nodes.forEach(item => {
                if (item.type !== 'center') {
                    item.x = Math.max(padding, Math.min(width - padding, item.x));
                    item.y = Math.max(padding, Math.min(height - padding, item.y));
                }
            });
            link.attr('x1', item => item.source.x).attr('y1', item => item.source.y).attr('x2', item => item.target.x).attr('y2', item => item.target.y);
            node.attr('transform', item => `translate(${item.x},${item.y})`);
        });

        const legend = svg.append('g').attr('transform', `translate(16, ${height - 18})`);
        legend.append('circle').attr('r', 5).attr('fill', selection);
        legend.append('text').attr('x', 10).attr('y', 4).attr('fill', accent).style('font', '10px monospace').text('active');
        legend.append('circle').attr('cx', 62).attr('r', 5).attr('fill', foreground).attr('fill-opacity', 0.55);
        legend.append('text').attr('x', 72).attr('y', 4).attr('fill', accent).style('font', '10px monospace').text('complete');
        legend.append('text').attr('x', 136).attr('y', 4).attr('fill', accent).style('font', '10px monospace').text('node size = scope');

        return () => simulation.stop();
    }, [projects, navigate, isMobile]);

    return <svg ref={ref} className="block h-full w-full touch-none" />;
};

export default ProjectGraph;
