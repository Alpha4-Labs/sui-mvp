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
    const pointsPerCrypto = rateMatch && rateMatch[1] ? parseFloat(rateMatch[1]) : Infinity;

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
    <div className="card-modern p-6 space-y-4 text-center animate-fade-in">
      <div className="flex items-center justify-center space-x-3 mb-4">
        {icon && <span className="text-2xl">{icon}</span>}
        <h3 className="text-lg font-semibold text-white">{cryptoName}</h3>
        {tooltip && (
          <div className="relative group">
            <div className="w-5 h-5 bg-amber-500/20 rounded-full flex items-center justify-center cursor-pointer">
              <svg className="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="absolute left-1/2 z-20 -translate-x-1/2 bottom-full mb-2 w-64 bg-black/80 backdrop-blur-lg border border-amber-500/30 text-amber-200 text-xs rounded-xl shadow-2xl px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-normal text-left">
              {tooltip}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="bg-black/20 rounded-lg p-3 border border-white/5">
        <div className="text-sm text-gray-400 mb-2">Exchange Rate</div>
        <div className="text-purple-400 font-medium">{exchangeRateText}</div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Points to Spend (αP)</span>
          <div className="flex space-x-1">
            {[25, 50, 75, 100].map((pct) => {
              const pctValue = Math.floor(pointsAvailable * pct / 100);
              const isSelected = redeemAmount !== '' && parseInt(redeemAmount, 10) === pctValue;
              return (
                <button
                  key={pct}
                  type="button"
                  className={`text-xs px-2 py-1 rounded-lg border transition-all duration-300 ${
                    isSelected
                      ? 'bg-purple-600 border-purple-500 text-white'
                      : 'border-white/10 text-gray-300 hover:bg-purple-600/20 hover:border-purple-500/50'
                  }`}
                  onClick={() => setRedeemAmount(pctValue.toString())}
                  disabled={isLoading || pointsAvailable === 0}
                >
                  {pct}%
                </button>
              );
            })}
          </div>
        </div>

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

  };

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400 text-transparent bg-clip-text mb-4">
          Marketplace
        </h1>
        <p className="text-gray-400 text-lg">Spend your Alpha Points.</p>
      </div>

      <div className="card-modern p-8 mb-8 animate-slide-up">
        {/* Tabs */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-xl bg-black/20 backdrop-blur-lg border border-white/10 p-1.5 shadow-xl">
            <button
              onClick={() => setTab('crypto')}
              className={`px-6 py-3 rounded-lg transition-all duration-300 flex items-center space-x-2 ${ 
                tab === 'crypto' 
                  ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/25' 
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-2.47 5.227 7.917-3.286-.672Zm-7.518-.267A8.25 8.25 0 1 1 20.25 10.5M8.288 14.212A5.25 5.25 0 1 1 17.25 10.5" />
              </svg>
              <span className="font-medium">Redeem for Crypto</span>
            </button>
            <button
              onClick={() => setTab('perks')}
              className={`px-6 py-3 rounded-lg transition-all duration-300 flex items-center space-x-2 ${ 
                tab === 'perks' 
                  ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/25' 
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 11.5L12.9 3.4C12.4 2.9 11.6 2.9 11.1 3.4L3 11.5H7V20.5H17V11.5H21Z" fill="currentColor"/>
              </svg>
              <span className="font-medium">Alpha Perks</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="animate-slide-up animation-delay-100">
          {tab === 'crypto' && (
            <div>
              <h2 className="text-xl font-semibold text-white text-center mb-8">Redeem Alpha Points for Crypto</h2>
              
              {/* Cards for each crypto */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* SUI Redemption Card - replaced with warning */}
                <div className="bg-amber-500/10 backdrop-blur-lg border border-amber-500/30 rounded-xl p-6 flex flex-col justify-center items-center text-center min-h-[200px] relative hover:bg-amber-500/20 transition-all duration-300">
                  <div className="flex items-center mb-4">
                    <img src={suiLogo} alt="Sui Logo" className="w-8 h-8 rounded-full object-cover mr-3" />
                    <span className="text-xl font-semibold text-amber-300">Sui</span>
                    <svg className="w-6 h-6 text-amber-400 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <button
                    className="w-full bg-amber-500/20 text-amber-300 font-semibold py-3 px-6 rounded-lg cursor-not-allowed flex items-center justify-center border border-amber-500/30 relative group"
                    disabled
                    style={{ pointerEvents: 'auto' }}
                  >
                    <span className="flex items-center">
                      <svg className="w-5 h-5 text-amber-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      Testnet Faucet Limitation
                    </span>
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-80 bg-black/90 backdrop-blur-lg border border-amber-500/30 text-amber-200 text-sm rounded-xl shadow-2xl px-4 py-3 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-normal text-left z-20">
                      During the testnet phase, there are no assurances that the conversion transaction will reward sufficient testnet Sui due to faucet limitations.
                    </div>
                  </button>
                </div>
                
                {/* Placeholder for Avalanche */}
                <div className="bg-black/20 backdrop-blur-lg border border-dashed border-gray-600/50 rounded-xl p-6 flex flex-col justify-center items-center text-center text-gray-500 min-h-[200px] hover:bg-black/30 transition-all duration-300">
                  <div className="w-16 h-16 bg-gray-600/20 rounded-2xl flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold">AVAX</span>
                  </div>
                  <span className="text-lg font-medium mb-2">Avalanche</span>
                  <span className="text-sm text-gray-400">Coming Soon</span>
                  <span className="text-xs text-gray-500 mt-1">Rate: TBD</span>
                </div>

                {/* Placeholder for ETH */}
                <div className="bg-black/20 backdrop-blur-lg border border-dashed border-gray-600/50 rounded-xl p-6 flex flex-col justify-center items-center text-center text-gray-500 min-h-[200px] hover:bg-black/30 transition-all duration-300">
                  <div className="w-16 h-16 bg-gray-600/20 rounded-2xl flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold">ETH</span>
                  </div>
                  <span className="text-lg font-medium mb-2">Ethereum</span>
                  <span className="text-sm text-gray-400">Coming Soon</span>
                  <span className="text-xs text-gray-500 mt-1">Rate: TBD</span>
                </div>

                {/* Placeholder for USDC */}
                <div className="bg-black/20 backdrop-blur-lg border border-dashed border-gray-600/50 rounded-xl p-6 flex flex-col justify-center items-center text-center text-gray-500 min-h-[200px] hover:bg-black/30 transition-all duration-300">
                  <div className="w-16 h-16 bg-gray-600/20 rounded-2xl flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold">USDC</span>
                  </div>
                  <span className="text-lg font-medium mb-2">USD Coin</span>
                  <span className="text-sm text-gray-400">Coming Soon</span>
                  <span className="text-xs text-gray-500 mt-1">Rate: TBD</span>
                </div>

                {/* Placeholder for Solana */}
                <div className="bg-black/20 backdrop-blur-lg border border-dashed border-gray-600/50 rounded-xl p-6 flex flex-col justify-center items-center text-center text-gray-500 min-h-[200px] hover:bg-black/30 transition-all duration-300">
                  <div className="w-16 h-16 bg-gray-600/20 rounded-2xl flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold">SOL</span>
                  </div>
                  <span className="text-lg font-medium mb-2">Solana</span>
                  <span className="text-sm text-gray-400">Coming Soon</span>
                  <span className="text-xs text-gray-500 mt-1">Rate: TBD</span>
                </div>

                {/* Placeholder for other cryptos */}
                <div className="bg-black/20 backdrop-blur-lg border border-dashed border-gray-600/50 rounded-xl p-6 flex flex-col justify-center items-center text-center text-gray-500 min-h-[200px] hover:bg-black/30 transition-all duration-300">
                  <div className="w-16 h-16 bg-gray-600/20 rounded-2xl flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold">?</span>
                  </div>
                  <span className="text-lg font-medium mb-2">More Cryptos</span>
                  <span className="text-sm text-gray-400">Coming Soon</span>
                  <span className="text-xs text-gray-500 mt-1">Rate: TBD</span>
                </div>
              </div>
              
              {/* Generalized Text Added Below Grid */}
              <div className="mt-8 pt-6 border-t border-white/10 text-center"> 
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 max-w-4xl mx-auto">
                  <p className="text-blue-300 text-sm leading-relaxed">
                    Alpha Points allows you to unlock cryptocurrency assets on native chains. Each cryptocurrency has its own exchange rate, based on market values, and will be dynamically discerned via oracles. Additionally this cross-chain system will be available later. Network fees apply.
                  </p>
                </div>
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
    </div>
  );
};