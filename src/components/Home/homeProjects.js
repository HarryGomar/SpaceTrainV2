import archive from '../Projects/projects.json';
import { profile } from '../../data/profile';

const cvIds = { leyes:7, tellus:16, semovi:14, informality:30, autoparts:15, cosmic:11 };
const cvById = new Map(profile.projects.map(project => [cvIds[project.id], project]));

// Research topics lead the page; the rest describe what else the archive contains.
export const topics = [
    {id:'nlp',name:'NLP and information extraction',label:'NLP',research:true,x:15,y:18,
        summary:'Turning legal texts, catalogues, requirements and scanned records into structured data.',highlights:[7,14]},
    {id:'representation',name:'Representation learning',label:'Representation learning',research:true,x:55,y:37,
        summary:'Embedding-based methods for text, places and sequences, now on Mantis with the Kellis Lab at MIT CSAIL.',highlights:[32,16]},
    {id:'data-science',name:'Data science',label:'Data science',research:true,x:91,y:14,
        summary:'Statistical learning for football, economic data and location planning.',highlights:[13,30]},
    {id:'geospatial',name:'Geospatial',label:'Geospatial',parent:'data-science',x:82,y:43,
        summary:'Location planning and policy analysis built on public and economic data.',highlights:[30,12]},
    {id:'software',name:'Software and games',label:'Software',x:65,y:79,
        summary:'Web apps, games and simulations, built end to end.'},
    {id:'hardware',name:'Hardware',label:'Hardware',x:24,y:95,
        summary:'Digital logic, embedded systems and fabrication.'},
    {id:'teaching',name:'Teaching and community',label:'Teaching & community',x:26,y:82,
        summary:'Past teaching at MIT, workshops at ITAM and collaborative events.'},
];
export const topicById = new Map(topics.map(topic => [topic.id, topic]));

// The first topic is the project's home in the archive; the others are real overlaps.
const projectTopics = {
    7:['nlp','representation'], 9:['nlp','representation'], 10:['representation'], 11:['nlp'],
    12:['geospatial'], 13:['data-science'], 14:['geospatial','nlp'], 15:['nlp'], 16:['software','geospatial','representation'],
    30:['geospatial'], 31:['teaching'], 17:['software','teaching'], 18:['software'], 19:['software'],
    20:['software'], 21:['software'], 22:['software'], 23:['software'], 24:['software'],
    25:['software'], 26:['hardware'], 27:['hardware'], 28:['hardware','teaching'],
    32:['representation','nlp'], 33:['software'], 34:['software','representation'],
    35:['teaching','software'], 36:['nlp','representation'], 37:['nlp'],
};

const shortNames = {
    7:'Universo de Leyes', 9:'Ethics survey', 10:'Futbol Transformer', 11:'COSMIC',
    12:'ANTAD pharmacies', 13:'Gol Tempranero', 14:'SEMOVI routes', 15:'Auto-parts catalogues', 16:'Tellus',
    30:'Informality', 31:'MIT teaching', 17:'El Critón', 18:'Space Train', 19:'CASAPP', 20:'Datodos',
    21:'AuthentiQR', 22:'Latent Lull', 23:'Tic-tac-toe AI', 24:'Baldosa', 25:'Safari sim',
    26:'Sense It', 27:'Logic-gate CPU', 28:'3D scanning',
    32:'Tree Atlas', 33:'MAKERS platform', 34:'Mapa ITAM · Atlas', 35:'Espacios Latentes',
    36:'Congreso', 37:'Music criticism',
};

export const homeProjects = archive.map(project => {
    const cv = cvById.get(project.id);
    return {
        ...project,
        title: cv?.title || project.title,
        shortName: shortNames[project.id] || project.title,
        topics: projectTopics[project.id] || ['software'],
        affiliations: project.motivation==='Makers'||[7,17].includes(project.id) ? ['makers'] : [],
        summary: cv?.summary || project.description.split(/\.\s|\.\n/)[0].replace(/\.$/, '') + '.',
        description: project.description,
        years: project.id === 7 ? '2022–2025' : project.id === 11 ? '2022–2023' : project.years,
    };
});

export const topicNames = project => project.topics.map(id => topicById.get(id).name).join(' · ');
export const projectInTopic = (project, topicId) => project.topics.some(id => id===topicId || topicById.get(id)?.parent===topicId);
export const projectsInTopic = (projects, topicId) => projects.filter(project => projectInTopic(project,topicId));

const positions = {
    7:[34,62], 9:[34,20], 10:[64,22], 11:[5,6], 15:[5,36],
    13:[94,24], 14:[56,6], 12:[94,36], 30:[82,58], 16:[68,55],
    17:[43,84], 18:[59,96], 19:[72,95], 20:[86,95], 21:[94,80],
    22:[88,68], 23:[79,83], 24:[47,96], 25:[94,55],
    31:[5,66], 26:[36,95], 27:[5,96], 28:[5,82],
    32:[34,34], 33:[74,68], 34:[56,58], 35:[39,73], 36:[34,48], 37:[5,47],
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
        .map(id => {
            const hub=hubById.get(id);
            return {project:node.id,topic:id,from:node,to:hub,primary:id===node.topics[0],
                path:`M${node.x} ${node.y} L${hub.x} ${hub.y}`};
        }));
    return {nodes,hubs,edges};
}

// Publications and talks remain separate works connected to their source project.
export const relatedRecords = [
    {id:'icits-2025',kind:'publication',title:profile.publication.title,shortName:'ICITS 2025 paper',projectId:7,x:49,y:67,url:profile.publication.url},
    ...profile.talks.map((talk,index)=>({...talk,id:'seminar-'+index,kind:'seminar',
        shortName:talk.graphLabel,
        x:[18,22,70,48,44][index],y:[52,70,39,19,44][index]})),
];
