// === MainLayout.tsx (Corrected Icon Access v2) ===
import React, { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
// Import necessary items from dapp-kit: ConnectButton, useCurrentAccount
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { formatAddress } from '../utils/format';
// import alphaPointsLogo from '../assets/alphapoints-logo.svg'; // Assuming path is correct if used

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();
  // Use useCurrentAccount - returns WalletAccount | null
  const currentAccount = useCurrentAccount();

  const navLinks = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Marketplace', path: '/marketplace' },
    { name: 'Generation', path: '/generation' },
    { name: 'Loans', path: '/loans' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-white">
      {/* Header */}
      <header className="bg-background-card py-4 px-6 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center">
              <span className="text-2xl font-bold text-primary mr-1">α</span>
              <span className="text-xl font-bold text-white">Points</span>
            </Link>
            {/* Desktop Navigation */}
            <nav className="hidden md:flex ml-10 space-x-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    location.pathname === link.path
                      ? 'bg-primary text-white'
                      : 'text-gray-300 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
            </nav>
          </div>

          {/* Wallet Connection Area */}
          <div className="flex items-center">
            {currentAccount ? (
              <div className="flex items-center bg-background rounded-lg p-1 md:p-2 text-sm">
                {/* Network Indicator */}
                <span className="hidden md:inline text-gray-400 mr-2 text-xs">Testnet</span>
                {/* Connected Account Info */}
                <div className="flex items-center bg-gray-800 rounded-lg px-2 py-1 md:px-3">
                  {/* Display wallet icon using img tag and icon directly from WalletAccount */}
                  {/* Check if the 'icon' property exists directly on currentAccount */}
                  {currentAccount.icon && (
                    <img
                       src={currentAccount.icon} // Use icon directly from currentAccount
                       alt="Wallet icon" // Generic alt text
                       className="h-4 w-4 mr-2 rounded-full"
                     />
                  )}
                  {/* Display formatted address */}
                  <span className="font-mono">{formatAddress(currentAccount.address)}</span>
                </div>
                 {/* You could place <ConnectButton /> here too - it adapts display based on state */}
                 {/* <ConnectButton /> */}
              </div>
            ) : (
              // Show ConnectButton if not connected
              <ConnectButton className="!bg-primary !hover:bg-primary-dark !text-white !py-2 !px-4 !rounded-lg !text-sm" />
            )}
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
       <nav className="md:hidden bg-background-card border-t border-gray-800 py-1 px-2 fixed bottom-0 left-0 right-0 z-50 shadow-lg">
         <div className="flex justify-around">
             {navLinks.map((link) => (
                 <Link
                     key={link.path}
                     to={link.path}
                     className={`flex flex-col items-center px-2 py-1 text-center text-xs rounded-md ${
                         location.pathname === link.path
                             ? 'text-primary font-medium'
                             : 'text-gray-400 hover:text-primary'
                     }`}
                 >
                     <span>{link.name}</span>
                 </Link>
             ))}
         </div>
       </nav>

      {/* Main Content Area */}
      <main className="flex-grow container mx-auto px-4 py-8 pb-20 md:pb-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-background-card py-4 px-4 text-center text-xs text-gray-500 border-t border-gray-800">
         <div className="container mx-auto">
             <div className="flex justify-center space-x-3 md:space-x-4 mb-2">
                 <a href="https://alpha4.io" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">Main Site</a><span className="text-gray-600">•</span>
                 <a href="https://discord.gg/VuF5NmC9Dg" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">Discord</a><span className="text-gray-600">•</span>
                 <a href="https://www.linkedin.com/company/alpha4-io" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">LinkedIn</a><span className="text-gray-600">•</span>
                 <a href="https://x.com/alpha4_io" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">X</a>
             </div>
             <div className="text-gray-500 text-xs px-2"> Testnet demo for experimental purposes only. Features shown may not reflect final product and are subject to change without notice. </div>
             <div className="text-gray-500 text-xs mt-1"> Alpha Points MVP © 2025 </div>
         </div>
      </footer>
    </div>
  );
};