import React, { useState, useEffect } from 'react';
import { PartnerCapInfo } from '../../hooks/usePartnerDetection';
import { usePartnerAnalytics } from '../../hooks/usePartnerAnalytics';
import { usePerkData } from '../../hooks/usePerkData';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';

interface AnalyticsTabProps {
  partnerCap: PartnerCapInfo;
  selectedPartnerCapId: string;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  partnerCap,
  selectedPartnerCapId
}) => {
  const { getPartnerPerkMetrics } = usePerkData();
  const metrics = getPartnerPerkMetrics(selectedPartnerCapId);
  
  // Analytics state
  const [analyticsTimeRange, setAnalyticsTimeRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [analyticsToggles, setAnalyticsToggles] = useState({
    tvlBacking: true,
    dailyQuotaUsage: true,
    pointsMinted: true,
    perkRevenue: false,
    lifetimeQuota: false
  });

  // Mock daily data - in a real implementation, this would come from your analytics service
  const [dailyData, setDailyData] = useState(() => {
    const data = [];
    const today = new Date();
    const daysToShow = analyticsTimeRange === '7d' ? 7 : analyticsTimeRange === '30d' ? 30 : 90;
    
    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Generate mock data based on current metrics
      const tvlBackingUsd = partnerCap.currentEffectiveUsdcValue || 0;
      const lifetimeQuota = Math.floor(tvlBackingUsd * 1000);
      const dailyQuota = Math.floor(lifetimeQuota * 0.03);
      const pointsMintedToday = partnerCap.pointsMintedToday || 0;
      
      data.push({
        day: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        tvlBacking: tvlBackingUsd + (Math.random() - 0.5) * tvlBackingUsd * 0.1,
        pointsMinted: Math.floor(pointsMintedToday * (0.5 + Math.random() * 0.5)),
        dailyQuotaUsage: Math.random() * 100,
        perkRevenue: Math.floor(Math.random() * 1000),
        lifetimeQuota: lifetimeQuota
      });
    }
    return data;
  });

  const analyticsMetrics = [
    { key: 'tvlBacking', label: 'TVL Backing', color: '#10b981' },
    { key: 'dailyQuotaUsage', label: 'Daily Quota Usage', color: '#3b82f6' },
    { key: 'pointsMinted', label: 'Points Minted', color: '#f59e42' },
    { key: 'perkRevenue', label: 'Perk Revenue', color: '#a21caf' },
    { key: 'lifetimeQuota', label: 'Lifetime Quota', color: '#38bdf8' },
  ];

  const handleAnalyticsToggle = (key: string) => {
    setAnalyticsToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleTimeRangeChange = (range: '7d' | '30d' | '90d') => {
    setAnalyticsTimeRange(range);
    setIsLoadingAnalytics(true);
    
    // Simulate loading and refresh data
    setTimeout(() => {
      // Regenerate data for new time range
      const data = [];
      const today = new Date();
      const daysToShow = range === '7d' ? 7 : range === '30d' ? 30 : 90;
      
      for (let i = daysToShow - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        const tvlBackingUsd = partnerCap.currentEffectiveUsdcValue || 0;
        const lifetimeQuota = Math.floor(tvlBackingUsd * 1000);
        const pointsMintedToday = partnerCap.pointsMintedToday || 0;
        
        data.push({
          day: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          tvlBacking: tvlBackingUsd + (Math.random() - 0.5) * tvlBackingUsd * 0.1,
          pointsMinted: Math.floor(pointsMintedToday * (0.5 + Math.random() * 0.5)),
          dailyQuotaUsage: Math.random() * 100,
          perkRevenue: Math.floor(Math.random() * 1000),
          lifetimeQuota: lifetimeQuota
        });
      }
      setDailyData(data);
      setIsLoadingAnalytics(false);
    }, 1000);
  };

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 bg-opacity-95 backdrop-blur-sm border border-gray-600 p-3 rounded-lg shadow-lg text-sm">
          <p className="text-gray-300 mb-2">{label}</p>
          {payload.map((entry: any, idx: number) => {
            const value = entry.value;
            let formattedValue = value.toLocaleString();
            
            // Format large numbers more readably
            if (value >= 1000000) {
              formattedValue = (value / 1000000).toFixed(1) + 'M';
            } else if (value >= 1000) {
              formattedValue = (value / 1000).toFixed(1) + 'K';
            }
            
            return (
              <p key={idx} style={{ color: entry.stroke }}>
                {entry.name}: {formattedValue}
                {entry.dataKey === 'tvlBacking' ? ' USD' : 
                 entry.dataKey === 'dailyQuotaUsage' ? '%' : ' AP'}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      {/* Analytics Chart */}
      <div className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          <div className="lg:col-span-3 w-full h-64">
            <div className="h-full bg-gray-900/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Daily Performance Trends</h3>
                <div className="flex items-center space-x-2">
                  <div className="flex bg-gray-800 rounded-lg p-1">
                    {(['7d', '30d', '90d'] as const).map((range) => (
                      <button
                        key={range}
                        onClick={() => handleTimeRangeChange(range)}
                        className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                          analyticsTimeRange === range
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
                      </button>
                    ))}
                  </div>
                  {isLoadingAnalytics && (
                    <div className="text-xs text-blue-400 flex items-center">
                      <svg className="animate-spin h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <circle className="opacity-25" cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Loading...
                    </div>
                  )}
                </div>
              </div>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                    <XAxis 
                      dataKey="day" 
                      stroke="#9ca3af" 
                      tick={{ fontSize: 12 }} 
                      axisLine={false} 
                      tickLine={false} 
                    />
                    <YAxis 
                      stroke="#9ca3af" 
                      tick={{ fontSize: 12 }} 
                      axisLine={false} 
                      tickLine={false} 
                      width={50}
                    />
                    <RechartsTooltip content={<CustomTooltip />} />
                    
                    {/* Show different metrics based on analytics toggles */}
                    {analyticsToggles['tvlBacking'] && (
                      <Line
                        type="monotone"
                        dataKey="tvlBacking"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="TVL Backing"
                      />
                    )}
                    {analyticsToggles['pointsMinted'] && (
                      <Line
                        type="monotone"
                        dataKey="pointsMinted"
                        stroke="#f59e42"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="Points Minted"
                      />
                    )}
                    {analyticsToggles['dailyQuotaUsage'] && (
                      <Line
                        type="monotone"
                        dataKey="dailyQuotaUsage"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="Daily Quota Usage"
                      />
                    )}
                    {analyticsToggles['perkRevenue'] && (
                      <Line
                        type="monotone"
                        dataKey="perkRevenue"
                        stroke="#a21caf"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="Perk Revenue"
                      />
                    )}
                    {analyticsToggles['lifetimeQuota'] && (
                      <Line
                        type="monotone"
                        dataKey="lifetimeQuota"
                        stroke="#38bdf8"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="Lifetime Quota"
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          
          {/* Analytics Controls */}
          <div className="lg:col-span-1 w-full">
            <div>
              <h4 className="text-sm font-medium text-gray-200 mb-3">Metrics</h4>
              <div className="space-y-2 mb-4">
                {analyticsMetrics.map((metric) => (
                  <label key={metric.key} className="inline-flex items-center cursor-pointer text-xs w-full">
                    <input
                      type="checkbox"
                      checked={analyticsToggles[metric.key]}
                      onChange={() => handleAnalyticsToggle(metric.key)}
                      className="form-checkbox h-3 w-3 rounded border-gray-600 focus:ring-offset-gray-800 cursor-pointer"
                      style={{ accentColor: metric.color }}
                    />
                    <span 
                      className="ml-2 flex-1" 
                      style={{ color: analyticsToggles[metric.key] ? metric.color : '#6b7280' }}
                    >
                      {metric.label}
                    </span>
                  </label>
                ))}
              </div>
              
              <h4 className="text-sm font-medium text-gray-200 mb-2">Data Status</h4>
              <div className="text-xs text-gray-400 bg-gray-800/50 rounded p-2">
                <div className="flex items-center mb-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                  Real-time metrics
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-gray-500 rounded-full mr-2"></div>
                  Historical data pending
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Current Metrics */}
        <div className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Current Metrics</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
            <div className="flex justify-between py-0.5">
              <span className="text-gray-400 text-sm">TVL Backing</span>
              <span className="text-white font-semibold text-sm">${(partnerCap.currentEffectiveUsdcValue || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-gray-400 text-sm">Total Points Minted</span>
              <span className="text-white font-semibold text-sm">{(partnerCap.totalPointsMintedLifetime || 0).toLocaleString()} AP</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-gray-400 text-sm">Points Minted Today</span>
              <span className="text-white font-semibold text-sm">{(partnerCap.pointsMintedToday || 0).toLocaleString()} AP</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-gray-400 text-sm">Daily Quota Usage</span>
              <span className="text-white font-semibold text-sm">
                {(() => {
                  const tvlBackingUsd = partnerCap.currentEffectiveUsdcValue || 0;
                  const lifetimeQuota = Math.floor(tvlBackingUsd * 1000);
                  const dailyQuota = Math.floor(lifetimeQuota * 0.03);
                  const pointsMintedToday = partnerCap.pointsMintedToday || 0;
                  return dailyQuota > 0 ? (pointsMintedToday / dailyQuota * 100).toFixed(1) : '0.0';
                })()}%
              </span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-gray-400 text-sm">Available Daily Quota</span>
              <span className="text-white font-semibold text-sm">
                {(() => {
                  const tvlBackingUsd = partnerCap.currentEffectiveUsdcValue || 0;
                  const lifetimeQuota = Math.floor(tvlBackingUsd * 1000);
                  const dailyQuota = Math.floor(lifetimeQuota * 0.03);
                  const pointsMintedToday = partnerCap.pointsMintedToday || 0;
                  return Math.max(0, dailyQuota - pointsMintedToday).toLocaleString();
                })()} AP
              </span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-gray-400 text-sm">Lifetime Quota Used</span>
              <span className="text-white font-semibold text-sm">
                {(() => {
                  const tvlBackingUsd = partnerCap.currentEffectiveUsdcValue || 0;
                  const lifetimeQuota = Math.floor(tvlBackingUsd * 1000);
                  const lifetimeMinted = partnerCap.totalPointsMintedLifetime || 0;
                  return lifetimeQuota > 0 ? (lifetimeMinted / lifetimeQuota * 100).toFixed(1) : '0.0';
                })()}%
              </span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-gray-400 text-sm">Perks Created</span>
              <span className="text-white font-semibold text-sm">{metrics.totalPerks || 0}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-gray-400 text-sm">Total Claims</span>
              <span className="text-white font-semibold text-sm">{metrics.totalClaims || 0}</span>
            </div>
          </div>
        </div>

        {/* Performance Insights */}
        <div className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Performance Insights</h3>
          <div className="space-y-3">
            {/* Capital Efficiency */}
            <div className="bg-gray-900/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">Capital Efficiency</span>
                <span className="text-sm font-bold text-white">
                  {(() => {
                    const tvlBackingUsd = partnerCap.currentEffectiveUsdcValue || 0;
                    const lifetimeMinted = partnerCap.totalPointsMintedLifetime || 0;
                    return tvlBackingUsd > 0 ? ((lifetimeMinted / (tvlBackingUsd * 1000)) * 100).toFixed(1) : '0.0';
                  })()}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${Math.min(100, (() => {
                      const tvlBackingUsd = partnerCap.currentEffectiveUsdcValue || 0;
                      const lifetimeMinted = partnerCap.totalPointsMintedLifetime || 0;
                      return tvlBackingUsd > 0 ? (lifetimeMinted / (tvlBackingUsd * 1000)) * 100 : 0;
                    })())}%` 
                  }}
                ></div>
              </div>
            </div>

            {/* Revenue Performance */}
            <div className="bg-gray-900/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">Revenue Generated</span>
                <span className="text-sm font-bold text-white">{(metrics.totalRevenue || 0).toLocaleString()} AP</span>
              </div>
              <div className="text-xs text-gray-400">
                ≈ ${((metrics.totalRevenue || 0) / 1000).toFixed(2)} USD equivalent
              </div>
            </div>

            {/* Growth Trajectory */}
            <div className="bg-gray-900/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">Growth Status</span>
                <span className={`text-sm font-bold ${
                  (metrics.totalClaims || 0) > 100 ? 'text-green-400' :
                  (metrics.totalClaims || 0) > 10 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {(metrics.totalClaims || 0) > 100 ? 'Scaling' : 
                   (metrics.totalClaims || 0) > 10 ? 'Growing' : 'Starting'}
                </span>
              </div>
              <div className="text-xs text-gray-400">
                {metrics.totalClaims || 0} total perk claims
              </div>
            </div>

            {/* Capacity Status */}
            <div className="bg-gray-900/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">Capacity Status</span>
                <span className={`text-sm font-bold ${
                  (() => {
                    const tvlBackingUsd = partnerCap.currentEffectiveUsdcValue || 0;
                    const lifetimeQuota = Math.floor(tvlBackingUsd * 1000);
                    const lifetimeMinted = partnerCap.totalPointsMintedLifetime || 0;
                    const usedPercent = lifetimeQuota > 0 ? (lifetimeMinted / lifetimeQuota * 100) : 0;
                    return usedPercent > 80 ? 'text-red-400' : usedPercent > 60 ? 'text-yellow-400' : 'text-green-400';
                  })()
                }`}>
                {(() => {
                  const tvlBackingUsd = partnerCap.currentEffectiveUsdcValue || 0;
                  const lifetimeQuota = Math.floor(tvlBackingUsd * 1000);
                  const lifetimeMinted = partnerCap.totalPointsMintedLifetime || 0;
                  const usedPercent = lifetimeQuota > 0 ? (lifetimeMinted / lifetimeQuota * 100) : 0;
                  return usedPercent > 80 ? 'High Usage' : usedPercent > 60 ? 'Moderate' : 'Healthy';
                })()}
              </span>
              </div>
              <div className="text-xs text-gray-400">
                {(() => {
                  const tvlBackingUsd = partnerCap.currentEffectiveUsdcValue || 0;
                  const lifetimeQuota = Math.floor(tvlBackingUsd * 1000);
                  const lifetimeMinted = partnerCap.totalPointsMintedLifetime || 0;
                  return Math.max(0, lifetimeQuota - lifetimeMinted).toLocaleString();
                })()} AP remaining capacity
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 