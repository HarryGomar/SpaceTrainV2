// src/components/Popup.jsx
import React from 'react';

const Popup = ({ point, onClose, isMobile }) => {

    // On mobile, render a full-screen modal for better readability and interaction.
    if (isMobile) {
        return (
            // The backdrop for the modal
            <div 
                className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
                onClick={onClose} // Close modal when clicking the backdrop
            >
                {/* The modal content itself. stopPropagation prevents clicks inside from closing it. */}
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="relative bg-[var(--container-background)] border-2 border-[var(--foreground-color)] shadow-lg w-full max-w-sm rounded-lg p-6 flex flex-col items-center"
                >
                    {/* Explicit close button for mobile */}
                    <button 
                        onClick={onClose} 
                        className="absolute top-2 right-2 text-white/50 hover:text-white text-2xl"
                        aria-label="Close popup"
                    >
                        &times;
                    </button>
                    
                    <img 
                        src={point.image} 
                        alt={point.title} 
                        className="w-full object-cover rounded-md"
                        style={{
                            height: '180px', // Larger, fixed height for the image
                            marginBottom: '1rem'
                        }}
                    />
                    <h3 
                        className="text-[var(--selection-color)] text-2xl font-bold"
                        style={{ marginBottom: '0.5rem' }}
                    >
                        {point.title}
                    </h3>
                    <p className="leading-tight text-center text-base">
                        {point.text}
                    </p>
                </div>
            </div>
        );
    }

    // On desktop, render the original tooltip-style popup.
    return (
        <div
            className="popup absolute bg-[var(--container-background)] border-2 border-[var(--foreground-color)] shadow-lg"
            style={{
                left: point.x,
                top: point.y,
                transform: 'translate(-50%, -110%)',
                zIndex: 10,
                width: '15cqi',
                maxHeight: '16.7cqi',
                padding: '1cqi',
            }}
        >
            <div className="relative">
                <img 
                    src={point.image} 
                    alt={point.title} 
                    className="w-full object-cover"
                    style={{
                        height: '8cqi',
                        marginBottom: '0.66cqi'
                    }}
                />
                <h3 
                    className="text-[var(--selection-color)]"
                    style={{
                        fontSize: '1.15cqi',
                        marginBottom: '0.34cqi'
                    }}
                >{point.title}</h3>
                <p 
                    className="leading-tight"
                    style={{ fontSize: '1cqi' }}
                >{point.text}</p>
            </div>
        </div>
    );
};

export default Popup;
