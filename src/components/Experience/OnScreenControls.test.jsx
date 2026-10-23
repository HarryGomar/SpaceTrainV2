import React from 'react';
import { afterEach, beforeEach, describe, expect, it,vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OnScreenControls from './OnScreenControls';
import useTrainStore from '../../store/useTrainStore';

const initialTrainState = useTrainStore.getState();

describe('OnScreenControls', () => {
    beforeEach(() => {
        useTrainStore.setState(initialTrainState, true);
        window.matchMedia = () => ({
            matches: false,
            addEventListener() {},
            removeEventListener() {},
        });
    });

    afterEach(() => cleanup());

    it.each([
        ['project archive', { inTrain: true, inProjects: true, projectsVisible: true }],
        ['terminal', { inTrain: true, inTerminal: true, iframeVisible: true }],
    ])('keeps an exit and main-screen action visible in the %s', (_, focusedState) => {
        useTrainStore.setState(focusedState);

        render(
            <MemoryRouter initialEntries={['/experience']}>
                <OnScreenControls />
            </MemoryRouter>,
        );

        expect(screen.getByRole('button', { name: /return to train/i })).not.toBeNull();
        expect(screen.getByRole('button', { name: /main screen/i })).not.toBeNull();

        const requestBeforeClick = useTrainStore.getState().focusExitRequest;
        fireEvent.click(screen.getByRole('button', { name: /return to train/i }));
        expect(useTrainStore.getState().focusExitRequest).toBe(requestBeforeClick + 1);
    });

    it('restores movement controls after leaving a focused view', () => {
        useTrainStore.setState({ inTrain: true, inProjects: true, projectsVisible: true });
        render(
            <MemoryRouter initialEntries={['/experience']}>
                <OnScreenControls />
            </MemoryRouter>,
        );

        expect(screen.queryByLabelText('Movement controls')).toBeNull();

        act(() => {
            useTrainStore.setState({ inProjects: false, projectsVisible: false, isTransitioning: false });
        });

        expect(screen.getByLabelText('Movement controls')).not.toBeNull();
    });

    it('exposes entry and project shortcuts and stops movement after pointer cancellation',()=>{
        const onOpenProjects=vi.fn();
        const view=render(<MemoryRouter><OnScreenControls onOpenProjects={onOpenProjects}/></MemoryRouter>);
        fireEvent.click(screen.getByRole('button',{name:'Enter train'}));
        expect(useTrainStore.getState().entryRequest).toBe(1);
        fireEvent.click(screen.getByRole('button',{name:'Projects'}));
        expect(onOpenProjects).toHaveBeenCalledOnce();
        act(()=>useTrainStore.setState({inTrain:true}));
        fireEvent.click(screen.getByRole('button',{name:'Show movement controls'}));
        fireEvent.pointerDown(screen.getByRole('button',{name:'Move forward'}));
        expect(useTrainStore.getState().moveForward).toBe(true);
        fireEvent.pointerCancel(screen.getByRole('button',{name:'Move forward'}));
        expect(useTrainStore.getState().moveForward).toBe(false);
        view.unmount();
    });
});
