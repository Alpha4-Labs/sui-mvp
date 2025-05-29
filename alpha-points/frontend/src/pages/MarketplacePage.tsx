// === MarketplacePage.tsx (Modified for SUI Redeem) ===
import React, { useMemo, useState, useEffect } from 'react';
import { useSignAndExecuteTransaction, useCurrentAccount } from '@mysten/dapp-kit';
import { useAlphaContext } from '../context/AlphaContext';
import { formatPoints, formatSui } from '../utils/format';
import { MainLayout } from '../layouts/MainLayout';
import { buildRedeemPointsTransaction, buildPurchaseAlphaPerkTransaction } from '../utils/transaction';
import { adaptPtbJsonForSignAndExecute } from '../utils/transaction-adapter';
import suiLogo from '../assets/sui-logo.jpg';
import { DiscordHandleModal } from '../components/DiscordHandleModal';
import { PerkFilterModal } from '../components/PerkFilterModal';
import { toast } from 'react-toastify';

// Define prices for rate calculation
const SUI_PRICE_USD = 3.28;
const ALPHA_POINT_PRICE_USD = 3.28 / 1191360; // Approx. 0.000002753 target rate for 1,191,360 αP / SUI

// Define Perk type for clarity
interface Perk {
  name: string;
  id: string;
  cost: string;
  costNumeric: number;
  image: string;
  description: string;
  actionable: boolean;
  partnerCapId?: string; // Optional: for future use if perks have specific partner caps
  tags?: string[]; // Added for filtering
}

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

// Define a list of potential tags - can be expanded
const ALL_POSSIBLE_PERK_TAGS = [
  'Community', 'Discord', 'Role', 'Financial', 'Discount', 'NFT', 'Cosmetic', 
  'Gaming', 'Event', 'Merchandise', 'Access', 'Utility', 'Governance', 
  'Developer', 'RealWorldAsset', 'Platform', 'SaaS', 'Contest', 'EarlyAccess', 'Support'
];

export const MarketplacePage: React.FC = () => {
  const { points, setTransactionLoading, refreshData, address: userAddress, suiClient } = useAlphaContext();
  const currentAccount = useCurrentAccount();
  const [tab, setTab] = useState<'crypto' | 'perks'>('crypto');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPerkForModal, setSelectedPerkForModal] = useState<Perk | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // State for Perk Filtering
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false); // For the filter modal itself

  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const alphaPointsPerSui = useMemo(() => {
    if (ALPHA_POINT_PRICE_USD <= 0) return Infinity;
    return SUI_PRICE_USD / ALPHA_POINT_PRICE_USD;
  }, []);

  const perks: Perk[] = useMemo(() => [
    {
      name: 'Alpha4 Tester Role',
      id: 'alpha4-tester-role',
      cost: '100,000 αP',
      costNumeric: 100000,
      image: '🧪',
      description: 'Gain the exclusive Alpha4 Tester role in Discord and access to private channels.',
      actionable: true,
      tags: ['Community', 'Discord', 'Role', 'Access', 'EarlyAccess']
    },
    {
      name: 'Alpha4 Veteran Role',
      id: 'alpha4-veteran-role',
      cost: '10,000,000 αP',
      costNumeric: 10000000,
      image: '🛡️',
      description: 'Achieve Veteran status in the Alpha4 Discord, showcasing your deep commitment.',
      actionable: true,
      tags: ['Community', 'Discord', 'Role', 'Access']
    },
    {
      name: 'Instant % Discount',
      id: 'instant-percentage-discount',
      cost: '150,000 αP',
      costNumeric: 150000,
      image: '🏷️',
      description: 'Get a dynamic coupon (e.g., 15% off) for your next checkout at partner stores.',
      actionable: false,
      tags: ['Financial', 'Discount', 'Merchandise', 'Utility']
    },
    {
      name: 'Gas-less Trade Pack',
      id: 'gasless-trade-pack',
      cost: '250,000 αP',
      costNumeric: 250000,
      image: '⛽',
      description: 'Receive a bundle of meta-transactions with gas fees sponsored for DEXs or NFT marketplaces.',
      actionable: false,
      tags: ['Financial', 'Utility', 'NFT', 'Platform', 'Developer']
    },
    {
      name: 'Mystery Loot Box',
      id: 'mystery-loot-box',
      cost: '300,000 αP',
      costNumeric: 300000,
      image: '📦',
      description: 'Unlock a surprise! Sui VRF reveals a random NFT or merchandise tier from partners.',
      actionable: false,
      tags: ['NFT', 'Merchandise', 'Gaming', 'Contest']
    },
    {
      name: 'Physical Merch Redemption',
      id: 'physical-merch-redemption',
      cost: '2,000,000 αP',
      costNumeric: 2000000,
      image: '👕',
      description: 'Redeem for exclusive physical items like hoodies, sneakers, or hardware wallets shipped to you.',
      actionable: false,
      tags: ['Merchandise', 'RealWorldAsset', 'Community']
    },
    {
      name: 'Event / Concert Ticket',
      id: 'event-concert-ticket',
      cost: '3,000,000 αP',
      costNumeric: 3000000,
      image: '🎟️',
      description: 'Mint an NFT or QR code ticket for exclusive events, concerts, or conferences.',
      actionable: false,
      tags: ['Event', 'Access', 'NFT', 'RealWorldAsset', 'Community']
    },
    {
      name: 'Subscription Upgrade',
      id: 'subscription-upgrade',
      cost: '400,000 αP',
      costNumeric: 400000,
      image: '🚀',
      description: 'Instantly unlock a 1-month premium tier or a storage boost for partner SaaS or media services.',
      actionable: false,
      tags: ['SaaS', 'Utility', 'Access', 'Discount']
    },
    {
      name: 'Subscription Voucher',
      id: 'subscription-voucher',
      cost: '450,000 αP',
      costNumeric: 450000,
      image: '🧾',
      description: 'Use Alpha Points to purchase a full subscription for a partner service (e.g., newsletter, app).',
      actionable: false,
      tags: ['SaaS', 'Utility', 'Discount', 'Financial']
    },
    {
      name: 'Raffle Entry',
      id: 'raffle-entry',
      cost: '50,000 αP',
      costNumeric: 50000,
      image: '🎰',
      description: 'Get on-chain raffle tickets for a chance to win prizes from community or charity partners.',
      actionable: false,
      tags: ['Contest', 'Community', 'NFT', 'Gaming']
    },
    {
      name: 'Trait Re-Roll / Skin Swap',
      id: 'trait-reroll-skin-swap',
      cost: '750,000 αP',
      costNumeric: 750000,
      image: '🎲',
      description: 'Modify NFT metadata or unlock a unique cosmetic skin for your in-game PFP character.',
      actionable: false,
      tags: ['NFT', 'Gaming', 'Cosmetic', 'Utility']
    },
    {
      name: 'Governance Vote Boost',
      id: 'governance-vote-boost',
      cost: '5,000,000 αP',
      costNumeric: 5000000,
      image: '⚖️',
      description: "Boost your voting weight (e.g., +10%) in a partner DAO's next proposal for a limited time.",
      actionable: false,
      tags: ['Governance', 'Community', 'Utility', 'Platform']
    },
    {
      name: 'API / AI Call Credits',
      id: 'api-ai-call-credits',
      cost: '600,000 αP',
      costNumeric: 600000,
      image: '🤖',
      description: 'Gain access to a developer API or an AI model endpoint for a specific number of calls/requests.',
      actionable: false,
      tags: ['Developer', 'Utility', 'SaaS', 'Platform']
    },
    {
      name: 'Cross-Brand Voucher',
      id: 'cross-brand-voucher',
      cost: '350,000 αP',
      costNumeric: 350000,
      image: '🔄',
      description: 'Burn Alpha Points to claim a discount or a special NFT from a different partner brand.',
      actionable: false,
      tags: ['Discount', 'NFT', 'Community', 'Merchandise']
    },
    {
      name: 'VIP Role / Badge',
      id: 'vip-role-badge',
      cost: '1,200,000 αP',
      costNumeric: 1200000,
      image: '🌟',
      description: 'Get an exclusive VIP role in a partner Discord/Telegram and a platform badge, possibly resetting monthly.',
      actionable: false,
      tags: ['Community', 'Discord', 'Role', 'Access', 'Cosmetic']
    },
    {
      name: 'Real-World Asset Claim',
      id: 'rwa-claim',
      cost: '10,000,000 αP',
      costNumeric: 10000000,
      image: '🌍',
      description: 'Redeem for a tokenized real-world asset like a coffee voucher, silver ounce, or carbon credit NFT.',
      actionable: false,
      tags: ['RealWorldAsset', 'Financial', 'Utility', 'NFT']
    },
    {
      name: 'Leaderboard Spotlight',
      id: 'leaderboard-spotlight',
      cost: '200,000 αP',
      costNumeric: 200000,
      image: '🏆',
      description: "Feature your wallet avatar and a custom message on a partner's in-app billboard for 24 hours.",
      actionable: false,
      tags: ['Community', 'Contest', 'Cosmetic', 'Platform']
    },
    {
      name: 'Trading Fee Discount',
      id: 'trading-fee-discount',
      cost: '500,000 αP',
      costNumeric: 500000,
      image: '📉',
      description: 'Reduce your trading fees on Alpha4 partner platforms for a set period.',
      actionable: false,
      tags: ['Financial', 'Discount', 'Platform', 'Utility']
    },
    {
      name: 'Early Access Features',
      id: 'early-access-features',
      cost: '1,000,000 αP',
      costNumeric: 1000000,
      image: '🔑',
      description: 'Unlock beta features and new dApps before public release.',
      actionable: false,
      tags: ['Access', 'EarlyAccess', 'Platform', 'Utility', 'Developer']
    },
    {
      name: 'NFT Whitelist Spot',
      id: 'nft-whitelist-spot',
      cost: '2,500,000 αP',
      costNumeric: 2500000,
      image: '🎨',
      description: 'Secure a guaranteed spot in upcoming NFT mints from Alpha4 partners.',
      actionable: false,
      tags: ['NFT', 'Access', 'EarlyAccess', 'Gaming', 'Community']
    },
    {
      name: 'Partner Airdrop Access',
      id: 'partner-airdrop-access',
      cost: '1,500,000 αP',
      costNumeric: 1500000,
      image: '🎁',
      description: 'Qualify for exclusive airdrops from Alpha4 ecosystem partners.',
      actionable: false,
      tags: ['Access', 'Financial', 'NFT', 'Community', 'Contest']
    },
    {
      name: 'Premium Support',
      id: 'premium-support',
      cost: '800,000 αP',
      costNumeric: 800000,
      image: '💬',
      description: 'Get priority support and faster response times from the Alpha4 team.',
      actionable: false,
      tags: ['Support', 'Utility', 'Platform', 'Community']
    },
  ], []);

  const allUniqueTags = useMemo(() => {
    const tagSet = new Set<string>();
    perks.forEach(perk => {
      perk.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort(); // Sort for consistent order in UI
  }, [perks]);

  const displayedPerks = useMemo(() => {
    if (activeTags.size === 0) {
      return perks; // Show all if no tags are active
    }
    return perks.filter(perk => 
      perk.tags?.some(tag => activeTags.has(tag))
    );
    // OR logic: perk.tags?.some(tag => activeTags.has(tag))
    // AND logic: activeTags.forEach(activeTag => { if (!perk.tags?.includes(activeTag)) return false; return true; })
    // For AND: return perks.filter(perk => Array.from(activeTags).every(activeTag => perk.tags?.includes(activeTag)));
  }, [perks, activeTags]);

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

  const handlePerkButtonClick = (perk: Perk) => {
    if (perk.actionable) {
      if (perk.id === 'alpha4-tester-role' || perk.id === 'alpha4-veteran-role') {
        if (points.available < perk.costNumeric) {
          toast.error("You don't have enough Alpha Points for this perk.");
          return;
        }
        setSelectedPerkForModal(perk);
        setIsModalOpen(true);
      } else {
        toast.info('This perk action is not yet implemented.');
      }
    }
  };

  const handleModalSubmit = async (discordHandle: string) => {
    if (!selectedPerkForModal || !userAddress) {
      toast.error("Error: No perk selected or user address missing.");
      return;
    }

    setModalLoading(true);
    setTransactionLoading(true);

    try {
      const platformPartnerCapId = import.meta.env.VITE_PARTNER_CAP;
      if (!platformPartnerCapId) {
        toast.error("Configuration error: PartnerCap ID is missing. Please contact support.");
        setModalLoading(false);
        setTransactionLoading(false);
        throw new Error("VITE_PARTNER_CAP is not set in .env file.");
      }
      
      const tx = buildPurchaseAlphaPerkTransaction(
        selectedPerkForModal.costNumeric,
        platformPartnerCapId,
      );

      const purchaseResult = await signAndExecute({ transaction: tx });
      toast.success(`Successfully purchased ${selectedPerkForModal.name}!`);

      const botApiEndpoint = import.meta.env.VITE_DISCORD_BOT_ENDPOINT_URL || '/api/assign-role'; 
      try {
        const response = await fetch(botApiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            discordHandle: discordHandle,
            perkId: selectedPerkForModal.id,
            perkName: selectedPerkForModal.name,
            userAddress: userAddress, 
            transactionDigest: purchaseResult.digest,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Failed to assign role. Bot API returned an error.' }));
          throw new Error(errorData.message || `Bot API Error: ${response.status}`);
        }
        const responseData = await response.json();
        toast.info(responseData.message || 'Discord role assignment request sent.'); 

      } catch (botError: any) {
        console.error("Error calling bot API:", botError);
        toast.warn(`Perk purchased, but failed to send info to Discord bot: ${botError.message}. Please contact support.`);
      }

      refreshData();
      setIsModalOpen(false); 

    } catch (error: any) {
      console.error(`Error purchasing perk ${selectedPerkForModal.name}:`, error);
      toast.error(error.message || `Failed to purchase ${selectedPerkForModal.name}.`);
    } finally {
      setModalLoading(false);
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
            <div className="bg-background rounded-lg p-4 mb-6 flex items-center justify-between">
                <div>
                  {tab === 'perks' && ( // Only show filter button when perks tab is active
                    <button 
                      onClick={() => setIsFilterModalOpen(true)}
                      className="flex items-center text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 px-4 rounded-md transition-colors"
                      aria-label="Filter perks"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3zm3.707 4.707A1 1 0 017 7h6a1 1 0 01.707.293l-2.828 2.828A1 1 0 0010 10.586v3.828l-1-1V10.586a1 1 0 00-.121-.454L6.707 7.707z" clipRule="evenodd" />
                      </svg>
                      Filter Perks
                    </button>
                  )}
                </div>
                <div className="text-right">
                    <span className="text-gray-400 mr-2">Available Balance:</span>
                    <span className="text-xl font-semibold text-secondary">{formatPoints(points.available)} αP</span>
                </div>
            </div>

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

           {tab === 'perks' && (
              <div>
                  <div className="max-h-[30rem] overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 p-1 rounded-md bg-background-input/30">
                    {/* Perks data - now uses displayedPerks */}
                    {displayedPerks.map((perk: Perk) => (
                      <div key={perk.id} className={`border border-gray-700 rounded-lg p-4 flex items-center bg-background-input ${perk.actionable ? '' : 'opacity-70'}`}>
                        <div className="w-12 h-12 flex items-center justify-center bg-background rounded-full mr-4 text-2xl flex-shrink-0">{perk.image}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <h3 className="text-white font-medium flex items-center gap-1 break-words mr-1">
                              {perk.name}
                            </h3>
                            
                            <div className="flex items-center flex-shrink-0 text-right">
                              {perk.tags && perk.tags.length > 0 && (
                                <div className="flex flex-wrap justify-end gap-1 mr-2">
                                  {perk.tags.map((tag) => (
                                    <span 
                                      key={tag} 
                                      className="text-xs bg-gray-600/80 text-gray-200 px-1.5 py-0.5 rounded-full whitespace-nowrap"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <button 
                                onClick={() => handlePerkButtonClick(perk)}
                                disabled={!perk.actionable || modalLoading}
                                className={`flex-shrink-0 px-2 py-1 text-xs rounded transition-colors 
                                  ${perk.actionable 
                                    ? 'bg-primary hover:bg-primary-dark text-white'
                                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'}
                                `}
                              >
                                {perk.actionable ? 'Get Role' : 'Soon'}
                              </button>
                            </div>
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-secondary text-sm whitespace-nowrap">{perk.cost}</span>
                            <span className="text-xs text-gray-400 ml-2 text-right break-words">{perk.description}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                 </div>
              </div>
           )}
         </div>
       </div>
       {selectedPerkForModal && (
        <DiscordHandleModal
          isOpen={isModalOpen}
          onClose={() => !modalLoading && setIsModalOpen(false)}
          onSubmit={handleModalSubmit}
          perkName={selectedPerkForModal.name}
          perkCost={selectedPerkForModal.cost}
          isLoading={modalLoading} 
        />
      )}
      {isFilterModalOpen && (
        <PerkFilterModal 
          isOpen={isFilterModalOpen}
          onClose={() => setIsFilterModalOpen(false)}
          allTags={allUniqueTags}
          activeTags={activeTags}
          setActiveTags={setActiveTags}
          modalTitle="Filter Perks by Tag"
        />
      )}
    </>
  );
};