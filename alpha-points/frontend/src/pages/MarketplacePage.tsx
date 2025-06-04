// === MarketplacePage.tsx (Modified for SUI Redeem & Modal-based Role Perk Purchase) ===
import React, { useMemo, useState, useEffect } from 'react';
import { useSignAndExecuteTransaction, useCurrentAccount } from '@mysten/dapp-kit';
import { useAlphaContext } from '../context/AlphaContext';
import { formatPoints, formatSui } from '../utils/format';
import { MainLayout } from '../layouts/MainLayout';
import { buildRedeemPointsTransaction } from '../utils/transaction';
import { AlphaPerksMarketplace } from '../components/AlphaPerksMarketplace';
import suiLogo from '../assets/sui-logo.jpg';
import { toast } from 'react-toastify';

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
  const currentAccount = useCurrentAccount();
  const [tab, setTab] = useState<'crypto' | 'perks'>('crypto');

  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const alphaPointsPerSui = useMemo(() => {
    if (ALPHA_POINT_PRICE_USD <= 0) return Infinity;
    return SUI_PRICE_USD / ALPHA_POINT_PRICE_USD;
  }, []);

  const handleRedeemSui = async (amountToRedeem: string) => {
    setTransactionLoading(true);
    try {
      const tx = buildRedeemPointsTransaction(amountToRedeem);
      await signAndExecute({ transaction: tx });
      refreshData();
      toast.success(`Successfully redeemed ${formatPoints(amountToRedeem)} Alpha Points for SUI!`);
    } catch (error: any) {
      console.error('Error redeeming points for SUI:', error);
      toast.error(error.message || 'Failed to redeem points for SUI.');
      throw error;
    } finally {
      setTransactionLoading(false);
    }
  };

  const handlePerkPurchase = (perk: any) => {
    // Optional callback when a perk is purchased
    console.log('Perk purchased:', perk.name);
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
                     onClick={() => setTab('crypto')}
                     className={`px-6 py-2 rounded-md transition-colors ${ 
                         tab === 'crypto' ? 'bg-primary text-white' : 'text-gray-300 hover:bg-gray-700'
                     }`}
                 >
                    <span className="flex items-center">
                       <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-2.47 5.227 7.917-3.286-.672Zm-7.518-.267A8.25 8.25 0 1 1 20.25 10.5M8.288 14.212A5.25 5.25 0 1 1 17.25 10.5" />
                       </svg>
                       Redeem for Crypto
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
                       Alpha Perks
                    </span>
                 </button>
             </div>
         </div>

         {/* Tab Content */}
         <div className="p-6">
           {tab === 'crypto' && (
             <div>
               <h2 className="text-xl font-semibold text-white text-center mb-6">Redeem Alpha Points for Crypto</h2>
               
               {/* Cards for each crypto */}
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                 {/* SUI Redemption Card - replaced with warning */}
                 <div className="border border-yellow-500 rounded-lg p-3 bg-yellow-900/20 flex flex-col justify-center items-center text-center min-h-[160px] relative">
                   <div className="flex items-center mb-2">
                     <img src={suiLogo} alt="Sui Logo" className="w-6 h-6 rounded-full object-cover mr-2" />
                     <span className="text-lg font-semibold text-yellow-300">Sui</span>
                     <svg className="w-5 h-5 text-yellow-400 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4l8.66 15H3.34L12 4z" fill="#fbbf24" stroke="#b45309" />
                       <circle cx="12" cy="17" r="1" fill="#b45309" />
                       <rect x="11.25" y="9" width="1.5" height="5" rx="0.75" fill="#b45309" />
                     </svg>
                   </div>
                   <button
                     className="w-full bg-yellow-500 text-yellow-900 font-semibold py-2 px-4 rounded-md cursor-not-allowed flex items-center justify-center mt-2 relative group"
                     disabled
                     style={{ pointerEvents: 'auto' }}
                   >
                     <span className="flex items-center">
                       <svg className="w-4 h-4 text-yellow-700 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4l8.66 15H3.34L12 4z" fill="#fbbf24" stroke="#b45309" />
                         <circle cx="12" cy="17" r="1" fill="#b45309" />
                         <rect x="11.25" y="9" width="1.5" height="5" rx="0.75" fill="#b45309" />
                       </svg>
                       Testnet Faucet Limitation
                     </span>
                     <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 bg-yellow-100 border border-yellow-500 text-yellow-900 text-xs rounded shadow-lg px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-normal text-left z-20">
                       During the testnet phase, there are no assurances that the conversion transaction will reward sufficient testnet Sui due to faucet limitations.
                     </span>
                   </button>
                 </div>
                 
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

           {tab === 'perks' && (
             <AlphaPerksMarketplace 
               userPoints={points.available}
               onPerkPurchase={handlePerkPurchase}
             />
           )}
         </div>
       </div>
    </>
  );
};