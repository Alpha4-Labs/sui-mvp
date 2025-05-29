import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { calculateAlphaPointsPerDayPerSui } from '../utils/format';
import { PerkFilterModal } from '../components/PerkFilterModal';

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
  'Content', 'Education', 'Governance', 'Activity', 'Partner', 'Social', 'NFT', 'ProofOfX'
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
        <div className="p-4 bg-background rounded-lg">
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
          <div className="text-center">
            <a href="/dashboard">
              <button className="bg-primary hover:bg-primary-dark text-white py-2 px-6 rounded transition-colors">
                Go to SUI Staking
              </button>
            </a>
          </div>
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
    <>
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Earn Alpha Points</h1>
        <p className="text-gray-400">Explore ways to generate points across the ecosystem.</p>
      </div>
      
      <div className="mb-4 flex justify-end px-2">
        <button 
          onClick={() => setIsGenerationFilterModalOpen(true)}
          className="flex items-center text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 px-4 rounded-md transition-colors"
          aria-label="Filter generation methods"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3zm3.707 4.707A1 1 0 017 7h6a1 1 0 01.707.293l-2.828 2.828A1 1 0 0010 10.586v3.828l-1-1V10.586a1 1 0 00-.121-.454L6.707 7.707z" clipRule="evenodd" />
          </svg>
          Filter Methods
        </button>
      </div>
      
      <div className="max-h-[70vh] overflow-y-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 p-2 rounded-lg bg-background-input/20">
        {displayedGenerationMethods.map((method) => (
          <div 
            key={method.id}
            className="bg-background-card rounded-lg shadow-lg overflow-hidden flex flex-col"
          >
            <div 
              className="p-4 flex justify-between items-center cursor-pointer border-b border-gray-700/50"
              onClick={() => setExpandedMethod(expandedMethod === method.id ? null : method.id)}
            >
              <div className="flex items-center min-w-0 mr-2">
                <div className="w-8 h-8 flex items-center justify-center bg-background rounded-full mr-3 text-xl flex-shrink-0">
                  {method.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate">{method.name}</div>
                  {method.tags && method.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {method.tags.slice(0, 3).map((tag) => (
                        <span 
                          key={tag} 
                          className="text-xs bg-gray-600/70 text-gray-300 px-1.5 py-0.5 rounded-full whitespace-nowrap"
                        >
                          {tag}
                        </span>
                      ))}
                      {method.tags.length > 3 && (
                        <span className="text-xs text-gray-400 px-1 py-0.5">+ {method.tags.length - 3} more</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className={`w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0 ${
                method.status === 'active' ? 'bg-green-500' 
                : method.status === 'coming-soon' ? 'bg-yellow-500'
                : 'bg-red-500'
              }`}>
                {expandedMethod === method.id ? (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </div>
            </div>
            
            {expandedMethod === method.id && (
              <div className="border-t border-gray-700 flex-grow">
                {method.details}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {displayedGenerationMethods.length === 0 && activeGenerationTags.size > 0 && (
        <div className="text-center text-gray-400 py-10">
          <p className="text-lg mb-2">No generation methods match your selected filters.</p>
          <p>Try adjusting your filter criteria or clearing all filters.</p>
        </div>
      )}

      <div className="text-center text-gray-400">
        More generation methods coming soon!
      </div>

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
    </>
  );
};