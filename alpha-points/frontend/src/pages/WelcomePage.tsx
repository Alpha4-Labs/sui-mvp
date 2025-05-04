// === WelcomePage.tsx (Styling Refresh) ===
import React, { useEffect } from 'react';
// Use ConnectButton and useCurrentAccount as decided previously
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { useZkLogin } from '../hooks/useZkLogin';
import { useNavigate } from 'react-router-dom';
import alphaPointsLogo from '../assets/Alpha4-logo.svg'; // Verify this path

export const WelcomePage: React.FC = () => {
  const currentAccount = useCurrentAccount();
  const { login, loading: zkLoginLoading } = useZkLogin();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentAccount) {
      navigate('/dashboard');
    }
  }, [currentAccount, navigate]);

  return (
    // Use a dark background, center content vertically and horizontally
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
       {/* Constrain overall content width for better readability */}
       <div className="w-full max-w-md flex flex-col items-center text-center">

        {/* Logo: Significantly smaller, add bottom margin */}
        <img
            src={alphaPointsLogo} // Make sure this logo variable holds the correct path/import
            alt="Alpha Points Logo"
            // Adjust w/h classes as needed for your specific logo aspect ratio
            className="w-24 h-24 md:w-32 md:h-32 mb-8"
         />

        {/* Title: Apply gradient and text styles */}
        <h1 className="text-3xl md:text-4xl font-bold mb-4
                       bg-gradient-to-r from-purple-400 via-pink-500 to-red-500
                       text-transparent bg-clip-text">
          Welcome to Alpha Points
        </h1>

        {/* Subtitle: Apply text styles and constrain width */}
        <p className="text-gray-400 mb-10 text-sm md:text-base max-w-xs md:max-w-sm">
          Connect your wallet or sign in to track your points and stake ALPHA.
          {/* Optional: Add network requirement text if needed */}
          {/* <br />(Requires Sepolia Testnet) */}
        </p>

        {/* Button Container */}
        <div className="space-y-4 w-full max-w-xs">

          {/* Connect Button: Styled similar to reference */}
           <ConnectButton
             connectText="Connect Wallet"
             // Using !important prefix to help override default dapp-kit styles if necessary
             className="!w-full !bg-gradient-to-r !from-purple-600 !to-indigo-600 !hover:from-purple-700 !hover:to-indigo-700 !text-white !py-3 !px-6 !rounded-lg !font-semibold !text-base !transition-all !duration-300 shadow-lg"
           />

           {/* Google Button: Clean white style */}
           <button
             onClick={() => login('google')}
             disabled={zkLoginLoading || !!currentAccount}
             className="w-full bg-white text-gray-700 py-2.5 px-6 rounded-lg font-medium transition-colors hover:bg-gray-200 disabled:opacity-60 flex items-center justify-center border border-gray-300 shadow-sm text-sm"
           >
             <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="#4285F4"> {/* Google's blue */}
                 <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
             </svg>
             Sign in with Google
           </button>

           {/* Optional: Remove or restyle the "Found X wallets" text */}
        </div>
      </div>

      {/* Minimalist Footer */}
       <footer className="absolute bottom-0 left-0 right-0 p-4 text-center text-gray-600 text-xs">
            Alpha Points MVP © 2025 - Testnet Demo
       </footer>
    </div>
  );
};