import React from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { PartnerCapInfo } from '../../hooks/usePartnerDetection';
import { Button } from '../ui/Button';
import { useAlphaContext } from '../../context/AlphaContext';
import { usePerkData } from '../../hooks/usePerkData';
import { formatSui } from '../../utils/format';
import suiLogo from '../../assets/sui-logo.jpg';

// Portal Tooltip Component
const PortalTooltip: React.FC<{ children: React.ReactNode; show: boolean; position: { x: number; y: number } }> = ({ children, show, position }) => {
  if (!show) return null;
  
  return createPortal(
    <div 
      className="fixed bg-gray-900 border rounded-lg shadow-lg p-3 text-sm"
      style={{ 
        left: position.x,
        top: position.y,
        transform: 'translate(-100%, -100%)', // Bottom right corner at cursor
        zIndex: 2147483647, // Maximum possible z-index
      }}
    >
      {children}
    </div>,
    document.body
  );
};

interface OverviewTabProps {
  partnerCap: PartnerCapInfo;
  onRefresh: () => void;
  calculateWithdrawableAmount: () => number;
  setShowCollateralModal: (modal: { type: string; isOpen: boolean }) => void;
  setShowWithdrawalModal: (show: boolean) => void;
}

export function OverviewTab({ 
  partnerCap, 
  onRefresh, 
  calculateWithdrawableAmount,
  setShowCollateralModal,
  setShowWithdrawalModal
}: OverviewTabProps) {
  const { suiBalance, loading } = useAlphaContext();
  const { getPartnerPerkMetrics } = usePerkData();

  // Calculate comprehensive business metrics
  const tvlBackingUsd = partnerCap.currentEffectiveUsdcValue || 0;
  const lifetimeQuota = Math.floor(tvlBackingUsd * 1000);
  const dailyQuota = Math.floor(lifetimeQuota * 0.03);
  const pointsMintedToday = partnerCap.pointsMintedToday || 0;
  const lifetimeMinted = partnerCap.totalPointsMintedLifetime || 0;
  const availableDaily = Math.max(0, dailyQuota - pointsMintedToday);
  const remainingLifetime = Math.max(0, lifetimeQuota - lifetimeMinted);
  const dailyUsedPercent = dailyQuota > 0 ? (pointsMintedToday / dailyQuota) * 100 : 0;
  const lifetimeUsedPercent = lifetimeQuota > 0 ? (lifetimeMinted / lifetimeQuota) * 100 : 0;
  const withdrawable = calculateWithdrawableAmount();
  const metrics = getPartnerPerkMetrics(partnerCap.id);
  const totalPerks = metrics.totalPerks || partnerCap.totalPerksCreated || 0;
  
  // Business intelligence calculations
  const capitalEfficiency = tvlBackingUsd > 0 ? (lifetimeMinted / (tvlBackingUsd * 1000)) * 100 : 0;
  const dailyBurnRate = dailyQuota > 0 ? (pointsMintedToday / dailyQuota) * 100 : 0;
  const projectedDaysToCapacity = remainingLifetime > 0 && pointsMintedToday > 0 ? Math.floor(remainingLifetime / (pointsMintedToday || 1)) : Infinity;
  const revenueProjection = lifetimeMinted * 0.001; // Assuming $0.001 per point average
  
  // Risk assessment
  const getRiskLevel = () => {
    if (lifetimeUsedPercent > 90) return { level: 'High', color: 'text-red-400', bg: 'bg-red-500/10' };
    if (lifetimeUsedPercent > 70) return { level: 'Medium', color: 'text-yellow-400', bg: 'bg-yellow-500/10' };
    return { level: 'Low', color: 'text-green-400', bg: 'bg-green-500/10' };
  };
  const risk = getRiskLevel();

  return (
    <div className="space-y-6">
      {/* Executive Summary Header */}
      <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 backdrop-blur-lg border border-blue-700/30 rounded-lg p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <div>
              <h2 className="text-lg font-bold text-white">{partnerCap.partnerName}</h2>
              <p className="text-xs text-blue-200">Complete operational dashboard</p>
            </div>
            
            <div className="hidden lg:flex items-center space-x-8">
              <div className="text-center py-1">
                <div className="text-xl font-bold text-blue-300 mb-1">${tvlBackingUsd.toLocaleString()}</div>
                <div className="text-xs text-blue-200">Capital Deployed</div>
              </div>
              <div className="text-center py-1">
                <div className="text-xl font-bold text-green-300 mb-1">{lifetimeMinted.toLocaleString()}</div>
                <div className="text-xs text-green-200">Points Distributed</div>
              </div>
              <div className="text-center py-1">
                <div className="text-xl font-bold text-purple-300 mb-1">{totalPerks}</div>
                <div className="text-xs text-purple-200">Active Perks</div>
              </div>
              <div className="text-center py-1">
                <div className="text-xl font-bold text-yellow-300 mb-1">{capitalEfficiency.toFixed(1)}%</div>
                <div className="text-xs text-yellow-200">Efficiency</div>
              </div>
            </div>
            
            <div className="hidden xl:flex items-center space-x-8 border-l border-blue-400/30 pl-8">
              <div className="text-center py-1">
                <div className="text-xl font-bold text-cyan-300 mb-1">{dailyUsedPercent.toFixed(1)}%</div>
                <div className="text-xs text-cyan-200">Daily Used</div>
              </div>
              <div className="text-center py-1">
                <div className="text-xl font-bold text-indigo-300 mb-1">{lifetimeUsedPercent.toFixed(1)}%</div>
                <div className="text-xs text-indigo-200">Lifetime Used</div>
              </div>
              <div className="text-center py-1">
                <div className="text-xl font-bold text-orange-300 mb-1">
                  {projectedDaysToCapacity === Infinity ? '∞' : projectedDaysToCapacity > 999 ? '999+' : projectedDaysToCapacity}
                </div>
                <div className="text-xs text-orange-200">Days Runway</div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="hidden lg:flex items-center space-x-2">
              <Button 
                className="text-xs btn-modern-primary px-3 py-1.5"
                onClick={() => setShowCollateralModal({ type: 'topup', isOpen: true })}
              >
                <span className="mr-1">⬆️</span>
                Increase
              </Button>
              <Button 
                className="text-xs bg-green-600 hover:bg-green-700 px-3 py-1.5"
                onClick={() => setShowCollateralModal({ type: 'add', isOpen: true })}
              >
                <span className="mr-1">➕</span>
                Add
              </Button>
              {withdrawable > 0 && (
                <Button 
                  className="text-xs bg-orange-600 hover:bg-orange-700 px-3 py-1.5"
                  onClick={() => setShowWithdrawalModal(true)}
                >
                  <span className="mr-1">⬇️</span>
                  Extract
                </Button>
              )}
            </div>
            
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${risk.bg} ${risk.color}`}>
              Risk: {risk.level}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Quota Progress Bar */}
      <div className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8 flex-1">
            {/* Daily Progress - Expanded */}
            <div className="flex items-center space-x-4 flex-1">
              <span className="text-sm text-blue-300 w-12 font-medium">Daily</span>
              <div className="flex-1 bg-gray-700 rounded-full h-3 min-w-0 relative">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-blue-400 h-3 rounded-full transition-all duration-700 ease-out relative overflow-hidden"
                  style={{ width: `${Math.min(dailyUsedPercent, 100)}%` }}
                >
                  {/* Subtle animated shimmer */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse"></div>
                </div>
                {/* Usage indicator line */}
                {dailyUsedPercent > 5 && (
                  <div className="absolute top-0 bottom-0 flex items-center text-xs font-medium text-white/90" style={{ left: `${Math.min(dailyUsedPercent, 95)}%`, transform: 'translateX(-50%)' }}>
                    <span className="bg-blue-600/80 px-1 py-0.5 rounded text-xs">{dailyUsedPercent.toFixed(0)}%</span>
                  </div>
                )}
              </div>
              <div className="text-right min-w-[80px]">
                <div className="text-sm font-semibold text-white">{pointsMintedToday.toLocaleString()}</div>
                <div className="text-xs text-gray-400">of {dailyQuota.toLocaleString()}</div>
              </div>
            </div>
          </div>
          
          <div className="w-px h-8 bg-gray-600 mx-6"></div>
          
          <div className="flex items-center space-x-8 flex-1">
            {/* Lifetime Progress - Expanded */}
            <div className="flex items-center space-x-4 flex-1">
              <span className="text-sm text-purple-300 w-16 font-medium">Lifetime</span>
              <div className="flex-1 bg-gray-700 rounded-full h-3 min-w-0 relative">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-purple-400 h-3 rounded-full transition-all duration-700 ease-out relative overflow-hidden"
                  style={{ width: `${Math.min(lifetimeUsedPercent, 100)}%` }}
                >
                  {/* Subtle animated shimmer */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse"></div>
                </div>
                {/* Usage indicator line */}
                {lifetimeUsedPercent > 5 && (
                  <div className="absolute top-0 bottom-0 flex items-center text-xs font-medium text-white/90" style={{ left: `${Math.min(lifetimeUsedPercent, 95)}%`, transform: 'translateX(-50%)' }}>
                    <span className="bg-purple-600/80 px-1 py-0.5 rounded text-xs">{lifetimeUsedPercent.toFixed(0)}%</span>
                  </div>
                )}
              </div>
              <div className="text-right min-w-[100px]">
                <div className="text-sm font-semibold text-white">{lifetimeMinted.toLocaleString()}</div>
                <div className="text-xs text-gray-400">of {lifetimeQuota.toLocaleString()}</div>
              </div>
            </div>
            
            {/* Action Button */}
            <div className="flex items-center space-x-3">
              {(lifetimeUsedPercent >= 70 || dailyUsedPercent >= 80) && (
                <Button 
                  className="text-sm btn-modern-primary px-4 py-2 whitespace-nowrap"
                  onClick={() => setShowCollateralModal({ type: 'add', isOpen: true })}
                >
                  <span className="mr-2">⬆️</span>
                  Scale Up
                </Button>
              )}
              <Button 
                className="text-sm bg-gray-600 hover:bg-gray-700 px-3 py-2 whitespace-nowrap"
                onClick={onRefresh}
              >
                <span className="mr-1">🔄</span>
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Business Intelligence Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* Strategic Actions */}
        <div className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-lg p-5">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <span className="mr-2">🎯</span>
            Strategic Actions
          </h3>
          
          <div className="space-y-4">
            {/* Perk Management */}
            <div className="bg-gray-900/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-300">Marketplace Presence</span>
                  <span className="text-lg font-bold text-white">{totalPerks}</span>
                  <span className="text-xs text-gray-400">Active Perks</span>
                </div>
              </div>
              <Link to="/partners/perks" className="block">
                <Button className="w-full text-xs">
                  <span className="mr-2">🛍️</span>
                  Manage Perks
                </Button>
              </Link>
            </div>

            {/* Analytics Access */}
            <div className="bg-gray-900/50 rounded-lg p-3">
              <div className="text-sm text-gray-300 mb-2">Performance Insights</div>
              <div className="text-xs text-gray-400 mb-2">Deep dive into your metrics</div>
              <Link to="/partners/analytics" className="block">
                <Button className="w-full text-xs btn-modern-secondary">
                  <span className="mr-2">📊</span>
                  View Analytics
                </Button>
              </Link>
            </div>

            {/* System Actions */}
            <div className="space-y-2">
              <Button 
                className="w-full text-xs btn-modern-secondary"
                onClick={onRefresh}
              >
                <span className="mr-2">🔄</span>
                Refresh Data
              </Button>
              <Link to="/partners/create" className="block">
                <Button className="w-full text-xs bg-green-700 hover:bg-green-600">
                  <span className="mr-2">➕</span>
                  New Partner Cap
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Smart Recommendations */}
        <div className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-lg p-5">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <span className="mr-2">💡</span>
            Smart Recommendations
          </h3>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {/* Strategic Business Recommendations */}
            {(() => {
              const recommendations = [];
              
              // Capital Optimization Strategies
              if (lifetimeUsedPercent > 80) {
                recommendations.push(
                  <div key="capacity" className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <div className="text-sm font-medium text-red-400 mb-1">⚠️ Scale Capital Infrastructure</div>
                    <div className="text-xs text-red-300 mb-2">At {lifetimeUsedPercent.toFixed(1)}% capacity utilization - approaching operational limits.</div>
                    <div className="text-xs text-red-200">💡 Strategy: Add ${Math.ceil(tvlBackingUsd * 0.5).toLocaleString()} collateral to unlock {Math.ceil(tvlBackingUsd * 500).toLocaleString()} more Alpha Points capacity.</div>
                  </div>
                );
              } else if (lifetimeUsedPercent > 60) {
                recommendations.push(
                  <div key="growth-prep" className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                    <div className="text-sm font-medium text-orange-400 mb-1">📈 Prepare for Growth</div>
                    <div className="text-xs text-orange-300 mb-2">At {lifetimeUsedPercent.toFixed(1)}% capacity - good time to plan expansion.</div>
                    <div className="text-xs text-orange-200">💡 Strategy: Consider adding collateral before hitting 80% to avoid service disruption during peak demand.</div>
                  </div>
                );
              }

              // Revenue Optimization
              if (totalPerks === 0) {
                recommendations.push(
                  <div key="first-perk" className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                    <div className="text-sm font-medium text-blue-400 mb-1">🚀 Launch Revenue Stream</div>
                    <div className="text-xs text-blue-300 mb-2">You have ${tvlBackingUsd.toLocaleString()} in capital but no active perks.</div>
                    <div className="text-xs text-blue-200">💡 Strategy: Start with 3-5 perks at different price points ($5-50) to test market demand and optimize pricing.</div>
                  </div>
                );
              } else if (totalPerks < 3) {
                recommendations.push(
                  <div key="diversify" className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
                    <div className="text-sm font-medium text-cyan-400 mb-1">🎯 Diversify Offerings</div>
                    <div className="text-xs text-cyan-300 mb-2">Only {totalPerks} active perk{totalPerks === 1 ? '' : 's'} - limited market coverage.</div>
                    <div className="text-xs text-cyan-200">💡 Strategy: Add perks in different categories (Digital Assets, Access, Physical) to capture broader audience segments.</div>
                  </div>
                );
              }

              // Efficiency & Performance Insights
              if (capitalEfficiency < 30 && lifetimeMinted > 1000) {
                recommendations.push(
                  <div key="efficiency" className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                    <div className="text-sm font-medium text-purple-400 mb-1">⚡ Optimize Capital Efficiency</div>
                    <div className="text-xs text-purple-300 mb-2">Current efficiency: {capitalEfficiency.toFixed(1)}% - room for improvement.</div>
                    <div className="text-xs text-purple-200">💡 Strategy: Focus on higher-margin digital perks or increase perk pricing to maximize Alpha Points per dollar invested.</div>
                  </div>
                );
              }

              // Market Timing & Demand
              if (dailyUsedPercent < 10 && pointsMintedToday === 0 && totalPerks > 0) {
                recommendations.push(
                  <div key="marketing" className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                    <div className="text-sm font-medium text-yellow-400 mb-1">📢 Boost Market Presence</div>
                    <div className="text-xs text-yellow-300 mb-2">Daily quota unused despite having {totalPerks} active perks.</div>
                    <div className="text-xs text-yellow-200">💡 Strategy: Launch marketing campaign, partner with influencers, or create limited-time offers to drive demand.</div>
                  </div>
                );
              } else if (dailyUsedPercent > 70) {
                recommendations.push(
                  <div key="demand" className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                    <div className="text-sm font-medium text-green-400 mb-1">🔥 High Demand Detected</div>
                    <div className="text-xs text-green-300 mb-2">Using {dailyUsedPercent.toFixed(1)}% of daily quota - strong market traction.</div>
                    <div className="text-xs text-green-200">💡 Strategy: Consider premium pricing tiers or exclusive perks to capture additional value from high demand.</div>
                  </div>
                );
              }

              // Financial Management
              if (withdrawable > tvlBackingUsd * 0.3) {
                recommendations.push(
                  <div key="capital-mgmt" className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3">
                    <div className="text-sm font-medium text-indigo-400 mb-1">💰 Capital Management</div>
                    <div className="text-xs text-indigo-300 mb-2">${withdrawable.toFixed(0)} available for withdrawal ({((withdrawable/tvlBackingUsd)*100).toFixed(0)}% of capital).</div>
                    <div className="text-xs text-indigo-200">💡 Strategy: Consider reinvesting excess capital into new perks or withdraw for other business opportunities.</div>
                  </div>
                );
              }

              // Long-term Strategic Planning
              if (projectedDaysToCapacity < 30 && projectedDaysToCapacity !== Infinity) {
                recommendations.push(
                  <div key="runway" className="bg-pink-500/10 border border-pink-500/20 rounded-lg p-3">
                    <div className="text-sm font-medium text-pink-400 mb-1">⏰ Capacity Planning</div>
                    <div className="text-xs text-pink-300 mb-2">Only {projectedDaysToCapacity} days until capacity limit at current usage rate.</div>
                    <div className="text-xs text-pink-200">💡 Strategy: Plan capital injection now or implement demand management (higher pricing, limited quantities).</div>
                  </div>
                );
              } else if (projectedDaysToCapacity > 365) {
                recommendations.push(
                  <div key="expansion" className="bg-teal-500/10 border border-teal-500/20 rounded-lg p-3">
                    <div className="text-sm font-medium text-teal-400 mb-1">🌟 Expansion Opportunity</div>
                    <div className="text-xs text-teal-300 mb-2">Current capacity will last {projectedDaysToCapacity > 999 ? '999+' : projectedDaysToCapacity} days - excellent runway.</div>
                    <div className="text-xs text-teal-200">💡 Strategy: Focus on aggressive growth - launch new perk categories, partner integrations, or geographic expansion.</div>
                  </div>
                );
              }

              // Default recommendation if no specific conditions met
              if (recommendations.length === 0) {
                recommendations.push(
                  <div key="optimize" className="bg-gray-500/10 border border-gray-500/20 rounded-lg p-3">
                    <div className="text-sm font-medium text-gray-400 mb-1">🔧 Business Optimization</div>
                    <div className="text-xs text-gray-300 mb-2">Your operations are stable. Focus on optimization and growth.</div>
                    <div className="text-xs text-gray-200">💡 Strategy: Analyze perk performance data, A/B test pricing, and explore new market segments for expansion.</div>
                  </div>
                );
              }

              return recommendations.slice(0, 4); // Show max 4 recommendations
            })()}
          </div>
        </div>

        {/* System Status */}
        <div className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-lg p-5">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <span className="mr-2">🔧</span>
            System Status
          </h3>
          
          <div className="space-y-3">
            {/* Wallet Status */}
            <div className="bg-gray-900/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">SUI Balance</span>
                <div className="flex items-center">
                  {loading.suiBalance ? (
                    <div className="w-4 h-4 bg-gray-700 rounded animate-pulse mr-2"></div>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-white mr-1">{formatSui(suiBalance)}</span>
                      <img src={suiLogo} alt="Sui Logo" className="w-4 h-4 rounded-full object-cover" />
                    </>
                  )}
                </div>
              </div>
              <a
                href="https://faucet.testnet.sui.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center bg-cyan-500 hover:bg-cyan-600 text-white py-1 px-2 rounded text-xs font-medium transition-colors"
              >
                Get Testnet SUI
              </a>
            </div>

            {/* Enhanced Partner Analytics */}
            <div className="bg-gray-900/50 rounded-lg p-3">
              <div className="text-sm text-gray-300 mb-3 flex items-center">
                <span className="mr-2">📈</span>
                Performance Metrics
              </div>
              
              {/* Key Performance Indicators */}
              <div className="space-y-3">
                {/* Perk Performance */}
                <div className="bg-gray-800/50 rounded-md p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-green-300 font-medium">Perk Claims</span>
                    <span className="text-xs text-gray-400">Total</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-white">{metrics.totalClaims?.toLocaleString() || '0'}</div>
                    <div className={`text-xs px-2 py-0.5 rounded-full ${
                      (metrics.totalClaims || 0) > 100 ? 'bg-green-500/20 text-green-400' :
                      (metrics.totalClaims || 0) > 10 ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {(metrics.totalClaims || 0) > 100 ? 'High' : (metrics.totalClaims || 0) > 10 ? 'Active' : 'Starting'}
                    </div>
                  </div>
                </div>

                {/* Revenue Performance */}
                <div className="bg-gray-800/50 rounded-md p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-purple-300 font-medium">Revenue</span>
                    <span className="text-xs text-gray-400">Generated</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-white">{(metrics.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} AP</div>
                    <div className={`text-xs px-2 py-0.5 rounded-full ${
                      (metrics.totalRevenue || 0) > 1000 ? 'bg-green-500/20 text-green-400' :
                      (metrics.totalRevenue || 0) > 100 ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {(metrics.totalRevenue || 0) > 1000 ? 'Strong' : (metrics.totalRevenue || 0) > 100 ? 'Growing' : 'Early'}
                    </div>
                  </div>
                </div>

                {/* Capacity Status */}
                <div className="bg-gray-800/50 rounded-md p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-blue-300 font-medium">Capacity</span>
                    <span className="text-xs text-gray-400">Utilization</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-white">{lifetimeUsedPercent.toFixed(1)}%</div>
                    <div className={`text-xs px-2 py-0.5 rounded-full ${risk.bg} ${risk.color}`}>
                      {risk.level}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  className="text-xs bg-blue-600 hover:bg-blue-700"
                  onClick={() => setShowCollateralModal({ type: 'add', isOpen: true })}
                >
                  <span className="mr-1">💰</span>
                  Add Capital
                </Button>
                {withdrawable > 0 && (
                  <Button 
                    className="text-xs bg-orange-600 hover:bg-orange-700"
                    onClick={() => setShowWithdrawalModal(true)}
                  >
                    <span className="mr-1">💸</span>
                    Withdraw
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 