// src/components/ProjectGraph.jsx

import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as d3 from 'd3';

const ProjectGraph = ({ projects }) => {
    const ref = useRef();
    const navigate = useNavigate();

    useEffect(() => {
        if (!projects || !ref.current) return;

        const container = ref.current;
        const { width, height } = container.getBoundingClientRect();

        // Clear any previous render
        d3.select(container).selectAll("*").remove();
        
        // If there are no projects after filtering, display a message.
        if (projects.length === 0) {
            d3.select(container)
              .append("text")
              .attr("x", width / 2)
              .attr("y", height / 2)
              .attr("text-anchor", "middle")
              .attr("fill", "var(--accent-color)")
              .style("font-size", "16px")
              .text("No projects match the current filters.");
            return;
        }

        // --- 1. Data Processing ---
        const categories = [...new Set(projects.map(p => p.category))];
        const nodes = [
            { id: 'PROJECTS', type: 'center', radius: 30 },
            ...categories.map(c => ({ id: c, type: 'category', radius: 20 })),
            ...projects.map(p => ({ id: p.title, type: 'project', radius: 12, data: p }))
        ];
        const links = [
            ...categories.map(c => ({ source: 'PROJECTS', target: c })),
            ...projects.map(p => ({ source: p.category, target: p.title }))
        ];

        // --- 2. D3 Setup ---
        const svg = d3.select(container);

        // Get theme colors from CSS variables
        const style = getComputedStyle(document.body);
        const selectionColor = style.getPropertyValue('--selection-color').trim() || '#bd95dd';
        const foregroundColor = style.getPropertyValue('--foreground-color').trim() || '#ffeffe';
        const backgroundColor = style.getPropertyValue('--background-color').trim() || '#1a1a1a';
        // A new, distinct color for category nodes to make them stand out.
        const categoryColor = '#bd95dd';

        // --- 3. Simulation ---
        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id).distance(d => d.source.type === 'center' ? Math.min(width, height) / 4 : Math.min(width, height) / 8).strength(0.7))
            .force("charge", d3.forceManyBody().strength(-200))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide().radius(d => d.radius + 10));

        // --- 4. Drawing Elements ---
        const link = svg.append("g")
            .attr("stroke", foregroundColor)
            .attr("stroke-opacity", 0.3)
            .selectAll("line")
            .data(links)
            .join("line");

        const node = svg.append("g")
            .selectAll("g")
            .data(nodes)
            .join("g")
            .call(drag(simulation));

        node.append("circle")
            .attr("r", d => d.radius)
            .attr("fill", d => {
                if (d.type === 'center') return selectionColor;
                if (d.type === 'category') return categoryColor; // Use the new color
                return foregroundColor;
            })
            .attr("stroke", backgroundColor)
            .attr("stroke-width", 2)
            .style("cursor", d => d.type === 'project' ? 'pointer' : 'move')
            .on("click", (event, d) => {
                if (d.type === 'project') {
                    navigate(`/projects/${d.data.id}`);
                }
            })
            // Add a subtle glow on hover to project nodes
            .on("mouseover", function(event, d) {
                if (d.type === 'project') {
                    d3.select(this).attr("stroke", selectionColor);
                }
            })
            .on("mouseout", function(event, d) {
                if (d.type === 'project') {
                    d3.select(this).attr("stroke", backgroundColor);
                }
            });
        
        node.append("text")
            .text(d => d.id)
            .attr("x", d => d.radius + 5)
            .attr("y", 4)
            .attr("fill", d => d.type === 'center' ? backgroundColor : foregroundColor)
            .style("font-size", "12px")
            .style("font-family", "monospace")
            .style("pointer-events", "none")
            .style("text-shadow", `0 0 5px ${backgroundColor}`);


        // --- 5. Ticking the Simulation ---
        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node.attr("transform", d => `translate(${d.x},${d.y})`);
        });

        // --- 6. Drag Functionality ---
        function drag(simulation) {
            function dragstarted(event, d) {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            }
            function dragged(event, d) {
                d.fx = event.x;
                d.fy = event.y;
            }
            function dragended(event, d) {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            }
            return d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended);
        }

    }, [projects, navigate]);

    return <svg ref={ref} style={{ width: '100%', height: '100%' }} />;
};

export default ProjectGraph;
