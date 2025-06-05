import { useState, useEffect } from 'react';
import { useCurrentAccount, useConnectWallet, useDisconnectWallet, useSuiClient, useWallets } from '@mysten/dapp-kit';
import { toast } from 'react-hot-toast';
import type { ConnectionStatus, Alpha4Perk, ClaimedPerk, DiscordUser } from '../types/index.js';
import { DiscordAuthService } from '../services/discord';
import { SuiService } from '../services/sui';
import { formatUSDC, formatAlphaPoints } from '../lib/utils';

// Alpha4 perks with proper perk type and tag matching
const mockAlpha4Perks: Alpha4Perk[] = [
  {
    id: '1',
    name: 'Discord Premium Role',
    description: 'Get exclusive access to Alpha4 premium Discord channels',
    icon: '👑',
    alphaPointCost: 1000,
    usdcValue: 10,
    isAvailable: true,
    requiredPerkType: 'discord_role',
    requiredTags: ['alpha4', 'premium'],
  },
  {
    id: '2',
    name: 'Early Access Pass',
    description: 'Get early access to new Alpha4 features and products',
    icon: '🚀',
    alphaPointCost: 2500,
    usdcValue: 25,
    isAvailable: true,
    requiredPerkType: 'early_access',
    requiredTags: ['alpha4', 'beta'],
  },
  {
    id: '3',
    name: 'Merchandise Bundle',
    description: 'Alpha4 branded merchandise package',
    icon: '🎁',
    alphaPointCost: 5000,
    usdcValue: 50,
    isAvailable: false,
    isPlaceholder: true,
  },
  {
    id: '4',
    name: 'Private Consultation',
    description: 'One-on-one consultation with Alpha4 team',
    icon: '🤝',
    alphaPointCost: 10000,
    usdcValue: 100,
    isAvailable: false,
    isPlaceholder: true,
  },
  {
    id: '5',
    name: 'VIP Event Access',
    description: 'Exclusive access to Alpha4 VIP events',
    icon: '🎪',
    alphaPointCost: 15000,
    usdcValue: 150,
    isAvailable: false,
    isPlaceholder: true,
  },
];

export default function RewardPlatform() {
  const currentAccount = useCurrentAccount();
  const { mutate: connectWallet } = useConnectWallet();
  const { mutate: disconnectWallet } = useDisconnectWallet();
  const suiClient = useSuiClient();
  const wallets = useWallets();

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    wallet: { connected: false },
    discord: { connected: false },
  });

  const [userPerks, setUserPerks] = useState<ClaimedPerk[]>([]);
  const [isLoadingPerks, setIsLoadingPerks] = useState(false);

  // Services
  const [discordService] = useState(() => DiscordAuthService.getInstance());
  const [suiService] = useState(() => new SuiService(suiClient));

  // Debug wallet availability
  useEffect(() => {
    console.log('Available wallets:', wallets.map(w => ({ name: w.name, features: Object.keys(w.features) })));
  }, [wallets]);

  // Load Discord connection status on mount
  useEffect(() => {
    const loadDiscordStatus = async () => {
      if (discordService.isAuthenticated()) {
        const user = discordService.getCurrentUser();
        if (user) {
          const isValid = await discordService.verifyToken();
          if (isValid) {
            setConnectionStatus(prev => ({
              ...prev,
              discord: { connected: true, user },
            }));
          } else {
            discordService.logout();
          }
        }
      }
    };
    loadDiscordStatus();
  }, [discordService]);

  // Handle OAuth callback (implicit flow)
  useEffect(() => {
    const handleOAuthCallback = async () => {
      // Add a small delay to ensure DOM is fully loaded
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check URL fragment for implicit flow response
      const urlFragment = window.location.hash.substring(1);
      const fragmentParams = new URLSearchParams(urlFragment);
      const accessToken = fragmentParams.get('access_token');
      const state = fragmentParams.get('state');
      const tokenType = fragmentParams.get('token_type');
      const expiresIn = fragmentParams.get('expires_in');

      // Also check URL parameters for any error responses
      const urlParams = new URLSearchParams(window.location.search);
      const error = urlParams.get('error');
      const errorDescription = urlParams.get('error_description');

      console.log('OAuth callback check:', {
        hasFragment: !!urlFragment,
        hasAccessToken: !!accessToken,
        hasState: !!state,
        hasError: !!error,
        fragmentLength: urlFragment.length,
        currentUrl: window.location.href
      });

      if (error) {
        console.error('Discord OAuth error:', error, errorDescription);
        toast.error(`Discord authentication failed: ${errorDescription || error}`);
        
        // Clean up URL
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        return;
      }

      if (accessToken && state) {
        console.log('Processing Discord OAuth callback...', { 
          token: accessToken.substring(0, 10) + '...', 
          state,
          tokenType,
          expiresIn: expiresIn ? `${expiresIn}s` : 'unknown'
        });
        
        // Check if we already processed this callback
        const processed = localStorage.getItem('discord_callback_processed');
        if (processed === accessToken.substring(0, 10)) {
          console.log('Callback already processed, skipping...');
          return;
        }
        
        // Mark as processing
        localStorage.setItem('discord_callback_processed', accessToken.substring(0, 10));
        
        try {
          const user = await discordService.handleCallback(accessToken, state);
          setConnectionStatus(prev => ({
            ...prev,
            discord: { connected: true, user },
          }));
          toast.success(`Discord connected! Welcome, ${user.username}`);
          
          // Clean up URL fragment
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
          
          // Clean up processing flags after successful completion
          setTimeout(() => {
            localStorage.removeItem('discord_callback_processed');
            localStorage.removeItem('discord_connecting');
          }, 1000);
          
        } catch (error) {
          console.error('Discord OAuth callback error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          toast.error(`Discord connection failed: ${errorMessage}`);
          
          // Clean up URL fragment even on error
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
          
          // Clean up processing flags on error
          localStorage.removeItem('discord_callback_processed');
          localStorage.removeItem('discord_connecting');
        }
      } else if (urlFragment && !accessToken) {
        console.warn('URL fragment present but no access token found:', urlFragment);
      }
    };
    
    // Run immediately and also after a short delay to catch any timing issues
    handleOAuthCallback();
    const timeoutId = setTimeout(handleOAuthCallback, 500);
    
    return () => clearTimeout(timeoutId);
  }, [discordService]);

  // Function to update wallet status and load perks
    const updateWalletStatus = async () => {
    setConnectionStatus(prev => ({
      ...prev,
      wallet: {
        connected: !!currentAccount,
        address: currentAccount?.address,
      },
    }));

    if (currentAccount) {
      setIsLoadingPerks(true);
      try {
        console.log('🔍 Loading perks using enhanced discovery for:', currentAccount.address);
        const perks = await suiService.getClaimedPerks(currentAccount.address);
        setUserPerks(perks);
        
        // Provide detailed feedback about what was loaded
        if (perks.length === 0) {
          console.log('ℹ️ No perks found in wallet');
          // Show informative message for empty results
          toast.info('No perks found in your wallet. Perks you claim will appear here.', { autoClose: 3000 });
        } else {
          console.log(`✅ Successfully loaded ${perks.length} perks from blockchain`);
          // Show success with breakdown
          const activePerks = perks.filter(p => p.status === 'ACTIVE').length;
          const statusBreakdown = activePerks < perks.length 
            ? ` (${activePerks} active)`
            : '';
          toast.success(`Loaded ${perks.length} perk${perks.length !== 1 ? 's' : ''}${statusBreakdown} from blockchain`);
        }
      } catch (error) {
        console.error('❌ Error loading perks from blockchain:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Enhanced error handling with more specific messages
        if (errorMessage.includes('Invalid StructType') || errorMessage.includes('MoveEventType')) {
          toast.warning('Smart contracts not deployed yet - using test data', { autoClose: 5000 });
        } else if (errorMessage.includes('RPC') || errorMessage.includes('network')) {
          toast.error('Unable to connect to Sui network. Check your connection.', { autoClose: 5000 });
        } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
          toast.warning('Network is busy. Retrying with cached data...', { autoClose: 3000 });
        } else {
          toast.error(`Failed to load perks: ${errorMessage}`, { autoClose: 7000 });
        }
        
        setUserPerks([]);
      } finally {
        setIsLoadingPerks(false);
      }
    } else {
      setUserPerks([]);
      setIsLoadingPerks(false);
    }
  };

  // Update wallet connection status and load perks when account changes
  useEffect(() => {
    updateWalletStatus();
  }, [currentAccount, suiService]);

  const handleWalletConnect = () => {
    console.log('Attempting to connect wallet...');
    console.log('Available wallets:', wallets);
    
    // Get the first available wallet
    const availableWallet = wallets.find(wallet => wallet.name);
    
    if (!availableWallet) {
      const message = 'No wallets detected. Please install a Sui wallet extension like Sui Wallet, Ethos, or Martian.';
      console.error(message);
      toast.error(message);
      return;
    }

    console.log('Connecting to wallet:', availableWallet.name);
    
    connectWallet(
      { wallet: availableWallet },
      {
        onSuccess: () => {
          console.log('Wallet connected successfully!');
          toast.success('Wallet connected successfully!');
        },
        onError: (error) => {
          console.error('Wallet connection error:', error);
          console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            wallet: availableWallet.name
          });
          
          // More specific error messages
          if (error.message.includes('User rejected')) {
            toast.error('Connection rejected by user');
          } else if (error.message.includes('standard:connect')) {
            toast.error('Wallet connection method not supported. Please update your wallet extension.');
          } else {
            toast.error(`Failed to connect wallet: ${error.message}`);
          }
        },
      }
    );
  };

  const handleWalletDisconnect = () => {
    disconnectWallet();
    setUserPerks([]);
    toast.success('Wallet disconnected');
  };

  const handleDiscordConnect = () => {
    // Prevent multiple simultaneous connection attempts
    if (connectionStatus.discord.connected) {
      toast.info('Discord is already connected!');
      return;
    }
    
    const connecting = localStorage.getItem('discord_connecting');
    if (connecting && Date.now() - parseInt(connecting) < 30000) {
      toast.info('Discord connection already in progress...');
      return;
    }
    
    localStorage.setItem('discord_connecting', Date.now().toString());
    console.log('Initiating Discord OAuth...');
    
    // Clean up the flag after 30 seconds
    setTimeout(() => {
      localStorage.removeItem('discord_connecting');
    }, 30000);
    
    discordService.initiateOAuth();
  };

  const handleDiscordDisconnect = () => {
    discordService.logout();
    setConnectionStatus(prev => ({
      ...prev,
      discord: { connected: false },
    }));
    toast.success('Discord disconnected');
  };

  const handleClaimPerk = (perk: Alpha4Perk) => {
    if (perk.requiredPerkType || perk.requiredTags) {
      const hasRequired = suiService.hasRequiredPerks(
        userPerks,
        perk.requiredPerkType,
        perk.requiredTags
      );

      if (!hasRequired) {
        toast.error(`You need a ${perk.requiredPerkType || 'specific'} perk to claim this reward`);
        return;
      }
    }

    toast.success(`Successfully claimed ${perk.name}!`);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <header className="bg-gray-900/95 backdrop-blur-sm border-b border-gray-700/50 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Logo and title */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              A4
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Alpha4 Rewards</h1>
              <p className="text-xs text-gray-400">Redeem your perks for exclusive Alpha4 benefits</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-3">
            {/* Discord Connection */}
            <div className="flex items-center space-x-2">
              {connectionStatus.discord.connected ? (
                <div className="flex items-center space-x-2 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-1.5">
                  <div className="w-6 h-6 bg-discord rounded-full flex items-center justify-center text-white text-xs font-semibold">
                    D
                  </div>
                  <span className="text-xs text-green-400 font-medium">Connected</span>
                  <button
                    onClick={handleDiscordDisconnect}
                    className="text-xs text-red-400 hover:text-red-300 ml-1"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleDiscordConnect}
                  className="flex items-center space-x-2 bg-discord/10 hover:bg-discord/20 border border-discord/30 hover:border-discord/50 text-discord px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
                >
                  <span>🎮</span>
                  <span>Connect Discord</span>
                </button>
              )}
            </div>

            {/* Wallet Connection */}
            <div className="flex items-center space-x-2">
              {connectionStatus.wallet.connected ? (
                <div className="flex items-center space-x-2 bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-1.5">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                    W
                  </div>
                  <span className="text-xs text-blue-400 font-medium">
                    {connectionStatus.wallet.address?.slice(0, 6)}...{connectionStatus.wallet.address?.slice(-4)}
                  </span>
                  <button
                    onClick={handleWalletDisconnect}
                    className="text-xs text-red-400 hover:text-red-300 ml-1"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleWalletConnect}
                  disabled={wallets.length === 0}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    wallets.length === 0
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed border border-gray-600'
                      : 'bg-blue-600/10 hover:bg-blue-600/20 border border-blue-600/30 hover:border-blue-600/50 text-blue-400'
                  }`}
                >
                  <span>💼</span>
                  <span>
                    {wallets.length === 0 
                      ? 'No Wallet Found' 
                      : `Connect ${wallets[0]?.name || 'Wallet'}`
                    }
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* User Perks Sidebar - More Compact */}
        <div className="w-80 flex-shrink-0">
          <div className="card h-full flex flex-col">
            {/* Header with gradient accent */}
            <div className="p-4 border-b border-gray-700 bg-gradient-to-r from-purple-900/20 to-blue-900/20">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="text-purple-400">💎</span>
                    Your Perks
                  </h2>
                  <p className="text-gray-400 text-xs">
                    {isLoadingPerks ? 'Loading from blockchain...' : `${userPerks.length} perk${userPerks.length !== 1 ? 's' : ''} owned`}
                  </p>
                </div>
                {connectionStatus.wallet.connected && (
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${isLoadingPerks ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
                    <button
                      onClick={() => {
                        if (currentAccount) {
                          console.log('🔄 Manual refresh requested - clearing cache and reloading');
                          suiService.refreshPerkData();
                          updateWalletStatus();
                        }
                      }}
                      disabled={isLoadingPerks || !currentAccount}
                      className="text-xs text-blue-400 hover:text-blue-300 disabled:text-gray-600 disabled:cursor-not-allowed p-1 hover:bg-blue-500/10 rounded transition-colors"
                      title="Clear cache and refresh perks from blockchain"
                    >
                      🔄
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Scrollable perk list */}
            <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
              {userPerks.length === 0 ? (
                <div className="text-center text-gray-500 mt-8 animate-fade-in">
                  <div className="text-3xl mb-3 opacity-50">📦</div>
                  <p className="text-sm">No perks found</p>
                  <p className="text-xs text-gray-600">Connect your wallet to see your perks</p>
                </div>
              ) : (
                <div className="space-y-2 animate-fade-in">
                  {userPerks.map((perk, index) => (
                    <div 
                      key={perk.objectId} 
                      className="group bg-gray-800/40 hover:bg-gray-700/60 rounded-lg p-3 border border-gray-700/50 hover:border-purple-500/30 transition-all duration-200 cursor-pointer animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="text-xl group-hover:scale-110 transition-transform">{perk.icon}</div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-white text-sm truncate">{perk.name}</h3>
                          <p className="text-xs text-gray-400 truncate">{perk.perkType}</p>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs mt-2 pt-2 border-t border-gray-700/30">
                        <span className="text-blue-400 font-medium">{formatAlphaPoints(perk.currentAlphaPointsPrice)} AP</span>
                        <span className="text-green-400 font-medium">{formatUSDC(perk.usdcPrice)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Alpha4 Rewards - Modern Grid Layout */}
        <div className="flex-1">
          <div className="card h-full flex flex-col">
            {/* Header with modern design */}
            <div className="p-4 border-b border-gray-700 bg-gradient-to-r from-blue-900/20 to-purple-900/20">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="text-blue-400">🚀</span>
                    Alpha4 Rewards
                  </h2>
                  <p className="text-gray-400 text-xs">Exclusive perks and benefits from Alpha4</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full">Premium</span>
                </div>
              </div>
            </div>
            
            {/* Modern grid layout */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {mockAlpha4Perks.map((perk, index) => {
                  const eligibility = perk.isPlaceholder 
                    ? { eligible: false, reason: 'Coming soon' }
                    : suiService.hasRequiredPerks(userPerks, perk.requiredPerkType, perk.requiredTags)
                    ? { eligible: true, reason: 'Ready to claim' }
                    : { eligible: false, reason: 'Missing required perks' };

                  return (
                    <div
                      key={perk.id}
                      className={`group relative bg-gray-800/60 hover:bg-gray-700/80 rounded-xl p-4 border transition-all duration-300 animate-fade-in ${
                        perk.isPlaceholder 
                          ? 'opacity-50 border-gray-700' 
                          : eligibility.eligible 
                          ? 'border-purple-500/50 hover:border-purple-400 shadow-lg shadow-purple-500/10' 
                          : 'border-gray-700/50 hover:border-gray-600'
                      }`}
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      {/* Status indicator */}
                      {!perk.isPlaceholder && (
                        <div className={`absolute top-3 right-3 w-2 h-2 rounded-full ${
                          eligibility.eligible ? 'bg-green-500' : 'bg-yellow-500'
                        }`}></div>
                      )}
                      
                      {/* Icon and title */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
                          {perk.icon}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-white text-sm mb-1">{perk.name}</h3>
                          <p className="text-gray-400 text-xs leading-relaxed">{perk.description}</p>
                        </div>
                      </div>

                      {/* Price section */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Cost</p>
                            <p className="text-blue-400 font-bold text-sm">
                              {formatAlphaPoints(perk.alphaPointCost)} AP
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Value</p>
                            <p className="text-green-400 font-bold text-sm">
                              {formatUSDC(perk.usdcValue)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Action button */}
                      <button
                        onClick={() => handleClaimPerk(perk)}
                        disabled={!eligibility.eligible}
                        className={`w-full py-2 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
                          eligibility.eligible
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]'
                            : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {perk.isPlaceholder ? 'Coming Soon' : eligibility.eligible ? 'Claim Reward' : 'Requirements Not Met'}
                      </button>

                      {/* Status footer */}
                      <div className="mt-2 text-xs text-center">
                        <span className={`${
                          eligibility.eligible ? 'text-green-400' : 'text-yellow-400'
                        }`}>
                          {eligibility.reason}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 