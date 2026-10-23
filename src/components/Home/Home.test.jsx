import {readFileSync} from 'node:fs';
const homeStyles=readFileSync('src/components/Home/Home.css','utf8');
import React from 'react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {MemoryRouter,Route,Routes,useLocation} from 'react-router-dom';
import Home from './Home';
import {homeProjects,layoutProjectMap,projectInTopic,projectsInTopic,relatedRecords,topicById,topics} from './homeProjects';
import originalProjects from '../Projects/projects.json';

function Location(){const location=useLocation();return <output data-testid="location">{location.pathname}</output>;}
function mount(path='/'){
    return render(<MemoryRouter initialEntries={[path]}><Location/><Routes><Route path="/" element={<Home/>}/><Route path="/projects" element={<Home/>}/><Route path="/projects/:id" element={<Home/>}/></Routes></MemoryRouter>);
}
const map=()=>screen.getByRole('region',{name:'Interactive project map'});
const semovi='SEMOVI route extraction, Geospatial, NLP and information extraction';
beforeEach(()=>{
    HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
    HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
    Element.prototype.scrollIntoView=vi.fn();
});
afterEach(()=>cleanup());

describe('Live academic homepage',()=>{
    it('shows the research themes without an introductory statement, and keeps the archive collapsed',()=>{
        const {container}=mount();
        expect(container.querySelector('.home-statement')).toBeNull();
        const themes=screen.getByRole('region',{name:'Research themes'});
        expect(within(themes).getAllByRole('heading').map(heading=>heading.textContent)).toEqual(topics.filter(topic=>topic.research).map(topic=>topic.name));
        expect(within(themes).getByRole('link',{name:'ICITS 2025 paper'}).getAttribute('href')).toMatch(/^https:\/\/doi.org\//);
        const archive=screen.getByRole('region',{name:'All projects'});
        expect(within(archive).queryAllByRole('link')).toHaveLength(0);
        fireEvent.click(within(archive).getByRole('button',{name:'View all projects'}));
        const links=within(archive).getAllByRole('link');
        expect(links).toHaveLength(originalProjects.length);
        for(const item of originalProjects)expect(links.some(link=>link.getAttribute('href')===`/projects/${item.id}`)).toBe(true);
        expect(container.querySelectorAll('.home-graph-node')).toHaveLength(originalProjects.length);
        expect(container.querySelectorAll('.home-map-hub')).toHaveLength(topics.length);
        expect(screen.getByRole('link',{name:'Explore the interactive experience'}).getAttribute('href')).toBe('/experience');
        expect(container.querySelector('.home-header a[download]').getAttribute('href')).toBe('/home/harry-gomar-cv.pdf');
    });
    it('limits current work to the ongoing research and MAKERS roles',()=>{
        const {container}=mount();
        const now=container.querySelector('.home-current');
        expect(within(now).getAllByRole('heading',{level:3}).map(heading=>heading.textContent)).toEqual(['Kellis Lab · MIT CSAIL','MAKERS · ITAM']);
        expect(within(now).getByText('Collaborating Researcher, Mantis')).not.toBeNull();
        expect(within(now).queryByText('Instructor and lecturer')).toBeNull();
    });
    it('supports deep links and closes with Escape without hiding the archive',()=>{
        mount('/projects/30');
        const dialog=screen.getByRole('dialog');
        expect(within(dialog).getByRole('heading',{name:'Commercial informality in Mexico'})).not.toBeNull();
        expect(within(dialog).getByText('Geospatial · 2025')).not.toBeNull();
        fireEvent(dialog,new Event('cancel',{cancelable:true}));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(screen.getByRole('region',{name:'All projects'})).not.toBeNull();
    });
    it('opens talks and image enlargement and handles unknown project URLs',()=>{
        const view=mount();
        fireEvent.click(within(map()).getByRole('button',{name:/^seminar:.*Player2Vec/}));
        expect(within(screen.getByRole('dialog')).getByRole('heading',{name:/Player2Vec/})).not.toBeNull();
        fireEvent.click(screen.getByRole('button',{name:'Close details'}));
        fireEvent.click(screen.getByRole('button',{name:'Enlarge Point-cloud study'}));
        expect(within(screen.getByRole('dialog')).getByRole('img').getAttribute('src')).toBe('/home/clusters-overview.png');
        view.unmount();
        mount('/projects/999');
        expect(within(screen.getByRole('dialog')).getByRole('heading',{name:'Project not found'})).not.toBeNull();
    });
});

describe('Topic map data',()=>{
    it('gives every project known topics and every topic at least one project',()=>{
        for(const project of homeProjects){
            expect(project.topics.length).toBeGreaterThan(0);
            for(const id of project.topics)expect(topicById.has(id)).toBe(true);
        }
        for(const topic of topics)expect(projectsInTopic(homeProjects,topic.id).length).toBeGreaterThan(0);
        for(const topic of topics.filter(topic=>topic.research))
            for(const id of topic.highlights)expect(projectInTopic(homeProjects.find(project=>project.id===id),topic.id)).toBe(true);
    });
    it('draws one edge per project topic and keeps nodes and hubs apart inside the drawing',()=>{
        const {nodes,hubs,edges}=layoutProjectMap(homeProjects);
        expect(edges).toHaveLength(homeProjects.reduce((sum,project)=>sum+project.topics.length,0));
        expect(new Set(nodes.map(node=>node.id)).size).toBe(homeProjects.length);
        const points=[...nodes,...hubs,...relatedRecords];
        for(const point of points){
            expect(point.x).toBeGreaterThan(4);expect(point.x).toBeLessThan(96);
            expect(point.y).toBeGreaterThan(3);expect(point.y).toBeLessThan(97);
            for(const other of points.filter(other=>other!==point))expect(Math.hypot(point.x-other.x,point.y-other.y)).toBeGreaterThan(10);
        }
    });
});

describe('Topic map interaction',()=>{
    it('selects a topic without moving nodes and opens a project directly',()=>{
        const {container}=mount();
        const positions=[...container.querySelectorAll('.home-graph-node')].map(node=>node.getAttribute('style'));
        fireEvent.click(within(map()).getByRole('button',{name:'Software and games, 13 projects'}));
        const software=projectsInTopic(homeProjects,'software');
        expect(container.querySelectorAll('.home-graph-node:not(.is-muted)')).toHaveLength(software.length);
        expect(container.querySelectorAll('.home-graph path[data-project].is-active')).toHaveLength(software.length);
        expect([...container.querySelectorAll('.home-graph-node')].map(node=>node.getAttribute('style'))).toEqual(positions);
        fireEvent.click(within(map()).getByRole('button',{name:'Space Train, Software and games'}));
        expect(screen.getByTestId('location').textContent).toBe('/projects/18');
        fireEvent.click(screen.getByRole('button',{name:'Close details'}));
        expect(screen.getByTestId('location').textContent).toBe('/');
        expect(document.body.style.overflow).not.toBe('hidden');
    });
    it('shows a project\'s topics on keyboard focus and restores the overview on blur',()=>{
        const {container}=mount();
        const node=within(map()).getByRole('button',{name:semovi});
        fireEvent.focus(node);
        expect(container.querySelectorAll('.home-graph path.is-active')).toHaveLength(2);
        expect(container.querySelector('[data-topic-id="nlp"]').classList.contains('is-related')).toBe(true);
        expect(container.querySelector('[data-topic-id="software"]').classList.contains('is-muted')).toBe(true);
        fireEvent.blur(node);
        expect(container.querySelectorAll('.home-graph path.is-active')).toHaveLength(0);
    });
    it('pins a topic for touch and clears with Escape',()=>{
        const {container}=mount();
        const topic=within(map()).getByRole('button',{name:'Geospatial, 4 projects'});
        fireEvent.click(topic);fireEvent.pointerLeave(topic);
        expect(topic.getAttribute('aria-pressed')).toBe('true');
        expect(container.querySelector('[data-project-id="14"]').classList.contains('is-related')).toBe(true);
        fireEvent.keyDown(topic,{key:'Escape'});
        expect(topic.getAttribute('aria-pressed')).toBe('false');
        expect(container.querySelectorAll('.home-graph path.is-active')).toHaveLength(0);
    });
    it('highlights a topic hub from its theme on the page',()=>{
        const {container}=mount();
        const theme=within(screen.getByRole('region',{name:'Research themes'})).getByRole('heading',{name:'Representation learning'}).closest('article');
        fireEvent.pointerEnter(theme);
        expect(container.querySelector('[data-topic-id="representation"]').classList.contains('is-active')).toBe(true);
        fireEvent.pointerLeave(theme);
        expect(container.querySelector('[data-topic-id="representation"]').classList.contains('is-active')).toBe(false);
    });
});

describe('Compact homepage',()=>{
    it('lets the phone work list open a topic and project, with an explicit map view',()=>{
        const {container}=mount();
        const list=container.querySelector('.home-mobile-work-list');
        fireEvent.click(within(list).getByRole('button',{name:'NLP and information extraction'}));
        expect(within(list).getByRole('button',{name:'NLP and information extraction'}).getAttribute('aria-expanded')).toBe('true');
        fireEvent.click(within(list).getByRole('button',{name:/Auto-parts catalogue extraction and matching/}));
        expect(within(screen.getByRole('dialog')).getByRole('heading',{name:'Auto-parts catalogue extraction and matching'})).not.toBeNull();
        fireEvent.click(screen.getByRole('button',{name:'Close details'}));
        fireEvent.click(within(map()).getByRole('button',{name:'Map',exact:true}));
        expect(map().getAttribute('data-mobile-view')).toBe('map');
    });
    it('opens the archive from its direct route, grouped by topic, and collapses it again',()=>{
        mount('/projects');
        const archive=screen.getByRole('region',{name:'All projects'});
        expect(within(archive).getAllByRole('link')).toHaveLength(originalProjects.length);
        expect(within(archive).getAllByRole('heading',{level:3}).map(heading=>heading.textContent)).toEqual(topics.map(topic=>topic.name));
        fireEvent.click(within(archive).getByRole('button',{name:'Hide projects'}));
        expect(within(archive).queryAllByRole('link')).toHaveLength(0);
        fireEvent.click(screen.getByRole('button',{name:'View all projects'}));
        expect(within(archive).getAllByRole('link')).toHaveLength(originalProjects.length);
    });
});

 describe('Connected work',()=>{
 it('places football in data science and keeps Tellus connected to software',()=>{
 expect(homeProjects.find(p=>p.id===13).topics).toEqual(['data-science']);
 expect(projectsInTopic(homeProjects,'data-science').map(p=>p.id)).toEqual(expect.arrayContaining([12,13,14,16,30]));
 expect(projectsInTopic(homeProjects,'software').map(p=>p.id)).toContain(16);
 });
 it('pins MAKERS projects across hover and clears the selection',()=>{
 const {container}=mount();
 fireEvent.click(screen.getByRole('button',{name:'MAKERS · ITAM'}));
 expect(container.querySelectorAll('.home-graph-node.is-related')).toHaveLength(12);
 expect(container.querySelector('[data-project-id="7"]').classList.contains('is-related')).toBe(true);
 expect(container.querySelector('[data-project-id="16"]').classList.contains('is-muted')).toBe(true);
 const node=container.querySelector('[data-project-id="16"]');
 fireEvent.pointerEnter(node);fireEvent.pointerLeave(node);
 expect(container.querySelectorAll('.home-graph-node.is-related')).toHaveLength(12);
 fireEvent.keyDown(node,{key:'Escape'});
 expect(container.querySelectorAll('.home-graph-node.is-muted')).toHaveLength(0);
 });
 it('connects seminars and publication to the graph and provides honest writing status',()=>{
 const {container}=mount();
 const seminars=container.querySelector('.home-seminars');
 fireEvent.focus(within(seminars).getByRole('button',{name:'Seminario de Ingeniería de Software y sus implicaciones',exact:true}));
 expect(container.querySelector('[data-record-id="seminar-0"]').classList.contains('is-active')).toBe(true);
 expect(container.querySelector('.home-publication').classList.contains('is-related')).toBe(false);
 expect(screen.getByText('Technical notes are in preparation.')).not.toBeNull();
 expect(screen.getByRole('link',{name:'https://mantis.csail.mit.edu/'}).getAttribute('href')).toBe('https://mantis.csail.mit.edu/');
 });
 });

it('selects the data science cluster with all geospatial descendants',()=>{
 const {container}=mount();
 fireEvent.click(within(map()).getByRole('button',{name:'Data science, 5 projects'}));
 expect(container.querySelector('[data-topic-id="geospatial"]').classList.contains('is-related')).toBe(true);
 expect(container.querySelectorAll('.home-graph-node.is-related')).toHaveLength(5);

});

it('links the publication and each seminar to its project in both directions',()=>{
 const {container}=mount();
 const publication=container.querySelector('.home-publication');
 expect(within(publication).getByRole('heading',{name:'Publications'})).not.toBeNull();
 fireEvent.pointerEnter(publication);
 expect(container.querySelector('[data-record-id="icits-2025"]').classList.contains('is-active')).toBe(true);
 expect(container.querySelector('[data-project-id="7"]').classList.contains('is-related')).toBe(true);
 fireEvent.pointerLeave(publication);
 const project=container.querySelector('[data-project-id="7"]');
 fireEvent.focus(project);
 expect(container.querySelectorAll('.home-record-node.is-related')).toHaveLength(4);
 expect(container.querySelectorAll('.home-map-chip')).toHaveLength(0);
 for(const edge of container.querySelectorAll('.home-graph path[data-project]'))expect(edge.getAttribute('d')).not.toMatch(/[QC]/);
});

 it('keeps every graph relationship visible in the overview',()=>{
 const style=document.createElement('style');style.textContent=homeStyles;document.head.append(style);
 try {
 const {container}=mount();
 const edges=container.querySelectorAll('.home-graph path');
 expect(edges.length).toBeGreaterThan(0);
 for(const edge of edges)expect(Number(getComputedStyle(edge).opacity),edge.outerHTML).toBeGreaterThanOrEqual(.25);
 } finally {style.remove();}
 });


 it('keeps graph text and node positions unchanged on hover and selection',()=>{
 const {container}=mount();
 const graph=container.querySelector('.home-graph');const text=graph.textContent;
 const positions=[...container.querySelectorAll('.home-graph-node,.home-record-node')].map(node=>node.getAttribute('style'));
 const node=container.querySelector('[data-project-id="17"]');
 fireEvent.pointerEnter(node);expect(graph.textContent).toBe(text);
 fireEvent.pointerLeave(node);
 fireEvent.click(container.querySelector('[data-topic-id="software"]'));
 expect(graph.textContent).toBe(text);
 expect([...container.querySelectorAll('.home-graph-node,.home-record-node')].map(node=>node.getAttribute('style'))).toEqual(positions);
 expect(container.querySelector('.home-map-caption')).toBeNull();
 expect(screen.queryByText(/All relationships are shown/)).toBeNull();
 });

 it('lays out all relationships without crossing unrelated edges',()=>{
 const {nodes,hubs,edges}=layoutProjectMap(homeProjects);
 const segments=[...edges.map(edge=>[edge.from,edge.to]),...relatedRecords.map(record=>[record,record.projectId?nodes.find(node=>node.id===record.projectId):hubs.find(hub=>hub.id===record.topicId)]),...hubs.filter(hub=>hub.parent).map(hub=>[hub,hubs.find(parent=>parent.id===hub.parent)])];
 const side=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
 const [a,b]=segments[i],[c,d]=segments[j];
 const crosses=side(a,b,c)*side(a,b,d)<-0.0001&&side(c,d,a)*side(c,d,b)<-0.0001;
 expect(crosses,JSON.stringify([[a.id,b.id],[c.id,d.id]])).toBe(false);
 }
 });

 it('adds cognitive cartography to its topic and opens its own seminar details',()=>{
 const {container}=mount();
 const seminar=container.querySelector('[data-record-id="seminar-3"]');
 fireEvent.focus(seminar);
 expect(container.querySelector('[data-topic-id="representation"]').classList.contains('is-active')).toBe(true);
 expect(container.querySelector('[data-record-edge="seminar-3"]').classList.contains('is-active')).toBe(true);
 fireEvent.click(seminar);
 const dialog=screen.getByRole('dialog');
 expect(within(dialog).getByRole('heading',{name:'Cartografías cognitivas: Abstracciones y aprendizaje de representaciones'})).not.toBeNull();
 expect(within(dialog).getByText(/División Académica de Ciencias de la Computación, ITAM/)).not.toBeNull();
 expect(within(dialog).getByText(/Los mapas son herramientas fundamentales/)).not.toBeNull();
 expect(within(dialog).getByText('10 Mar · 14:00 · Sala de conferencias')).not.toBeNull();
 expect(within(dialog).getByRole('link',{name:'Ver cartel'}).getAttribute('href')).toBe('/home/talks/cartografias-cognitivas.jpg');
 });

 it('keeps one catalogue project and preserves its old experiment URL',()=>{
 const view=mount('/projects/8');
 const dialog=screen.getByRole('dialog');
 expect(homeProjects.filter(project=>[8,15].includes(project.id))).toHaveLength(1);
 expect(within(dialog).getByRole('heading',{name:'Auto-parts catalogue extraction and matching'})).not.toBeNull();
 expect(within(dialog).getByText(/correctly formatted 4 of 10 brand catalogues/)).not.toBeNull();
 view.unmount();
 mount('/projects/30');
 expect(within(screen.getByRole('dialog')).getByRole('link',{name:'Visit project'}).getAttribute('href')).toBe('https://informal-dataton-2025.vercel.app/');
 });

 it('opens the ITAM poster abstract from the project and keeps invited talks out of MIT teaching',()=>{
 const view=mount('/projects/7');
 fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Seminario Recursivo',exact:true}));
 const dialog=screen.getByRole('dialog');
 expect(within(dialog).getByRole('heading',{name:/Universo de Leyes: Aplicando/})).not.toBeNull();
 expect(within(dialog).getByText(/En un estudio comparativo/)).not.toBeNull();
 expect(within(dialog).getByText('14 Nov · 14:00–15:00 · Salón 310')).not.toBeNull();
 view.unmount();
 mount('/projects/31');
 const teaching=screen.getByRole('dialog');
 expect(within(teaching).getByText(/MIT IAP courses 6.S189/)).not.toBeNull();
 expect(within(teaching).queryByText(/My invited talks/)).toBeNull();
 expect(within(teaching).queryByRole('heading',{name:'Presentations'})).toBeNull();
 });

 it('uses the single reading column and opens the full seminar details from its title',()=>{
 const {container}=mount();
 const reading=container.querySelector('.home-reading');
 expect(within(reading).getAllByRole('heading',{level:2}).map(node=>node.textContent)).toEqual(['Publications','Seminars and talks','Past experience','Writing','Recognition']);
 const teaching=container.querySelector('.home-sidebar-teaching');
 expect(within(teaching).getByText(/Former instructor and lecturer for 6.S189/)).not.toBeNull();
 fireEvent.pointerEnter(within(teaching).getByRole('button',{name:'MIT IAP · MIT Sloan'}).closest('article'));
 expect(container.querySelector('[data-project-id="31"]').classList.contains('is-active')).toBe(true);
 expect(within(reading).getByRole('heading',{name:'Spingere'})).not.toBeNull();
 expect(within(reading).queryByRole('button',{name:'View publication in graph'})).toBeNull();
 fireEvent.click(within(reading).getByRole('button',{name:'ITAM Sports Analytics Conference',exact:true}));
 expect(within(screen.getByRole('dialog')).getByRole('heading',{name:/¿Y si pudiéramos/})).not.toBeNull();
 });

describe('MAKERS additions',()=>{
    it('connects all six additions to valid topics, affiliations and related work without adding Vaso',()=>{
        const additions=homeProjects.filter(project=>project.id>=32);
        expect(additions.map(project=>project.id)).toEqual([32,33,34,35,36,37]);
        expect(homeProjects.some(project=>/vaso|cup.wallet/i.test(project.title))).toBe(false);
        for(const project of additions){
            expect(project.affiliations).toContain('makers');
            expect(project.contribution).toBeTruthy();
            for(const relatedId of project.relatedProjectIds)expect(homeProjects.some(item=>item.id===relatedId)).toBe(true);
        }
        expect(homeProjects.find(project=>project.id===35).topics).toEqual(['teaching','software']);
    });

    it('presents platform engineering and event organization, with working links between project details',()=>{
        const view=mount('/projects/33');
        const platform=screen.getByRole('dialog');
        expect(within(platform).getByText(/kill a mosquito with a bazooka/)).not.toBeNull();
        expect(within(platform).getByText(/pnpm and Turborepo monorepo/)).not.toBeNull();
        expect(within(platform).getByRole('link',{name:'MAKERS public site'}).getAttribute('href')).toBe('https://makers.itam.mx/');
        fireEvent.click(within(platform).getByRole('button',{name:'Mapa ITAM and the academic atlas'}));
        expect(screen.getByTestId('location').textContent).toBe('/projects/34');
        view.unmount();
        mount('/projects/35');
        const event=screen.getByRole('dialog');
        expect(within(event).getByText('Organizing collaboration and web development')).not.toBeNull();
        expect(within(event).getByText(/I collaborated on organizing Espacios Latentes/)).not.toBeNull();
        expect(within(event).getByRole('link',{name:'Visit project'}).getAttribute('href')).toBe('https://espacioslatentes.org/es/');
    });

    it('connects the CDAS talk to Congreso in the graph and in both detail views',()=>{
        const {container}=mount();
        fireEvent.focus(screen.getByRole('button',{name:'CDAS',exact:true}));
        expect(container.querySelector('[data-record-id="seminar-4"]').classList.contains('is-active')).toBe(true);
        expect(container.querySelector('[data-project-id="36"]').classList.contains('is-related')).toBe(true);
        expect(container.querySelectorAll('.home-graph path[data-project="36"].is-active')).toHaveLength(2);
        fireEvent.click(screen.getByRole('button',{name:'CDAS',exact:true}));
        const talk=screen.getByRole('dialog');
        expect(within(talk).getByRole('heading',{name:'La geometría de la política: mapas, conceptos y lenguaje'})).not.toBeNull();
        expect(within(talk).getByRole('heading',{name:'Sobre la charla'})).not.toBeNull();
        fireEvent.click(within(talk).getByRole('button',{name:'Mexican parliamentary discourse'}));
        expect(screen.getByTestId('location').textContent).toBe('/projects/36');
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'CDAS'}));
        expect(within(screen.getByRole('dialog')).getByRole('heading',{name:/La geometría de la política/})).not.toBeNull();
    });
});
