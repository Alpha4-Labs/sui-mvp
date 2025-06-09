import React, { useMemo, useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Label, ResponsiveContainer
} from 'recharts';
import { useAlphaContext } from '../context/AlphaContext';
import { formatPoints, formatSui } from '../utils/format';
import { InformationCircleIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { useProjectionChartData } from '../hooks/useProjectionChartData';

// --- Metric Definitions ---
const METRICS = [
  { key: 'suiPrice', label: 'SUI Price', color: '#10b981' },
  { key: 'alphaPointBalance', label: 'Alpha Point Balance', color: '#3b82f6' },
  { key: 'alphaPointSpending', label: 'Alpha Point Spending', color: '#f59e42' },
  { key: 'loanInflow', label: 'Loan Inflow', color: '#a21caf' },
  { key: 'loanOutflow', label: 'Loan Outflow', color: '#f43f5e' },
  { key: 'totalGains', label: 'Total Gains', color: '#fde047' },
  { key: 'unrealizedGains', label: 'Unrealized Gains', color: '#38bdf8' },
  { key: 'unrealizedLosses', label: 'Unrealized Losses', color: '#ef4444' },
];
const DAY_WINDOWS = [15, 30, 45, 60, 90, 180];

// --- Chart Data Point Type ---
interface ChartDataPoint {
  day: number; // 0 = today, negative = past, positive = future
  suiPrice?: number;
  alphaPointBalance?: number;
  alphaPointSpending?: number;
  loanInflow?: number;
  loanOutflow?: number;
  totalGains?: number;
  unrealizedGains?: number;
  unrealizedLosses?: number;
}

const METRIC_TOOLTIPS: Record<string, string> = {
  suiPrice: 'The price of SUI in USD, sourced from CoinGecko.',
  alphaPointBalance: 'Your Alpha Point balance for each day.',
  alphaPointSpending: 'Alpha Points spent on redemptions or actions each day.',
  loanInflow: 'Alpha Points received from loan inflows each day.',
  loanOutflow: 'Alpha Points paid out for loan repayments each day.',
  totalGains: 'Net realized profit or loss for the day (earned minus spent).',
  unrealizedGains: 'Potential profit if you sold your Alpha Points at current prices. Only positive if your position is in profit.',
  unrealizedLosses: 'Potential loss if you sold your Alpha Points at current prices. Only positive if your position is at a loss.',
};

// --- Main Component ---
const ProjectionChart: React.FC = () => {
  useAlphaContext();
  const [windowSize, setWindowSize] = useState(30);
  const [metricToggles, setMetricToggles] = useState<Record<string, boolean>>({
    suiPrice: true,
    alphaPointBalance: false,
    alphaPointSpending: false,
    loanInflow: false,
    loanOutflow: false,
    totalGains: false,
    unrealizedGains: false,
    unrealizedLosses: false,
  });
  const [refreshing, setRefreshing] = useState(false);

  // --- Use new data hook ---
  const { data: rawChartData, loading, error, refetch } = useProjectionChartData(windowSize);
  
  // Transform data to have separate historical and projected properties
  const chartData = useMemo(() => {
    return rawChartData.map(point => {
      const transformed: any = { day: point.day };
      
             METRICS.forEach(metric => {
         const value = point[metric.key as keyof typeof point];
         if (point.day <= 0) {
           // Historical data: from -X to 0 (including day 0)
           transformed[`${metric.key}Historical`] = value;
         } else {
           transformed[`${metric.key}Historical`] = null;
         }
         
         if (point.day >= 0) {
           // Projected data: from 0 to +X (including day 0) 
           transformed[`${metric.key}Projected`] = value;
         } else {
           transformed[`${metric.key}Projected`] = null;
         }
      });
      
      return transformed;
    });
  }, [rawChartData]);

  // --- Toggle Handlers ---
  const handleToggle = (key: string) => {
    setMetricToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const handleWindowChange = (size: number) => setWindowSize(size);

  // --- Refresh Handler ---
  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch(true); // Pass forceRefresh=true
    setRefreshing(false);
  };

  // --- Tooltip ---
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 bg-opacity-80 backdrop-blur-sm border border-gray-600 p-3 rounded-lg shadow-lg text-sm">
          <p className="text-gray-300 mb-1">{label === 0 ? 'Today' : (label > 0 ? `Day +${label}` : `Day ${label}`)}</p>
          {payload.map((entry: any, idx: number) => {
            const metric = METRICS.find(m => m.key === entry.dataKey);
            const isDollar = metric && ['suiPrice', 'unrealizedGains', 'unrealizedLosses'].includes(metric.key);
            return (
              <p key={idx} style={{ color: entry.stroke }}>
                {metric?.label}: {isDollar ? '$' : ''}{typeof entry.value === 'number' ? entry.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : entry.value}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  // --- Legend/Controls ---
  const renderControls = () => (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-white mb-3 flex items-center">
          <svg className="w-4 h-4 mr-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Metrics
          <span className="ml-2 text-gray-400" title="Toggle metrics to show/hide lines on the chart.">
            <InformationCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
          </span>
        </h4>
        <div className="grid grid-cols-1 gap-2">
          {METRICS.map((metric) => (
            <label key={metric.key} className="inline-flex items-center cursor-pointer text-xs p-2 rounded-lg hover:bg-white/5 transition-colors" title={metric.label}>
              <input
                type="checkbox"
                checked={metricToggles[metric.key]}
                onChange={() => handleToggle(metric.key)}
                className="form-checkbox h-4 w-4 rounded border-gray-600 focus:ring-offset-gray-800 cursor-pointer mr-3"
                style={{ accentColor: metric.color }}
              />
              <span className="flex items-center flex-1" style={{ color: metricToggles[metric.key] ? metric.color : '#6b7280' }}>
                <div 
                  className="w-3 h-3 rounded-full mr-2" 
                  style={{ backgroundColor: metricToggles[metric.key] ? metric.color : '#6b7280' }}
                ></div>
                {metric.label}
                {METRIC_TOOLTIPS[metric.key] && (
                  <span className="ml-auto" title={METRIC_TOOLTIPS[metric.key]}>
                    <QuestionMarkCircleIcon className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      </div>
      

    </div>
  );

  // --- Y-Axis Formatter ---
  const formatYAxis = (tick: number) => {
    // If only SUI Price, Unrealized Gains, or Unrealized Losses are shown, add $ prefix
    const dollarMetrics = ['suiPrice', 'unrealizedGains', 'unrealizedLosses'];
    const activeDollar = METRICS.filter(m => metricToggles[m.key] && dollarMetrics.includes(m.key));
    const activeOther = METRICS.filter(m => metricToggles[m.key] && !dollarMetrics.includes(m.key));
    const prefix = activeDollar.length > 0 && activeOther.length === 0 ? '$' : '';
    if (tick >= 1000000) return `${prefix}${(tick / 1000000).toFixed(1)}m`;
    if (tick >= 1000) return `${prefix}${(tick / 1000).toFixed(0)}k`;
    return `${prefix}${tick.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // --- Render ---
  return (
    <div className="card-modern p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Projection & History Chart</h3>
            <p className="text-sm text-gray-400">Track your Alpha Points growth</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="relative group">
            <span className="text-gray-400 cursor-help" title="Extrapolated data (dotted lines) represents projections based on historical trends and is not indicative of future performance or guaranteed outcomes. Past performance does not predict future results.">
              <QuestionMarkCircleIcon className="h-5 w-5 text-amber-400" />
            </span>
          </div>
          
          <button
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
              refreshing 
                ? 'bg-gray-700/50 text-gray-400 cursor-not-allowed' 
                : 'btn-modern-secondary'
            }`}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-3 w-3 border-b border-current"></div>
                <span>Refreshing...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh Data</span>
              </div>
            )}
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 w-full">
          <div className="h-[300px] mb-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                  <span className="text-gray-400 text-sm">Loading chart...</span>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                  <XAxis dataKey="day" stroke="#9ca3af" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} label={{ value: 'Day', position: 'insideBottom', offset: -10, fill: '#9ca3af', fontSize: 12 }} />
                  <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} tickFormatter={formatYAxis} axisLine={false} tickLine={false} width={45} domain={['auto', 'auto']} />
                  <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: '#6b7280', strokeWidth: 1, strokeDasharray: '3 3' }} />
                  {METRICS.filter(m => metricToggles[m.key]).map(metric => [
                    // Historical/Known data (solid line) - from -X days to 0 (including today)
                    <Line
                      key={`${metric.key}-historical`}
                      type="monotone"
                      dataKey={`${metric.key}Historical`}
                      stroke={metric.color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5 }}
                      name={`${metric.label} (Historical)`}
                      connectNulls={false}
                      isAnimationActive={true}
                    />,
                    // Extrapolated/Projected data (dotted line) - from day 1 onwards (AFTER known data)
                    <Line
                      key={`${metric.key}-projected`}
                      type="monotone"
                      dataKey={`${metric.key}Projected`}
                      stroke={metric.color}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      activeDot={{ r: 5 }}
                      name={`${metric.label} (Projected)`}
                      connectNulls={false}
                      isAnimationActive={true}
                    />
                  ]).flat()}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          
          {/* Day Window Controls */}
          <div className="bg-black/20 backdrop-blur-lg border border-white/10 rounded-xl p-3 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium text-white">Day Window</span>
                <span className="text-gray-400" title="Select the number of days to display (centered on today)">
                  <InformationCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
                </span>
              </div>
              <div className="flex gap-2">
                {DAY_WINDOWS.map((size) => (
                  <button
                    key={size}
                    onClick={() => handleWindowChange(size)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                      windowSize === size 
                        ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/25' 
                        : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    {size}d
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="lg:col-span-1 w-full bg-black/20 backdrop-blur-lg border border-white/10 rounded-xl p-4 shadow-xl">
          {renderControls()}
        </div>
      </div>
    </div>
  );
};

export default ProjectionChart;