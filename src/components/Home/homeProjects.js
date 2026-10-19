import archive from '../Projects/projects.json';
import { profile } from '../../data/profile';

const cvIds = { leyes:7, tellus:16, semovi:14, informality:30, autoparts:15, cosmic:11 };
const cvById = new Map(profile.projects.map(project => [cvIds[project.id], project]));

// Research topics lead the page; the rest describe what else the archive contains.
export const topics = [
    {id:'nlp',name:'NLP and information extraction',label:'NLP',research:true,x:18,y:15,
        summary:'Turning legal texts, catalogues, requirements and scanned records into structured data.',highlights:[7,14]},
    {id:'representation',name:'Representation learning',label:'Representation learning',research:true,x:57,y:13,
        summary:'Embedding-based methods for text, places and sequences, now on Mantis with the Kellis Lab at MIT CSAIL.',highlights:[16,9]},
    {id:'geospatial',name:'Geospatial and public data',label:'Geospatial data',research:true,x:84,y:40,
        summary:'Location planning and policy analysis built on public and economic data.',highlights:[30,12]},
    {id:'software',name:'Software and games',label:'Software',x:62,y:80,
        summary:'Web apps, games and simulations, built end to end.'},
    {id:'hardware',name:'Hardware',label:'Hardware',x:14,y:88,
        summary:'Digital logic, embedded systems and fabrication.'},
    {id:'teaching',name:'Teaching',label:'Teaching',x:14,y:62,
        summary:'Applied AI courses at MIT and hands-on workshops at ITAM.'},
];
export const topicById = new Map(topics.map(topic => [topic.id, topic]));

// The first topic is the project's home in the archive; the others are real overlaps.
const projectTopics = {
    7:['nlp','representation'], 8:['nlp'], 9:['nlp','representation'], 10:['representation'], 11:['nlp'],
    12:['geospatial'], 13:['geospatial'], 14:['geospatial','nlp'], 15:['nlp'], 16:['geospatial','representation'],
    30:['geospatial'], 31:['teaching'], 17:['software','teaching'], 18:['software'], 19:['software'],
    20:['software'], 21:['software'], 22:['software'], 23:['software'], 24:['software'],
    25:['software'], 26:['hardware'], 27:['hardware'], 28:['hardware','teaching'],
};

const shortNames = {
    7:'Universo de Leyes', 8:'Catalogue agents', 9:'Ethics survey', 10:'Futbol Transformer', 11:'COSMIC',
    12:'ANTAD pharmacies', 13:'Gol Tempranero', 14:'SEMOVI routes', 15:'Auto parts', 16:'Tellus',
    30:'Informality', 31:'MIT teaching', 17:'El Critón', 18:'Space Train', 19:'CASAPP', 20:'Datodos',
    21:'AuthentiQR', 22:'Latent Lull', 23:'Tic-tac-toe AI', 24:'Baldosa', 25:'Safari sim',
    26:'Sense It', 27:'Logic-gate CPU', 28:'3D scanning',
};

export const homeProjects = archive.map(project => {
    const cv = cvById.get(project.id);
    return {
        ...project,
        title: cv?.title || project.title,
        shortName: shortNames[project.id] || project.title,
        topics: projectTopics[project.id] || ['software'],
        summary: cv?.summary || project.description.split(/\.\s|\.\n/)[0].replace(/\.$/, '') + '.',
        description: cv ? `${cv.detail}\n\n${cv.outcome}` : project.description,
        years: project.id === 7 ? '2022–2025' : project.id === 11 ? '2022–2023' : project.years,
    };
});

export const topicNames = project => project.topics.map(id => topicById.get(id).name).join(' · ');
export const projectsInTopic = (projects, topicId) => projects.filter(project => project.topics.includes(topicId));

const positions = {
    7:[38,23], 9:[35,4], 10:[83,6], 16:[72,26], 13:[95,22],
    11:[5,30], 8:[22,40], 15:[5,47], 14:[50,42],
    12:[95,52], 30:[88,64], 31:[30,56], 28:[5,75], 17:[27,73],
    23:[49,69], 24:[62,66], 22:[74,70], 21:[80,82], 20:[74,93], 19:[60,95], 18:[47,92], 25:[44,81],
    26:[29,95], 27:[5,95],
};

// Coordinates never change on selection, preserving the reader's bearings.
export function layoutProjectMap(projects) {
    const nodes = projects.map((project,index) => {
        const [x,y] = positions[project.id] || [12 + index % 5 * 18,12 + Math.floor(index / 5) * 18];
        return {...project,x,y};
    });
    const hubs = topics.map(topic => ({...topic,count:projectsInTopic(projects,topic.id).length})).filter(hub => hub.count>0);
    const hubById = new Map(hubs.map(hub => [hub.id,hub]));
    const edges = nodes.flatMap(node => node.topics.filter(id => hubById.has(id))
        .map(id => ({project:node.id,topic:id,from:node,to:hubById.get(id)})));
    return {nodes,hubs,edges};
}
