// src/components/MainContainer.jsx

import React from 'react';

/**
 * A reusable layout component that wraps content in a standardized, retro-themed container.
 * It provides a consistent frame, aspect ratio, and visual effects for all pages.
 */
const MainContainer = ({ children }) => {
    return (
        // This outer div centers the container on the screen.
        <div className="flex items-center justify-center h-screen p-4 bg-black">
            {/* This is the main styled container. The gap has been reduced from gap-4 to gap-2. */}
            <div className="relative w-full max-w-4xl aspect-[4/3] bg-[var(--main-bg)] p-4 flex flex-col gap-2 scanlines noise border-2 border-[var(--foreground-color)] glow text-[var(--foreground-color)]">
                {children}
            </div>
        </div>
    );
};

export default MainContainer;
