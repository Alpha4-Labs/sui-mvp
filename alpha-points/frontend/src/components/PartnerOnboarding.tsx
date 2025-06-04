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

export function PartnerOnboarding({ onSuccess }: PartnerOnboardingProps) {
  const { currentWallet } = useCurrentWallet();
  const {
    createPartnerCapFlex,
    createPartnerCap,
    isLoading: isPartnerCapLoading,
    error: partnerCapError,
    transactionDigest: partnerCapTxDigest,
  } = usePartnerOnboarding();

  const [partnerName, setPartnerName] = useState('');
  const [suiAmount, setSuiAmount] = useState('');
  const [useFlexSystem, setUseFlexSystem] = useState(true); // Default to new system
  const [currentSlide, setCurrentSlide] = useState(0);

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
    const suiAmountNumber = parseFloat(suiAmount);
    if (isNaN(suiAmountNumber) || suiAmountNumber <= 0) {
      toast.error('Please enter a valid SUI collateral amount.');
      return;
    }
    if (!partnerName.trim()) {
      toast.error('Please enter a partner name.');
      return;
    }
    const suiAmountMist = BigInt(Math.floor(suiAmountNumber * Math.pow(10, SUI_INPUT_DECIMALS)));
    
    // Choose which function to call based on user selection
    if (useFlexSystem) {
      await createPartnerCapFlex(partnerName.trim(), suiAmountMist);
    } else {
      await createPartnerCap(partnerName.trim(), suiAmountMist);
    }
  };

  return (
    <div className="h-full flex flex-col max-h-screen overflow-hidden">
      {/* Compact Header */}
      <div className="text-center mb-4 flex-shrink-0">
        <h1 className="text-2xl font-bold mb-1">Become an Alpha Points Partner</h1>
        <p className="text-gray-400 text-sm">
          Create your Partner Capability to start minting Alpha Points
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
              <h2 className="text-lg font-semibold mb-4 text-center">Partner Benefits & System Selection</h2>
              
              {/* Top-level Compact Benefits Grid (remains as is) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="bg-background p-3 rounded-lg text-center">
                  <div className="text-2xl text-primary mb-1">💰</div>
                  <h3 className="font-medium text-sm mb-1">Revenue Sharing</h3>
                  <p className="text-gray-400 text-xs">Enhanced 70/20/10 split</p>
                </div>
                <div className="bg-background p-3 rounded-lg text-center">
                  <div className="text-2xl text-primary mb-1">📈</div>
                  <h3 className="font-medium text-sm mb-1">TVL Growth</h3>
                  <p className="text-gray-400 text-xs">20% revenue reinvestment</p>
                </div>
                <div className="bg-background p-3 rounded-lg text-center">
                  <div className="text-2xl text-primary mb-1">🔒</div>
                  <h3 className="font-medium text-sm mb-1">Sustainable Quotas</h3>
                  <p className="text-gray-400 text-xs">TVL-backed economics</p>
                </div>
              </div>

              {/* New Flex Container for System Selection & Dynamic Benefits */}
              <div className="flex flex-col md:flex-row gap-4">
                {/* System Selection Card (Left Side on MD+) */}
                <div className="md:w-1/2 p-3 bg-background rounded-lg border border-gray-700">
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
                        <div className="text-xs text-gray-400">TVL-backed quotas, revenue recycling, sustainable growth</div>
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
                        <div className="text-xs text-gray-400">Simple quota system, limited features</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Dynamic Benefits Display Card (Right Side on MD+) */}
                <div className="md:w-1/2">
                  {useFlexSystem && (
                    <div className="h-full p-3 bg-green-900/20 border border-green-700 rounded-lg">
                      <h4 className="text-sm font-medium text-green-400 mb-2">PartnerCapFlex Benefits:</h4>
                      <ul className="text-xs text-green-300 space-y-0.5">
                        <li>• TVL-backed quotas: 1,000 Alpha Points per USDC locked</li>
                        <li>• Daily throttling: 3% of TVL value per day</li>
                        <li>• Revenue recycling: 20% grows your effective TVL</li>
                        <li>• Enhanced revenue split: 70/20/10 model</li>
                        <li>• Sustainable growth mechanics</li>
                      </ul>
                    </div>
                  )}

                  {!useFlexSystem && (
                    <div className="h-full p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                      <h4 className="text-sm font-medium text-yellow-400 mb-2">Legacy System Notice:</h4>
                      <ul className="text-xs text-yellow-300 space-y-0.5">
                        <li>• Basic quota system without TVL backing</li>
                        <li>• No revenue recycling or growth mechanics</li>
                        <li>• Limited to simple 90/10 revenue split</li>
                        <li>• Consider using PartnerCapFlex for better features</li>
                      </ul>
                    </div>
                  )}
                </div>
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
                  By creating a Partner Capability, you agree to the platform terms and understand that collateral is locked to back your minting quotas.
                </p>
              </div>

              {/* Main Content Area (Flex for Columns) */}
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
                    <h4 className="text-sm font-medium text-white mb-2">Selected System</h4>
                    <div className="text-xs">
                      {useFlexSystem ? (
                        <span className="text-green-400">✓ PartnerCapFlex: TVL-backed, revenue recycling.</span>
                      ) : (
                        <span className="text-yellow-400">⚠ Legacy PartnerCap: Basic quotas, limited features.</span>
                      )}
                    </div>
                  </div>
                  <div className="p-3 bg-background rounded-lg border border-gray-700">
                    <h4 className="text-sm font-medium text-white mb-2">Collateral Info</h4>
                    <p className="text-xs text-gray-400">
                      Higher SUI collateral increases your daily Alpha Point minting quotas.
                      Example: 100 SUI (at $3/SUI = $300 TVL) provides a base quota of 300,000 Alpha Points.
                    </p>
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
                      </div>
                    </div>
                    
                    <Button 
                      type="submit" 
                      disabled={isPartnerCapLoading || !currentWallet || !partnerName.trim() || !suiAmount.trim()}
                      className="w-full py-3 text-base flex-shrink-0"
                    >
                      {isPartnerCapLoading ? 'Creating...' : `Create ${useFlexSystem ? 'PartnerCapFlex' : 'Legacy PartnerCap'}`}
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