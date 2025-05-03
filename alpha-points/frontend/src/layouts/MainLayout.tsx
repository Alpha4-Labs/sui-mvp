import React, { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWallets, ConnectButton, WalletIcon } from '@mysten/dapp-kit';
import { formatAddress } from '../utils/format';
import alphaPointsLogo from '../assets/alphapoints-logo.svg';

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();
  const { currentAccount } = useWallets();
  
  // Navigation links
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
          <div className="flex items-center">
          <Link to="/dashboard" className="flex items-center">
            <span className="text-2xl font-bold text-primary mr-1">α</span>
            <span className="text-xl font-bold text-white">Points</span>
          </Link>
            
            <nav className="hidden md:flex ml-10">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3 py-2 text-sm font-medium rounded-md mr-2 ${
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
          
          <div className="flex items-center">
            {currentAccount ? (
              <div className="flex items-center bg-background rounded-lg p-2">
                <span className="hidden md:inline text-gray-300 mr-2">sepolia</span>
                <div className="flex items-center bg-gray-800 rounded-lg px-3 py-1">
                  <WalletIcon wallet={currentAccount.wallet} className="h-4 w-4 mr-2" />
                  <span className="text-sm">{formatAddress(currentAccount.address)}</span>
                </div>
              </div>
            ) : (
              <ConnectButton className="bg-primary hover:bg-primary-dark text-white py-2 px-4 rounded-lg" />
            )}
          </div>
        </div>
      </header>
      
      {/* Mobile Navigation */}
      <div className="md:hidden bg-background-card border-t border-gray-800 py-2 px-4">
        <div className="flex justify-between">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`px-3 py-2 text-center text-sm ${
                location.pathname === link.path
                  ? 'text-primary font-medium'
                  : 'text-gray-400'
              }`}
            >
              {link.name}
            </Link>
          ))}
        </div>
      </div>
      
      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-8">
        {children}
      </main>
      
      {/* Footer */}
      <footer className="bg-background-card py-6 px-4">
        <div className="container mx-auto">
          <div className="flex justify-center space-x-4 mb-4">
            <a href="#" className="text-gray-400 hover:text-white transition-colors">Main Site</a>
            <span className="text-gray-600">•</span>
            <a href="#" className="text-gray-400 hover:text-white transition-colors">Discord</a>
            <span className="text-gray-600">•</span>
            <a href="#" className="text-gray-400 hover:text-white transition-colors">LinkedIn</a>
            <span className="text-gray-600">•</span>
            <a href="#" className="text-gray-400 hover:text-white transition-colors">X</a>
          </div>
          
          <div className="text-center text-gray-500 text-sm">
            Testnet demo for experimental purposes only. Features shown may not reflect final product and are subject to change without notice.
          </div>
          
          <div className="text-center text-gray-500 text-sm mt-1">
            Alpha Points MVP © 2025
          </div>
        </div>
      </footer>
    </div>
  );
};