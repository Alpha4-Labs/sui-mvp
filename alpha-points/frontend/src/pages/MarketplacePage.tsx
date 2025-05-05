// === MarketplacePage.tsx (Modified for SUI Redeem) ===
import React, { useMemo, useState } from 'react';
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useAlphaContext } from '../context/AlphaContext';
import { formatPoints, formatSui } from '../utils/format';
import { MainLayout } from '../layouts/MainLayout';
import { buildRedeemPointsTransaction } from '../utils/transaction';
import { adaptPtbJsonForSignAndExecute } from '../utils/transaction-adapter';

// Define prices for rate calculation
const SUI_PRICE_USD = 3.28;
const ALPHA_POINT_PRICE_USD = 0.10;

export const MarketplacePage: React.FC = () => {
  const { points, setTransactionLoading, refreshData } = useAlphaContext();
  const [redeemAmount, setRedeemAmount] = useState('');
  const [tab, setTab] = useState<'sui' | 'perks'>('sui');

  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  // Calculate the dynamic rate
  const alphaPointsPerSui = useMemo(() => {
    if (ALPHA_POINT_PRICE_USD <= 0) return Infinity; // Avoid division by zero
    return SUI_PRICE_USD / ALPHA_POINT_PRICE_USD;
  }, []); // Empty dependency array, prices are constants

  const handleRedeem = async () => {
    const amountNumber = parseInt(redeemAmount, 10);
    if (!redeemAmount || isNaN(amountNumber) || amountNumber <= 0) {
        console.error("Invalid redeem amount");
        return;
    }
    if (amountNumber > points.available) {
        console.error("Insufficient available points");
        return;
    }

    setTransactionLoading(true);
    try {
      // Build the PTB JSON - This function already targets redeem_points<T>,
      // which works for SUI since Escrow is EscrowVault<SUI>
      const ptbJson = buildRedeemPointsTransaction(redeemAmount);
      const executionInput = adaptPtbJsonForSignAndExecute(ptbJson);
      await signAndExecute(executionInput);
      setRedeemAmount('');
      refreshData();
    } catch (error) {
      console.error('Error redeeming points for SUI:', error);
    } finally {
      setTransactionLoading(false);
    }
  };

  // Calculate estimated SUI receive amount
  const estimatedSuiReceive = useMemo(() => {
    const amountNum = parseInt(redeemAmount, 10);
    if (!isNaN(amountNum) && amountNum > 0 && isFinite(alphaPointsPerSui) && alphaPointsPerSui > 0) {
      return amountNum / alphaPointsPerSui;
    }
    return 0;
  }, [redeemAmount, alphaPointsPerSui]);

  return (
    <MainLayout>
       <div className="text-center mb-8">
         <h1 className="text-3xl font-bold text-white mb-2">Marketplace</h1>
         <p className="text-gray-400">Spend your Alpha Points.</p>
       </div>

       <div className="bg-background-card rounded-lg shadow-lg mb-6">
         {/* Tabs */}
         <div className="flex justify-center p-4 border-b border-gray-700">
             <div className="inline-flex rounded-md bg-background p-1">
                 <button
                     onClick={() => setTab('sui')}
                     className={`px-6 py-2 rounded-md transition-colors ${
                         tab === 'sui' ? 'bg-primary text-white' : 'text-gray-300 hover:bg-gray-700'
                     }`}
                 >
                    <span className="flex items-center">
                       <span className="font-bold text-lg mr-2">S</span>
                       Redeem for SUI
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

           {/* Redeem for SUI Tab */}
           {tab === 'sui' && (
             <div>
               <h2 className="text-xl font-semibold text-white text-center mb-4">Redeem Alpha Points for SUI</h2>
               <div className="text-center text-gray-300 mb-6">
                 Current Rate: {alphaPointsPerSui.toFixed(2)} αP / SUI
               </div>
               <div className="mb-4">
                 <label className="block text-gray-400 mb-1 text-sm">Points to Spend (αP)</label>
                 <input
                   type="text"
                   inputMode="numeric"
                   pattern="[0-9]*"
                   value={redeemAmount}
                   onChange={(e) => setRedeemAmount(e.target.value.replace(/[^0-9]/g, ''))}
                   placeholder={`e.g., ${alphaPointsPerSui.toFixed(0)}`}
                   className="w-full bg-background-input rounded p-3 text-white border border-gray-600 focus:border-primary focus:ring-primary"
                 />
                 {estimatedSuiReceive > 0 && (
                    <div className="text-xs text-gray-400 mt-1 text-right">
                        ≈ {formatSui(estimatedSuiReceive.toString(), 4)} SUI
                    </div>
                 )}
               </div>
               <button
                 onClick={handleRedeem}
                 disabled={!redeemAmount || parseInt(redeemAmount) <= 0 || parseInt(redeemAmount) > points.available}
                 className="w-full bg-primary hover:bg-primary-dark text-white py-3 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
               >
                 Redeem {formatPoints(redeemAmount || '0', 0)} αP
               </button>
               <div className="text-xs text-gray-500 mt-3 text-center">
                 Requires contract SUI balance in Escrow Vault. Network fees apply.
               </div>
             </div>
           )}

           {/* Alpha Perks Tab */}
           {tab === 'perks' && (
              <div>
                  <h2 className="text-xl font-semibold text-white text-center mb-6">Alpha Perks</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Perks data */}
                    {[
                      { name: 'Trading Fee Discount', cost: '5,000 αP', image: '🔄', comingSoon: true },
                      { name: 'Early Access Features', cost: '10,000 αP', image: '🔑', comingSoon: true },
                      { name: 'NFT Whitelist Spot', cost: '25,000 αP', image: '🎨', comingSoon: true },
                      { name: 'Governance Voting Power', cost: '50,000 αP', image: '🗳️', comingSoon: true },
                    ].map((perk, index) => (
                      <div key={index} className="border border-gray-700 rounded-lg p-4 flex items-center bg-background-input opacity-70 cursor-not-allowed">
                        <div className="w-12 h-12 flex items-center justify-center bg-background rounded-full mr-4 text-2xl">{perk.image}</div>
                        <div>
                          <h3 className="text-white font-medium">{perk.name}</h3>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-secondary text-sm">{perk.cost}</span>
                            {perk.comingSoon && <span className="text-xs bg-gray-600 text-gray-300 px-2 py-0.5 rounded">Coming Soon</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                 </div>
              </div>
           )}
         </div>
       </div>
    </MainLayout>
  );
};