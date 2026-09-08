import archive from '../Projects/projects.json';
import { profile } from '../../data/profile';

const cvIds = { leyes:7, tellus:16, semovi:14, informality:30, autoparts:15, cosmic:11 };
const cvById = new Map(profile.projects.map(project => [cvIds[project.id], project]));

export const homeProjects = archive.map(project => {
    const cv = cvById.get(project.id);
    return {
        ...project,
        title: cv?.title || project.title,
        summary: cv?.summary || project.description.split(/\.\s|\.\n/)[0].replace(/\.$/, '') + '.',
        description: cv ? `${cv.detail}\n\n${cv.outcome}` : project.description,
        years: project.id === 7 ? '2022–2025' : project.id === 11 ? '2022–2023' : project.years,
    };
});

export const selectedIds = [7,16,14,30];
export const fields = ['NLP','Data','Software','Hardware','Teaching'];
export const projectNumber = id => String(homeProjects.findIndex(project => project.id === id) + 1).padStart(2,'0');

// Fixed, separated clusters avoid a moving force layout and keep labels predictable.
export function layoutProjectMap(projects, field = 'All') {
    const clusters = {
        NLP: {x:73,y:23,r:15},
        Data: {x:71,y:71,r:15},
        Software: {x:25,y:43,r:17},
        Hardware: {x:24,y:83,r:10},
        Teaching: {x:23,y:10,r:10},
    };
    const visible = field === 'All' ? projects : projects.filter(project => project.category === field);
    if (field !== 'All') {
        const columns = Math.min(3, visible.length);
        const rows = Math.ceil(visible.length / columns);
        return {
            hubs: [{category:field,x:50,y:7}],
            nodes: visible.map((project,i) => ({
                ...project,
                x: columns === 1 ? 50 : 15 + (i % columns) * 70 / (columns - 1),
                y: rows === 1 ? 48 : 29 + Math.floor(i / columns) * 53 / (rows - 1),
                hubX:50,hubY:7,
            })),
        };
    }
    const hubs = fields.filter(category => visible.some(project => project.category === category))
        .map(category => ({category,...clusters[category]}));
    const nodes = hubs.flatMap(hub => {
        const members = visible.filter(project => project.category === hub.category);
        return members.map((project,i) => {
            const angle = i / members.length * Math.PI * 2 - Math.PI / 2;
            return {
                ...project,
                x: members.length === 1 ? hub.x + 12 : hub.x + Math.cos(angle) * hub.r,
                y: members.length === 1 ? hub.y + 1 : hub.y + Math.sin(angle) * hub.r,
                hubX:hub.x,hubY:hub.y,
            };
        });
    });
    return {hubs,nodes};
}
