import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { calculateAlphaPointsPerDayPerSui } from '../utils/format';
import { PerkFilterModal } from '../components/PerkFilterModal';
import { StakeCard } from '../components/StakeCard';
import { LoanManagementCards } from '../components/LoanManagementCards';

// Define a generation method interface
interface GenerationMethod {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'active' | 'inactive' | 'coming-soon';
  details?: React.ReactNode;
  tags?: string[];
}

// Define a list of potential tags for generation methods
const ALL_POSSIBLE_GENERATION_TAGS = [
  'Staking', 'Community', 'Engagement', 'Referral', 'Financial', 'Location', 
  'Content', 'Education', 'Governance', 'Activity', 'Partner', 'Social', 'NFT', 'ProofOfX', 'DeFi'
];

export const GenerationPage: React.FC = () => {
  const [expandedMethod, setExpandedMethod] = useState<string | null>('stake-sui');
  
  // State for Filtering
  const [activeGenerationTags, setActiveGenerationTags] = useState<Set<string>>(new Set());
  const [isGenerationFilterModalOpen, setIsGenerationFilterModalOpen] = useState(false);

  // Generation methods data (with tags added)
  const generationMethods: GenerationMethod[] = [
    {
      id: 'stake-sui',
      name: 'Stake SUI',
      description: 'Earn Alpha Points by staking SUI tokens in the protocol.',
      icon: '🟦',
      status: 'active',
      tags: ['Staking', 'Financial', 'Activity'],
      details: (
        <div className="space-y-6">
          {/* Staking Interface */}
          <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl p-1">
            <StakeCard />
          </div>
          
          {/* Staking Information */}
          <div className="bg-background rounded-lg p-4">
            <h3 className="text-lg font-medium text-white mb-3">SUI Staking Details</h3>
            <p className="text-gray-300 mb-3">
              Stake your SUI tokens to earn Alpha Points over time. The longer you stake, the better the rate.
            </p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-background-card p-3 rounded-lg">
                <div className="text-gray-400 mb-1">7-Day Stake</div>
                <div className="text-white font-medium">5% APY</div>
                <div className="text-green-400 text-sm mt-1">+{calculateAlphaPointsPerDayPerSui(5).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 1})} αP/day per 1 SUI</div>
              </div>
              <div className="bg-background-card p-3 rounded-lg">
                <div className="text-gray-400 mb-1">30-Day Stake</div>
                <div className="text-white font-medium">10% APY</div>
                <div className="text-green-400 text-sm mt-1">+{calculateAlphaPointsPerDayPerSui(10).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 1})} αP/day per 1 SUI</div>
              </div>
              <div className="bg-background-card p-3 rounded-lg">
                <div className="text-gray-400 mb-1">90-Day Stake</div>
                <div className="text-white font-medium">15% APY</div>
                <div className="text-green-400 text-sm mt-1">+{calculateAlphaPointsPerDayPerSui(15).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 1})} αP/day per 1 SUI</div>
              </div>
              <div className="bg-background-card p-3 rounded-lg">
                <div className="text-gray-400 mb-1">365-Day Stake</div>
                <div className="text-white font-medium">25% APY</div>
                <div className="text-green-400 text-sm mt-1">+{calculateAlphaPointsPerDayPerSui(25).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 1})} αP/day per 1 SUI</div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'collateral-loan',
      name: 'Collateral Loan',
      description: 'Borrow Alpha Points against your staked SUI as collateral.',
      icon: '🏦',
      status: 'active',
      tags: ['Financial', 'Staking', 'DeFi', 'Activity'],
      details: (
        <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl p-1">
          <LoanManagementCards />
        </div>
      ),
    },
    {
      id: 'referral-conversion',
      name: 'Referral Conversion',
      description: 'Inviter & invitee earn when newcomer completes first quest.',
      icon: '🫂',
      status: 'coming-soon',
      tags: ['Referral', 'Community', 'Partner', 'Engagement'],
      details: (
        <div className="p-4 bg-background rounded-lg">
          <h3 className="text-lg font-medium text-white mb-3">Referral Conversion Details</h3>
          <p className="text-gray-300 mb-2">
            <strong>How it Works:</strong> Inviter & invitee wallets both earn when the newcomer completes their first Alpha4 quest or a partner-defined action.
          </p>
          <p className="text-gray-400 text-sm mb-1">
            <strong>Potential Partners:</strong> Fintech apps, wallets, exchanges, any platform looking to grow its user base through verified onboarding.
          </p>
          <p className="mt-3 text-xs text-gray-500">This feature is under development. Stay tuned for updates!</p>
        </div>
      ),
    },
    {
      id: 'staking-liquidity-provision',
      name: 'Staking / Liquidity Provision',
      description: 'Points minted per dollar-seconds locked when staking or providing liquidity.',
      icon: '💸',
      status: 'coming-soon',
      tags: ['Staking', 'Financial', 'DeFi', 'Partner', 'Activity'],
      details: (
        <div className="p-4 bg-background rounded-lg">
          <h3 className="text-lg font-medium text-white mb-3">Staking / LP Details</h3>
          <p className="text-gray-300 mb-2">
            <strong>How it Works:</strong> Stake tokens or provide liquidity (LP tokens) for a defined minimum period (e.g., ≥ 7 days); Alpha Points are minted based on the value locked and duration (dollar-seconds).
          </p>
          <p className="text-gray-400 text-sm mb-1">
            <strong>Potential Partners:</strong> DeFi protocols, yield platforms, DEXs, any project with staking or liquidity pool mechanisms.
          </p>
          <p className="mt-3 text-xs text-gray-500">This feature is under development. Stay tuned for updates!</p>
        </div>
      ),
    },
    {
      id: 'airdrop-campaign',
      name: 'Airdrop Campaign',
      description: 'Earn Alpha Points by participating in special airdrop events.',
      icon: '🎁',
      status: 'coming-soon',
      tags: ['Community', 'Engagement', 'Financial', 'Partner', 'Activity'],
      details: (
        <div className="p-4 bg-background rounded-lg">
          <h3 className="text-lg font-medium text-white mb-3">Airdrop Opportunities</h3>
           <p className="text-gray-300 mb-2">
            <strong>How it Works:</strong> Alpha4 or partners may distribute Alpha Points via airdrops to users meeting specific criteria (e.g., holding certain NFTs/tokens, past activity, early adoption).
          </p>
          <p className="text-gray-400 text-sm mb-1">
            <strong>Potential Partners:</strong> New project launches, community engagement initiatives, existing protocols rewarding loyalty.
          </p>
          <p className="mt-3 text-xs text-gray-500">Watch for announcements about upcoming airdrop events and how to qualify.</p>
        </div>
      ),
    },
    {
      id: 'proof-of-purchase',
      name: 'Proof-of-Purchase',
      description: 'Earn for purchases by signing a receipt hash.',
      icon: '🛒',
      status: 'coming-soon',
      tags: ['ProofOfX', 'Financial', 'Partner', 'Activity', 'Retail'],
      details: (
        <div className="p-4 bg-background rounded-lg">
          <h3 className="text-lg font-medium text-white mb-3">Proof-of-Purchase Details</h3>
          <p className="text-gray-300 mb-2">
            <strong>How it Works:</strong> Wallet signs a receipt hash (from e-commerce or Point-of-Sale system) via a partner integration. Alpha Points are then awarded, potentially proportional to spend.
          </p>
          <p className="text-gray-400 text-sm mb-1">
            <strong>Potential Partners:</strong> Retail brands, e-commerce platforms, food & beverage services, ticketing providers.
          </p>
          <p className="mt-3 text-xs text-gray-500">This feature is under development. Stay tuned for updates!</p>
        </div>
      ),
    },
    {
      id: 'geofenced-check-in',
      name: 'Geofenced Check-In',
      description: 'Earn points by checking in at specific locations.',
      icon: '📍',
      status: 'coming-soon',
      tags: ['ProofOfX', 'Location', 'Partner', 'Activity', 'Event'],
      details: (
        <div className="p-4 bg-background rounded-lg">
          <h3 className="text-lg font-medium text-white mb-3">Geofenced Check-In Details</h3>
          <p className="text-gray-300 mb-2">
            <strong>How it Works:</strong> User taps an NFC tag or scans a QR code at a partner venue. A location oracle (or the venue's system) confirms presence, triggering an Alpha Point mint.
          </p>
          <p className="text-gray-400 text-sm mb-1">
            <strong>Potential Partners:</strong> Live events, sports arenas, tourism boards, retail locations offering experiential rewards.
          </p>
          <p className="mt-3 text-xs text-gray-500">This feature is under development. Stay tuned for updates!</p>
        </div>
      ),
    },
    {
      id: 'social-share-challenge',
      name: 'Social Share Challenge',
      description: 'Get points for sharing content on social media.',
      icon: '📢',
      status: 'coming-soon',
      tags: ['Social', 'Content', 'Partner', 'Engagement', 'Marketing'],
      details: (
        <div className="p-4 bg-background rounded-lg">
          <h3 className="text-lg font-medium text-white mb-3">Social Share Challenge Details</h3>
          <p className="text-gray-300 mb-2">
            <strong>How it Works:</strong> User posts or reposts specific brand content using a tracked URL/hashtag. An oracle or integrated service verifies the share and engagement metrics to award Alpha Points.
          </p>
          <p className="text-gray-400 text-sm mb-1">
            <strong>Potential Partners:</strong> Media companies, influencers, SaaS product launches, marketing campaigns.
          </p>
          <p className="mt-3 text-xs text-gray-500">This feature is under development. Stay tuned for updates!</p>
        </div>
      ),
    },
    {
      id: 'hold-to-earn-nft',
      name: 'Hold-to-Earn / Delist NFT',
      description: 'Earn points for holding or not listing brand NFTs.',
      icon: '🖼️',
      status: 'coming-soon',
      tags: ['NFT', 'Staking', 'Community', 'Partner', 'Financial'],
      details: (
        <div className="p-4 bg-background rounded-lg">
          <h3 className="text-lg font-medium text-white mb-3">Hold-to-Earn / Delist NFT Details</h3>
          <p className="text-gray-300 mb-2">
            <strong>How it Works:</strong> Users keep a specific partner NFT staked in a designated contract or verifiably unlisted from major marketplaces for a set duration (e.g., X days), with Alpha Points dripped periodically.
          </p>
          <p className="text-gray-400 text-sm mb-1">
            <strong>Potential Partners:</strong> PFP collections, digital art projects, membership clubs using NFTs for access.
          </p>
          <p className="mt-3 text-xs text-gray-500">This feature is under development. Stay tuned for updates!</p>
        </div>
      ),
    },
    {
      id: 'learn-to-earn',
      name: 'Learn-to-Earn Module',
      description: 'Gain points by completing educational modules or quizzes.',
      icon: '🎓',
      status: 'coming-soon',
      tags: ['Education', 'Engagement', 'Partner', 'ProofOfX'],
      details: (
        <div className="p-4 bg-background rounded-lg">
          <h3 className="text-lg font-medium text-white mb-3">Learn-to-Earn Details</h3>
          <p className="text-gray-300 mb-2">
            <strong>How it Works:</strong> Users complete a micro-course, watch educational content, or pass a quiz provided by a partner. An on-chain credential or off-chain verification triggers an Alpha Point mint.
          </p>
          <p className="text-gray-400 text-sm mb-1">
            <strong>Potential Partners:</strong> EdTech platforms, Web3 projects for developer/user onboarding, security awareness training providers.
          </p>
          <p className="mt-3 text-xs text-gray-500">This feature is under development. Stay tuned for updates!</p>
        </div>
      ),
    },
    {
      id: 'dao-vote-participation',
      name: 'DAO Vote Participation',
      description: 'Earn points for participating in DAO governance.',
      icon: '🗳️',
      status: 'coming-soon',
      tags: ['Governance', 'Community', 'Partner', 'Engagement', 'DeFi'],
      details: (
        <div className="p-4 bg-background rounded-lg">
          <h3 className="text-lg font-medium text-white mb-3">DAO Vote Participation Details</h3>
          <p className="text-gray-300 mb-2">
            <strong>How it Works:</strong> Users cast a vote in a partner DAO's governance proposal. The smart contract interaction for voting calls an Alpha Points earning hook or is verified by an oracle.
          </p>
          <p className="text-gray-400 text-sm mb-1">
            <strong>Potential Partners:</strong> DAOs, decentralized protocols, community-governed treasuries.
          </p>
          <p className="mt-3 text-xs text-gray-500">This feature is under development. Stay tuned for updates!</p>
        </div>
      ),
    },
    {
      id: 'fitness-proof',
      name: 'Fitness Proof',
      description: 'Earn points by achieving fitness goals.',
      icon: '🏃',
      status: 'coming-soon',
      tags: ['ProofOfX', 'Activity', 'Partner', 'Health'],
      details: (
        <div className="p-4 bg-background rounded-lg">
          <h3 className="text-lg font-medium text-white mb-3">Fitness Proof Details</h3>
          <p className="text-gray-300 mb-2">
            <strong>How it Works:</strong> Users sync data from a wearable device or fitness app (e.g., 5,000 steps, 10 km ride). A trusted oracle or partner integration verifies the fitness data and signs it to trigger Alpha Point minting.
          </p>
          <p className="text-gray-400 text-sm mb-1">
            <strong>Potential Partners:</strong> Health insurers, fitness app companies, shoe/apparel brands, gyms, wellness programs.
          </p>
          <p className="mt-3 text-xs text-gray-500">This feature is under development. Stay tuned for updates!</p>
        </div>
      ),
    },
    {
      id: 'survey-feedback',
      name: 'Survey or Feedback Loop',
      description: 'Earn for completing surveys or providing product feedback.',
      icon: '📝',
      status: 'coming-soon',
      tags: ['Engagement', 'Content', 'Partner', 'Community'],
      details: (
        <div className="p-4 bg-background rounded-lg">
          <h3 className="text-lg font-medium text-white mb-3">Survey/Feedback Details</h3>
          <p className="text-gray-300 mb-2">
            <strong>How it Works:</strong> Users complete a CSAT/NPS survey or provide structured feedback for a partner product/service. Hashed answers or completion proof can be stored or verified to issue Alpha Points.
          </p>
          <p className="text-gray-400 text-sm mb-1">
            <strong>Potential Partners:</strong> SaaS products, consumer brands, research firms, any service looking for user feedback.
          </p>
          <p className="mt-3 text-xs text-gray-500">This feature is under development. Stay tuned for updates!</p>
        </div>
      ),
    },
  ];

  const allUniqueGenerationTags = useMemo(() => {
    const tagSet = new Set<string>();
    generationMethods.forEach(method => {
      method.tags?.forEach(tag => tagSet.add(tag));
    });
    // Ensure all predefined tags are included, even if not currently used, for a comprehensive filter list
    ALL_POSSIBLE_GENERATION_TAGS.forEach(tag => tagSet.add(tag)); 
    return Array.from(tagSet).sort();
  }, [generationMethods]);

  const displayedGenerationMethods = useMemo(() => {
    if (activeGenerationTags.size === 0) {
      return generationMethods;
    }
    return generationMethods.filter(method => 
      method.tags?.some(tag => activeGenerationTags.has(tag))
    );
  }, [generationMethods, activeGenerationTags]);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          <span className="bg-gradient-to-r from-emerald-400 to-blue-400 text-transparent bg-clip-text">
            Earn Alpha Points
          </span>
        </h1>
        <p className="text-gray-400 text-lg">
          Explore diverse ways to generate points across the ecosystem
        </p>
      </div>
      
      {/* Filter Section */}
      <div className="card-modern py-1.5 px-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <div className="w-6 h-6 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </div>
            <span className="text-white font-medium">Filter Methods</span>
            {activeGenerationTags.size > 0 && (
              <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded-lg text-sm">
                {activeGenerationTags.size} active
              </span>
            )}
          </div>
          <button 
            onClick={() => setIsGenerationFilterModalOpen(true)}
            className="btn-modern-secondary text-sm"
            aria-label="Filter generation methods"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
            </svg>
            Configure Filters
          </button>
        </div>
      </div>
      
      {/* Generation Methods Grid */}
      <div className="h-[calc(100vh-280px)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-slide-up pb-12">
        {displayedGenerationMethods.map((method, index) => (
          <div 
            key={method.id}
            className="card-modern overflow-hidden animate-fade-in"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div 
              className="p-4 cursor-pointer transition-all duration-300 hover:bg-white/5"
              onClick={() => setExpandedMethod(expandedMethod === method.id ? null : method.id)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl flex items-center justify-center text-xl shadow-lg">
                    {method.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white text-lg mb-1">{method.name}</h3>
                    <div className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium ${
                      method.status === 'active' 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                        : method.status === 'coming-soon' 
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-red-500/20 text-red-300 border border-red-500/30'
                    }`}>
                      <div className={`w-2 h-2 rounded-full mr-2 ${
                        method.status === 'active' ? 'bg-emerald-400' 
                        : method.status === 'coming-soon' ? 'bg-amber-400'
                        : 'bg-red-400'
                      }`}></div>
                      {method.status === 'active' ? 'Active' 
                       : method.status === 'coming-soon' ? 'Coming Soon'
                       : 'Inactive'}
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
                    expandedMethod === method.id 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-white/10 text-gray-400 hover:bg-white/20'
                  }`}>
                    <svg 
                      className={`w-4 h-4 transition-transform duration-300 ${
                        expandedMethod === method.id ? 'rotate-180' : ''
                      }`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                {method.description}
              </p>
              
              {method.tags && method.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {method.tags.slice(0, 4).map((tag) => (
                    <span 
                      key={tag} 
                      className="bg-black/20 border border-white/10 text-gray-300 px-2 py-1 rounded-lg text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                  {method.tags.length > 4 && (
                    <span className="text-xs text-gray-500 px-2 py-1">
                      +{method.tags.length - 4} more
                    </span>
                  )}
                </div>
              )}
            </div>
            
            {expandedMethod === method.id && (
              <div className="border-t border-white/10 bg-black/20 animate-slide-up">
                <div className="p-4">
                  {method.details}
                </div>
              </div>
            )}
          </div>
        ))}
        </div>
      </div>
      
      {/* No Results State */}
      {displayedGenerationMethods.length === 0 && activeGenerationTags.size > 0 && (
        <div className="h-[calc(100vh-280px)] flex items-center justify-center">
          <div className="card-modern p-12 text-center animate-fade-in">
          <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 20a7.962 7.962 0 01-5-1.709M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No Methods Found</h3>
          <p className="text-gray-400 mb-4">No generation methods match your selected filters.</p>
          <button 
            onClick={() => setActiveGenerationTags(new Set())}
            className="btn-modern-secondary"
          >
            Clear All Filters
          </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="card-modern p-6 text-center border-blue-500/20">
        <div className="flex items-center justify-center space-x-3 mb-3">
          <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white">More Coming Soon</h3>
        </div>
        <p className="text-gray-400">
          We're constantly adding new ways to earn Alpha Points. Stay tuned for exciting updates!
        </p>
      </div>

      {/* Filter Modal */}
      {isGenerationFilterModalOpen && (
        <PerkFilterModal 
          isOpen={isGenerationFilterModalOpen}
          onClose={() => setIsGenerationFilterModalOpen(false)}
          allTags={allUniqueGenerationTags}
          activeTags={activeGenerationTags}
          setActiveTags={setActiveGenerationTags}
          modalTitle="Filter Methods by Tag"
        />
      )}
    </div>
  );
};