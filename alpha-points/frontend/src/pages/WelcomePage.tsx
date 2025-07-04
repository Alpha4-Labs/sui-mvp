import React, { useEffect } from 'react';
import { 
  useWallets,
  useConnectWallet,
  useDisconnectWallet
} from '@mysten/dapp-kit';
// DEPRECATED: Removed unused zkLogin import
// import { useZkLogin } from '../hooks/useZkLogin';
import { useAlphaContext } from '../context/AlphaContext';
import { useNavigate } from 'react-router-dom';
import alphaPointsLogo from '../assets/alpha4-logo.svg'; // Verify this path
import neonLogoVideo from '../assets/Neon_Logo_01.mp4'; // Import the video
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export const WelcomePage: React.FC = () => {
  const alphaContext = useAlphaContext();
  // DEPRECATED: Removed unused zkLogin call
  // useZkLogin();
  const navigate = useNavigate();
  
  // Get all available wallets
  const wallets = useWallets();
  
  // Get the connect function from useConnectWallet
  const { mutate: connectWallet } = useConnectWallet();
  const { mutate: disconnectWallet } = useDisconnectWallet();

  // Redirect to dashboard if already connected (via AlphaContext)
  useEffect(() => {
    if (alphaContext.authLoading) return; 

    if (alphaContext.isConnected) {

      navigate('/dashboard');
    }
  }, [alphaContext.isConnected, alphaContext.authLoading, navigate]);

  // Effect to show toast if no wallets are detected
  useEffect(() => {
    // Give a brief moment for wallets to be detected, then check.
    const timer = setTimeout(() => {
      if (wallets.length === 0 && !alphaContext.authLoading && !alphaContext.isConnected) {
        toast.info(
          "No SUI wallet extensions detected. Please install a SUI wallet (e.g., Sui Wallet, Suiet) to connect.", 
          {
            position: "top-center",
            autoClose: 7000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            theme: "dark",
          }
        );
      }
    }, 1500); // Wait 1.5 seconds before showing the toast

    return () => clearTimeout(timer);
  }, [wallets, alphaContext.authLoading, alphaContext.isConnected]);

  if (alphaContext.authLoading && !alphaContext.isConnected) { // Show loading only if not yet connected, otherwise it might flash if already connected and just loading data
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-purple-900 text-white p-4">
        <div className="flex flex-col items-center animate-fade-in">
          <video 
            autoPlay 
            muted 
            loop 
            className="w-32 h-32 mb-6 animate-pulse"
            style={{ filter: 'drop-shadow(0 0 20px rgba(168, 85, 247, 0.4))' }}
          >
                         <source src={neonLogoVideo} type="video/mp4" />
            {/* Fallback for browsers that don't support video */}
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
          </video>
          <p className="text-gray-300 animate-pulse">Experience the full Alpha Points journey</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-purple-900 text-white p-4 pb-16 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-blue-900/20 opacity-50"></div>
      <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
      <div className="absolute top-40 right-20 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-40 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>

      <div className="w-full max-w-6xl flex flex-col items-center relative z-10 flex-1 justify-center -mt-16">
        <div className="text-center mb-6 animate-fade-in">
          {/* Logo Container */}
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full blur-2xl opacity-50 animate-pulse"></div>
            <div className="relative bg-black/20 backdrop-blur-lg border border-white/10 rounded-2xl p-4 shadow-2xl">
              <img
                src={alphaPointsLogo}
                alt="Alpha Points Logo"
                className="w-12 h-12 md:w-16 md:h-16 mx-auto filter drop-shadow-lg"
              />
            </div>
          </div>

          <h1 className="text-3xl md:text-5xl font-bold mb-4 animate-slide-up">
            <span className="bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 text-transparent bg-clip-text">
              Welcome to
            </span>
            <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 text-transparent bg-clip-text">
              {" "}Alpha4
            </span>
          </h1>

          <p className="text-gray-300 mb-8 text-base md:text-lg max-w-2xl mx-auto leading-relaxed animate-slide-up animation-delay-200">
            Connect your wallet and enter the realm of bounless rewards and opportunities
            <br className="hidden md:block" />
            <span className="text-purple-400">Your journey to free flowing, cross application rewards lives here.</span>
          </p>
        </div>

        <div className="w-full max-w-4xl animate-slide-up animation-delay-400">
          <h2 className="text-lg font-semibold mb-8 text-center">Choose Your Wallet</h2>
          
          {wallets.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <p className="text-gray-400">No wallets detected</p>
              <p className="text-sm text-gray-500 mt-2">Please install a SUI wallet extension</p>
            </div>
          ) : (
            <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 justify-items-center ${wallets.length > 10 ? 'max-h-[480px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-purple-600 scrollbar-track-gray-800' : ''}`}>
              {wallets.map((wallet, index) => (
                <button
                  key={wallet.name}
                  onClick={async () => {

                    try {
                      await disconnectWallet();
                      console.log('Disconnect call completed.');
                    } catch (disconnectError) {

                    }

                    console.log('Attempting to connect to wallet:', wallet.name, wallet);
                    try {
                      await connectWallet({ wallet });

                    } catch (err) {
                      
                    }
                  }}
                  className="group relative bg-black/20 backdrop-blur-lg border border-white/10 rounded-2xl p-6 w-full max-w-[180px] aspect-square flex flex-col items-center justify-center space-y-3 hover:bg-black/30 hover:border-purple-500/50 hover:scale-105 transition-all duration-300 animate-fade-in shadow-2xl hover:shadow-purple-500/20"
                  style={{ animationDelay: `${600 + index * 100}ms` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-blue-600/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  
                  <div className="relative z-10 flex flex-col items-center space-y-3">
                    {wallet.icon && (
                      <div className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-xl group-hover:bg-white/10 transition-colors duration-300">
                        <img 
                          src={wallet.icon} 
                          alt={`${wallet.name} icon`} 
                          className="w-8 h-8 group-hover:scale-110 transition-transform duration-300" 
                        />
                      </div>
                    )}
                    <span className="text-sm font-medium text-center group-hover:text-purple-300 transition-colors duration-300">
                      {wallet.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <footer className="relative z-10 p-4 text-center text-gray-500 text-sm">
        <div className="flex justify-center items-center space-x-2">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
          <span>Alpha4 MVP © 2025 - Testnet Environment</span>
        </div>
      </footer>
    </div>
  );
};

export default WelcomePage;