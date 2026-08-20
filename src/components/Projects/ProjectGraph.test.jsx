import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProjectGraph from './ProjectGraph';

let resizeCallback;
let graphSize;

class ResizeObserverMock {
    constructor(callback) {
        resizeCallback = callback;
    }

    observe() {}
    disconnect() {}
}

describe('ProjectGraph', () => {
    beforeEach(() => {
        graphSize = { width: 0, height: 0 };
        resizeCallback = undefined;
        window.ResizeObserver = ResizeObserverMock;
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({
            ...graphSize,
            top: 0,
            left: 0,
            right: graphSize.width,
            bottom: graphSize.height,
            x: 0,
            y: 0,
            toJSON() {},
        }));
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('recovers when an embedded project screen receives its size after mount', async () => {
        const { container } = render(
            <MemoryRouter>
                <ProjectGraph
                    projects={[{
                        id: 1,
                        title: 'Test project',
                        category: 'Software',
                        scope: 'Small',
                        status: 'Active',
                        years: '2026',
                    }]}
                    isMobile={false}
                />
            </MemoryRouter>,
        );

        graphSize = { width: 800, height: 500 };
        resizeCallback?.([{ contentRect: graphSize }]);

        await waitFor(() => {
            expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 800 500');
            expect(container.querySelector('[role="button"]')).not.toBeNull();
        });
    });
});
