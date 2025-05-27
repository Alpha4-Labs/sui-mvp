// === MarketplacePage.tsx (Modified for SUI Redeem) ===
import React, { useMemo, useState } from 'react';
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useAlphaContext } from '../context/AlphaContext';
import { formatPoints, formatSui } from '../utils/format';
import { MainLayout } from '../layouts/MainLayout';
import { buildRedeemPointsTransaction } from '../utils/transaction';
import { adaptPtbJsonForSignAndExecute } from '../utils/transaction-adapter';
import suiLogo from '../assets/sui-logo.jpg';

// Define prices for rate calculation
const SUI_PRICE_USD = 3.28;
const ALPHA_POINT_PRICE_USD = 3.28 / 1191360; // Approx. 0.000002753 target rate for 1,191,360 αP / SUI

// --- Crypto Redemption Card Component ---
interface CryptoRedemptionCardProps {
  cryptoName: string;
  icon?: React.ReactNode; // Optional icon
  exchangeRateText: string; // e.g., "32.80 αP / SUI"
  pointsAvailable: number;
  onRedeem: (amount: string) => Promise<void>; // Async function for handling redeem
  tooltip?: string; // Optional tooltip for caution/info
}

const CryptoRedemptionCard: React.FC<CryptoRedemptionCardProps> = ({
  cryptoName,
  icon,
  exchangeRateText,
  pointsAvailable,
  onRedeem,
  tooltip,
}) => {
  const [redeemAmount, setRedeemAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Basic calculation for estimated crypto receive amount (can be enhanced)
  const estimatedCryptoReceive = useMemo(() => {
    const amountNum = parseInt(redeemAmount, 10);
    // Extract rate from text like "32.80 αP / SUI"
    const rateMatch = exchangeRateText.match(/^([\d.]+)\s+αP/);
    const pointsPerCrypto = rateMatch ? parseFloat(rateMatch[1]) : Infinity;

    if (!isNaN(amountNum) && amountNum > 0 && isFinite(pointsPerCrypto) && pointsPerCrypto > 0) {
      return amountNum / pointsPerCrypto;
    }
    return 0;
  }, [redeemAmount, exchangeRateText]);

  const handleRedeemClick = async () => {
    const amountNumber = parseInt(redeemAmount, 10);
    if (!redeemAmount || isNaN(amountNumber) || amountNumber <= 0) {
        setError("Please enter a valid amount.");
        return;
    }
    if (amountNumber > pointsAvailable) {
        setError("Insufficient available points.");
        return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await onRedeem(redeemAmount);
      setRedeemAmount(''); // Clear input on success
    } catch (err: any) {
      console.error(`Error redeeming for ${cryptoName}:`, err);
      setError(err.message || `Failed to redeem points for ${cryptoName}.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border border-gray-700 rounded-lg p-3 bg-background-input space-y-2 text-center">
      <h3 className="text-base font-semibold text-white flex items-center justify-center gap-1 relative">
        {icon && <span className="mr-2 text-lg">{icon}</span>}
        {cryptoName}
        {tooltip && (
          <span className="relative group ml-1 flex items-center">
            {/* Caution Triangle SVG */}
            <svg
              className="w-4 h-4 text-yellow-400 inline-block cursor-pointer"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              style={{ color: '#fbbf24' }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4l8.66 15H3.34L12 4z"
                fill="#fbbf24"
                stroke="#b45309"
              />
              <circle cx="12" cy="17" r="1" fill="#b45309" />
              <rect x="11.25" y="9" width="1.5" height="5" rx="0.75" fill="#b45309" />
            </svg>
            {/* Tooltip */}
            <span className="absolute left-1/2 z-20 -translate-x-1/2 bottom-full mb-2 w-64 bg-background-card border border-yellow-500 text-yellow-200 text-xs rounded shadow-lg px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-normal text-left">
              {tooltip}
            </span>
          </span>
        )}
      </h3>
      {error && (
        <div className="p-1.5 text-xs bg-red-900/30 border border-red-700 rounded-md text-red-400 break-words text-left">
           {error}
        </div>
      )}
      <div className="text-xs text-gray-300">
        Rate: {exchangeRateText}
      </div>
      <div className="text-left">
        <label className="block text-gray-400 mb-1 text-xs flex items-center justify-between">
          <span>Points to Spend (αP)</span>
          <span className="flex space-x-1">
            {[25, 50, 75, 100].map((pct, idx) => {
              const pctValue = Math.floor(pointsAvailable * pct / 100);
              const isSelected =
                redeemAmount !== '' &&
                parseInt(redeemAmount, 10) === pctValue;
              return (
                <button
                  key={pct}
                  type="button"
                  className={`text-xs px-1.5 py-0.5 rounded border border-gray-600 transition-colors ${
                    isSelected
                      ? 'bg-primary text-white'
                      : 'bg-background text-gray-300 hover:bg-primary hover:text-white'
                  }${idx !== 0 ? ' ml-1' : ''}`}
                  style={{ minWidth: 0 }}
                  onClick={() => setRedeemAmount(pctValue.toString())}
                  disabled={isLoading || pointsAvailable === 0}
                >
                  {pct}%
                </button>
              );
            })}
          </span>
        </label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={redeemAmount}
          onChange={(e) => setRedeemAmount(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder={`Available: ${formatPoints(pointsAvailable)} αP`}
          className="w-full bg-background rounded p-1.5 text-white border border-gray-600 focus:border-primary focus:ring-primary text-xs"
          disabled={isLoading}
        />
        {estimatedCryptoReceive > 0 && (
          <div className="text-xs text-gray-400 mt-1 text-right">
            ≈ {estimatedCryptoReceive.toFixed(4)} {cryptoName}
          </div>
        )}
      </div>
      <button
        onClick={handleRedeemClick}
        disabled={isLoading || !redeemAmount || parseInt(redeemAmount) <= 0 || parseInt(redeemAmount) > pointsAvailable}
        className="w-full bg-primary hover:bg-primary-dark text-white py-1.5 px-2.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium relative"
      >
        {isLoading ? (
          <>
            <span className="opacity-0">Redeeming...</span> {/* Keep layout */}
            <span className="absolute inset-0 flex items-center justify-center">
              <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </span>
          </>
        ) : (
          `Redeem ${formatPoints(redeemAmount || '0', 0)} αP`
        )}
      </button>
    </div>
  );
};
// --- End Card Component ---

export const MarketplacePage: React.FC = () => {
  const { points, setTransactionLoading, refreshData } = useAlphaContext();
  const [tab, setTab] = useState<'crypto' | 'perks'>('crypto'); // Changed 'sui' to 'crypto'

  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  // Calculate the dynamic rate
  const alphaPointsPerSui = useMemo(() => {
    if (ALPHA_POINT_PRICE_USD <= 0) return Infinity; // Avoid division by zero
    return SUI_PRICE_USD / ALPHA_POINT_PRICE_USD;
  }, []); // Empty dependency array, prices are constants

  const handleRedeemSui = async (amountToRedeem: string) => {
    // This function is now passed to the Card component's onRedeem prop
    setTransactionLoading(true);
    try {
      const ptbJson = buildRedeemPointsTransaction(amountToRedeem);
      const executionInput = adaptPtbJsonForSignAndExecute(ptbJson);
      signAndExecute({ transaction: executionInput.transaction }); 
      refreshData(); // Refresh data after successful execution
    } catch (error) {
      console.error('Error redeeming points for SUI:', error);
      // Let the card component handle displaying the error
      throw error; // Re-throw error so card can catch it
    } finally {
      setTransactionLoading(false);
    }
  };

  return (
     <>
       <div className="text-center mb-8">
         <h1 className="text-3xl font-bold text-white mb-2">Marketplace</h1>
         <p className="text-gray-400">Spend your Alpha Points.</p>
       </div>

       <div className="bg-background-card rounded-lg shadow-lg mb-6">
         {/* Tabs */}
         <div className="flex justify-center p-4 border-b border-gray-700">
             <div className="inline-flex rounded-md bg-background p-1">
                 <button
                     onClick={() => setTab('crypto')} // Changed 'sui' to 'crypto'
                     className={`px-6 py-2 rounded-md transition-colors ${ 
                         tab === 'crypto' ? 'bg-primary text-white' : 'text-gray-300 hover:bg-gray-700'
                     }`}
                 >
                    <span className="flex items-center">
                       {/* Placeholder Crypto Icon */}
                       <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-2.47 5.227 7.917-3.286-.672Zm-7.518-.267A8.25 8.25 0 1 1 20.25 10.5M8.288 14.212A5.25 5.25 0 1 1 17.25 10.5" />
                       </svg>
                       Redeem for Crypto {/* Renamed Tab Label */}
                    </span>
                 </button>
                 <button
                     onClick={() => setTab('perks')}
                     className={`px-6 py-2 rounded-md transition-colors ${ 
                         tab === 'perks' ? 'bg-primary text-white' : 'text-gray-300 hover:bg-gray-700'
                     }`}
                 >
                     <span className="flex items-center">
                       <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 11.5L12.9 3.4C12.4 2.9 11.6 2.9 11.1 3.4L3 11.5H7V20.5H17V11.5H21Z" fill="currentColor"/></svg>
                       Alpha Perks (Simulated)
                    </span>
                 </button>
             </div>
         </div>

         {/* Tab Content */}
         <div className="p-6">
            <div className="bg-background rounded-lg p-4 mb-6 text-center">
                <span className="text-gray-400 mr-2">Available Balance:</span>
                <span className="text-xl font-semibold text-secondary">{formatPoints(points.available)} αP</span>
            </div>

           {/* Redeem for Crypto Tab */}
           {tab === 'crypto' && (
             <div>
               <h2 className="text-xl font-semibold text-white text-center mb-6">Redeem Alpha Points for Crypto</h2>
               
               {/* Cards for each crypto */}
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                 {/* SUI Redemption Card */}
                 <CryptoRedemptionCard
                    cryptoName="Sui"
                    icon={<img src={suiLogo} alt="Sui Logo" className="w-6 h-6 rounded-full object-cover" />}
                    exchangeRateText={`${alphaPointsPerSui.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} αP / SUI`}
                    pointsAvailable={points.available}
                    onRedeem={handleRedeemSui}
                    tooltip="During the testnet phase, there are no assurances that the conversion transaction will reward sufficient testnet Sui due to faucet limitations."
                 />
                 
                 {/* Placeholder for Avalanche */}
                 <div className="border border-dashed border-gray-600 rounded-lg p-3 bg-background-input flex flex-col justify-center items-center text-center text-gray-500 min-h-[160px]">
                    <span className="text-xl mb-1.5">AVAX</span>
                    <span>Avalanche Coming Soon</span>
                    <span className="text-xs mt-1">Rate: TBD</span>
                 </div>

                 {/* Placeholder for ETH */}
                 <div className="border border-dashed border-gray-600 rounded-lg p-3 bg-background-input flex flex-col justify-center items-center text-center text-gray-500 min-h-[160px]">
                    <span className="text-xl mb-1.5">ETH</span>
                    <span>Ethereum Coming Soon</span>
                    <span className="text-xs mt-1">Rate: TBD</span>
                 </div>

                 {/* Placeholder for USDC */}
                 <div className="border border-dashed border-gray-600 rounded-lg p-3 bg-background-input flex flex-col justify-center items-center text-center text-gray-500 min-h-[160px]">
                    <span className="text-xl mb-1.5">USDC</span>
                    <span>USDC Coming Soon</span>
                    <span className="text-xs mt-1">Rate: TBD</span>
                 </div>

                 {/* Placeholder for Solana */}
                 <div className="border border-dashed border-gray-600 rounded-lg p-3 bg-background-input flex flex-col justify-center items-center text-center text-gray-500 min-h-[160px]">
                    <span className="text-xl mb-1.5">SOL</span>
                    <span>Solana Coming Soon</span>
                    <span className="text-xs mt-1">Rate: TBD</span>
                 </div>

                 {/* Placeholder for other cryptos */}
                 <div className="border border-dashed border-gray-600 rounded-lg p-3 bg-background-input flex flex-col justify-center items-center text-center text-gray-500 min-h-[160px]">
                    <span className="text-xl mb-1.5">?</span>
                    <span>More Cryptos Soon</span>
                    <span className="text-xs mt-1">Rate: TBD</span>
                 </div>

               </div>
               
               {/* Generalized Text Added Below Grid */}
               <div className="text-xs text-gray-400 mt-6 text-center px-4"> 
                 Alpha Points allows you to unlock cryptocurrency assets on native chains. Each cryptocurrency has its own exchange rate, based on market values, and will be dynamically discerned via oracles. Additionally this cross-chain system will be available later. Network fees apply.
               </div>
             </div>
           )}

           {/* Alpha Perks Tab */}
           {tab === 'perks' && (
              <div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Perks data */}
                    {[
                      {
                        name: 'Trading Fee Discount',
                        cost: '500,000 αP',
                        image: '🔄',
                        description: 'Reduce your trading fees on Alpha4 partner platforms for a set period.'
                      },
                      {
                        name: 'Early Access Features',
                        cost: '1,000,000 αP',
                        image: '🔑',
                        description: 'Unlock beta features and new dApps before public release.'
                      },
                      {
                        name: 'NFT Whitelist Spot',
                        cost: '2,500,000 αP',
                        image: '🎨',
                        description: 'Secure a guaranteed spot in upcoming NFT mints from Alpha4 partners.'
                      },
                      {
                        name: 'Governance Voting Power',
                        cost: '5,000,000 αP',
                        image: '🗳️',
                        description: 'Boost your influence in Alpha4 and partner protocol governance votes.'
                      },
                      {
                        name: 'Partner Airdrop Access',
                        cost: '1,500,000 αP',
                        image: '🎁',
                        description: 'Qualify for exclusive airdrops from Alpha4 ecosystem partners.'
                      },
                      {
                        name: 'Premium Support',
                        cost: '800,000 αP',
                        image: '💬',
                        description: 'Get priority support and faster response times from the Alpha4 team.'
                      },
                      {
                        name: 'Merchandise Voucher',
                        cost: '2,000,000 αP',
                        image: '👕',
                        description: 'Redeem for limited edition Alpha4 or partner merchandise.'
                      },
                      {
                        name: 'Event Pass',
                        cost: '3,000,000 αP',
                        image: '🎟️',
                        description: 'Gain access to exclusive online or in-person Alpha4 events.'
                      },
                    ].map((perk, index) => (
                      <div key={index} className="border border-gray-700 rounded-lg p-4 flex items-center bg-background-input opacity-90 cursor-not-allowed">
                        <div className="w-12 h-12 flex items-center justify-center bg-background rounded-full mr-4 text-2xl">{perk.image}</div>
                        <div className="flex-1">
                          <h3 className="text-white font-medium flex items-center gap-1">{perk.name}</h3>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-secondary text-sm">{perk.cost}</span>
                            <span className="text-xs text-gray-400 ml-2 text-right">{perk.description}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                 </div>
                 {/* Disclaimer Added Here */}
                 <div className="mt-6 pt-4 border-t border-gray-700 text-xs text-gray-400 text-center italic">
                   Disclaimer: The perks shown here are conceptual, meant to articulate some, not all, possibilities that Alpha Points can be used by the Alpha4 platform and by partnering teams to extend the Alpha Points ecosystem.
                 </div>
              </div>
           )}
         </div>
       </div>
    </>
  );
};