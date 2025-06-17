import React, { useState } from 'react';
import { PartnerCap } from '../../types';
import { OverviewTab } from './OverviewTab';
import { PerksTab } from './PerksTab';
import { AnalyticsTab } from './AnalyticsTab';
import { SettingsTab } from './SettingsTab';
import { GenerationsTab } from './GenerationsTab';

interface PartnerDashboardProps {
  partnerCap: PartnerCap;
  onRefresh: () => void;
  currentTab: 'overview' | 'perks' | 'analytics' | 'settings' | 'generations';
  onPartnerCreated: () => Promise<any>;
}

export const PartnerDashboard: React.FC<PartnerDashboardProps> = ({
  partnerCap,
  onRefresh,
  currentTab,
  onPartnerCreated
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'perks' | 'analytics' | 'settings' | 'generations'>(currentTab);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab partnerCap={partnerCap} onRefresh={onRefresh} />;
      case 'perks':
        return <PerksTab partnerCap={partnerCap} onRefresh={onRefresh} />;
      case 'analytics':
        return <AnalyticsTab partnerCap={partnerCap} onRefresh={onRefresh} />;
      case 'settings':
        return <SettingsTab partnerCap={partnerCap} onRefresh={onRefresh} />;
      case 'generations':
        return <GenerationsTab partnerCap={partnerCap} onRefresh={onRefresh} />;
      default:
        return <OverviewTab partnerCap={partnerCap} onRefresh={onRefresh} />;
    }
  };

  const tabClasses = (tabName: string) => {
    const baseClasses = "px-4 py-2 rounded-lg font-medium transition-all duration-200";
    const activeClasses = "bg-primary text-white shadow-lg";
    const inactiveClasses = "text-gray-400 hover:text-white hover:bg-gray-800/50";
    
    return `${baseClasses} ${activeTab === tabName ? activeClasses : inactiveClasses}`;
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header with Navigation */}
      <div className="bg-background-card border-b border-gray-800">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Partner Dashboard</h1>
              <p className="text-gray-400 mt-1">Manage your Alpha Points partnership</p>
            </div>
            <button
              onClick={onRefresh}
              className="px-4 py-2 bg-primary/20 text-primary border border-primary/30 rounded-lg hover:bg-primary/30 transition-all duration-200"
            >
              Refresh
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={tabClasses('overview')}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('perks')}
              className={tabClasses('perks')}
            >
              Perks
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={tabClasses('analytics')}
            >
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('generations')}
              className={tabClasses('generations')}
            >
              Generations
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={tabClasses('settings')}
            >
              Settings
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {renderTabContent()}
      </div>
    </div>
  );
}; 