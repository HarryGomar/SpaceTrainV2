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

// Connections are editorially grounded in the archive, not inferred from category alone.
export const projectConnections = [
    {source:7,target:11,reason:'Information extraction from legal texts and software requirements.',strong:true},
    {source:7,target:14,reason:'Turning document references into structured relationships.',strong:true},
    {source:8,target:15,reason:'Catalogue formatting is part of the sustainable auto-parts initiative.',strong:true},
    {source:14,target:15,reason:'Extracting usable data from inconsistent scanned documents.'},
    {source:14,target:16,reason:'Geospatial pipelines and map-based analysis.',strong:true},
    {source:16,target:12,reason:'Predicting demand to compare potential expansion locations.',strong:true},
    {source:12,target:30,reason:'Using INEGI economic and regional data to prioritize locations.'},
    {source:10,target:13,reason:'Modelling football event sequences and tactical patterns.',strong:true},
    {source:9,target:7,reason:'Applying NLP to structure and analyze written texts.'},
    {source:31,target:7,reason:'Universo de Leyes research presented in seminars at UNAM and ITAM.',strong:true},
    {source:31,target:28,reason:'Teaching technical methods through practical work.',strong:true},
    {source:28,target:26,reason:'SolidWorks modelling and fabrication of physical parts.'},
    {source:17,target:24,reason:'Interactive interpretations of classical texts.',strong:true},
    {source:24,target:18,reason:'Building visual, interactive experiences.',strong:true},
    {source:18,target:22,reason:'Personal creative work in interactive worlds.'},
    {source:22,target:23,reason:'Game development.'},
    {source:19,target:20,reason:'Web applications supporting students.'},
    {source:19,target:17,reason:'Angular applications built for students.'},
    {source:23,target:25,reason:'Modelling agents and their behavior in simulated environments.'},
];

const positions = {
    7:[36,18], 8:[58,12], 9:[12,30], 10:[28,38], 11:[18,13],
    12:[85,61], 13:[34,57], 14:[51,36], 15:[78,22], 16:[77,45],
    30:[65,68], 31:[15,48], 17:[35,72], 18:[59,92], 19:[33,91],
    20:[22,77], 21:[86,9], 22:[70,83], 23:[49,59], 24:[47,84],
    25:[89,93], 26:[8,82], 27:[9,95], 28:[9,65],
};
const shortNames = {7:'Universo de Leyes',14:'SEMOVI',16:'Tellus'};
const regions = [
    {category:'NLP',x:36,y:3}, {category:'Data',x:85,y:35},
    {category:'Software',x:53,y:73}, {category:'Hardware',x:10,y:76},
    {category:'Teaching',x:10,y:41},
];

// Coordinates never change on selection or filtering, preserving the reader's bearings.
export function layoutProjectMap(projects, field = 'All') {
    const nodes = projects.map((project,index) => {
        const [x,y] = positions[project.id] || [12 + index % 5 * 18,12 + Math.floor(index / 5) * 18];
        return {...project,x,y,shortName:shortNames[project.id],matches:field==='All'||project.category===field};
    });
    const byId = new Map(nodes.map(node => [node.id,node]));
    const edges = projectConnections.filter(edge => byId.has(edge.source)&&byId.has(edge.target))
        .map(edge => ({...edge,from:byId.get(edge.source),to:byId.get(edge.target)}));
    return {nodes,edges,regions:regions.filter(region=>projects.some(project=>project.category===region.category))};
}
