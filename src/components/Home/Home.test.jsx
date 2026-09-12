import React from 'react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {MemoryRouter,Route,Routes,useLocation} from 'react-router-dom';
import Home from './Home';
import {homeProjects,fields,layoutProjectMap,projectConnections} from './homeProjects';
import originalProjects from '../Projects/projects.json';

function Location(){const location=useLocation();return <output data-testid="location">{location.pathname}</output>;}
function mount(path='/'){
    return render(<MemoryRouter initialEntries={[path]}><Location/><Routes><Route path="/" element={<Home/>}/><Route path="/projects" element={<Home/>}/><Route path="/projects/:id" element={<Home/>}/></Routes></MemoryRouter>);
}
beforeEach(()=>{
    HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
    HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
    Element.prototype.scrollIntoView=vi.fn();
});
afterEach(()=>cleanup());

describe('Live academic homepage',()=>{
    it('starts with a collapsed archive and exposes every project when expanded',()=>{
        const {container}=mount();
        const archive=screen.getByRole('region',{name:'All projects'});
        expect(within(archive).queryAllByRole('link')).toHaveLength(0);
        expect(screen.getByText('I work on representation learning and natural language processing.')).not.toBeNull();
        fireEvent.click(within(archive).getByRole('button',{name:'All projects Show 24'}));
        const links=within(archive).getAllByRole('link');
        expect(links).toHaveLength(originalProjects.length);
        for(const item of originalProjects)expect(links.some(link=>link.getAttribute('href')===`/projects/${item.id}`)).toBe(true);
        expect(container.querySelectorAll('.home-graph-node')).toHaveLength(originalProjects.length);
        expect(screen.getByRole('link',{name:'Explore the interactive experience'}).getAttribute('href')).toBe('/experience');
        expect(container.querySelector('.home-header a[download]').getAttribute('href')).toBe('/home/harry-gomar-cv.pdf');
    });
    it('highlights a field without moving nodes, keeps the archive, and opens selected details',()=>{
        const {container}=mount();
        const positions=[...container.querySelectorAll('.home-graph-node')].map(node=>node.getAttribute('style'));
        const filter=screen.getByRole('group',{name:'Project map field'});
        fireEvent.click(within(filter).getByRole('button',{name:'Software',exact:true}));
        const software=homeProjects.filter(project=>project.category==='Software');
        expect(container.querySelectorAll('.home-graph-node')).toHaveLength(homeProjects.length);
        expect(container.querySelectorAll('.home-graph-node:not(.is-muted)')).toHaveLength(software.length);
        expect([...container.querySelectorAll('.home-graph-node')].map(node=>node.getAttribute('style'))).toEqual(positions);
        expect(within(screen.getByRole('region',{name:'All projects'})).queryAllByRole('link')).toHaveLength(0);
        fireEvent.click(screen.getByRole('link',{name:'All 24 projects'}));
        expect(within(screen.getByRole('region',{name:'All projects'})).getAllByRole('link')).toHaveLength(homeProjects.length);
        fireEvent.click(screen.getByRole('button',{name:'Tellus, Software'}));
        expect(screen.getByTestId('location').textContent).toBe('/');
        fireEvent.click(within(screen.getByRole('region',{name:'Interactive project map'})).getByRole('button',{name:'Tellus',exact:true}));
        expect(screen.getByTestId('location').textContent).toBe('/projects/16');
        expect(within(screen.getByRole('dialog')).getByRole('heading',{name:'Tellus'})).not.toBeNull();
        fireEvent.click(screen.getByRole('button',{name:'Close details'}));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(screen.getByTestId('location').textContent).toBe('/');
        expect(document.body.style.overflow).not.toBe('hidden');
    });
    it('supports deep links and closes with Escape without hiding the archive',()=>{
        mount('/projects/30');
        const dialog=screen.getByRole('dialog');
        expect(within(dialog).getByRole('heading',{name:'Commercial informality in Mexico'})).not.toBeNull();
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

describe('Project map geometry',()=>{
    it('keeps all projects distinct and within the drawing',()=>{
        const {nodes}=layoutProjectMap(homeProjects);
        expect(new Set(nodes.map(node=>node.id)).size).toBe(homeProjects.length);
        for(const node of nodes){
            expect(node.x).toBeGreaterThan(4);expect(node.x).toBeLessThan(96);
            expect(node.y).toBeGreaterThan(4);expect(node.y).toBeLessThan(96);
            for(const other of nodes.filter(other=>other.id!==node.id))expect(Math.hypot(node.x-other.x,node.y-other.y)).toBeGreaterThan(10);
        }
    });
    it.each(fields)('keeps every coordinate fixed when highlighting %s',field=>{
        const overview=layoutProjectMap(homeProjects);
        const filtered=layoutProjectMap(homeProjects,field);
        expect(filtered.nodes.map(({id,x,y})=>({id,x,y}))).toEqual(overview.nodes.map(({id,x,y})=>({id,x,y})));
        expect(filtered.nodes.filter(node=>node.matches).map(node=>node.id)).toEqual(homeProjects.filter(node=>node.category===field).map(node=>node.id));
    });
    it('uses explained, unique relationships between existing projects, with real cross-field links',()=>{
        const {edges}=layoutProjectMap(homeProjects);
        expect(edges).toHaveLength(projectConnections.length);
        expect(new Set(edges.map(edge=>[edge.source,edge.target].sort().join('-'))).size).toBe(edges.length);
        for(const edge of edges){
            expect(edge.source).not.toBe(edge.target);
            expect(edge.reason.length).toBeGreaterThan(15);
            expect(edge.from.id).toBe(edge.source);expect(edge.to.id).toBe(edge.target);
        }
        expect(edges.some(edge=>edge.source===14&&edge.target===16&&edge.from.category!==edge.to.category)).toBe(true);
        expect(edges.some(edge=>edge.source===27||edge.target===27)).toBe(false);
        expect(layoutProjectMap(homeProjects.filter(project=>project.id!==7)).edges.every(edge=>edge.source!==7&&edge.target!==7)).toBe(true);
    });
});

describe('Project relationships',()=>{
    it('reveals neighbors on keyboard focus and restores the overview on blur',()=>{
        const {container}=mount();
        const node=screen.getByRole('button',{name:'SEMOVI route extraction, Data'});
        fireEvent.focus(node);
        expect(screen.queryByRole('list',{name:'Related projects'})).toBeNull();
        expect(screen.getByRole('button',{name:'3 related projects'})).not.toBeNull();
        expect(container.querySelectorAll('.home-graph path.is-active')).toHaveLength(3);
        expect(container.querySelector('[data-project-id="16"]').classList.contains('is-related')).toBe(true);
        fireEvent.blur(node);
        expect(screen.queryByRole('list',{name:'Related projects'})).toBeNull();
    });
    it('pins a selection for touch, opens a related project, and clears with Escape',()=>{
        const {container}=mount();
        const node=screen.getByRole('button',{name:'SEMOVI route extraction, Data'});
        fireEvent.click(node);
        fireEvent.pointerLeave(node);
        expect(node.getAttribute('aria-pressed')).toBe('true');
        fireEvent.click(screen.getByRole('button',{name:'3 related projects'}));
        expect(screen.getByRole('dialog')).not.toBeNull();
        const relationships=screen.getByRole('list',{name:'Related projects'});
        expect(within(relationships).getByText('Geospatial pipelines and map-based analysis.')).not.toBeNull();
        fireEvent.click(within(relationships).getByRole('button',{name:'Tellus'}));
        expect(screen.getByTestId('location').textContent).toBe('/projects/16');
        fireEvent.click(screen.getByRole('button',{name:'Close details'}));
        fireEvent.keyDown(node,{key:'Escape'});
        expect(node.getAttribute('aria-pressed')).toBe('false');
        expect(container.querySelectorAll('.home-graph path.is-active')).toHaveLength(0);
    });
    it('resets a pinned selection when changing fields and supports independent projects',()=>{
        mount();
        fireEvent.click(screen.getByRole('button',{name:'SEMOVI route extraction, Data'}));
        const filter=screen.getByRole('group',{name:'Project map field'});
        fireEvent.click(within(filter).getByRole('button',{name:'Hardware',exact:true}));
        expect(screen.queryByRole('list',{name:'Related projects'})).toBeNull();
        const cpu=screen.getByRole('button',{name:'Basic CPU from Logic Gates, Hardware'});
        fireEvent.click(cpu);
        expect(cpu.getAttribute('aria-pressed')).toBe('true');
        expect(screen.queryByRole('list',{name:'Related projects'})).toBeNull();
        fireEvent.click(screen.getByRole('button',{name:'Clear selection'}));
        expect(cpu.getAttribute('aria-pressed')).toBe('false');
    });
});

describe('Compact homepage',()=>{
    it('opens the archive from its direct route and collapses it again',()=>{
        mount('/projects');
        const archive=screen.getByRole('region',{name:'All projects'});
        expect(within(archive).getAllByRole('link')).toHaveLength(24);
        fireEvent.click(within(archive).getByRole('button',{name:'All projects Hide 24'}));
        expect(within(archive).queryAllByRole('link')).toHaveLength(0);
        fireEvent.click(screen.getByRole('link',{name:'Browse the complete index'}));
        expect(within(archive).getAllByRole('link')).toHaveLength(24);
    });
    it('keeps current work beside the map and closes relationship details with Escape',()=>{
        const {container}=mount();
        expect(container.querySelector('.home-project-column .home-current')).not.toBeNull();
        expect(container.querySelector('aside .home-current')).toBeNull();
        fireEvent.click(screen.getByRole('button',{name:'SEMOVI route extraction, Data'}));
        fireEvent.click(screen.getByRole('button',{name:'3 related projects'}));
        fireEvent(screen.getByRole('dialog'),new Event('cancel',{cancelable:true}));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.body.style.overflow).not.toBe('hidden');
    });
});
