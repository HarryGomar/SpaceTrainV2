import React from 'react';
import {afterEach,expect,it} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import MobileDisplay from './MobileDisplay';

afterEach(cleanup);
it('opens phone-sized project details and preserves the archive page on return',()=>{
    const {container}=render(<MemoryRouter><MobileDisplay screen="projects" onClose={()=>{}}/></MemoryRouter>);
    const cards=()=>[...container.querySelectorAll('button.group')];
    expect(cards()).toHaveLength(6);
    fireEvent.click(screen.getByRole('button',{name:'Next project page'}));
    const title=cards()[0].querySelector('h2').textContent;
    fireEvent.click(cards()[0]);
    expect(screen.getByRole('heading',{level:1,name:title})).not.toBeNull();
    expect(screen.getByTestId('project-detail-layout').className).toContain('flex-col');
    fireEvent.click(screen.getByRole('button',{name:/Return to Archives/}));
    expect(cards()[0].querySelector('h2').textContent).toBe(title);
});
