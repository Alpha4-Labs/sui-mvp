// === WelcomePage.tsx (Refactored using ConnectButton and useCurrentAccount) ===
import React, { useEffect } from 'react';
// Import ConnectButton and useCurrentAccount
// Remove imports for useWallets, useConnectWallet, useAccountConnection, ConnectionStatus
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { useZkLogin } from '../hooks/useZkLogin'; // Keep using your zkLogin hook
import { useNavigate } from 'react-router-dom';
import alphaPointsLogo from '../assets/Alpha4-logo.svg'; // Ensure path is correct

export const WelcomePage: React.FC = () => {
  // Use useCurrentAccount to determine connection status reliably
  // It returns the WalletAccount object if connected, otherwise null
  const currentAccount = useCurrentAccount();
  const { login, loading: zkLoginLoading } = useZkLogin();
  const navigate = useNavigate();

  // Redirect to dashboard if already connected (account exists)
  useEffect(() => {
    if (currentAccount) {
      console.log("WelcomePage: Account detected, navigating to dashboard");
      navigate('/dashboard');
    }
  }, [currentAccount, navigate]);

  // No need for handleConnectWallet or manual status hooks - ConnectButton handles it

  return (
    <div className="min-h-screen flex flex-col bg-background-card text-white">
      <div className="flex-grow flex flex-col items-center justify-center p-6">
        <img src={alphaPointsLogo} alt="Alpha Points" className="w-40 mb-12" />

        <h1 className="text-4xl font-bold text-center bg-gradient-to-r from-purple-400 to-pink-500 text-transparent bg-clip-text mb-4">
          Welcome to Alpha Points
        </h1>

        <p className="text-center text-gray-300 mb-12 max-w-md">
          Connect your wallet or sign in to track your points and stake ALPHA.
        </p>

        <div className="space-y-4 w-full max-w-xs">
          {/* Use the dapp-kit ConnectButton component */}
          {/* It will render a button that opens a wallet selection modal */}
          <ConnectButton
            // You can customize the text if needed
            // connectText="Connect Standard Wallet"
            // connectedText={`Connected: ${currentAccount?.address.slice(0, 6)}...`} // Example custom connected text
            // Apply styling - you might need !important or more specific selectors
            // if Tailwind utility classes conflict with default ConnectButton styles.
            className="!w-full !bg-primary !hover:bg-primary-dark !text-white !py-3 !px-6 !rounded-lg !font-medium !transition-colors"
          />

          {/* zkLogin Button */}
          <button
            onClick={() => login('google')} // Assuming zkLogin handles its own flow
            // Disable zkLogin button if already connected via *any* wallet
            disabled={zkLoginLoading || !!currentAccount}
            className="w-full bg-white text-gray-800 py-3 px-6 rounded-lg font-medium transition-colors hover:bg-gray-100 disabled:opacity-50 flex items-center justify-center"
          >
            {/* Google Icon SVG */}
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg>
            Sign in with Google
          </button>

           {/* Optional: Text indicating wallet status could be removed as ConnectButton shows state */}
           {/* <div className="text-xs text-center text-gray-500 mt-3">...</div> */}
        </div>
      </div>

      {/* Footer */}
      <footer className="p-4 text-center text-gray-500 text-sm">
         <div className="flex justify-center space-x-4 mb-2">
             <a href="#" className="hover:text-gray-300 transition-colors">Main Site</a><span>•</span>
             <a href="#" className="hover:text-gray-300 transition-colors">Discord</a><span>•</span>
             <a href="#" className="hover:text-gray-300 transition-colors">LinkedIn</a><span>•</span>
             <a href="#" className="hover:text-gray-300 transition-colors">X</a>
         </div>
         <div> Testnet demo for experimental purposes only. Features shown may not reflect final product and are subject to change without notice. </div>
         <div className="mt-1"> Alpha Points MVP © 2025 </div>
      </footer>
    </div>
  );
};