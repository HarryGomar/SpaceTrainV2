import React from 'react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {MemoryRouter,Route,Routes,useLocation} from 'react-router-dom';
import Home from './Home';
import {homeProjects,fields,layoutProjectMap} from './homeProjects';
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
    it('exposes every original project in the visible archive and in the graph',()=>{
        const {container}=mount();
        const archive=screen.getByRole('region',{name:'All projects'});
        const links=within(archive).getAllByRole('link');
        expect(links).toHaveLength(originalProjects.length);
        for(const item of originalProjects)expect(links.some(link=>link.getAttribute('href')===`/projects/${item.id}`)).toBe(true);
        expect(container.querySelectorAll('.home-graph-node')).toHaveLength(originalProjects.length);
        expect(screen.getByRole('link',{name:'Explore the interactive experience'}).getAttribute('href')).toBe('/experience');
        expect(container.querySelector('.home-header a[download]').getAttribute('href')).toBe('/home/harry-gomar-cv.pdf');
    });
    it('filters only the graph, keeps the complete archive, and opens a project from a node',()=>{
        const {container}=mount();
        const filter=screen.getByRole('group',{name:'Project map field'});
        fireEvent.click(within(filter).getByRole('button',{name:'Software',exact:true}));
        const software=homeProjects.filter(project=>project.category==='Software');
        expect(container.querySelectorAll('.home-graph-node')).toHaveLength(software.length);
        expect(container.querySelectorAll('.home-node-name')).toHaveLength(software.length);
        expect(within(screen.getByRole('region',{name:'All projects'})).getAllByRole('link')).toHaveLength(homeProjects.length);
        fireEvent.click(screen.getByRole('button',{name:'Tellus, Software'}));
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
    it('keeps all 24 nodes distinct, within the drawing, and connected to their real field',()=>{
        const {nodes,hubs}=layoutProjectMap(homeProjects);
        expect(new Set(nodes.map(node=>node.id)).size).toBe(homeProjects.length);
        for(const node of nodes){
            expect(node.x).toBeGreaterThan(4);expect(node.x).toBeLessThan(96);
            expect(node.y).toBeGreaterThan(4);expect(node.y).toBeLessThan(96);
            expect(hubs.some(hub=>hub.category===node.category&&hub.x===node.hubX&&hub.y===node.hubY)).toBe(true);
            for(const other of nodes.filter(other=>other.id!==node.id))expect(Math.hypot(node.x-other.x,node.y-other.y)).toBeGreaterThan(10);
        }
    });
    it.each(fields)('gives %s project labels separate rows and columns',field=>{
        const {nodes}=layoutProjectMap(homeProjects,field);
        expect(nodes).toHaveLength(homeProjects.filter(project=>project.category===field).length);
        expect(new Set(nodes.map(node=>`${node.x},${node.y}`)).size).toBe(nodes.length);
        expect(nodes.every(node=>node.category===field&&node.y>=29&&node.y<=82)).toBe(true);
    });
});
