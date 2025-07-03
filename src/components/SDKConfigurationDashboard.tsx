import React, { useState, useCallback } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

interface EventConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  points: number;
  maxPerUser: number;
  maxPerDay: number;
  cooldownMinutes: number;
  enabled: boolean;
  requiresSignature: boolean;
}

interface SecuritySettings {
  domainWhitelist: string[];
  rateLimitPerMinute: number;
  requireUserSignature: boolean;
  enableNotifications: boolean;
  debugMode: boolean;
  integrationEnabled: boolean;
  signatureValidation: boolean;
  replayProtection: boolean;
}

const DEFAULT_EVENTS: EventConfig[] = [
  {
    id: 'user_signup',
    name: 'User Signup',
    description: 'New user registration on your platform',
    icon: <span className="text-green-400">👤</span>,
    points: 50,
    maxPerUser: 1,
    maxPerDay: 1,
    cooldownMinutes: 0,
    enabled: true,
    requiresSignature: true
  },
  {
    id: 'purchase',
    name: 'Purchase Made',
    description: 'User completes a purchase transaction',
    icon: <span className="text-yellow-400">💰</span>,
    points: 100,
    maxPerUser: 10,
    maxPerDay: 5,
    cooldownMinutes: 5,
    enabled: true,
    requiresSignature: true
  },
  {
    id: 'newsletter_signup',
    name: 'Newsletter Signup',
    description: 'User subscribes to newsletter',
    icon: <span className="text-blue-400">📧</span>,
    points: 25,
    maxPerUser: 1,
    maxPerDay: 1,
    cooldownMinutes: 0,
    enabled: true,
    requiresSignature: false
  },
  {
    id: 'social_share',
    name: 'Social Share',
    description: 'User shares content on social media',
    icon: <span className="text-purple-400">🌐</span>,
    points: 15,
    maxPerUser: 5,
    maxPerDay: 3,
    cooldownMinutes: 30,
    enabled: true,
    requiresSignature: false
  },
  {
    id: 'profile_completion',
    name: 'Profile Completion',
    description: 'User completes their profile setup',
    icon: <span className="text-cyan-400">✅</span>,
    points: 75,
    maxPerUser: 1,
    maxPerDay: 1,
    cooldownMinutes: 0,
    enabled: true,
    requiresSignature: true
  },
  {
    id: 'referral',
    name: 'Successful Referral',
    description: 'User successfully refers a new user',
    icon: <span className="text-orange-400">🤝</span>,
    points: 200,
    maxPerUser: 20,
    maxPerDay: 5,
    cooldownMinutes: 60,
    enabled: true,
    requiresSignature: true
  }
];

const DEFAULT_SECURITY: SecuritySettings = {
  domainWhitelist: ['localhost:3000', 'yourdomain.com'],
  rateLimitPerMinute: 10,
  requireUserSignature: true,
  enableNotifications: true,
  debugMode: false,
  integrationEnabled: true,
  signatureValidation: true,
  replayProtection: true
};

export const SDKConfigurationDashboard: React.FC = () => {
  const [events, setEvents] = useState<EventConfig[]>(DEFAULT_EVENTS);
  const [security, setSecurity] = useState<SecuritySettings>(DEFAULT_SECURITY);
  const [newDomain, setNewDomain] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'events' | 'security' | 'integration'>('events');

  const updateEvent = useCallback((eventId: string, updates: Partial<EventConfig>) => {
    setEvents(prev => prev.map(event => 
      event.id === eventId ? { ...event, ...updates } : event
    ));
  }, []);

  const addDomain = useCallback(() => {
    if (newDomain.trim() && !security.domainWhitelist.includes(newDomain.trim())) {
      setSecurity(prev => ({
        ...prev,
        domainWhitelist: [...prev.domainWhitelist, newDomain.trim()]
      }));
      setNewDomain('');
    }
  }, [newDomain, security.domainWhitelist]);

  const removeDomain = useCallback((domain: string) => {
    setSecurity(prev => ({
      ...prev,
      domainWhitelist: prev.domainWhitelist.filter(d => d !== domain)
    }));
  }, []);

  const generateIntegrationCode = useCallback(() => {
    const enabledEvents = events.filter(e => e.enabled);
    const eventConfigs = enabledEvents.map(event => ({
      type: event.id,
      points: event.points,
      maxPerUser: event.maxPerUser,
      maxPerDay: event.maxPerDay,
      cooldown: event.cooldownMinutes * 60000,
      requiresSignature: event.requiresSignature
    }));

    return `<!-- Alpha4 Onboard SDK - Enhanced Security Integration -->
<script 
    src="https://onboard.alpha4.io/sui-points-adapter.js"
    data-package-id="YOUR_PACKAGE_ID"
    data-partner-cap-id="YOUR_PARTNER_CAP_ID"
    data-rpc-url="https://rpc-testnet.suiscan.xyz:443"
    data-allowed-origins="${security.domainWhitelist.join(',')}"
    data-rate-limit="${security.rateLimitPerMinute}"
    data-require-signature="${security.requireUserSignature}"
    data-enable-notifications="${security.enableNotifications}"
    data-debug-mode="${security.debugMode}"
    data-signature-validation="${security.signatureValidation}"
    data-replay-protection="${security.replayProtection}"
    data-event-configs='${JSON.stringify(eventConfigs)}'>
</script>`;
  }, [events, security]);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generateIntegrationCode());
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [generateIntegrationCode]);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <p className="text-gray-300">Configure your Zero-Dev integration settings and generate SDK code</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('events')}
          className={`px-4 py-2 font-medium ${activeTab === 'events' 
            ? 'text-blue-400 border-b-2 border-blue-400' 
            : 'text-gray-400 hover:text-white'}`}
        >
          ⚡ Events
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 font-medium ${activeTab === 'security' 
            ? 'text-blue-400 border-b-2 border-blue-400' 
            : 'text-gray-400 hover:text-white'}`}
        >
          🛡️ Security
        </button>
        <button
          onClick={() => setActiveTab('integration')}
          className={`px-4 py-2 font-medium ${activeTab === 'integration' 
            ? 'text-blue-400 border-b-2 border-blue-400' 
            : 'text-gray-400 hover:text-white'}`}
        >
          🔗 Integration
        </button>
      </div>

      {/* Events Tab */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          <div className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              ⚡ Event Configuration
            </h3>
            <div className="space-y-4">
              {events.map((event) => (
                <div key={event.id} className="bg-gray-900/50 border border-gray-600 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-900/50 rounded-lg">
                        {event.icon}
                      </div>
                      <div>
                        <h4 className="font-semibold text-white flex items-center gap-2">
                          {event.name}
                          {event.requiresSignature && (
                            <span className="text-xs bg-purple-600/20 text-purple-300 px-2 py-1 rounded">
                              🔑 Signature Required
                            </span>
                          )}
                        </h4>
                        <p className="text-sm text-gray-300">{event.description}</p>
                      </div>
                    </div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={event.enabled}
                        onChange={(e) => updateEvent(event.id, { enabled: e.target.checked })}
                        className="mr-2 w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-300">Enabled</span>
                    </label>
                  </div>
                  
                  {event.enabled && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Points</label>
                        <Input
                          type="number"
                          value={event.points}
                          onChange={(e) => updateEvent(event.id, { points: parseInt(e.target.value) || 0 })}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Max/User</label>
                        <Input
                          type="number"
                          value={event.maxPerUser}
                          onChange={(e) => updateEvent(event.id, { maxPerUser: parseInt(e.target.value) || 0 })}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Max/Day</label>
                        <Input
                          type="number"
                          value={event.maxPerDay}
                          onChange={(e) => updateEvent(event.id, { maxPerDay: parseInt(e.target.value) || 0 })}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Cooldown (min)</label>
                        <Input
                          type="number"
                          value={event.cooldownMinutes}
                          onChange={(e) => updateEvent(event.id, { cooldownMinutes: parseInt(e.target.value) || 0 })}
                          className="h-8"
                        />
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={event.requiresSignature}
                            onChange={(e) => updateEvent(event.id, { requiresSignature: e.target.checked })}
                            className="mr-2 w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                          />
                          <span className="text-xs text-gray-300">Signature</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Domain Security */}
            <div className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                🌐 Domain Security
              </h3>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Add allowed domain"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addDomain()}
                  />
                  <Button onClick={addDomain} className="bg-green-600 hover:bg-green-700">Add</Button>
                </div>
                <div className="space-y-2">
                  {security.domainWhitelist.map((domain) => (
                    <div key={domain} className="flex items-center justify-between p-2 bg-gray-900/50 rounded">
                      <span className="text-sm text-gray-300">{domain}</span>
                      <button
                        onClick={() => removeDomain(domain)}
                        className="text-red-400 hover:text-red-300 text-sm px-2 py-1"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Rate Limiting */}
            <div className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                ⏱️ Rate Limiting
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Requests per minute per user</label>
                  <Input
                    type="number"
                    value={security.rateLimitPerMinute}
                    onChange={(e) => setSecurity(prev => ({ ...prev, rateLimitPerMinute: parseInt(e.target.value) || 1 }))}
                    min="1"
                    max="100"
                  />
                  <p className="text-sm text-gray-400 mt-1">
                    Lower values increase security but may impact user experience
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Security Features */}
          <div className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              🛡️ Security Features
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'requireUserSignature', label: 'Require User Signatures', desc: 'Users must sign events with their wallet' },
                { key: 'signatureValidation', label: 'Signature Validation', desc: 'Validate signatures on-chain' },
                { key: 'replayProtection', label: 'Replay Protection', desc: 'Prevent duplicate event submissions' },
                { key: 'enableNotifications', label: 'Enable Notifications', desc: 'Show user feedback for events' }
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between p-3 bg-gray-900/50 rounded">
                  <div>
                    <label className="text-sm font-medium text-gray-300">{label}</label>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={security[key as keyof SecuritySettings] as boolean}
                    onChange={(e) => setSecurity(prev => ({ ...prev, [key]: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Integration Tab */}
      {activeTab === 'integration' && (
        <div className="space-y-4">
          <div className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              🔗 Integration Code
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-gray-300">Copy this code to your website:</p>
                <Button 
                  onClick={copyToClipboard}
                  className={`${copySuccess ? 'bg-green-600' : 'bg-blue-600'} hover:bg-blue-700`}
                >
                  {copySuccess ? '✅ Copied!' : '📋 Copy Code'}
                </Button>
              </div>
              <div className="bg-gray-900 border border-gray-600 rounded p-4 overflow-x-auto">
                <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                  {generateIntegrationCode()}
                </pre>
              </div>
              <div className="text-sm text-gray-400">
                <p className="mb-2"><strong>Next steps:</strong></p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Replace YOUR_PACKAGE_ID with your actual package ID</li>
                  <li>Replace YOUR_PARTNER_CAP_ID with your partner capability ID</li>
                  <li>Add this script to your website's HTML</li>
                  <li>Test the integration using the security demo</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 