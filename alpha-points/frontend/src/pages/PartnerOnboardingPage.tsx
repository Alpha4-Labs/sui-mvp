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

export function PartnerOnboardingPage({ onPartnerCreated }: PartnerOnboardingPageProps = { onPartnerCreated: undefined }) {
  const { currentWallet } = useCurrentWallet();
  const navigate = useNavigate();
  const { setMode, setPartnerCaps } = useAlphaContext();
  const {
    createPartnerCapFlex,
    isLoading: isPartnerCapLoading,
    error: partnerCapError,
    transactionDigest: partnerCapTxDigest,
  } = usePartnerOnboarding();

  const [partnerName, setPartnerName] = useState('');
  const [suiAmount, setSuiAmount] = useState('');

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
            console.log('🚀 Starting partner detection after creation...');
            toast.info('🔍 Detecting your new Partner Capability...', { autoClose: 3000 });
            
            // First, detect the partner caps to get the fresh data
            const detectedCaps = await onPartnerCreated();
            
            // If we got caps back (function returns caps) or if onPartnerCreated is a detection function
            if (Array.isArray(detectedCaps) && detectedCaps.length > 0) {
              console.log('✅ Detection successful, switching to partner mode...');
              // Update global state with the detected caps
              setPartnerCaps(detectedCaps);
              // Switch to partner mode
              setMode('partner');
              // Navigate to partner dashboard
              navigate('/partners/overview');
              toast.success('Welcome to your Partner Dashboard! 🎉');
            } else {
              console.log('⚠️ No caps detected, trying fallback approach...');
              // If onPartnerCreated doesn't return caps, call it anyway and assume it will trigger detection
              onPartnerCreated();
              // Give it a longer moment for the context to update, then try to switch mode
              setTimeout(() => {
                console.log('🔄 Attempting fallback navigation...');
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
    
    await createPartnerCapFlex(partnerName.trim(), suiAmountMist);
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
          Join our partner program to mint Alpha Points and offer exclusive perks to your community.
        </p>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col bg-background-card rounded-lg shadow-lg p-4 md:p-6 overflow-y-auto">
        
        {/* Rules/Disclaimer */}
        <div className="mb-6 p-3 bg-background rounded-lg border border-gray-700 text-center flex-shrink-0">
          <p className="text-xs text-gray-400">
            By joining our partner program, you agree to platform terms and understand that SUI collateral is required to back your minting capabilities.
          </p>
        </div>

        {/* Container for Two Columns: Info (Left) and Form (Right) */}
        <div className="flex-grow flex flex-col md:flex-row gap-6 min-h-0">
          
          {/* Information/Benefits (Left Column) */}
          <div className="md:w-2/5 lg:w-1/3 flex flex-col gap-4 flex-shrink-0">
            {/* Partner Benefits */}
            <div className="p-4 bg-green-900/30 border border-green-700/50 rounded-lg text-sm">
              <h4 className="font-semibold text-green-300 mb-2">Partner Benefits:</h4>
              <ul className="text-xs text-green-400/90 space-y-1 list-disc list-inside">
                <li>TVL-backed quotas: Approx. 1,000 Alpha Points per 1 USDC value of SUI locked.</li>
                <li>Daily mint limits: Up to 3% of your TVL value per day.</li>
                <li>Revenue sharing: 70% of perk revenue goes to you, 20% reinvested for growth.</li>
                <li>Automated growth: Revenue automatically increases your earning potential.</li>
                <li>Analytics dashboard: Track performance and optimize your offerings.</li>
              </ul>
            </div>
            
            {/* Additional Info */}
            <div className="p-4 bg-background rounded-lg border border-gray-700 text-sm">
              <h4 className="font-semibold text-white mb-2">How It Works</h4>
              <p className="text-xs text-gray-400 mb-2">
                Your SUI collateral determines your minting quotas. Higher collateral means you can offer more valuable perks and mint more Alpha Points.
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
              </div>
              
              <Button 
                type="submit" 
                disabled={isPartnerCapLoading || !partnerName.trim() || !suiAmount.trim()}
                className="w-full py-3 text-base font-semibold mt-auto flex-shrink-0"
              >
                {isPartnerCapLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Joining Partner Program...
                  </div>
                ) : 'Join Partner Program'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div> 
  );
} 