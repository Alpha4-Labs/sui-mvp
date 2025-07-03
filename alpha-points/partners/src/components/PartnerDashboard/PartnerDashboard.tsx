import React, { useState, useCallback } from 'react';
import { PartnerCap } from '../../types';
import { OverviewTab } from './OverviewTab';
import { PerksTab } from './PerksTab';
import { AnalyticsTab } from './AnalyticsTab';
import { SettingsTab } from './SettingsTab';
import { GenerationsTab } from './GenerationsTab';
import { CollateralModal } from './CollateralModal';
import { toast } from 'react-toastify';

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
  // Modal states
  const [showCollateralModal, setShowCollateralModal] = useState(false);
  const [showPerkModal, setShowPerkModal] = useState(false);
  const [editingPerk, setEditingPerk] = useState<any>(null);
  
  // Loading states
  const [isCreatingPerk, setIsCreatingPerk] = useState(false);

  // Calculate withdrawable amount
  const calculateWithdrawableAmount = useCallback(() => {
    // TODO: Implement actual calculation logic
    return 0;
  }, [partnerCap]);

  // Enhanced refresh function
  const handleRefresh = useCallback(async () => {
    try {
      await onRefresh();
      toast.success('Dashboard refreshed successfully');
    } catch (error) {
      console.error('Failed to refresh dashboard:', error);
      toast.error('Failed to refresh dashboard');
    }
  }, [onRefresh]);

  // Perk management handlers (TODO: Implement actual logic)
  const handleCreatePerk = useCallback(async (perkData: any) => {
    console.log('Creating perk:', perkData);
    // TODO: Implement perk creation
    setShowPerkModal(false);
  }, []);

  const handleUpdatePerk = useCallback(async (perkData: any) => {
    console.log('Updating perk:', perkData);
    // TODO: Implement perk update
    setEditingPerk(null);
    setShowPerkModal(false);
  }, []);

  const handleDeletePerk = useCallback(async (perkId: string) => {
    console.log('Deleting perk:', perkId);
    // TODO: Implement perk deletion
  }, []);

  const handleTogglePerkStatus = useCallback(async (perk: any) => {
    try {
      // TODO: Implement actual perk toggle logic
      console.log('Toggling perk status:', perk);
      toast.info('Perk toggle functionality will be implemented soon');
      await handleRefresh();
    } catch (error) {
      console.error('Failed to toggle perk status:', error);
      toast.error('Failed to update perk status');
      throw error;
    }
  }, [handleRefresh]);

  const handleUpdatePartnerSettings = useCallback(async () => {
    try {
      // TODO: Implement actual settings update logic
      console.log('Updating partner settings');
      toast.info('Settings update functionality will be implemented soon');
      await handleRefresh();
    } catch (error) {
      console.error('Failed to update partner settings:', error);
      toast.error('Failed to update partner settings');
      throw error;
    }
  }, [handleRefresh]);

  const handleShowCollateralModal = useCallback(() => {
    setShowCollateralModal(true);
  }, []);

  // Modal handlers
  const handleCloseCollateralModal = useCallback(() => {
    setShowCollateralModal(false);
  }, []);

  const handleClosePerkModal = useCallback(() => {
    setShowPerkModal(false);
  }, []);

  const handleCollateralModalRefresh = useCallback(async () => {
    await handleRefresh();
    handleCloseCollateralModal();
  }, [handleRefresh, handleCloseCollateralModal]);

  // Render content based on currentTab (from URL)
  const renderTabContent = () => {
    switch (currentTab) {
      case 'overview':
        return (
          <OverviewTab 
            partnerCap={partnerCap} 
            onRefresh={handleRefresh}
            calculateWithdrawableAmount={calculateWithdrawableAmount}
            setShowCollateralModal={setShowCollateralModal}
          />
        );
      case 'perks':
        return (
          <PerksTab 
            partnerCap={partnerCap}
            selectedPartnerCapId={partnerCap.id}
            onCreatePerk={handleCreatePerk}
            onTogglePerkStatus={handleTogglePerkStatus}
            onUpdatePerk={handleUpdatePerk}
            onUpdatePerkSettings={handleUpdatePartnerSettings}
            isCreatingPerk={isCreatingPerk}
          />
        );
      case 'analytics':
        return (
          <AnalyticsTab 
            partnerCap={partnerCap}
            selectedPartnerCapId={partnerCap.id}
          />
        );
      case 'settings':
        return (
          <SettingsTab 
            partnerCap={partnerCap}
            selectedPartnerCapId={partnerCap.id}
            onUpdatePerkSettings={handleUpdatePartnerSettings}
            onShowCollateralModal={handleShowCollateralModal}
          />
        );
      case 'generations':
        return (
          <GenerationsTab 
            partnerCap={partnerCap}
            selectedPartnerCapId={partnerCap.id}
          />
        );
      default:
        return (
          <OverviewTab 
            partnerCap={partnerCap} 
            onRefresh={handleRefresh}
            calculateWithdrawableAmount={calculateWithdrawableAmount}
            setShowCollateralModal={setShowCollateralModal}
          />
        );
    }
  };

  const tabClasses = (tabName: string) => {
    const baseClasses = "px-4 py-2 rounded-lg font-medium transition-all duration-200";
    const activeClasses = "bg-primary text-white shadow-lg";
    const inactiveClasses = "text-gray-400 hover:text-white hover:bg-gray-800/50";
    
    return `${baseClasses} ${currentTab === tabName ? activeClasses : inactiveClasses}`;
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header without Navigation */}
      <div className="bg-background-card border-b border-gray-800">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Partner Dashboard</h1>
              <p className="text-gray-400 mt-1">Manage your Alpha Points partnership</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {renderTabContent()}
      </div>

      {/* Modals */}
      {showCollateralModal && (
        <CollateralModal
          partnerCap={partnerCap}
          modalType="add"
          onClose={handleCloseCollateralModal}
          onRefresh={handleCollateralModalRefresh}
        />
      )}

      {showPerkModal && (
        <CollateralModal
          partnerCap={partnerCap}
          modalType="edit"
          onClose={handleClosePerkModal}
          onRefresh={handleCollateralModalRefresh}
          editingPerk={editingPerk}
        />
      )}
    </div>
  );
}; 