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
    createPartnerCapFlex,
    createPartnerCapFlexWithUSDC,
    createPartnerCapFlexWithNFT,
    isLoading: isPartnerCapLoading,
    error: partnerCapError,
    transactionDigest: partnerCapTxDigest,
  } = usePartnerOnboarding();

  const [partnerName, setPartnerName] = useState('');
  const [collateralType, setCollateralType] = useState<CollateralType>('SUI');
  
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
      
      // Create a clickable toast with the transaction URL
      toast.success(
        <div>
          <div>Successfully joined partner program!</div>
          <a 
            href={explorerUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-300 hover:text-blue-200 underline text-sm"
          >
            View transaction: {partnerCapTxDigest.substring(0,10)}...
          </a>
        </div>,
        {
          autoClose: 8000, // Give more time to see and click the link
        }
      );
      
      // Trigger partner detection refresh and handle mode switching
      if (onPartnerCreated) {
        setTimeout(async () => {
          try {

            toast.info('🔍 Detecting your new Partner Capability...', { autoClose: 3000 });
            
            // First, detect the partner caps to get the fresh data
            const detectedCaps = await onPartnerCreated();
            
            // If we got caps back (function returns caps) or if onPartnerCreated is a detection function
            if (Array.isArray(detectedCaps) && detectedCaps.length > 0) {

              // Update global state with the detected caps
              setPartnerCaps(detectedCaps);
              // Switch to partner mode
              setMode('partner');
              // Navigate to partner dashboard
              navigate('/partners/overview');
              toast.success('Welcome to your Partner Dashboard! 🎉');
            } else {

              // If onPartnerCreated doesn't return caps, call it anyway and assume it will trigger detection
              onPartnerCreated();
              // Give it a longer moment for the context to update, then try to switch mode
              setTimeout(() => {

                setMode('partner');
                navigate('/partners/overview');
                toast.success('Welcome to your Partner Dashboard! 🎉');
              }, 3000); // Increased to 3 seconds for enhanced detection
            }
          } catch (error) {
            console.error('❌ Error during partner mode activation:', error);
            // Fallback: just call the callback and let the user manually switch
            if (typeof onPartnerCreated === 'function') {
              onPartnerCreated();
            }
            toast.warning('⚠️ Partner created successfully! Please use the "Partners" button at the bottom to access your dashboard.');
          }
        }, 2000); // Increased delay to 2 seconds to ensure transaction is fully processed
      }
    }
  }, [partnerCapError, partnerCapTxDigest, onPartnerCreated, setMode, setPartnerCaps, navigate]);

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
      // Always use PartnerCapFlex system with different collateral types
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
    } catch (error) {
      console.error('Error creating partner capability:', error);
    }
  };

  const renderCollateralInputs = () => {
    switch (collateralType) {
      case 'SUI':
        return (
          <div>
            <label htmlFor="suiAmount" className="block text-sm font-medium text-gray-300 mb-1.5">
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
              className="w-full text-base"
              required
            />
            <p className="text-xs text-gray-500 mt-1.5">
              This SUI secures your partner status and determines your minting capabilities.
              <br />
              <span className="text-green-400">Example: 100 SUI ≈ $300 backing ≈ 300,000 Alpha Point quota</span>
            </p>
          </div>
        );
      
      case 'USDC':
        return (
          <div>
            <label htmlFor="usdcCoinId" className="block text-sm font-medium text-gray-300 mb-1.5">
              USDC Coin Object ID <span className="text-red-400">*</span>
            </label>
            <Input
              type="text"
              id="usdcCoinId"
              value={usdcCoinId}
              onChange={(e) => setUsdcCoinId(e.target.value)}
              placeholder="0x123...abc (USDC coin object ID)"
              disabled={isPartnerCapLoading}
              className="w-full text-base"
              required
            />
            <p className="text-xs text-gray-500 mt-1.5">
              USDC provides 100% LTV ratio - stable collateral with full value utilization.
              <br />
              <span className="text-green-400">Direct 1:1000 ratio: 1 USDC = 1,000 Alpha Points quota</span>
            </p>
          </div>
        );
      
      case 'NFT':
        return (
          <div className="space-y-4">
            {/* Partner Name and Estimated Floor Value - side by side to save space */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="partnerName" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Partner Name <span className="text-red-400">*</span>
                </label>
                <Input
                  type="text"
                  id="partnerName"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  placeholder="Your Company / Project Name"
                  disabled={isPartnerCapLoading}
                  className="w-full text-base"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  This name will be displayed in your partner dashboard.
                </p>
              </div>

              <div>
                <label htmlFor="estimatedFloorValue" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Estimated Floor Value (USDC) <span className="text-red-400">*</span>
                </label>
                <Input
                  type="number"
                  id="estimatedFloorValue"
                  value={estimatedFloorValue}
                  onChange={(e) => setEstimatedFloorValue(e.target.value)}
                  placeholder="e.g., 1000"
                  step="any"
                  min="1"
                  disabled={isPartnerCapLoading}
                  className="w-full text-base"
                  required
                />
                <p className="text-xs text-purple-400 mt-1">
                  $1000 = 700,000 Alpha Points quota (70% LTV)
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="kioskId" className="block text-sm font-medium text-gray-300 mb-1.5">
                Kiosk Object ID <span className="text-red-400">*</span>
              </label>
              <Input
                type="text"
                id="kioskId"
                value={kioskId}
                onChange={(e) => setKioskId(e.target.value)}
                placeholder="0x123...abc (Kiosk containing NFTs)"
                disabled={isPartnerCapLoading}
                className="w-full text-base"
                required
              />
            </div>
            
            <div>
              <label htmlFor="collectionType" className="block text-sm font-medium text-gray-300 mb-1.5">
                NFT Collection Type <span className="text-red-400">*</span>
              </label>
              <Input
                type="text"
                id="collectionType"
                value={collectionType}
                onChange={(e) => setCollectionType(e.target.value)}
                placeholder="e.g., 0x123::nft::MyNFT"
                disabled={isPartnerCapLoading}
                className="w-full text-base"
                required
              />
              <p className="text-xs text-gray-500 mt-1.5">
                NFT collateral provides 70% LTV ratio with kiosk owner capabilities retained.
              </p>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  const getCollateralBenefits = () => {
    switch (collateralType) {
      case 'SUI':
        return (
          <div className="p-4 bg-blue-900/30 border border-blue-700/50 rounded-lg text-sm">
            <h4 className="font-semibold text-blue-300 mb-2">SUI Collateral Benefits:</h4>
            <ul className="text-xs text-blue-400/90 space-y-1 list-disc list-inside">
              <li>Dynamic pricing via oracle integration</li>
              <li>Gas-efficient native token operations</li>
              <li>TVL-backed quotas: ~1,000 Alpha Points per USDC equivalent</li>
              <li>Flexible LTV based on market conditions</li>
            </ul>
          </div>
        );
      
      case 'USDC':
        return (
          <div className="p-4 bg-green-900/30 border border-green-700/50 rounded-lg text-sm">
            <h4 className="font-semibold text-green-300 mb-2">USDC Stable Collateral Benefits:</h4>
            <ul className="text-xs text-green-400/90 space-y-1 list-disc list-inside">
              <li>100% LTV ratio - maximum capital efficiency</li>
              <li>Stable value - no volatility risk</li>
              <li>Direct 1:1000 quota calculation (1 USDC = 1,000 points)</li>
              <li>Lower liquidation risk than volatile assets</li>
            </ul>
          </div>
        );
      
      case 'NFT':
        return (
          <div className="p-4 bg-purple-900/30 border border-purple-700/50 rounded-lg text-sm">
            <h4 className="font-semibold text-purple-300 mb-2">NFT Bundle Collateral Benefits:</h4>
            <ul className="text-xs text-purple-400/90 space-y-1 list-disc list-inside">
              <li>70% LTV ratio with collection backing</li>
              <li>Kiosk owner capabilities retained</li>
              <li>Oracle-based floor value validation</li>
              <li>Diversified NFT collection support</li>
            </ul>
          </div>
        );
      
      default:
        return null;
    }
  };

  // No wallet connected
  if (!currentWallet) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-white p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">🔗</div>
          <h2 className="text-2xl font-semibold mb-4">Connect Your Wallet</h2>
          <p className="text-gray-400 mb-8 max-w-md">
            Please connect your wallet to create your Partner Capability and start minting Alpha Points.
          </p>
          <div className="bg-background-card rounded-lg p-6 max-w-md mx-auto">
            <h3 className="font-semibold mb-4 text-lg">As a partner, you can:</h3>
            <ul className="text-left text-gray-300 space-y-2 text-sm">
              <li>• Create and manage marketplace perks for users</li>
              <li>• Mint Alpha Points with TVL-backed quotas</li>
              <li>• Earn revenue share from perk claims</li>
              <li>• Track your analytics and performance</li>
              <li>• Benefit from automated revenue recycling for growth</li>
              <li>• Choose from multiple collateral types (SUI, USDC, NFT)</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Onboarding form
  return (
    <div className="h-full flex flex-col max-h-screen overflow-hidden text-white p-4 md:p-6">
      {/* Header */}
      <div className="text-center mb-6 flex-shrink-0">
        <h1 className="text-3xl font-bold mb-1">Become an Alpha Points Partner</h1>
        <p className="text-gray-400">
          Join our partner program with your preferred collateral type to mint Alpha Points and offer exclusive perks.
        </p>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col bg-background-card rounded-lg shadow-lg p-4 md:p-6 overflow-y-auto">
        
        {/* Rules/Disclaimer */}
        <div className="mb-6 p-3 bg-background rounded-lg border border-gray-700 text-center flex-shrink-0">
          <p className="text-xs text-gray-400">
            By joining our partner program, you agree to platform terms. 
            {collateralType === 'USDC' && ' USDC provides stable 100% LTV backing.'}
            {collateralType === 'NFT' && ' NFT collateral maintains kiosk owner capabilities with 70% LTV.'}
            {collateralType === 'SUI' && ' SUI collateral backing varies with market price via oracle.'}
          </p>
        </div>

        {/* Collateral Selection */}
        <div className="mb-6 p-4 bg-background rounded-lg border border-gray-700">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Choose Collateral Type</h3>
          
          <div className="grid grid-cols-3 gap-3">
            <label className="cursor-pointer">
              <input
                type="radio"
                name="collateralType"
                value="SUI"
                checked={collateralType === 'SUI'}
                onChange={() => setCollateralType('SUI')}
                className="sr-only"
              />
              <div className={`p-4 rounded-lg border text-center transition-colors ${
                collateralType === 'SUI' 
                  ? 'border-blue-500 bg-blue-900/20 text-blue-300' 
                  : 'border-gray-600 hover:border-gray-500'
              }`}>
                <div className="text-2xl mb-2">⚡</div>
                <div className="text-sm font-medium">SUI</div>
                <div className="text-xs text-gray-400 mt-1">Native Token</div>
                <div className="text-xs text-blue-400 mt-1">Dynamic LTV</div>
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
              <div className={`p-4 rounded-lg border text-center transition-colors ${
                collateralType === 'USDC' 
                  ? 'border-green-500 bg-green-900/20 text-green-300' 
                  : 'border-gray-600 hover:border-gray-500'
              }`}>
                <div className="text-2xl mb-2">💲</div>
                <div className="text-sm font-medium">USDC</div>
                <div className="text-xs text-gray-400 mt-1">Stable Coin</div>
                <div className="text-xs text-green-400 mt-1">100% LTV</div>
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
              <div className={`p-4 rounded-lg border text-center transition-colors ${
                collateralType === 'NFT' 
                  ? 'border-purple-500 bg-purple-900/20 text-purple-300' 
                  : 'border-gray-600 hover:border-gray-500'
              }`}>
                <div className="text-2xl mb-2">🎨</div>
                <div className="text-sm font-medium">NFT</div>
                <div className="text-xs text-gray-400 mt-1">Collection</div>
                <div className="text-xs text-purple-400 mt-1">70% LTV</div>
              </div>
            </label>
          </div>
        </div>

        {/* Container for Two Columns: Info (Left) and Form (Right) */}
        <div className="flex-grow flex flex-col md:flex-row gap-6 min-h-0">
          
          {/* Information/Benefits (Left Column) */}
          <div className="md:w-2/5 lg:w-1/3 flex flex-col gap-4 flex-shrink-0">
            {/* Dynamic Benefits based on selection */}
            {getCollateralBenefits()}
            
            {/* How It Works */}
            <div className="p-4 bg-background rounded-lg border border-gray-700 text-sm">
              <h4 className="font-semibold text-white mb-2">How It Works</h4>
              <p className="text-xs text-gray-400 mb-2">
                Your collateral determines your minting quotas. Higher collateral means you can offer more valuable perks and mint more Alpha Points.
              </p>
              <p className="text-xs text-gray-400">
                Revenue from your perks automatically reinvests to grow your capabilities, creating a sustainable business model.
              </p>
            </div>
          </div>

          {/* Input Form (Right Column) */}
          <div className="md:w-3/5 lg:w-2/3 flex flex-col">
            <form onSubmit={handleSubmit} className="space-y-5 flex flex-col flex-grow">
              <div className="flex-grow space-y-5">
                {/* Only show Partner Name for SUI and USDC - NFT includes it in collateral inputs */}
                {collateralType !== 'NFT' && (
                <div>
                  <label htmlFor="partnerName" className="block text-sm font-medium text-gray-300 mb-1.5">
                    Partner Name <span className="text-red-400">*</span>
                  </label>
                  <Input
                    type="text"
                    id="partnerName"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    placeholder="Your Company / Project Name"
                    disabled={isPartnerCapLoading}
                    className="w-full text-base"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This name will be displayed in your partner dashboard and associated with your perks.
                  </p>
                </div>
                )}
                
                {renderCollateralInputs()}
              </div>
              
              <Button 
                type="submit" 
                disabled={isPartnerCapLoading || !partnerName.trim()}
                className="w-full py-3 text-base font-semibold mt-auto flex-shrink-0"
              >
                {isPartnerCapLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Creating PartnerCapFlex...
                  </div>
                ) : `Create PartnerCapFlex with ${collateralType}`}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div> 
  );
} 