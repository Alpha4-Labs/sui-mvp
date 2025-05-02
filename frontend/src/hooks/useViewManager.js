// src/hooks/useViewManager.js
import { useState, useEffect, useRef, useCallback } from 'react';

export function useViewManager(initialView = 'dashboard', transitionDuration = 300) {
    const [currentView, setCurrentView] = useState(initialView);
    const [previousView, setPreviousView] = useState(null); // Could be useful for complex transitions
    const [isTransitioning, setIsTransitioning] = useState(false);
    const viewTimeoutRef = useRef(null);

    const changeView = useCallback((newView) => {
        if (newView === currentView || isTransitioning) return;

        clearTimeout(viewTimeoutRef.current); // Clear any pending timeout
        setPreviousView(currentView);
        setIsTransitioning(true); // Start transition out

        // Timeout matches the CSS transition duration
        viewTimeoutRef.current = setTimeout(() => {
            setCurrentView(newView); // Switch the view content
            setPreviousView(null); // Reset previous view
            setIsTransitioning(false); // Transition complete
        }, transitionDuration);

    }, [currentView, isTransitioning, transitionDuration]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => clearTimeout(viewTimeoutRef.current);
    }, []);

    return {
        currentView,
        isTransitioning,
        changeView
    };
}