// === MainLayout.tsx (Corrected Icon Access v2) ===
import React, { ReactNode, useState, useEffect, useRef } from 'react';
import { Link, useLocation, NavLink, Outlet, useNavigate } from 'react-router-dom';
// Import necessary items from dapp-kit: ConnectButton, useCurrentAccount, useWallets
import { ConnectButton, useCurrentAccount, useWallets } from '@mysten/dapp-kit';
import { useAlphaContext } from '../context/AlphaContext'; // Import useAlphaContext
import { usePartnerDetection } from '../hooks/usePartnerDetection';
import { useTVLCalculation } from '../hooks/useTVLCalculation';
import { formatAddress } from '../utils/format';
import alpha4Logo from '../../public/alpha4-logo.svg';
// import alphaPointsLogo from '../assets/alphapoints-logo.svg'; // Assuming path is correct if used
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { toast } from 'react-toastify'; // Import toast

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const alphaContext = useAlphaContext();
  const wallets = useWallets();
  const [isWalletDropdownOpen, setIsWalletDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // --- USE GLOBAL MODE STATE ---
  const { mode, setMode, setPartnerCaps } = alphaContext;
  const { detectPartnerCaps, getPrimaryPartnerCap, hasPartnerCap, isLoading: partnerDetecting, error: partnerError } = usePartnerDetection();

  // Platform statistics
  const { totalStakedSui, totalTVL, stakeCount, isLoading: isLoadingStats, error: statsError, refreshTVL: refetchStats } = useTVLCalculation();

  // Nav links by mode
  const userNavLinks = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Marketplace', path: '/marketplace' },
    { name: 'Generation', path: '/generation' },
    { name: 'Loans', path: '/loans' },
  ];
  const partnerNavLinks = [
    { name: 'Overview', path: '/partners/overview' },
    { name: 'Perks', path: '/partners/perks' },
    { name: 'Analytics', path: '/partners/analytics' },
    { name: 'Settings', path: '/partners/settings' },
  ];
  const navLinks = mode === 'partner' ? partnerNavLinks : userNavLinks;

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

  // --- Footer Button Handler ---
  const handleFooterToggle = async () => {
    if (mode === 'user') {
      // Try to detect partner cap
      try {
        const detectedCaps = await detectPartnerCaps();
        
        if (detectedCaps.length > 0) {
          // Store caps in global state
          setPartnerCaps(detectedCaps);
          setMode('partner');
          navigate('/partners/overview');
          toast.success('Partner mode activated!');
        } else {
          // No partnercap found - take user to onboarding page
          setPartnerCaps([]);
          navigate('/partners');
          toast.info('No partner capabilities found. Create one to access partner features.');
        }
      } catch (err: any) {
        toast.error(`Error detecting partner capabilities: ${err.message || err}`);
        // Still navigate to partners page so they can try to create one
        setPartnerCaps([]);
        navigate('/partners');
      }
    } else {
      // Switch back to user mode
      setMode('user');
      setPartnerCaps([]); // Clear partner caps when switching back
      navigate('/dashboard');
    }
  };

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

          {/* Platform Statistics */}
          <div className="hidden md:flex items-center space-x-4 text-sm lg:space-x-6">
            {!isLoadingStats && !statsError && alphaContext.isConnected && (
              <>
                <div className="text-center">
                  <div className="text-blue-400 font-semibold">
                    {totalStakedSui.toLocaleString(undefined, { maximumFractionDigits: 1 })} SUI
                  </div>
                  <div className="text-gray-400 text-xs">Staked SUI</div>
                </div>
                <div className="text-center">
                  <div className="text-green-400 font-semibold">
                    ${totalTVL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-gray-400 text-xs">Total TVL</div>
                </div>
                <div className="text-center hidden lg:block">
                  <div className="text-purple-400 font-semibold">{stakeCount.toLocaleString()}</div>
                  <div className="text-gray-400 text-xs">Active Stakes</div>
                </div>
                <button
                  onClick={refetchStats}
                  className="p-1 text-gray-400 hover:text-white transition-colors rounded hover:bg-gray-700"
                  title="Refresh TVL data"
                  disabled={isLoadingStats}
                >
                  <svg className={`w-4 h-4 ${isLoadingStats ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                </button>
              </>
            )}
            {isLoadingStats && alphaContext.isConnected && (
              <div className="flex items-center text-gray-400">
                <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-xs">Loading TVL...</span>
              </div>
            )}
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
                  if (wallets.length === 0) {
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
                  if (location.pathname !== '/') {
                    navigate('/');
                  }
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
      <main className="container mx-auto px-4 pt-4 pb-16 md:pb-0 box-border flex-grow overflow-hidden">
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
            {/* Footer toggle button */}
            <button
              onClick={handleFooterToggle}
              className="text-gray-400 hover:text-white transition-colors underline focus:outline-none"
              disabled={partnerDetecting}
            >
              {mode === 'partner' ? 'Home' : 'Partners'}
            </button>
          </div>
          <div className="w-full truncate text-gray-500 text-xs px-2 mt-1" title="Testnet demo for experimental purposes only. Features shown may not reflect final product and are subject to change without notice. Alpha Points MVP © 2025">
            Testnet demo for experimental purposes only. Features shown may not reflect final product and are subject to change without notice. Alpha Points MVP © 2025
          </div>
        </div>
      </footer>
      {/* Toast Container */}
      <ToastContainer 
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
        toastStyle={{
          backgroundColor: '#1f2937',
          color: '#ffffff',
          border: '1px solid #374151'
        }}
      />
    </div>
  );
};