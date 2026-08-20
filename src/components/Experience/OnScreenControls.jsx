import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useTrainStore from '../../store/useTrainStore';
import useStore from '../../store/useStore';
import './OnScreenControls.css';

const movementControls = [
    { direction: 'forward', label: 'FWD', symbol: '↑' },
    { direction: 'backward', label: 'REV', symbol: '↓' },
];

const OnScreenControls = () => {
    const navigate = useNavigate();
    const [expanded, setExpanded] = useState(() => (
        typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
    ));
    const [portraitNoticeDismissed, setPortraitNoticeDismissed] = useState(false);
    const activePointers = useRef({ forward: new Set(), backward: new Set() });
    const inTrain = useTrainStore((state) => state.inTrain);
    const inTerminal = useTrainStore((state) => state.inTerminal);
    const inProjects = useTrainStore((state) => state.inProjects);
    const isTransitioning = useTrainStore((state) => state.isTransitioning);
    const moveForward = useTrainStore((state) => state.moveForward);
    const moveBackward = useTrainStore((state) => state.moveBackward);
    const setMovement = useTrainStore((state) => state.setMovement);
    const requestFocusExit = useTrainStore((state) => state.requestFocusExit);
    const resetExperience = useTrainStore((state) => state.resetExperience);
    const setEnterExperience = useStore((state) => state.setEnterExperience);

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

    const handleReturnToMain = () => {
        releaseAll();
        setEnterExperience(false);
        resetExperience();
        navigate('/', { replace: true });
    };

    return (
        <>
            <nav className="experience-navigation" aria-label="Experience navigation">
                {(inTerminal || inProjects) && (
                    <button type="button" onClick={requestFocusExit} className="experience-navigation__button experience-navigation__button--primary">
                        <span aria-hidden="true">←</span> Return to train
                    </button>
                )}
                <button type="button" onClick={handleReturnToMain} className="experience-navigation__button" aria-label="Return to main screen">
                    Main screen
                </button>
            </nav>

            {!portraitNoticeDismissed && (
                <aside className="portrait-notice" aria-label="Portrait mode notice">
                    <p><strong>Limited in portrait.</strong> Rotate your device for more room to move and use the train displays.</p>
                    <button type="button" onClick={() => setPortraitNoticeDismissed(true)} aria-label="Dismiss portrait mode notice">Dismiss</button>
                </aside>
            )}

            {canMove && (
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
                    <span className="on-screen-controls__toggle-label">MOVE</span>
                    <span className="on-screen-controls__chevron" aria-hidden="true">›</span>
                </button>

                <div id="movement-buttons" className="on-screen-controls__buttons" aria-hidden={!expanded}>
                    {movementControls.map(({ direction, label, symbol }) => {
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
                                title={`Move ${direction}`}
                                onContextMenu={(event) => event.preventDefault()}
                                onPointerDown={(event) => {
                                    if (event.pointerType === 'mouse' && event.button !== 0) return;
                                    event.preventDefault();
                                    startMovement(direction, event.pointerId, event.currentTarget);
                                }}
                                onPointerUp={(event) => {
                                    event.preventDefault();
                                    stopMovement(direction, event.pointerId, event.currentTarget);
                                }}
                                onPointerCancel={(event) => stopMovement(direction, event.pointerId, event.currentTarget)}
                                onLostPointerCapture={(event) => stopMovement(direction, event.pointerId, event.currentTarget)}
                                onBlur={() => setMovement(direction, false)}
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
                                <span className="on-screen-controls__arrow" aria-hidden="true">{symbol}</span>
                                <span className="on-screen-controls__movement-label">{label}</span>
                            </button>
                        );
                    })}
                </div>
                    </div>
                </aside>
            )}
        </>
    );
};

export default OnScreenControls;
