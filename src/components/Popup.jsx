// src/components/Popup.jsx

import React from 'react';

const Popup = ({ point, onClose }) => {
    return (
        <div
            className="popup absolute bg-[var(--container-background)] p-3 border-2 border-[var(--foreground-color)] shadow-lg rounded"
            style={{
                left: point.x,
                top: point.y,
                width: '180px',
                maxHeight: '200px',
                transform: 'translate(-50%, -110%)',
                zIndex: 10,
            }}
        >
            <button
                onClick={onClose}
                className="absolute top-1 right-1 text-white text-lg leading-none bg-transparent border-none cursor-pointer hover:text-[var(--selection-color)]"
                aria-label="Close popup"
            >
                &times;
            </button>
            <div className="relative">
                <img src={point.image} alt={point.title} className="w-full h-24 object-cover mb-2 border-2 border-white" />
                <h3 className="text-sm text-[var(--selection-color)] mb-1">{point.title}</h3>
                <p className="text-xs leading-tight">{point.text}</p>
            </div>
        </div>
    );
};

export default Popup;
