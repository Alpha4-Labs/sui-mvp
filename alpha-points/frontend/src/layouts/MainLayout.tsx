// === MainLayout.tsx (Corrected Icon Access v2) ===
import React, { ReactNode, useState, useEffect, useRef } from 'react';
import { Link, useLocation, NavLink, Outlet, useNavigate } from 'react-router-dom';
// Import necessary items from dapp-kit: ConnectButton, useCurrentAccount, useWallets
import { ConnectButton, useCurrentAccount, useWallets } from '@mysten/dapp-kit';
import { useAlphaContext } from '../context/AlphaContext'; // Import useAlphaContext
import { usePartnerDetection } from '../hooks/usePartnerDetection';
// Removed TVL calculation import - not needed anymore
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
  const dropdownMenuRef = useRef<HTMLDivElement>(null);

  // --- USE GLOBAL MODE STATE ---
  const { mode, setMode, setPartnerCaps } = alphaContext;
  const { detectPartnerCaps, getPrimaryPartnerCap, hasPartnerCap, isLoading: partnerDetecting, error: partnerError } = usePartnerDetection();

  // Removed platform statistics - not needed anymore

  // Nav links by mode
  const userNavLinks = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Marketplace', path: '/marketplace' },
    { name: 'Generation', path: '/generation' },
    { name: 'Analytics', path: '/analytics' },
    { name: 'Loans', path: '/loans' },
  ];
  const partnerNavLinks = [
    { name: 'Overview', path: '/partners/overview' },
    { name: 'Perks', path: '/partners/perks' },
    { name: 'Analytics', path: '/partners/analytics' },
    { name: 'Settings', path: '/partners/settings' },
  ];
  const navLinks = mode === 'partner' ? partnerNavLinks : userNavLinks;

  // Click outside to close dropdown - Updated to handle both button and dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const isOutsideButton = dropdownRef.current && !dropdownRef.current.contains(event.target as Node);
      const isOutsideDropdown = dropdownMenuRef.current && !dropdownMenuRef.current.contains(event.target as Node);
      
      if (isOutsideButton && isOutsideDropdown) {
        setIsWalletDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef, dropdownMenuRef]);

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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-purple-900 text-white box-border overflow-y-auto lg:h-screen lg:overflow-hidden">
      {/* Header */}
      <header className="bg-black/10 backdrop-blur-lg border-b border-white/10 py-3 px-4 shadow-xl flex-shrink-0">
        <div className="container mx-auto flex justify-between items-center">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center group">
              <div className="p-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 shadow-lg group-hover:shadow-purple-500/25 transition-all duration-300">
                <img src={alpha4Logo} alt="Alpha4 Logo" className="w-6 h-6 object-contain object-center flex-shrink-0" />
              </div>
            </Link>
            {/* Desktop Navigation */}
            <nav className="hidden md:flex ml-8 space-x-2">
              {navLinks.map((link) => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  className={({ isActive }) => `
                    px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 relative
                    ${isActive
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/25'
                      : 'text-gray-300 hover:text-white hover:bg-white/10 hover:backdrop-blur-sm'
                    }
                  `}
                >
                  {link.name}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Platform Statistics - Removed to eliminate API calls */}

          {/* Wallet Connection Area */}
          <div className="flex items-center">
            {alphaContext.isConnected ? (
              <div className="relative flex items-center z-[9998]" ref={dropdownRef}>
                {/* Network Indicator */}
                <span className="hidden md:inline text-gray-400 mr-3 text-sm bg-amber-500/20 px-2 py-1 rounded-lg">Testnet</span>
                
                {/* Connected Account Info - Clickable Trigger */}
                <button 
                  onClick={() => setIsWalletDropdownOpen(!isWalletDropdownOpen)}
                  className="flex items-center bg-black/20 backdrop-blur-lg border border-white/10 hover:border-white/20 rounded-xl px-4 py-2 transition-all duration-300 hover:bg-black/30"
                >
                  {alphaContext.provider === 'google' ? (
                    <div className="w-5 h-5 bg-gradient-to-r from-red-500 to-yellow-500 rounded-full mr-2 flex items-center justify-center text-xs font-bold text-white">G</div>
                  ) : (
                    <div className="w-5 h-5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mr-2 flex items-center justify-center text-xs font-bold text-white">W</div>
                  )}
                  <span className="font-mono text-sm">{formatAddress(alphaContext.address || '')}</span>
                  <svg className={`w-4 h-4 ml-2 transform transition-transform duration-200 ${isWalletDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>

                {/* Dropdown Menu - Moved outside of header to avoid stacking context issues */}
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
                className="btn-modern-primary"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <nav className="md:hidden bg-black/20 backdrop-blur-lg border-t border-white/10 py-3 px-4 fixed bottom-0 left-0 right-0 z-50 shadow-2xl">
        <div className="flex justify-around">
          {navLinks.map((link, index) => (
            <NavLink
              key={link.path}
              to={link.path}
              className={({ isActive }) => `
                flex flex-col items-center px-3 py-2 text-center text-xs rounded-lg transition-all duration-300
                ${isActive
                  ? 'text-purple-400 bg-purple-500/10 font-medium'
                  : 'text-gray-400 hover:text-purple-400 hover:bg-white/5'
                }
              `}
              style={{animationDelay: `${index * 0.1}s`}}
            >
              <span className="animate-fade-in">{link.name}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="container mx-auto px-4 pt-6 pb-20 md:pb-6 box-border flex-grow overflow-hidden">
        <div className="animate-fade-in">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-black/10 backdrop-blur-lg border-t border-white/10 py-4 px-4 text-center text-sm text-gray-400 flex-shrink-0 w-full">
        <div className="w-full flex flex-col items-center space-y-2">
          <div className="flex flex-wrap justify-center items-center space-x-4 md:space-x-6 w-full">
            <a href="https://alpha4.io" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-purple-400 transition-colors duration-300">Main Site</a>
            <span className="text-gray-600">•</span>
            <a href="https://discord.gg/VuF5NmC9Dg" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-purple-400 transition-colors duration-300">Discord</a>
            <span className="text-gray-600">•</span>
            <a href="https://www.linkedin.com/company/alpha4-io" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-purple-400 transition-colors duration-300">LinkedIn</a>
            <span className="text-gray-600">•</span>
            <a href="https://x.com/alpha4_io" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-purple-400 transition-colors duration-300">X</a>
            <span className="text-gray-600">•</span>
            {/* Footer toggle button */}
            <button
              onClick={handleFooterToggle}
              className="text-gray-400 hover:text-purple-400 transition-colors duration-300 underline decoration-dotted underline-offset-2 focus:outline-none disabled:opacity-50"
              disabled={partnerDetecting}
            >
              {mode === 'partner' ? '🏠 Home' : '🤝 Partners'}
            </button>
          </div>
          <div className="w-full text-center text-gray-500 text-xs px-4" title="Testnet demo for experimental purposes only. Features shown may not reflect final product and are subject to change without notice. Alpha Points MVP © 2025">
            Testnet demo • Alpha Points MVP © 2025
          </div>
        </div>
      </footer>
      
      {/* Wallet Dropdown - Positioned outside header to avoid stacking context issues */}
      {isWalletDropdownOpen && alphaContext.isConnected && (
        <div ref={dropdownMenuRef} className="fixed top-16 right-4 w-48 bg-black/90 backdrop-blur-lg border border-white/20 rounded-xl py-2 z-[9999] animate-fade-in shadow-xl shadow-purple-500/25" style={{ filter: 'drop-shadow(0 0 20px rgba(168, 85, 247, 0.3))' }}>
          <button
            onClick={async () => {
              try {
                await alphaContext.logout();
                setIsWalletDropdownOpen(false);
              } catch (error) {
                console.error("Error disconnecting:", error);
              }
            }}
            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-300 rounded-lg mx-2"
          >
            Disconnect
          </button>
        </div>
      )}

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
          backgroundColor: 'rgba(17, 24, 39, 0.8)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          color: '#ffffff'
        }}
      />
    </div>
  );
};