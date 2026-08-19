import React, { useCallback, useEffect, useRef, useState } from 'react';
import useTrainStore from '../../store/useTrainStore';
import './OnScreenControls.css';

const movementControls = [
    { direction: 'forward', label: 'FWD', path: 'M6 11.5 12 5.5l6 6M12 6v12.5' },
    { direction: 'backward', label: 'REV', path: 'M6 12.5 12 18.5l6-6M12 18V5.5' },
];

const OnScreenControls = () => {
    const [expanded, setExpanded] = useState(() => (
        typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
    ));
    const activePointers = useRef({ forward: new Set(), backward: new Set() });
    const inTrain = useTrainStore((state) => state.inTrain);
    const inTerminal = useTrainStore((state) => state.inTerminal);
    const inProjects = useTrainStore((state) => state.inProjects);
    const isTransitioning = useTrainStore((state) => state.isTransitioning);
    const moveForward = useTrainStore((state) => state.moveForward);
    const moveBackward = useTrainStore((state) => state.moveBackward);
    const setMovement = useTrainStore((state) => state.setMovement);

    const canMove = inTrain && !inTerminal && !inProjects && !isTransitioning;

    const releaseAll = useCallback(() => {
        activePointers.current.forward.clear();
        activePointers.current.backward.clear();
        const movementState = useTrainStore.getState();
        if (movementState.moveForward || movementState.moveBackward) {
            movementState.clearMovement();
        }
    }, []);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) releaseAll();
        };

        window.addEventListener('blur', releaseAll);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('blur', releaseAll);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            releaseAll();
        };
    }, [releaseAll]);

    useEffect(() => {
        if (!canMove || !expanded) releaseAll();
    }, [canMove, expanded, releaseAll]);

    const startMovement = (direction, pointerId, target) => {
        activePointers.current[direction].add(pointerId);
        target?.setPointerCapture?.(pointerId);
        setMovement(direction, true);
    };

    const stopMovement = (direction, pointerId, target) => {
        activePointers.current[direction].delete(pointerId);
        if (target?.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId);
        setMovement(direction, activePointers.current[direction].size > 0);
    };

    if (!canMove) return null;

    return (
        <aside className="on-screen-controls" aria-label="Movement controls">
            <div className={`on-screen-controls__panel${expanded ? ' is-expanded' : ''}`}>
                <button
                    type="button"
                    className="on-screen-controls__toggle"
                    aria-controls="movement-buttons"
                    aria-expanded={expanded}
                    aria-label={expanded ? 'Hide movement controls' : 'Show movement controls'}
                    onClick={() => setExpanded((isExpanded) => !isExpanded)}
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 8h16M4 16h16M8 5v6M16 13v6" />
                    </svg>
                    <span>MOVE</span>
                    <svg className="on-screen-controls__chevron" viewBox="0 0 16 16" aria-hidden="true">
                        <path d="m6 3 5 5-5 5" />
                    </svg>
                </button>

                <div id="movement-buttons" className="on-screen-controls__buttons" aria-hidden={!expanded}>
                    {movementControls.map(({ direction, label, path }) => {
                        const isPressed = direction === 'forward' ? moveForward : moveBackward;

                        return (
                            <button
                                key={direction}
                                type="button"
                                className="on-screen-controls__movement"
                                aria-label={`Move ${direction}`}
                                aria-pressed={isPressed}
                                tabIndex={expanded ? 0 : -1}
                                disabled={!expanded}
                                onContextMenu={(event) => event.preventDefault()}
                                onPointerDown={(event) => {
                                    event.preventDefault();
                                    startMovement(direction, event.pointerId, event.currentTarget);
                                }}
                                onPointerUp={(event) => {
                                    event.preventDefault();
                                    stopMovement(direction, event.pointerId, event.currentTarget);
                                }}
                                onPointerCancel={(event) => stopMovement(direction, event.pointerId, event.currentTarget)}
                                onLostPointerCapture={(event) => stopMovement(direction, event.pointerId, event.currentTarget)}
                                onKeyDown={(event) => {
                                    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
                                        event.preventDefault();
                                        setMovement(direction, true);
                                    }
                                }}
                                onKeyUp={(event) => {
                                    if (event.key === ' ' || event.key === 'Enter') {
                                        event.preventDefault();
                                        setMovement(direction, false);
                                    }
                                }}
                            >
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d={path} />
                                </svg>
                                <span>{label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </aside>
    );
};

export default OnScreenControls;
