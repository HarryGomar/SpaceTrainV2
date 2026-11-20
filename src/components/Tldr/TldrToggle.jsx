import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Tldr.css';

export default function TldrToggle({ enabled = false }) {
    const navigate = useNavigate();
    const { state } = useLocation();

    return (
        <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="TLDR mode"
            className="tldr-toggle"
            autoFocus={state?.focusTldrToggle}
            onClick={() => navigate(enabled ? '/' : '/tldr', { state: { focusTldrToggle: true } })}
        >
            TLDR
        </button>
    );
}
