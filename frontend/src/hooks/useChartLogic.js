// src/hooks/useChartLogic.js
import { useState, useEffect, useCallback } from 'react';

export function useChartLogic(alphaPoints, accruedPoints, stakedAlphaBalance, generationSources, isFetchingAny) {
    // --- Chart State ---
    const [projectionData, setProjectionData] = useState([]); // Data for the points projection line
    const [chartSourceToggles, setChartSourceToggles] = useState({}); // Toggles for chart sources (e.g., { 1: true, 2: false })
    const [assetPriceData, setAssetPriceData] = useState([]); // Mock data for asset price overlays
    const [chartAssetToggles, setChartAssetToggles] = useState({ ALPHA: false, ETH: false }); // Toggles for asset overlays

    // --- Effect: Initialize chart source toggles based on generationSources ---
    useEffect(() => {
        const initToggles = {};
        generationSources.forEach(s => {
            // Initialize toggle only if not already set, respecting previous user interaction
            setChartSourceToggles(prev => ({ ...prev, [s.id]: prev[s.id] ?? s.active }));
        });
        // Ensure all sources from the config are present in the toggles
        const sourceIds = generationSources.map(s => s.id);
        setChartSourceToggles(prev => {
            const next = {...prev};
            Object.keys(next).forEach(key => {
                if (!sourceIds.includes(parseInt(key))) {
                    delete next[key]; // Clean up toggles for sources that might no longer exist
                }
            });
            return next;
        });
    }, [generationSources]); // Rerun if generationSources array changes structure

    // --- Effect for mock asset prices ---
    useEffect(() => {
        const mockPrices = []; let alphaP = 1.5, ethP = 3000;
        for (let d = 0; d <= 30; d++) {
            mockPrices.push({ day: d, ALPHA: parseFloat(alphaP.toFixed(2)), ETH: Math.round(ethP) });
            alphaP *= (1 + (Math.random() - .49) * .05); ethP *= (1 + (Math.random() - .48) * .06);
            alphaP = Math.max(.01, alphaP); ethP = Math.max(100, ethP);
        }
        setAssetPriceData(mockPrices);
    }, []); // Run only once

    // --- Updated Projection Calculation ---
    const calculateProjection = useCallback(() => {
        const currentPointsNum = parseFloat(alphaPoints);
        const currentAccruedNum = parseFloat(accruedPoints);
        const currentStakedNum = parseFloat(stakedAlphaBalance);

        // Guard against invalid inputs or initial loading states
        if (isFetchingAny ||
            isNaN(currentPointsNum) || alphaPoints === '---' || alphaPoints === '...' ||
            isNaN(currentStakedNum) || stakedAlphaBalance === '---' || stakedAlphaBalance === '...') {
            return [{ day: 0, points: 0 }]; // Return baseline or empty array
        }

        // Use 0 for accrued if it's NaN (e.g., 'Error' state)
        const startingTotalPoints = currentPointsNum + (isNaN(currentAccruedNum) ? 0 : currentAccruedNum);

        const data = [];
        let projectedPoints = startingTotalPoints;
        data.push({ day: 0, points: projectedPoints });

        // Rate: 1 Point / 100 ALPHA / 60 min
        const POINTS_PER_PERIOD = 1; const ALPHA_PER_PERIOD = 100; const MINUTES_PER_PERIOD = 60;
        const PERIODS_PER_DAY = (24 * 60) / MINUTES_PER_PERIOD; // 24

        for (let day = 1; day <= 30; day++) {
            let dailyGen = 0;
            // Calculate Native Staking contribution
            const nativeStakingSource = generationSources.find(s => s.id === 1);
            if (nativeStakingSource && chartSourceToggles[nativeStakingSource.id] && currentStakedNum > 0) {
                dailyGen += (currentStakedNum / ALPHA_PER_PERIOD) * PERIODS_PER_DAY * POINTS_PER_PERIOD;
            }

            // Add other sources based on mock data and toggles
            generationSources.forEach(s => {
                if (s.id !== 1 && s.active && chartSourceToggles[s.id] && s.stakedAmount > 0) {
                    // Example for LP Staking (using its mock 'rate' string - needs parsing logic)
                    if (s.type === 'LP Staking') {
                        // Placeholder: Implement actual rate parsing based on 's.rate' string
                        // e.g., '0.5 αP / day / $100 LP Value' -> calculate points based on s.stakedAmount (value)
                        const rateMatch = s.rate.match(/([\d.]+)\s*αP\s*\/\s*day/);
                        const valueMatch = s.rate.match(/\$\s*([\d.]+)\s*LP/);
                        if (rateMatch && valueMatch) {
                            const pointsPerDayPer100Value = parseFloat(rateMatch[1]);
                            const valueBase = parseFloat(valueMatch[1]);
                            dailyGen += (s.stakedAmount / valueBase) * pointsPerDayPer100Value;
                        }
                    }
                    // Add other types ('Participation' etc.) if they have defined rates/logic
                }
            });

            projectedPoints += dailyGen;
            data.push({ day: day, points: parseFloat(projectedPoints.toFixed(6)) }); // Store with precision
        }
        return data;
    }, [alphaPoints, accruedPoints, stakedAlphaBalance, chartSourceToggles, generationSources, isFetchingAny]);

    // --- Effect to Recalculate Projection ---
    useEffect(() => {
        setProjectionData(calculateProjection());
    }, [calculateProjection]); // Depends on the memoized calculation function

    // --- Chart Toggle Handlers ---
    const handleChartSourceToggle = useCallback((sourceId) => {
        setChartSourceToggles(prev => ({ ...prev, [sourceId]: !prev[sourceId] }));
    }, []);

    const handleChartAssetToggle = useCallback((assetSymbol) => {
        setChartAssetToggles(prev => ({ ...prev, [assetSymbol]: !prev[assetSymbol] }));
    }, []);

    return {
        projectionData,
        assetPriceData,
        chartSourceToggles,
        chartAssetToggles,
        handleChartSourceToggle,
        handleChartAssetToggle
    };
}