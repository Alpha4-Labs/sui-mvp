import React, { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
// Ensure all necessary icons are imported
import { ChevronDownIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/20/solid';

// Header Component with Navigation and Disconnect
function Header({ userAddress, network, onConnectWallet, currentView, setCurrentView, disconnectWallet }) {
  // Helper to format wallet address
  const formatAddress = (addr) => addr ? `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}` : '';

  // Style helper for navigation buttons
  const navButtonStyle = (viewName) => {
    const baseStyle = "px-4 py-2 rounded-md text-sm font-medium transition duration-200 ease-in-out";
    const activeStyle = "bg-purple-600 text-white shadow-md";
    const inactiveStyle = "text-gray-300 hover:bg-gray-700 hover:text-white";
    return `${baseStyle} ${currentView === viewName ? activeStyle : inactiveStyle}`;
  };

  return (
    <header className="w-full max-w-5xl flex flex-col sm:flex-row justify-between items-center p-4 space-y-4 sm:space-y-0">
      {/* Logo */}
      <div className="text-2xl font-semibold text-white flex-shrink-0">
        <span className="text-purple-400">α</span>Points
      </div>

      {/* Navigation (only show if connected) */}
      {userAddress && (
        // --- RESTORED Navigation Buttons ---
        <nav className="flex space-x-1 sm:space-x-2 bg-gray-800 bg-opacity-70 p-1.5 rounded-lg border border-gray-700 shadow-sm">
          <button onClick={() => setCurrentView('dashboard')} className={navButtonStyle('dashboard')}>
            Dashboard
          </button>
          <button onClick={() => setCurrentView('marketplace')} className={navButtonStyle('marketplace')}>
            Marketplace
          </button>
          <button onClick={() => setCurrentView('generation')} className={navButtonStyle('generation')}>
            Generation
          </button>
        </nav>
        // --- END RESTORED ---
      )}

      {/* Wallet Info / Disconnect Dropdown */}
      <div className="flex-shrink-0">
        {userAddress ? (
          <Menu as="div" className="relative inline-block text-left">
            <div>
              <Menu.Button className="inline-flex w-full justify-center items-center space-x-2 bg-gray-700 bg-opacity-70 px-3 py-2 rounded-lg shadow border border-gray-600 text-sm font-medium text-gray-200 hover:bg-gray-600/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 transition duration-150">
                <span className="text-xs text-gray-400 hidden md:inline">{network ? `${network.name}` : 'Network...'}</span>
                <span className="font-mono text-sm bg-gray-800 px-3 py-1 rounded">{formatAddress(userAddress)}</span>
                <ChevronDownIcon className="ml-1 h-4 w-4 text-gray-400" aria-hidden="true" />
              </Menu.Button>
            </div>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right divide-y divide-gray-600 rounded-md bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-gray-700 z-50">
                <div className="px-1 py-1">
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={disconnectWallet} // Call disconnect passed from App
                        className={`${ active ? 'bg-purple-600 text-white' : 'text-gray-300' } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                      >
                        <ArrowRightOnRectangleIcon className="mr-2 h-5 w-5" aria-hidden="true" />
                        Disconnect
                      </button>
                    )}
                  </Menu.Item>
                </div>
              </Menu.Items>
            </Transition>
          </Menu>
        ) : (
          null // Keep header clean when disconnected; connect prompt is in App.jsx
        )}
      </div>
    </header>
  );
}

export default Header;
