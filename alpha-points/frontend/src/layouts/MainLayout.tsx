// === MainLayout.tsx (Corrected Icon Access v2) ===
import React, { ReactNode, useState, useEffect, useRef } from 'react';
import { Link, useLocation, NavLink, Outlet, useNavigate } from 'react-router-dom';
// Import necessary items from dapp-kit: ConnectButton, useCurrentAccount
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { useAlphaContext } from '../context/AlphaContext'; // Import useAlphaContext
import { formatAddress } from '../utils/format';
import alpha4Logo from '../../public/alpha4-logo.svg';
// import alphaPointsLogo from '../assets/alphapoints-logo.svg'; // Assuming path is correct if used
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate(); // Initialize navigate
  const alphaContext = useAlphaContext(); // Use AlphaContext
  const [isWalletDropdownOpen, setIsWalletDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const navLinks = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Marketplace', path: '/marketplace' },
    { name: 'Generation', path: '/generation' },
    { name: 'Loans', path: '/loans' },
    // { name: 'Partner Onboarding', path: '/partner-onboarding' }, // Removed from main nav
  ];

  // Click outside to close dropdown - MOVED INSIDE THE COMPONENT
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsWalletDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]); // Dependency array is correct

  return (
    <div className="min-h-screen flex flex-col bg-background text-white box-border overflow-y-auto lg:h-screen lg:overflow-hidden">
      {/* Header */}
      <header className="bg-background-card py-2 px-4 shadow-lg flex-shrink-0">
        <div className="container mx-auto flex justify-between items-center">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center">
              <img src={alpha4Logo} alt="Alpha4 Logo" className="w-8 h-8 object-contain object-center flex-shrink-0" />
            </Link>
            {/* Desktop Navigation */}
            <nav className="hidden md:flex ml-10 space-x-1">
              {navLinks.map((link) => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    location.pathname === link.path
                      ? 'bg-primary text-white'
                      : 'text-gray-300 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {link.name}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Wallet Connection Area */}
          <div className="flex items-center">
            {alphaContext.isConnected ? (
              <div className="relative flex items-center bg-background rounded-lg p-1 md:p-2 text-sm" ref={dropdownRef}>
                {/* Network Indicator */}
                <span className="hidden md:inline text-gray-400 mr-2 text-xs">Testnet</span>
                
                {/* Connected Account Info - Clickable Trigger */}
                <button 
                  onClick={() => setIsWalletDropdownOpen(!isWalletDropdownOpen)}
                  className="flex items-center bg-gray-800 hover:bg-gray-700 rounded-lg px-2 py-1 md:px-3 transition-colors"
                >
                  {alphaContext.provider === 'google' ? (
                    <span className="mr-2"> G </span>
                  ) : (
                    <span className="mr-2"> W </span>
                  )}
                  <span className="font-mono">{formatAddress(alphaContext.address || '')}</span>
                  <svg className={`w-3 h-3 ml-1.5 transform transition-transform duration-200 ${isWalletDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>

                {/* Dropdown Menu */}
                {isWalletDropdownOpen && (
                  <div className="absolute top-full right-0 mt-1.5 w-48 bg-background-card rounded-md shadow-lg py-1 z-50 border border-gray-700">
                    <button
                      onClick={async () => {
                        try {
                          await alphaContext.logout();
                          setIsWalletDropdownOpen(false);
                        } catch (error) {
                          console.error("Error disconnecting:", error);
                        }
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300 transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // Custom button to navigate to WelcomePage if not connected
              <button
                onClick={() => {
                  if (location.pathname !== '/') {
                    navigate('/');
                  }
                  // If already on WelcomePage, dapp-kit's ConnectButton might typically open its modal.
                  // Here, we are simplifying: if on welcome page and click this, it does nothing extra beyond what WelcomePage offers.
                  // The primary goal is to get to WelcomePage if disconnected and elsewhere.
                }}
                className="!bg-primary !hover:bg-primary-dark !text-white !py-2 !px-4 !rounded-lg !text-sm"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
       <nav className="md:hidden bg-background-card border-t border-gray-800 py-1 px-2 fixed bottom-0 left-0 right-0 z-50 shadow-lg">
         <div className="flex justify-around">
             {navLinks.map((link) => (
                 <NavLink
                     key={link.path}
                     to={link.path}
                     className={`flex flex-col items-center px-2 py-1 text-center text-xs rounded-md ${
                         location.pathname === link.path
                             ? 'text-primary font-medium'
                             : 'text-gray-400 hover:text-primary'
                     }`}
                 >
                     <span>{link.name}</span>
                 </NavLink>
             ))}
         </div>
       </nav>

      {/* Main Content Area */}
      <main className="container mx-auto px-4 pt-4 pb-0 box-border flex-grow">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-background-card py-2 px-4 text-center text-xs text-gray-500 border-t border-gray-800 flex-shrink-0 w-full">
        <div className="w-full flex flex-col items-center">
          <div className="flex flex-wrap justify-center items-center space-x-3 md:space-x-4 w-full overflow-x-auto whitespace-nowrap mb-1">
            <a href="https://alpha4.io" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">Main Site</a><span className="text-gray-600">•</span>
            <a href="https://discord.gg/VuF5NmC9Dg" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">Discord</a><span className="text-gray-600">•</span>
            <a href="https://www.linkedin.com/company/alpha4-io" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">LinkedIn</a><span className="text-gray-600">•</span>
            <a href="https://x.com/alpha4_io" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">X</a><span className="text-gray-600">•</span>
            <Link to="/partner-onboarding" className="text-gray-400 hover:text-white transition-colors">Partner Onboarding</Link>
          </div>
          <div className="w-full truncate text-gray-500 text-xs px-2 mt-1" title="Testnet demo for experimental purposes only. Features shown may not reflect final product and are subject to change without notice. Alpha Points MVP © 2025">
            Testnet demo for experimental purposes only. Features shown may not reflect final product and are subject to change without notice. Alpha Points MVP © 2025
          </div>
        </div>
      </footer>
      <ToastContainer />
    </div>
  );
};