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
  const { points, loans, stakePositions } = useAlphaContext();
  const [windowSize, setWindowSize] = useState(30);
  const [metricToggles, setMetricToggles] = useState<Record<string, boolean>>({
    suiPrice: true,
    alphaPointBalance: true,
    alphaPointSpending: false,
    loanInflow: false,
    loanOutflow: false,
    totalGains: false,
    unrealizedGains: false,
    unrealizedLosses: false,
  });
  const [refreshing, setRefreshing] = useState(false);

  // --- Use new data hook ---
  const { data: chartData, loading, error, refetch } = useProjectionChartData(windowSize);

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
        <h4 className="text-sm font-medium text-gray-200 mb-2 flex items-center">
          Metrics
          <span className="ml-2 text-gray-400" title="Toggle metrics to show/hide lines on the chart.">
            <InformationCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
          </span>
        </h4>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {METRICS.map((metric, idx) => (
            <label key={metric.key} className="inline-flex items-center cursor-pointer text-xs" title={metric.label} style={{ gridColumn: (idx % 2) + 1 }}>
              <input
                type="checkbox"
                checked={metricToggles[metric.key]}
                onChange={() => handleToggle(metric.key)}
                className="form-checkbox h-4 w-4 rounded border-gray-600 focus:ring-offset-gray-800 cursor-pointer"
                style={{ accentColor: metric.color }}
              />
              <span className="ml-2 flex items-center" style={{ color: metricToggles[metric.key] ? metric.color : '#6b7280' }}>
                {metric.label}
                {METRIC_TOOLTIPS[metric.key] && (
                  <span className="ml-1" title={METRIC_TOOLTIPS[metric.key]}>
                    <QuestionMarkCircleIcon className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-sm font-medium text-gray-200 mb-2 flex items-center">
          Day Window
          <span className="ml-2 text-gray-400" title="Select the number of days to display (centered on today)">
            <InformationCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
          </span>
        </h4>
        <div className="grid grid-cols-3 grid-rows-2 gap-2">
          {DAY_WINDOWS.map((size, idx) => (
            <button
              key={size}
              onClick={() => handleWindowChange(size)}
              className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${windowSize === size ? 'bg-primary text-white border-primary' : 'bg-background-input text-gray-300 border-gray-600 hover:bg-gray-700'}`}
              style={{ gridColumn: (idx % 3) + 1, gridRow: Math.floor(idx / 3) + 1 }}
            >
              {size} days
            </button>
          ))}
        </div>
      </div>
      <button
        className={`mt-2 px-3 py-1 rounded border text-xs font-medium transition-colors ${refreshing ? 'bg-gray-700 text-gray-400' : 'bg-background-input text-gray-300 border-gray-600 hover:bg-gray-700'}`}
        onClick={handleRefresh}
        disabled={refreshing}
      >
        {refreshing ? 'Refreshing...' : 'Refresh'}
      </button>
      {error && (
        <div className="mt-2 text-sm text-red-400">{error}</div>
      )}
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
    <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm p-4 md:p-6 rounded-xl shadow-lg border border-gray-700 transition duration-300 hover:border-green-500">
      <h3 className="text-lg font-semibold text-gray-100 mb-4 text-center">Projection & History Chart</h3>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 w-full h-[350px]">
          {loading ? (
            <div className="flex items-center justify-center h-full"><span className="text-gray-400">Loading chart...</span></div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                <XAxis dataKey="day" stroke="#9ca3af" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} label={{ value: 'Day', position: 'insideBottom', offset: -10, fill: '#9ca3af', fontSize: 12 }} />
                <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} tickFormatter={formatYAxis} axisLine={false} tickLine={false} width={45} domain={['auto', 'auto']} />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: '#6b7280', strokeWidth: 1, strokeDasharray: '3 3' }} />
                {METRICS.filter(m => metricToggles[m.key]).map(metric => (
                  <Line
                    key={metric.key}
                    type="monotone"
                    dataKey={metric.key}
                    stroke={metric.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                    name={metric.label}
                    connectNulls={false}
                    isAnimationActive={true}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="lg:col-span-1 w-full">
          {renderControls()}
        </div>
      </div>
    </div>
  );
};

export default ProjectionChart;