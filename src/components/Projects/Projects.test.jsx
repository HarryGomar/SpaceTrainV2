import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Projects from './Projects';
import ProjectDetail from './ProjectDetail';

describe('Projects embedded train display', () => {
    const originalWidth = window.innerWidth;

    beforeEach(() => {
        window.history.replaceState({}, '', '/experience');
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 480 });
    });

    afterEach(() => {
        cleanup();
        window.history.replaceState({}, '', '/');
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
    });

    it('keeps the 1200 by 800 screen layout on a narrow phone viewport', async () => {
        const { container } = render(
            <MemoryRouter initialEntries={['/projects']}>
                <Projects />
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(container.querySelectorAll('button.group')).toHaveLength(4);
        });
        expect(screen.queryByRole('button', { name: 'Show Filters' })).toBeNull();
        expect(container.firstElementChild?.firstElementChild?.style.aspectRatio).toBe('4 / 3');
    });

    it('matches the landing screen aspect ratio on a wide standalone viewport', async () => {
        window.history.replaceState({}, '', '/projects');
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1920 });

        const { container } = render(
            <MemoryRouter initialEntries={['/projects']}>
                <Projects />
            </MemoryRouter>,
        );

        await waitFor(() => expect(container.querySelectorAll('button.group')).toHaveLength(4));
        expect(container.firstElementChild?.firstElementChild?.style.aspectRatio).toBe('4 / 3');
    });

    it('keeps project details in two columns inside the train screen', () => {
        render(
            <MemoryRouter initialEntries={['/projects/7']}>
                <Routes>
                    <Route path="/projects/:id" element={<ProjectDetail embedded />} />
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.getByTestId('project-detail-layout').className).toContain('flex-row');
        expect(screen.getByRole('button', { name: /return to archives/i })).not.toBeNull();
    });
});
