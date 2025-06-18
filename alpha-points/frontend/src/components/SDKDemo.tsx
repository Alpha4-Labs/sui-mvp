import React, { useState } from 'react';
import { SDKConfigurationDashboard } from './SDKConfigurationDashboard';
import { Button } from './ui/Button';

// Mock partner cap for demo
const mockPartnerCap = {
  id: '0x123456789abcdef',
  partnerName: 'Demo Business',
  currentEffectiveUsdcValue: 10000,
  totalPointsMintedLifetime: 50000,
  pointsMintedToday: 1500,
  totalPerksCreated: 5,
  isPaused: false
};

export const SDKDemo: React.FC = () => {
  const [showSDKConfig, setShowSDKConfig] = useState(false);
  const [showCodeExample, setShowCodeExample] = useState(false);

  return (
    <div className="bg-gray-900 text-white min-h-screen">
      <div className="max-w-4xl mx-auto p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">🔗 Zero-Dev SDK Configuration</h1>
          <p className="text-gray-400 text-lg mb-8">
            Transform any website into a blockchain rewards platform with zero development effort
          </p>
          
          <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-purple-700/30 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">What is the Zero-Dev SDK?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              <div>
                <h3 className="text-purple-400 font-medium mb-2">🚀 For Partners</h3>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• Configure events and point rewards</li>
                  <li>• Set allowed domains for security</li>
                  <li>• Generate integration code automatically</li>
                  <li>• Monitor usage and analytics</li>
                  <li>• Customize UI branding</li>
                </ul>
              </div>
              <div>
                <h3 className="text-blue-400 font-medium mb-2">💻 For Websites</h3>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• Single script tag integration</li>
                  <li>• Auto-detects user actions</li>
                  <li>• Real-time point notifications</li>
                  <li>• Works with any website</li>
                  <li>• No backend required</li>
                </ul>
              </div>
            </div>
          </div>

          <Button 
            onClick={() => setShowSDKConfig(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 text-lg"
          >
            🔧 Open SDK Configuration Dashboard
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="text-center">
              <div className="text-3xl mb-2">⚡</div>
              <h3 className="font-semibold mb-2">Event Configuration</h3>
              <p className="text-sm text-gray-400">
                Set up point rewards for user actions like signups, purchases, and social shares
              </p>
            </div>
          </div>
          
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="text-center">
              <div className="text-3xl mb-2">⚙️</div>
              <h3 className="font-semibold mb-2">Security Settings</h3>
              <p className="text-sm text-gray-400">
                Control which domains can use your SDK and configure rate limiting
              </p>
            </div>
          </div>
          
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="text-center">
              <div className="text-3xl mb-2">🔗</div>
              <h3 className="font-semibold mb-2">Integration Code</h3>
              <p className="text-sm text-gray-400">
                Copy-paste ready HTML code to add to any website
              </p>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Button 
            onClick={() => setShowCodeExample(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 text-lg"
          >
            📋 View Integration Example
          </Button>
        </div>
      </div>

      {/* Integration Code Example Modal */}
      {showCodeExample && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">📋 SDK Integration Code</h2>
              <button
                onClick={() => setShowCodeExample(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">HTML Integration</h3>
                <p className="text-gray-300 text-sm mb-4">Add this script tag to your website's HTML:</p>
                <pre className="bg-gray-900 border border-gray-600 rounded p-4 text-sm overflow-x-auto whitespace-pre-wrap text-gray-300">
{`<!-- Add this to your website's HTML -->
<script 
    src="https://cdn.alphapoints.com/sui-points-adapter.js"
    data-package-id="0x123..."
    data-partner-cap-id="${mockPartnerCap.id}"
    data-rpc-url="https://fullnode.testnet.sui.io:443"
    data-allowed-origins="yoursite.com"
    data-enable-notifications="true">
</script>`}
                </pre>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Automatic Event Detection</h3>
                <p className="text-gray-300 text-sm mb-4">The SDK automatically detects and rewards these user actions:</p>
                <div className="bg-gray-900 border border-gray-600 rounded p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-green-400">✅</span>
                      <span className="text-gray-300">User signups (50 points)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-400">✅</span>
                      <span className="text-gray-300">Purchases (100 points)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-400">✅</span>
                      <span className="text-gray-300">Newsletter subscriptions (25 points)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-400">✅</span>
                      <span className="text-gray-300">Social media shares (15 points)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-400">✅</span>
                      <span className="text-gray-300">Profile completions (75 points)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-400">✅</span>
                      <span className="text-gray-300">Custom events (configurable)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-700">
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(`<!-- Add this to your website's HTML -->
<script 
    src="https://cdn.alphapoints.com/sui-points-adapter.js"
    data-package-id="0x123..."
    data-partner-cap-id="${mockPartnerCap.id}"
    data-rpc-url="https://fullnode.testnet.sui.io:443"
    data-allowed-origins="yoursite.com"
    data-enable-notifications="true">
</script>`);
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  📋 Copy Code
                </Button>
                <Button
                  onClick={() => setShowCodeExample(false)}
                  className="bg-gray-600 hover:bg-gray-700"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SDK Configuration Dashboard Modal */}
      {showSDKConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">🔧 SDK Configuration Dashboard</h2>
              <button
                onClick={() => setShowSDKConfig(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <SDKConfigurationDashboard />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 