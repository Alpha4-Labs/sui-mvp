import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Label, ResponsiveContainer
} from 'recharts';
import { Tooltip } from './Tooltip'; // Our custom tooltip component
import { InformationCircleIcon } from '@heroicons/react/24/outline';

// Define types for our component props
interface ProjectionDataPoint {
  day: number;
  points: number;
  [key: string]: number; // For asset prices like ALPHA, ETH, etc.
}

interface Source {
  id: string;
  name: string;
  stakedAmount?: number;
  type?: string;
}

interface ProjectionChartProps {
  projectionData?: ProjectionDataPoint[];
  assetPriceData?: ProjectionDataPoint[]; // Array: [{ day: X, ALPHA: Y, ETH: Z }, ...]
  sources?: Source[];        // Array: Full generation sources data
  sourceToggles?: Record<string, boolean>;  // Object: { sourceId: boolean }
  assetToggles?: Record<string, boolean>;   // Object: { ALPHA: boolean, ETH: boolean }
  onSourceToggle?: (sourceId: string) => void;  // Function: (sourceId) => void
  onAssetToggle?: (assetSymbol: string) => void;  // Function: (assetSymbol) => void
}

// Define types for the tooltip props
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    stroke?: string;
    color?: string;
    name?: string;
    value?: number;
    dataKey?: string;
  }>;
  label?: string | number;
}

// Component to display the projection chart with asset overlays
export const ProjectionChart: React.FC<ProjectionChartProps> = ({
    projectionData = [],
    assetPriceData = [], 
    sources = [],       
    sourceToggles = {},  
    assetToggles = {},   
    onSourceToggle,     
    onAssetToggle        
}) => {

    // Custom Tooltip for Recharts - Shows points and active asset prices
    const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-gray-800 bg-opacity-80 backdrop-blur-sm border border-gray-600 p-3 rounded-lg shadow-lg text-sm">
                    <p className="text-gray-300 mb-1">{`Day ${label}`}</p>
                    {payload.map((entry, index) => (
                         <p key={index} style={{ color: entry.stroke || entry.color }}> {/* Use stroke color from Line */}
                            {/* Format points as whole numbers, prices with decimals */}
                            {`${entry.name}: ${entry.value?.toLocaleString(undefined,
                                { maximumFractionDigits: (entry.dataKey === 'points' ? 0 : 2) }
                            )}`}
                         </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    // --- COMPLETE Custom Legend/Controls Function ---
    const renderControls = () => {
        // Filter sources that are relevant to show a toggle for (e.g., have staked amount or are participation based)
        const relevantSources = sources.filter(s => s.stakedAmount || s.type === 'Participation');
        const activeSourcesForChartCount = relevantSources.filter(s => sourceToggles[s.id]).length;

        return (
            <div className="mt-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700 space-y-4 text-left"> {/* Added text-left */}
                {/* Source Toggles Section */}
                <div>
                    <h4 className="text-sm font-medium text-gray-200 mb-2 flex items-center">
                        Projection Sources
                        <Tooltip text="Toggle sources to see their impact on the 30-day projection." position="top">
                            <InformationCircleIcon className="h-4 w-4 ml-1.5 text-gray-400 cursor-help" />
                        </Tooltip>
                    </h4>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                        {relevantSources.length > 0 ? relevantSources.map((source) => (
                            <label key={`source-${source.id}`} className="inline-flex items-center cursor-pointer text-xs" title={source.name}> {/* Added title attribute */}
                                <input
                                    type="checkbox"
                                    checked={sourceToggles[source.id] || false}
                                    onChange={() => onSourceToggle?.(source.id)}
                                    className="form-checkbox h-4 w-4 rounded bg-gray-700 border-gray-600 text-purple-500 focus:ring-purple-600 focus:ring-offset-gray-800 cursor-pointer"
                                />
                                <span className={`ml-2 truncate max-w-[100px] sm:max-w-[150px] ${sourceToggles[source.id] ? 'text-gray-100' : 'text-gray-500 line-through'}`}> {/* Added truncate */}
                                    {source.name}
                                </span>
                            </label>
                         )) : <p className="text-xs text-gray-500 w-full">No applicable sources found.</p>
                        }
                         {relevantSources.length > 0 && activeSourcesForChartCount === 0 && Object.keys(sourceToggles).length > 0 && (
                             <p className="text-xs text-gray-500 w-full">No sources selected for projection.</p>
                         )}
                    </div>
                </div>

                {/* Asset Price Toggles Section */}
                 <div>
                    <h4 className="text-sm font-medium text-gray-200 mb-2 flex items-center">
                        Asset Price Overlay
                         <Tooltip text="Show simulated price trends for selected assets." position="top">
                            <InformationCircleIcon className="h-4 w-4 ml-1.5 text-gray-400 cursor-help" />
                        </Tooltip>
                    </h4>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                        {Object.keys(assetToggles).map((assetSymbol) => (
                            <label key={`asset-${assetSymbol}`} className="inline-flex items-center cursor-pointer text-xs">
                                <input
                                    type="checkbox"
                                    checked={assetToggles[assetSymbol] || false}
                                    onChange={() => onAssetToggle?.(assetSymbol)}
                                    // Example using different colors per asset toggle
                                    className={`form-checkbox h-4 w-4 rounded bg-gray-700 border-gray-600 focus:ring-offset-gray-800 cursor-pointer ${
                                        assetSymbol === 'ALPHA' ? 'text-yellow-500 focus:ring-yellow-600' :
                                        assetSymbol === 'ETH' ? 'text-pink-500 focus:ring-pink-600' :
                                        'text-indigo-500 focus:ring-indigo-600' // Default
                                    }`}
                                />
                                <span className={`ml-2 ${assetToggles[assetSymbol] ? 'text-gray-100' : 'text-gray-500'}`}>
                                    {assetSymbol} Price
                                </span>
                            </label>
                        ))}
                         {Object.keys(assetToggles).length === 0 && <p className="text-xs text-gray-500 w-full">No asset overlays available.</p>}
                    </div>
                </div>
            </div>
        );
    };
    // --- END COMPLETE renderControls ---

    // Format Y-axis ticks
    const formatYAxisPoints = (tick: number) => {
        if (tick >= 1000000) return `${(tick / 1000000).toFixed(1)}m`;
        if (tick >= 1000) return `${(tick / 1000).toFixed(0)}k`;
        return tick.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0});
    };
    // Format Y-axis for prices (basic example)
    const formatYAxisPrice = (tick: number) => {
         if (tick >= 1000) return `${(tick / 1000).toFixed(0)}k`;
         return tick.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    };


    return (
        // Main container for the chart component
        <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm p-4 md:p-6 rounded-xl shadow-lg border border-gray-700 transition duration-300 hover:border-green-500">
            {/* Centered Title */}
            <h3 className="text-lg font-semibold text-gray-100 mb-4 text-center">30-Day Points & Price Projection</h3>
    
            {/* --- Grid Container for Chart and Controls --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start"> {/* Adjust gap as needed */}
    
                {/* Chart Area (Takes 2/3 width on large screens) */}
                {/* ADD EXPLICIT HEIGHT (e.g., h-[350px]) HERE */}
                <div className="lg:col-span-2 w-full h-[350px]"> {/* <--- USE h-[...] NOT min-h-[...] */}
                    <ResponsiveContainer width="100%" height="100%">
                        {/* Your full LineChart component with data={projectionData}, Lines, Axes, Tooltip etc. */}
                        <LineChart data={projectionData} margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                            <XAxis dataKey="day" stroke="#9ca3af" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} label={{ value: 'Days', position: 'insideBottom', offset: -10, fill: '#9ca3af', fontSize: 12 }} />
                            <YAxis yAxisId="left" stroke="#9ca3af" tick={{ fontSize: 12 }} tickFormatter={formatYAxisPoints} axisLine={false} tickLine={false} width={45} domain={['auto', 'auto']} >
                                <Label value="Alpha Points" angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fill: '#9ca3af', fontSize: '12px' }} />
                            </YAxis>
                            {/* Optional Price Y Axis if you add it back */}
                            {/* <YAxis yAxisId="right" orientation="right" ... /> */}
                            <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: '#6b7280', strokeWidth: 1, strokeDasharray: '3 3' }}/>
                            {/* Points Line */}
                            <Line yAxisId="left" type="monotone" dataKey="points" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="Projected Points" connectNulls={false} isAnimationActive={true} />
                            {/* Asset Price Lines */}
                            {assetToggles['ALPHA'] && (
                                <Line yAxisId="left" type="monotone" dataKey="ALPHA" data={assetPriceData} stroke="#eab308" strokeWidth={1.5} dot={false} activeDot={{ r: 5 }} name="ALPHA Price" connectNulls={false} isAnimationActive={true} strokeDasharray="3 7"/>
                            )}
                            {assetToggles['ETH'] && (
                               <Line yAxisId="left" type="monotone" dataKey="ETH" data={assetPriceData} stroke="#ec4899" strokeWidth={1.5} dot={false} activeDot={{ r: 5 }} name="ETH Price" connectNulls={false} isAnimationActive={true} strokeDasharray="3 7"/>
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
    
                {/* Controls Area (Takes 1/3 width on large screens) */}
                <div className="lg:col-span-1 w-full">
                    {/* renderControls() now renders inside the correct grid column */}
                    {renderControls()}
                </div>
    
            </div>
            {/* --- END Grid Container --- */}
        </div>
     );
}

export default ProjectionChart;