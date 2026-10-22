import archive from '../Projects/projects.json';
import { profile } from '../../data/profile';

const cvIds = { leyes:7, tellus:16, semovi:14, informality:30, autoparts:15, cosmic:11 };
const cvById = new Map(profile.projects.map(project => [cvIds[project.id], project]));

// Research topics lead the page; the rest describe what else the archive contains.
export const topics = [
    {id:'nlp',name:'NLP and information extraction',label:'NLP',research:true,x:17,y:17,
        summary:'Turning legal texts, catalogues, requirements and scanned records into structured data.',highlights:[7,14]},
    {id:'representation',name:'Representation learning',label:'Representation learning',research:true,x:47,y:40,
        summary:'Embedding-based methods for text, places and sequences, now on Mantis with the Kellis Lab at MIT CSAIL.',highlights:[16,9]},
    {id:'data-science',name:'Data science',label:'Data science',research:true,x:91,y:15,
        summary:'Statistical learning for football, economic data and location planning.',highlights:[13,30]},
    {id:'geospatial',name:'Geospatial',label:'Geospatial',parent:'data-science',x:81,y:37,
        summary:'Location planning and policy analysis built on public and economic data.',highlights:[30,12]},
    {id:'software',name:'Software and games',label:'Software',x:64,y:79,
        summary:'Web apps, games and simulations, built end to end.'},
    {id:'hardware',name:'Hardware',label:'Hardware',x:18,y:90,
        summary:'Digital logic, embedded systems and fabrication.'},
    {id:'teaching',name:'Teaching',label:'Teaching',x:18,y:70,
        summary:'Applied AI courses at MIT and hands-on workshops at ITAM.'},
];
export const topicById = new Map(topics.map(topic => [topic.id, topic]));

// The first topic is the project's home in the archive; the others are real overlaps.
const projectTopics = {
    7:['nlp','representation'], 8:['nlp'], 9:['nlp','representation'], 10:['representation'], 11:['nlp'],
    12:['geospatial'], 13:['data-science'], 14:['geospatial','nlp'], 15:['nlp'], 16:['software','geospatial','representation'],
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
        affiliations: project.motivation==='Makers'||[7,17].includes(project.id) ? ['makers'] : [],
        summary: cv?.summary || project.description.split(/\.\s|\.\n/)[0].replace(/\.$/, '') + '.',
        description: cv ? `${cv.detail}\n\n${cv.outcome}` : project.description,
        years: project.id === 7 ? '2022–2025' : project.id === 11 ? '2022–2023' : project.years,
    };
});

export const topicNames = project => project.topics.map(id => topicById.get(id).name).join(' · ');
export const projectInTopic = (project, topicId) => project.topics.some(id => id===topicId || topicById.get(id)?.parent===topicId);
export const projectsInTopic = (projects, topicId) => projects.filter(project => projectInTopic(project,topicId));

const positions = {
    7:[20,39], 9:[34,24], 10:[42,54], 11:[5,6], 8:[5,21], 15:[32,6],
    13:[94,28], 14:[55,9], 12:[94,45], 30:[81,60], 16:[68,54],
    17:[36,74], 18:[60,95], 19:[73,94], 20:[88,92], 21:[94,77],
    22:[82,72], 23:[53,67], 24:[48,88], 25:[91,62],
    31:[7,63], 26:[34,95], 27:[5,95], 28:[5,80],
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
    {id:'icits-2025',kind:'publication',title:profile.publication.title,shortName:'ICITS 2025 paper',projectId:7,x:7,y:52,url:profile.publication.url},
    ...profile.talks.map((talk,index)=>({...talk,id:'seminar-'+index,kind:'seminar',
        shortName:['UNAM seminar','ITAM seminar','StatsBomb talk','Cartografías cognitivas'][index],
        projectId:talk.topicId?null:talk.title.includes('Player2Vec')?10:7,
        x:[7,25,37,60][index],y:[34,54,64,28][index]})),
];
