import React, { useState } from 'react';
import { useCurrentWallet } from '@mysten/dapp-kit';
import { usePartnerOnboarding } from '../hooks/usePartnerOnboarding';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { toast } from 'react-toastify';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, A11y } from 'swiper/modules';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

const SUI_INPUT_DECIMALS = 9; // Standard SUI decimals

interface PartnerOnboardingProps {
  onSuccess: () => void;
}

type CollateralType = 'SUI' | 'USDC' | 'NFT';

export function PartnerOnboarding({ onSuccess }: PartnerOnboardingProps) {
  const { currentWallet } = useCurrentWallet();
  const {
    createPartnerCapFlex,
    createPartnerCapFlexWithUSDC,
    createPartnerCapFlexWithNFT,
    createPartnerCap,
    isLoading: isPartnerCapLoading,
    error: partnerCapError,
    transactionDigest: partnerCapTxDigest,
  } = usePartnerOnboarding();

  const [partnerName, setPartnerName] = useState('');
  const [collateralType, setCollateralType] = useState<CollateralType>('SUI');
  const [useFlexSystem, setUseFlexSystem] = useState(true); // Default to new system
  const [currentSlide, setCurrentSlide] = useState(0);

  // SUI collateral fields
  const [suiAmount, setSuiAmount] = useState('');
  
  // USDC collateral fields
  const [usdcCoinId, setUsdcCoinId] = useState('');
  
  // NFT collateral fields
  const [kioskId, setKioskId] = useState('');
  const [collectionType, setCollectionType] = useState('');
  const [estimatedFloorValue, setEstimatedFloorValue] = useState('');

  React.useEffect(() => {
    if (partnerCapError) {
      toast.error(partnerCapError);
    }
    if (partnerCapTxDigest) {
      const systemType = useFlexSystem ? 'PartnerCapFlex' : 'Legacy PartnerCap';
      toast.success(`${systemType} created successfully!`);
      onSuccess(); // Trigger refresh of parent component
    }
  }, [partnerCapError, partnerCapTxDigest, useFlexSystem, onSuccess]);

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
      if (useFlexSystem) {
        // PartnerCapFlex system - supports all collateral types
        switch (collateralType) {
          case 'SUI':
            const suiAmountNumber = parseFloat(suiAmount);
            if (isNaN(suiAmountNumber) || suiAmountNumber <= 0) {
              toast.error('Please enter a valid SUI collateral amount.');
              return;
            }
            const suiAmountMist = BigInt(Math.floor(suiAmountNumber * Math.pow(10, SUI_INPUT_DECIMALS)));
            await createPartnerCapFlex(partnerName.trim(), suiAmountMist);
            break;
            
          case 'USDC':
            if (!usdcCoinId.trim()) {
              toast.error('Please enter a valid USDC coin ID.');
              return;
            }
            await createPartnerCapFlexWithUSDC(partnerName.trim(), usdcCoinId.trim());
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
            await createPartnerCapFlexWithNFT(partnerName.trim(), kioskId.trim(), collectionType.trim(), floorValue);
            break;
        }
      } else {
        // Legacy system - only supports SUI collateral
        if (collateralType !== 'SUI') {
          toast.error('Legacy PartnerCap only supports SUI collateral. Please select SUI or use PartnerCapFlex system.');
          return;
        }
        const suiAmountNumber = parseFloat(suiAmount);
        if (isNaN(suiAmountNumber) || suiAmountNumber <= 0) {
          toast.error('Please enter a valid SUI collateral amount.');
          return;
        }
        const suiAmountMist = BigInt(Math.floor(suiAmountNumber * Math.pow(10, SUI_INPUT_DECIMALS)));
        await createPartnerCap(partnerName.trim(), suiAmountMist);
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
            <label htmlFor="suiAmount" className="block text-sm font-medium text-gray-300 mb-1">
              SUI Collateral Amount
            </label>
            <Input
              type="number"
              id="suiAmount"
              value={suiAmount}
              onChange={(e) => setSuiAmount(e.target.value)}
              placeholder="e.g., 100"
              step="any"
              disabled={isPartnerCapLoading || !currentWallet}
              className="w-full"
            />
            <p className="text-xs text-gray-400 mt-1">
              Higher SUI collateral increases your daily Alpha Point minting quotas.
            </p>
          </div>
        );
      
      case 'USDC':
        return (
          <div>
            <label htmlFor="usdcCoinId" className="block text-sm font-medium text-gray-300 mb-1">
              USDC Coin Object ID
            </label>
            <Input
              type="text"
              id="usdcCoinId"
              value={usdcCoinId}
              onChange={(e) => setUsdcCoinId(e.target.value)}
              placeholder="0x123...abc (USDC coin object ID)"
              disabled={isPartnerCapLoading || !currentWallet}
              className="w-full"
            />
            <p className="text-xs text-gray-400 mt-1">
              USDC provides 100% LTV ratio - stable collateral with full value utilization.
            </p>
          </div>
        );
      
      case 'NFT':
        return (
          <div className="space-y-4">
            <div>
              <label htmlFor="kioskId" className="block text-sm font-medium text-gray-300 mb-1">
                Kiosk Object ID
              </label>
              <Input
                type="text"
                id="kioskId"
                value={kioskId}
                onChange={(e) => setKioskId(e.target.value)}
                placeholder="0x123...abc (Kiosk containing NFTs)"
                disabled={isPartnerCapLoading || !currentWallet}
                className="w-full"
              />
            </div>
            
            <div>
              <label htmlFor="collectionType" className="block text-sm font-medium text-gray-300 mb-1">
                NFT Collection Type
              </label>
              <Input
                type="text"
                id="collectionType"
                value={collectionType}
                onChange={(e) => setCollectionType(e.target.value)}
                placeholder="e.g., 0x123::nft::MyNFT"
                disabled={isPartnerCapLoading || !currentWallet}
                className="w-full"
              />
            </div>
            
            <div>
              <label htmlFor="estimatedFloorValue" className="block text-sm font-medium text-gray-300 mb-1">
                Estimated Floor Value (USDC)
              </label>
              <Input
                type="number"
                id="estimatedFloorValue"
                value={estimatedFloorValue}
                onChange={(e) => setEstimatedFloorValue(e.target.value)}
                placeholder="e.g., 1000"
                step="any"
                disabled={isPartnerCapLoading || !currentWallet}
                className="w-full"
              />
              <p className="text-xs text-gray-400 mt-1">
                NFT collateral provides 70% LTV ratio with kiosk owner capabilities.
              </p>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  const getCollateralBenefits = () => {
    if (!useFlexSystem) return null;
    
    switch (collateralType) {
      case 'SUI':
        return (
          <div className="p-3 bg-blue-900/20 border border-blue-700 rounded-lg">
            <h4 className="text-sm font-medium text-blue-400 mb-2">SUI Collateral Benefits:</h4>
            <ul className="text-xs text-blue-300 space-y-0.5">
              <li>• Dynamic pricing via oracle integration</li>
              <li>• Gas-efficient native token operations</li>
              <li>• Standard collateral with flexible LTV</li>
              <li>• TVL-backed quotas: 1,000 Alpha Points per USDC equivalent</li>
            </ul>
          </div>
        );
      
      case 'USDC':
        return (
          <div className="p-3 bg-green-900/20 border border-green-700 rounded-lg">
            <h4 className="text-sm font-medium text-green-400 mb-2">USDC Stable Collateral Benefits:</h4>
            <ul className="text-xs text-green-300 space-y-0.5">
              <li>• 100% LTV ratio - maximum capital efficiency</li>
              <li>• Stable value - no volatility risk</li>
              <li>• Direct 1:1000 quota calculation (1 USDC = 1,000 points)</li>
              <li>• Lower liquidation risk than volatile assets</li>
            </ul>
          </div>
        );
      
      case 'NFT':
        return (
          <div className="p-3 bg-purple-900/20 border border-purple-700 rounded-lg">
            <h4 className="text-sm font-medium text-purple-400 mb-2">NFT Bundle Collateral Benefits:</h4>
            <ul className="text-xs text-purple-300 space-y-0.5">
              <li>• 70% LTV ratio with collection backing</li>
              <li>• Kiosk owner capabilities retained</li>
              <li>• Oracle-based floor value validation</li>
              <li>• Diversified NFT collection support</li>
            </ul>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col max-h-screen overflow-hidden">
      {/* Compact Header */}
      <div className="text-center mb-4 flex-shrink-0">
        <h1 className="text-2xl font-bold mb-1">Become an Alpha Points Partner</h1>
        <p className="text-gray-400 text-sm">
          Create your Partner Capability with your preferred collateral type
        </p>
      </div>

      {/* Main Content Swiper */}
      <div className="flex-1 min-h-0">
        <Swiper
          modules={[Navigation, Pagination, A11y]}
          spaceBetween={20}
          slidesPerView={1}
          navigation={{
            nextEl: '.swiper-button-next-custom',
            prevEl: '.swiper-button-prev-custom',
          }}
          pagination={{ 
            clickable: true,
            el: '.swiper-pagination-custom',
          }}
          onSlideChange={(swiper) => setCurrentSlide(swiper.activeIndex)}
          className="h-full"
        >
          {/* Slide 1: Benefits & System Selection */}
          <SwiperSlide className="p-4">
            <div className="bg-background-card rounded-lg shadow-lg p-4 h-full overflow-y-auto">
              <h2 className="text-lg font-semibold mb-4 text-center">System & Collateral Selection</h2>
              
              {/* Top-level Compact Benefits Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="bg-background p-3 rounded-lg text-center">
                  <div className="text-2xl text-primary mb-1">💰</div>
                  <h3 className="font-medium text-sm mb-1">Multi-Collateral</h3>
                  <p className="text-gray-400 text-xs">SUI, USDC, NFT support</p>
                </div>
                <div className="bg-background p-3 rounded-lg text-center">
                  <div className="text-2xl text-primary mb-1">📈</div>
                  <h3 className="font-medium text-sm mb-1">TVL Growth</h3>
                  <p className="text-gray-400 text-xs">20% revenue reinvestment</p>
                </div>
                <div className="bg-background p-3 rounded-lg text-center">
                  <div className="text-2xl text-primary mb-1">🔒</div>
                  <h3 className="font-medium text-sm mb-1">Flexible LTV</h3>
                  <p className="text-gray-400 text-xs">Optimized per asset type</p>
                </div>
              </div>

              {/* System Selection & Collateral Type */}
              <div className="flex flex-col lg:flex-row gap-4">
                {/* System Selection Card */}
                <div className="lg:w-1/2 p-3 bg-background rounded-lg border border-gray-700">
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Choose System Type</h3>
                  <div className="space-y-2">
                    <label className="flex items-start space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="systemType"
                        value="flex"
                        checked={useFlexSystem}
                        onChange={() => setUseFlexSystem(true)}
                        className="mt-1 h-4 w-4 text-primary border-gray-300 focus:ring-primary focus:ring-2"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">PartnerCapFlex (Recommended)</div>
                        <div className="text-xs text-gray-400">Multi-collateral support, TVL-backed quotas</div>
                      </div>
                    </label>
                    <label className="flex items-start space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="systemType"
                        value="legacy"
                        checked={!useFlexSystem}
                        onChange={() => setUseFlexSystem(false)}
                        className="mt-1 h-4 w-4 text-primary border-gray-300 focus:ring-primary focus:ring-2"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">Legacy PartnerCap</div>
                        <div className="text-xs text-gray-400">SUI only, basic features</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Collateral Type Selection */}
                <div className="lg:w-1/2 p-3 bg-background rounded-lg border border-gray-700">
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Choose Collateral Type</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="cursor-pointer">
                      <input
                        type="radio"
                        name="collateralType"
                        value="SUI"
                        checked={collateralType === 'SUI'}
                        onChange={() => setCollateralType('SUI')}
                        className="sr-only"
                      />
                      <div className={`p-2 rounded-lg border text-center transition-colors ${
                        collateralType === 'SUI' 
                          ? 'border-blue-500 bg-blue-900/20 text-blue-300' 
                          : 'border-gray-600 hover:border-gray-500'
                      }`}>
                        <div className="text-lg mb-1">⚡</div>
                        <div className="text-xs font-medium">SUI</div>
                        <div className="text-xs text-gray-400">Native</div>
                      </div>
                    </label>
                    
                    <label className={`cursor-pointer ${!useFlexSystem ? 'opacity-50 pointer-events-none' : ''}`}>
                      <input
                        type="radio"
                        name="collateralType"
                        value="USDC"
                        checked={collateralType === 'USDC'}
                        onChange={() => setCollateralType('USDC')}
                        disabled={!useFlexSystem}
                        className="sr-only"
                      />
                      <div className={`p-2 rounded-lg border text-center transition-colors ${
                        collateralType === 'USDC' 
                          ? 'border-green-500 bg-green-900/20 text-green-300' 
                          : 'border-gray-600 hover:border-gray-500'
                      }`}>
                        <div className="text-lg mb-1">💲</div>
                        <div className="text-xs font-medium">USDC</div>
                        <div className="text-xs text-gray-400">100% LTV</div>
                      </div>
                    </label>
                    
                    <label className={`cursor-pointer ${!useFlexSystem ? 'opacity-50 pointer-events-none' : ''}`}>
                      <input
                        type="radio"
                        name="collateralType"
                        value="NFT"
                        checked={collateralType === 'NFT'}
                        onChange={() => setCollateralType('NFT')}
                        disabled={!useFlexSystem}
                        className="sr-only"
                      />
                      <div className={`p-2 rounded-lg border text-center transition-colors ${
                        collateralType === 'NFT' 
                          ? 'border-purple-500 bg-purple-900/20 text-purple-300' 
                          : 'border-gray-600 hover:border-gray-500'
                      }`}>
                        <div className="text-lg mb-1">🎨</div>
                        <div className="text-xs font-medium">NFT</div>
                        <div className="text-xs text-gray-400">70% LTV</div>
                      </div>
                    </label>
                  </div>
                  {!useFlexSystem && (
                    <p className="text-xs text-yellow-400 mt-2">
                      Multi-collateral requires PartnerCapFlex system
                    </p>
                  )}
                </div>
              </div>

              {/* Dynamic Benefits Display */}
              <div className="mt-4">
                {getCollateralBenefits()}
              </div>
            </div>
          </SwiperSlide>

          {/* Slide 2: Form */}
          <SwiperSlide className="p-4">
            <div className="bg-background-card rounded-lg shadow-lg p-4 h-full flex flex-col overflow-y-auto">
              <h2 className="text-lg font-semibold mb-4 text-center flex-shrink-0">Create Your Partner Capability</h2>

              {/* Section 1: Rules/Disclaimer (Top) */}
              <div className="mb-4 p-3 bg-background rounded-lg border border-gray-700 text-center flex-shrink-0">
                <p className="text-xs text-gray-400">
                  By creating a Partner Capability, you agree to the platform terms. 
                  {collateralType === 'USDC' && ' USDC provides stable 100% LTV backing.'}
                  {collateralType === 'NFT' && ' NFT collateral maintains kiosk owner capabilities with 70% LTV.'}
                  {collateralType === 'SUI' && ' SUI collateral backing varies with market price via oracle.'}
                </p>
              </div>

              {/* Main Content Area */}
              <div className="flex-grow flex flex-col md:flex-row gap-4 min-h-0">
                {/* Section 2: Information/Guidance (Left Column) */}
                <div className="md:w-1/3 flex flex-col gap-4">
                  {!currentWallet && (
                    <div className="p-3 bg-red-900/20 border border-red-700 rounded-lg text-center">
                      <p className="text-red-300 text-sm font-medium">Connect Wallet</p>
                      <p className="text-xs text-red-400">Please connect your wallet to create a capability.</p>
                    </div>
                  )}
                  
                  <div className="p-3 bg-background rounded-lg border border-gray-700">
                    <h4 className="text-sm font-medium text-white mb-2">Selected Configuration</h4>
                    <div className="text-xs space-y-1">
                      <div>System: <span className={useFlexSystem ? 'text-green-400' : 'text-yellow-400'}>
                        {useFlexSystem ? 'PartnerCapFlex' : 'Legacy PartnerCap'}
                      </span></div>
                      <div>Collateral: <span className="text-primary">{collateralType}</span></div>
                      {collateralType === 'USDC' && <div className="text-green-400">100% LTV - Stable backing</div>}
                      {collateralType === 'NFT' && <div className="text-purple-400">70% LTV - Kiosk integration</div>}
                      {collateralType === 'SUI' && <div className="text-blue-400">Dynamic LTV - Oracle pricing</div>}
                    </div>
                  </div>
                </div>

                {/* Section 3: Input Form (Right Column) */}
                <div className="md:w-2/3">
                  <form onSubmit={handleSubmit} className="space-y-4 h-full flex flex-col">
                    <div className="flex-grow space-y-4">
                      <div>
                        <label htmlFor="partnerName" className="block text-sm font-medium text-gray-300 mb-1">
                          Partner Name
                        </label>
                        <Input
                          type="text"
                          id="partnerName"
                          value={partnerName}
                          onChange={(e) => setPartnerName(e.target.value)}
                          placeholder="Your Company / Project Name"
                          disabled={isPartnerCapLoading || !currentWallet}
                          className="w-full"
                        />
                      </div>
                      
                      {renderCollateralInputs()}
                    </div>
                    
                    <Button 
                      type="submit" 
                      disabled={isPartnerCapLoading || !currentWallet || !partnerName.trim()}
                      className="w-full py-3 text-base flex-shrink-0"
                    >
                      {isPartnerCapLoading ? 'Creating...' : `Create ${useFlexSystem ? 'PartnerCapFlex' : 'Legacy PartnerCap'} with ${collateralType}`}
                    </Button>
                  </form>
                </div>
              </div>
            </div>
          </SwiperSlide>
        </Swiper>
      </div>

      {/* Navigation Controls */}
      <div className="flex-shrink-0 flex items-center justify-center gap-4 mt-4 mb-2">
        <button 
          className="swiper-button-prev-custom p-2 rounded-full bg-background-card hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={currentSlide === 0}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <div className="swiper-pagination-custom flex gap-2"></div>
        
        <button 
          className="swiper-button-next-custom p-2 rounded-full bg-background-card hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={currentSlide === 1}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
} 