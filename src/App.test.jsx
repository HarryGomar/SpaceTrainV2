import React from 'react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {Link} from 'react-router-dom';

const loadExperience=vi.hoisted(()=>vi.fn());
vi.mock('./components/Experience/Experience',()=>{
    loadExperience();
    return {default:()=> <div>Original train experience<Link to="/">Main screen</Link></div>};
});
import App from './App';
afterEach(()=>{cleanup();window.history.replaceState({},'','/');});

describe('Homepage and train boundary',()=>{
    it('does not import the 3D experience until the visitor follows its link',async()=>{
        window.history.replaceState({},'','/');
        render(<App/>);
        expect(loadExperience).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('link',{name:'Explore the interactive experience'}));
        expect(await screen.findByText('Original train experience')).not.toBeNull();
        expect(loadExperience).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('link',{name:'Main screen'}));
        expect(await screen.findByRole('heading',{name:'Harry Gomar',level:1})).not.toBeNull();
    });
    it('allows direct loading of the train route without a prior landing-page click',async()=>{
        window.history.replaceState({},'','/experience');
        render(<App/>);
        expect(await screen.findByText('Original train experience')).not.toBeNull();
    });
});
