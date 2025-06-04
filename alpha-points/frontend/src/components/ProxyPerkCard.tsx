import React from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

interface ProxyPerkCardProps {
  partnerCapIdForProxy: string;
  setPartnerCapIdForProxy: (v: string) => void;
  suinsParentNftId: string;
  setSuinsParentNftId: (v: string) => void;
  isLoadingProxyCap: boolean;
  currentWallet: any;
  onSubmit: (e: React.FormEvent) => void;
  errorMsg?: string;
}

export const ProxyPerkCard: React.FC<ProxyPerkCardProps> = ({
  partnerCapIdForProxy,
  setPartnerCapIdForProxy,
  suinsParentNftId,
  setSuinsParentNftId,
  isLoadingProxyCap,
  currentWallet,
  onSubmit,
  errorMsg,
}) => {
  return (
    // This outer div ensures the content is centered within the Swiper slide and takes full height
    // It also provides some top padding if desired (adjust pt-4 as needed, or remove if holder handles padding)
    <div className="flex flex-col h-full w-full items-center justify-start pt-4 px-2 md:px-4">
      {/* This inner div constrains the width and manages vertical distribution of content */}
      <div className="w-full max-w-md flex flex-col flex-grow">
        <div>
          <h2 className="text-lg font-semibold mb-4 text-center">Manage ProxyCap</h2>
          <p className="text-gray-400 text-center mb-3 text-sm">
            Create a ProxyCap to associate a SuiNS domain with your PartnerCap for specific perk types.
          </p>
          {!currentWallet && (
            <p className="text-red-500 mb-3 text-center text-xs">Please connect your wallet.</p>
          )}
          {errorMsg && (
            <p className="text-red-500 mb-3 text-center text-xs">{errorMsg}</p>
          )}
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label htmlFor="partnerCapIdForProxy" className="block text-xs font-medium text-gray-300 mb-1">
                Your Existing PartnerCap Object ID
              </label>
              <Input
                type="text"
                id="partnerCapIdForProxy"
                value={partnerCapIdForProxy}
                onChange={(e) => setPartnerCapIdForProxy(e.target.value)}
                placeholder="0x..."
                disabled={isLoadingProxyCap || !currentWallet}
                className="w-full"
              />
            </div>
            <div>
              <label htmlFor="suinsParentNftId" className="block text-xs font-medium text-gray-300 mb-1">
                SuiNS Parent Domain NFT Object ID
              </label>
              <Input
                type="text"
                id="suinsParentNftId"
                value={suinsParentNftId}
                onChange={(e) => setSuinsParentNftId(e.target.value)}
                placeholder="0x... (e.g., object ID of 'yourname.sui')"
                disabled={isLoadingProxyCap || !currentWallet}
                className="w-full"
              />
            </div>
          </form>
        </div>
        <div className="flex-grow" /> {/* This pushes the button to the bottom */}
        <Button type="submit" disabled={isLoadingProxyCap || !currentWallet} className="w-full py-2 text-sm mt-2" onClick={onSubmit}>
          {isLoadingProxyCap ? 'Processing...' : 'Create Proxy Cap'}
        </Button>
      </div>
    </div>
  );
}; 