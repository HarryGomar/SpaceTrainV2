// src/components/Point.jsx

import React from 'react';
import './Point.css';

const Point = ({ point, onClick, isSelected }) => {
    return (
        <button
            onClick={() => onClick(point)}
            className={`point ${isSelected ? 'selected' : ''}`}
            style={{
                left: point.x,
                top: point.y,
            }}
            aria-label={`Show details for ${point.title}`}
        >
            <div className="corners">
                <div className="corner top-left"></div>
                <div className="corner top-right"></div>
                <div className="corner bottom-left"></div>
                <div className="corner bottom-right"></div>
            </div>
        </button>
    );
};

export default Point;
