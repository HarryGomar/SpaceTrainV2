import React from 'react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {MemoryRouter,Route,Routes,useLocation} from 'react-router-dom';
import Home from './Home';
import {homeProjects,layoutProjectMap,projectsInTopic,topicById,topics} from './homeProjects';
import originalProjects from '../Projects/projects.json';

function Location(){const location=useLocation();return <output data-testid="location">{location.pathname}</output>;}
function mount(path='/'){
    return render(<MemoryRouter initialEntries={[path]}><Location/><Routes><Route path="/" element={<Home/>}/><Route path="/projects" element={<Home/>}/><Route path="/projects/:id" element={<Home/>}/></Routes></MemoryRouter>);
}
const map=()=>screen.getByRole('region',{name:'Interactive project map'});
const semovi='SEMOVI route extraction, Geospatial and public data, NLP and information extraction';
beforeEach(()=>{
    HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
    HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
    Element.prototype.scrollIntoView=vi.fn();
});
afterEach(()=>cleanup());

describe('Live academic homepage',()=>{
    it('leads with one statement and the research themes, and keeps the archive collapsed',()=>{
        const {container}=mount();
        expect(container.querySelector('.home-statement').textContent).toMatch(/^I work on representation learning and natural language processing, collaborating with Mantis at MIT CSAIL/);
        const themes=screen.getByRole('region',{name:'Research themes'});
        expect(within(themes).getAllByRole('heading').map(heading=>heading.textContent)).toEqual(topics.filter(topic=>topic.research).map(topic=>topic.name));
        expect(within(themes).getByRole('link',{name:'ICITS 2025 paper'}).getAttribute('href')).toMatch(/^https:\/\/doi.org\//);
        const archive=screen.getByRole('region',{name:'All projects'});
        expect(within(archive).queryAllByRole('link')).toHaveLength(0);
        fireEvent.click(within(archive).getByRole('button',{name:'All projects Show 24'}));
        const links=within(archive).getAllByRole('link');
        expect(links).toHaveLength(originalProjects.length);
        for(const item of originalProjects)expect(links.some(link=>link.getAttribute('href')===`/projects/${item.id}`)).toBe(true);
        expect(container.querySelectorAll('.home-graph-node')).toHaveLength(originalProjects.length);
        expect(container.querySelectorAll('.home-map-hub')).toHaveLength(topics.length);
        expect(screen.getByRole('link',{name:'Explore the interactive experience'}).getAttribute('href')).toBe('/experience');
        expect(container.querySelector('.home-header a[download]').getAttribute('href')).toBe('/home/harry-gomar-cv.pdf');
    });
    it('keeps current work and the publication beside the map',()=>{
        const {container}=mount();
        expect(container.querySelector('.home-project-column .home-current')).not.toBeNull();
        expect(container.querySelector('.home-project-column .home-publication')).not.toBeNull();
        expect(within(container.querySelector('.home-current')).getByText(/embedding-based methods across law/)).not.toBeNull();
    });
    it('supports deep links and closes with Escape without hiding the archive',()=>{
        mount('/projects/30');
        const dialog=screen.getByRole('dialog');
        expect(within(dialog).getByRole('heading',{name:'Commercial informality in Mexico'})).not.toBeNull();
        expect(within(dialog).getByText('Geospatial and public data · 2025')).not.toBeNull();
        fireEvent(dialog,new Event('cancel',{cancelable:true}));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(screen.getByRole('region',{name:'All projects'})).not.toBeNull();
    });
    it('opens talks and image enlargement and handles unknown project URLs',()=>{
        const view=mount();
        fireEvent.click(screen.getByRole('button',{name:'Seminars and talks'}));
        expect(within(screen.getByRole('dialog')).getByText(/Player2Vec/)).not.toBeNull();
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
            for(const id of topic.highlights)expect(homeProjects.find(project=>project.id===id)?.topics).toContain(topic.id);
    });
    it('draws one edge per project topic and keeps nodes and hubs apart inside the drawing',()=>{
        const {nodes,hubs,edges}=layoutProjectMap(homeProjects);
        expect(edges).toHaveLength(homeProjects.reduce((sum,project)=>sum+project.topics.length,0));
        expect(new Set(nodes.map(node=>node.id)).size).toBe(homeProjects.length);
        const points=[...nodes,...hubs];
        for(const point of points){
            expect(point.x).toBeGreaterThan(4);expect(point.x).toBeLessThan(96);
            expect(point.y).toBeGreaterThan(3);expect(point.y).toBeLessThan(97);
            for(const other of points.filter(other=>other!==point))expect(Math.hypot(point.x-other.x,point.y-other.y)).toBeGreaterThan(10);
        }
    });
});

describe('Topic map interaction',()=>{
    it('selects a topic without moving nodes and opens its projects from the caption',()=>{
        const {container}=mount();
        const positions=[...container.querySelectorAll('.home-graph-node')].map(node=>node.getAttribute('style'));
        fireEvent.click(within(map()).getByRole('button',{name:'Software and games, 9 projects'}));
        const software=projectsInTopic(homeProjects,'software');
        expect(container.querySelectorAll('.home-graph-node:not(.is-muted)')).toHaveLength(software.length);
        expect(container.querySelectorAll('.home-graph path.is-active')).toHaveLength(software.length);
        expect([...container.querySelectorAll('.home-graph-node')].map(node=>node.getAttribute('style'))).toEqual(positions);
        const list=screen.getByRole('list',{name:'Software and games projects'});
        expect(within(list).getAllByRole('button')).toHaveLength(software.length);
        fireEvent.click(within(list).getByRole('button',{name:'Space Train'}));
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
    it('pins a project for touch, jumps to one of its topics, and clears with Escape',()=>{
        const {container}=mount();
        const node=within(map()).getByRole('button',{name:semovi});
        fireEvent.click(node);
        fireEvent.pointerLeave(node);
        expect(node.getAttribute('aria-pressed')).toBe('true');
        fireEvent.click(within(map()).getByRole('button',{name:'Geospatial and public data'}));
        expect(node.getAttribute('aria-pressed')).toBe('false');
        expect(screen.getByRole('list',{name:'Geospatial and public data projects'})).not.toBeNull();
        fireEvent.click(within(map()).getByRole('button',{name:semovi}));
        within(map()).getByRole('button',{name:'SEMOVI route extraction'});
        fireEvent.keyDown(node,{key:'Escape'});
        expect(node.getAttribute('aria-pressed')).toBe('false');
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
    it('opens the archive from its direct route, grouped by topic, and collapses it again',()=>{
        mount('/projects');
        const archive=screen.getByRole('region',{name:'All projects'});
        expect(within(archive).getAllByRole('link')).toHaveLength(24);
        expect(within(archive).getAllByRole('heading',{level:3}).map(heading=>heading.textContent)).toEqual(topics.map(topic=>topic.name));
        fireEvent.click(within(archive).getByRole('button',{name:'All projects Hide 24'}));
        expect(within(archive).queryAllByRole('link')).toHaveLength(0);
        fireEvent.click(screen.getByRole('link',{name:'Browse the complete index'}));
        expect(within(archive).getAllByRole('link')).toHaveLength(24);
    });
});
