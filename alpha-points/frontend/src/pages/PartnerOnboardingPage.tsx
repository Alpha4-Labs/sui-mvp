import React, { useState, useEffect } from 'react';
import { useCurrentWallet } from '@mysten/dapp-kit';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { usePartnerOnboarding } from '../hooks/usePartnerOnboarding';
import { useAlphaContext } from '../context/AlphaContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { CURRENT_NETWORK } from '../config/network';

const SUI_INPUT_DECIMALS = 9; // Standard SUI decimals

interface PartnerOnboardingPageProps {
  onPartnerCreated?: () => void; // Callback to trigger partner detection refresh
}

type CollateralType = 'SUI' | 'USDC' | 'NFT';

export function PartnerOnboardingPage({ onPartnerCreated }: PartnerOnboardingPageProps = { onPartnerCreated: undefined }) {
  const { currentWallet } = useCurrentWallet();
  const navigate = useNavigate();
  const { setMode, setPartnerCaps } = useAlphaContext();
  const {
    createPartnerWithFullSetup,
    createPartnerWithFullSetupUSDC,
    createPartnerWithFullSetupNFT,
    isLoading: isPartnerCapLoading,
    error: partnerCapError,
    transactionDigest: partnerCapTxDigest,
    onboardingStep,
  } = usePartnerOnboarding();

  const [partnerName, setPartnerName] = useState('');
  const [collateralType, setCollateralType] = useState<CollateralType>('SUI');
  const [showOnboardingForm, setShowOnboardingForm] = useState(false);
  
  // SUI collateral fields
  const [suiAmount, setSuiAmount] = useState('');
  
  // USDC collateral fields
  const [usdcCoinId, setUsdcCoinId] = useState('');
  
  // NFT collateral fields
  const [kioskId, setKioskId] = useState('');
  const [collectionType, setCollectionType] = useState('');
  const [estimatedFloorValue, setEstimatedFloorValue] = useState('');

  useEffect(() => {
    if (partnerCapError) {
      toast.error(`Onboarding Error: ${partnerCapError}`);
    }
    if (partnerCapTxDigest) {
      const explorerUrl = `${CURRENT_NETWORK.explorerUrl}/txblock/${partnerCapTxDigest}`;
      
      toast.success(
        <div>
          <div>Successfully completed partner onboarding!</div>
          <div className="text-sm text-gray-300 mt-1">
            ✅ Partner capability created<br/>
            ✅ Analytics system initialized
          </div>
          <a 
            href={explorerUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-300 hover:text-blue-200 underline text-sm"
          >
            View final transaction: {partnerCapTxDigest.substring(0,10)}...
          </a>
        </div>,
        {
          autoClose: 10000,
        }
      );
      
      if (onPartnerCreated) {
        setTimeout(async () => {
          try {
            toast.info('🔍 Detecting your new Partner Capability...', { autoClose: 3000 });
            
            const detectedCaps = await onPartnerCreated();
            
            if (Array.isArray(detectedCaps) && detectedCaps.length > 0) {
              setPartnerCaps(detectedCaps);
              setMode('partner');
              navigate('/partners/overview');
              toast.success('Welcome to your Partner Dashboard! 🎉');
            } else {
              onPartnerCreated();
              setTimeout(() => {
                setMode('partner');
                navigate('/partners/overview');
                toast.success('Welcome to your Partner Dashboard! 🎉');
              }, 3000);
            }
          } catch (error) {
            console.error('❌ Error during partner mode activation:', error);
            if (typeof onPartnerCreated === 'function') {
              onPartnerCreated();
            }
            toast.warning('⚠️ Partner created successfully! Please use the "Partners" button at the bottom to access your dashboard.');
          }
        }, 2000);
      }
    }
  }, [partnerCapError, partnerCapTxDigest, onPartnerCreated, setMode, setPartnerCaps, navigate]);

  // Show onboarding step progress
  const getStepMessage = () => {
    const collateralTypeLabel = collateralType === 'SUI' ? 'SUI' : collateralType === 'USDC' ? 'USDC' : 'NFT';
    
    switch (onboardingStep) {
      case 'partnercap':
        return `🚀 Step 1/2: Creating your ${collateralTypeLabel} Partner Capability...`;
      case 'stats':
        return '📊 Step 2/2: Setting up analytics system...';
      case 'complete':
        return '✅ Onboarding complete!';
      default:
        return '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWallet) {
      toast.error('Please connect your wallet.');
      return;
    }
    
    if (!partnerName.trim()) {
      toast.error('Please enter a partner name.');
      return;
    }

    try {
      switch (collateralType) {
        case 'SUI':
          const suiAmountNumber = parseFloat(suiAmount);
          if (isNaN(suiAmountNumber) || suiAmountNumber <= 0) {
            toast.error('Please enter a valid SUI collateral amount.');
            return;
          }
          const suiAmountMist = BigInt(Math.floor(suiAmountNumber * Math.pow(10, SUI_INPUT_DECIMALS)));
          await createPartnerWithFullSetup(partnerName.trim(), suiAmountMist);
          break;
          
        case 'USDC':
          if (!usdcCoinId.trim()) {
            toast.error('Please enter a valid USDC coin ID.');
            return;
          }
          await createPartnerWithFullSetupUSDC(partnerName.trim(), usdcCoinId.trim());
          break;
          
        case 'NFT':
          if (!kioskId.trim() || !collectionType.trim()) {
            toast.error('Please enter valid kiosk ID and collection type.');
            return;
          }
          const floorValue = parseFloat(estimatedFloorValue);
          if (isNaN(floorValue) || floorValue <= 0) {
            toast.error('Please enter a valid estimated floor value.');
            return;
          }
          await createPartnerWithFullSetupNFT(partnerName.trim(), kioskId.trim(), collectionType.trim(), floorValue);
          break;
      }
    } catch (error) {
      console.error('Error creating partner capability:', error);
    }
  };

  const renderCollateralInputs = () => {
    switch (collateralType) {
      case 'SUI':
        return (
          <div>
            <label htmlFor="suiAmount" className="block text-sm font-medium text-gray-300 mb-2">
              SUI Collateral Amount <span className="text-red-400">*</span>
            </label>
            <Input
              type="number"
              id="suiAmount"
              value={suiAmount}
              onChange={(e) => setSuiAmount(e.target.value)}
              placeholder="e.g., 100 SUI"
              step="any"
              min="1"
              disabled={isPartnerCapLoading}
              className="w-full"
              required
            />
            <p className="text-xs text-gray-500 mt-2">
              This SUI secures your partner status and determines your minting capabilities.
              <br />
              <span className="text-green-400">Example: 100 SUI ≈ $300 backing ≈ 300,000 Alpha Point quota</span>
            </p>
          </div>
        );
      
      case 'USDC':
        return (
          <div>
            <label htmlFor="usdcCoinId" className="block text-sm font-medium text-gray-300 mb-2">
              USDC Coin Object ID <span className="text-red-400">*</span>
            </label>
            <Input
              type="text"
              id="usdcCoinId"
              value={usdcCoinId}
              onChange={(e) => setUsdcCoinId(e.target.value)}
              placeholder="Enter USDC coin object ID"
              disabled={isPartnerCapLoading}
              className="w-full"
              required
            />
            <p className="text-xs text-gray-500 mt-2">
              <span className="text-green-400">100% LTV: Every $1 USDC = 1,000 Alpha Point quota</span>
            </p>
          </div>
        );
      
      case 'NFT':
        return (
          <div className="space-y-4">
            <div>
              <label htmlFor="kioskId" className="block text-sm font-medium text-gray-300 mb-2">
                Kiosk ID <span className="text-red-400">*</span>
              </label>
              <Input
                type="text"
                id="kioskId"
                value={kioskId}
                onChange={(e) => setKioskId(e.target.value)}
                placeholder="Enter kiosk ID containing your NFT"
                disabled={isPartnerCapLoading}
                className="w-full"
                required
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="collectionType" className="block text-sm font-medium text-gray-300 mb-2">
                  Collection Type <span className="text-red-400">*</span>
                </label>
                <Input
                  type="text"
                  id="collectionType"
                  value={collectionType}
                  onChange={(e) => setCollectionType(e.target.value)}
                  placeholder="e.g., SuiFrens, Cosmocadia"
                  disabled={isPartnerCapLoading}
                  className="w-full"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="estimatedFloorValue" className="block text-sm font-medium text-gray-300 mb-2">
                  Estimated Floor Value (USD) <span className="text-red-400">*</span>
                </label>
                <Input
                  type="number"
                  id="estimatedFloorValue"
                  value={estimatedFloorValue}
                  onChange={(e) => setEstimatedFloorValue(e.target.value)}
                  placeholder="e.g., 500"
                  step="any"
                  min="1"
                  disabled={isPartnerCapLoading}
                  className="w-full"
                  required
                />
              </div>
            </div>
            
            <p className="text-xs text-gray-500">
              <span className="text-purple-400">70% LTV: $500 floor = $350 effective = 350,000 Alpha Point quota</span>
            </p>
          </div>
        );
    }
  };

  if (!currentWallet) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-4">Wallet Connection Required</h2>
          <p className="text-gray-400">Please connect your wallet to access the Partner Program.</p>
        </div>
      </div>
    );
  }

  if (showOnboardingForm) {
    return (
      <div className="min-h-screen bg-background py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <button
              onClick={() => setShowOnboardingForm(false)}
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
            >
              <span>←</span> Back to Partner Program
            </button>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent mb-4">
              Create Your Partner Capability
            </h1>
            <p className="text-gray-300 text-lg">
              Lock collateral to start earning from your perks
            </p>
          </div>

          <div className="card-modern p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Partner Name */}
              <div>
                <label htmlFor="partnerName" className="block text-sm font-medium text-gray-300 mb-2">
                  Partner Name <span className="text-red-400">*</span>
                </label>
                <Input
                  type="text"
                  id="partnerName"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  placeholder="Your partner/brand name"
                  disabled={isPartnerCapLoading}
                  className="w-full"
                  required
                />
              </div>

              {/* Collateral Type Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-4">
                  Collateral Type <span className="text-red-400">*</span>
                </label>
                <div className="flex items-center justify-between p-4 bg-background rounded-lg border border-gray-700">
                  <h3 className="text-lg font-semibold text-white">Choose Collateral Type</h3>
                  
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer">
                      <input
                        type="radio"
                        name="collateralType"
                        value="SUI"
                        checked={collateralType === 'SUI'}
                        onChange={() => setCollateralType('SUI')}
                        className="sr-only"
                      />
                      <div className={`px-3 py-2 rounded-lg border text-center transition-all duration-300 flex items-center gap-2 text-sm ${
                        collateralType === 'SUI' 
                          ? 'border-blue-500 bg-blue-900/20 text-blue-300 shadow-lg shadow-blue-500/20' 
                          : 'border-gray-600 hover:border-gray-500'
                      }`}>
                        <span className="text-lg">⚡</span>
                        <div>
                          <div className="font-medium">SUI</div>
                          <div className="text-xs text-gray-400">Dynamic LTV</div>
                        </div>
                      </div>
                    </label>

                    <label className="cursor-pointer">
                      <input
                        type="radio"
                        name="collateralType"
                        value="USDC"
                        checked={collateralType === 'USDC'}
                        onChange={() => setCollateralType('USDC')}
                        className="sr-only"
                      />
                      <div className={`px-3 py-2 rounded-lg border text-center transition-all duration-300 flex items-center gap-2 text-sm ${
                        collateralType === 'USDC' 
                          ? 'border-green-500 bg-green-900/20 text-green-300 shadow-lg shadow-green-500/20' 
                          : 'border-gray-600 hover:border-gray-500'
                      }`}>
                        <span className="text-lg">💲</span>
                        <div>
                          <div className="font-medium">USDC</div>
                          <div className="text-xs text-gray-400">100% LTV</div>
                        </div>
                      </div>
                    </label>

                    <label className="cursor-pointer">
                      <input
                        type="radio"
                        name="collateralType"
                        value="NFT"
                        checked={collateralType === 'NFT'}
                        onChange={() => setCollateralType('NFT')}
                        className="sr-only"
                      />
                      <div className={`px-3 py-2 rounded-lg border text-center transition-all duration-300 flex items-center gap-2 text-sm ${
                        collateralType === 'NFT' 
                          ? 'border-purple-500 bg-purple-900/20 text-purple-300 shadow-lg shadow-purple-500/20' 
                          : 'border-gray-600 hover:border-gray-500'
                      }`}>
                        <span className="text-lg">🎨</span>
                        <div>
                          <div className="font-medium">NFT</div>
                          <div className="text-xs text-gray-400">70% LTV</div>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Dynamic Collateral Inputs */}
              {renderCollateralInputs()}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isPartnerCapLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPartnerCapLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>{getStepMessage() || 'Creating Partner Capability...'}</span>
                  </div>
                ) : (
                  'Create Partner Capability'
                )}
              </Button>
              
              {/* Progress indicator */}
              {isPartnerCapLoading && onboardingStep && onboardingStep !== 'idle' && (
                <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                  <div className="text-sm text-blue-300 mb-2">{getStepMessage()}</div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className={`bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500 ${
                        onboardingStep === 'partnercap' ? 'w-1/2' : 
                        onboardingStep === 'stats' ? 'w-full' : 'w-0'
                      }`}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-400 mt-2">
                    {onboardingStep === 'partnercap' && `Setting up your ${collateralType} partner account with collateral backing...`}
                    {onboardingStep === 'stats' && 'Initializing analytics and quota management system...'}
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 text-center pt-8 pb-6">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-3">
          Alpha Partner Program
        </h1>
        <p className="text-lg text-gray-300 max-w-4xl mx-auto px-4">
          Transform your digital assets into revenue. No subscriptions, no complex setups—just pure earning potential.
        </p>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full px-4 gap-6 min-h-0 pb-8">
        
        {/* Left Side - Benefits & How It Works */}
        <div className="lg:w-1/2 flex flex-col min-h-0">
          
          {/* Key Benefits */}
          <div className="flex-shrink-0 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">Why Choose Alpha Partners?</h2>
            <div className="grid grid-cols-4 gap-2">
              <div className="card-modern p-2 text-center">
                <div className="text-lg mb-1">💰</div>
                <h3 className="text-xs font-semibold text-white mb-1">Zero Fees</h3>
                <p className="text-xs text-gray-400">Keep 100% revenue</p>
              </div>
              <div className="card-modern p-2 text-center">
                <div className="text-lg mb-1">📈</div>
                <h3 className="text-xs font-semibold text-white mb-1">Yield on Assets</h3>
                <p className="text-xs text-gray-400">Earn while building</p>
              </div>
              <div className="card-modern p-2 text-center">
                <div className="text-lg mb-1">⚡</div>
                <h3 className="text-xs font-semibold text-white mb-1">Instant Setup</h3>
                <p className="text-xs text-gray-400">Live in minutes</p>
              </div>
              <div className="card-modern p-2 text-center">
                <div className="text-lg mb-1">🎛️</div>
                <h3 className="text-xs font-semibold text-white mb-1">Full Control</h3>
                <p className="text-xs text-gray-400">Custom configs</p>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className="flex-1 min-h-0">
            <h2 className="text-xl font-bold text-white mb-4">How It Works</h2>
            <div className="space-y-4 overflow-y-auto">
              <div className="card-modern p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">1</div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Lock Collateral</h3>
                    <p className="text-sm text-gray-300 mb-2">Choose SUI, USDC, or NFTs. Each $1 = 1,000 Alpha Points quota.</p>
                    <div className="flex gap-2 text-xs">
                      <span className="text-blue-400">⚡ SUI: Dynamic</span>
                      <span className="text-green-400">💲 USDC: 100%</span>
                      <span className="text-purple-400">🎨 NFT: 70%</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="card-modern p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">2</div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Create Perks</h3>
                    <p className="text-sm text-gray-300 mb-2">Design experiences with custom pricing & revenue splits.</p>
                    <div className="text-xs text-gray-400">✓ Revenue control ✓ Metadata ✓ Usage limits</div>
                  </div>
                </div>
              </div>
              
              <div className="card-modern p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-pink-500 to-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">3</div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Earn & Grow</h3>
                    <p className="text-sm text-gray-300 mb-2">Users buy perks, you earn. Configure auto-reinvestment for growth.</p>
                    <div className="text-xs text-gray-400">📊 Analytics 🔄 Auto-growth 💎 Compounding</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Revenue Calculator & CTA */}
        <div className="lg:w-1/2 flex flex-col min-h-0">
          
          {/* Revenue Calculator */}
          <div className="card-modern p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">Revenue Calculator</h2>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center p-3 bg-background rounded-lg">
                <span className="text-gray-300 text-sm">Collateral Value</span>
                <span className="text-white font-semibold">$1,000 USD</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-background rounded-lg">
                <span className="text-gray-300 text-sm">Lifetime Quota</span>
                <span className="text-green-400 font-semibold">1,000,000 Points</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-background rounded-lg">
                <span className="text-gray-300 text-sm">Daily Quota</span>
                <span className="text-blue-400 font-semibold">30,000 Points</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-background rounded-lg">
                <span className="text-gray-300 text-sm">Monthly Revenue*</span>
                <span className="text-purple-400 font-semibold">$900 USD</span>
              </div>
            </div>
            
            {/* Business Model Benefits */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-6 h-6 bg-green-500/20 rounded flex items-center justify-center">
                  <span className="text-green-400 text-xs">💰</span>
                </div>
                <span className="text-gray-300">No subscription model vs traditional platforms</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-6 h-6 bg-blue-500/20 rounded flex items-center justify-center">
                  <span className="text-blue-400 text-xs">🏦</span>
                </div>
                <span className="text-gray-300">Collateral earns yield through protocols</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-6 h-6 bg-purple-500/20 rounded flex items-center justify-center">
                  <span className="text-purple-400 text-xs">📈</span>
                </div>
                <span className="text-gray-300">Configurable revenue auto-reinvestment for compound growth</span>
              </div>
            </div>
            
            <p className="text-xs text-gray-500">
              *Based on optimal daily quota usage and market pricing
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex-shrink-0 text-center space-y-3">
            <Button 
              onClick={() => setShowOnboardingForm(true)}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              Create Partner Capability
            </Button>
            <Button 
              onClick={() => navigate('/perks')}
              className="w-full border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 py-3 px-6 rounded-lg transition-all duration-300"
            >
              Explore Existing Perks
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 