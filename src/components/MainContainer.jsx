// src/components/MainContainer.jsx
import React from 'react';

const MainContainer = ({ children, isMobile }) => {
    return (
        // On Desktop: A fixed, centered container with outer padding.
        // On Mobile: A standard block element that allows the page to scroll.
        <div className={!isMobile ? "fixed inset-0 flex items-center justify-center bg-black p-[1.1cqi]" : "bg-black"}>
            <div
                className={`relative text-[var(--foreground-color)] bg-[var(--main-bg)] ${
                    !isMobile 
                        ? 'border-2 border-[var(--foreground-color)] glow scanlines noise overflow-hidden' 
                        : 'w-full'
                }`}
                style={
                    isMobile
                        ? { 
                              // Mobile styles: container takes full width and at least 100% of the screen height.
                              containerType: 'inline-size', 
                              minHeight: '100vh' 
                          }
                        : {
                              // Desktop styles: The container is a fixed aspect ratio box.
                              containerType: 'inline-size',
                              aspectRatio: '4 / 3',
                              width: '100%',
                              height: '100%',
                              maxWidth: 'calc(100vh * (4 / 3))',
                              maxHeight: 'calc(100vw * (3 / 4))',
                          }
                }
            >
                {children}
            </div>
        </div>
    );
};

export default MainContainer;
