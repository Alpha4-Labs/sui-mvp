import React, { useState, useEffect } from 'react';
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { toast } from 'react-hot-toast';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { PartnerCapInfo } from '../hooks/usePartnerDetection';
import { 
  buildUpdateIntegrationSettingsTransaction,
  buildConfigureEventMappingTransaction,
  generateEventHash
} from '../utils/transaction';

interface ZeroDevIntegrationWizardProps {
  partnerCap: PartnerCapInfo;
  onClose: () => void;
  onComplete: () => void;
}

interface EventMapping {
  eventType: string;
  displayName: string;
  pointsPerEvent: number;
  maxEventsPerUser: number;
  maxEventsPerDay: number;
  cooldownSeconds: number;
  eventConditions: string;
  enabled: boolean;
}

interface IntegrationSettings {
  allowedOrigins: string[];
  rateLimitPerMinute: number;
  requireUserSignature: boolean;
  integrationEnabled: boolean;
}

const COMMON_EVENT_TYPES = [
  {
    eventType: 'user_signup',
    displayName: 'User Registration',
    description: 'When a user creates an account',
    defaultPoints: 100,
    icon: '👤'
  },
  {
    eventType: 'purchase_completed',
    displayName: 'Purchase Completed',
    description: 'When a user completes a purchase',
    defaultPoints: 50,
    icon: '🛒'
  },
  {
    eventType: 'newsletter_signup',
    displayName: 'Newsletter Signup',
    description: 'When a user subscribes to newsletter',
    defaultPoints: 25,
    icon: '📧'
  },
  {
    eventType: 'social_share',
    displayName: 'Social Media Share',
    description: 'When a user shares content on social media',
    defaultPoints: 20,
    icon: '📱'
  },
  {
    eventType: 'profile_completed',
    displayName: 'Profile Completion',
    description: 'When a user completes their profile',
    defaultPoints: 75,
    icon: '✅'
  },
  {
    eventType: 'referral_successful',
    displayName: 'Successful Referral',
    description: 'When a user successfully refers someone',
    defaultPoints: 200,
    icon: '🎯'
  }
];

export const ZeroDevIntegrationWizard: React.FC<ZeroDevIntegrationWizardProps> = ({
  partnerCap,
  onClose,
  onComplete
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [detectedEvents, setDetectedEvents] = useState<string[]>([]);
  const [eventMappings, setEventMappings] = useState<EventMapping[]>([]);
  const [integrationSettings, setIntegrationSettings] = useState<IntegrationSettings>({
    allowedOrigins: [],
    rateLimitPerMinute: 60,
    requireUserSignature: true,
    integrationEnabled: true
  });
  const [generatedScript, setGeneratedScript] = useState('');

  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  // Step 1: Website URL Input and Event Discovery
  const handleWebsiteAnalysis = async () => {
    if (!websiteUrl) {
      toast.error('Please enter your website URL');
      return;
    }

    setIsLoading(true);
    try {
      // Simulate client-side event discovery
      // In a real implementation, this would run discovery scripts
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock detected events
      const mockDetectedEvents = [
        'user_signup',
        'newsletter_signup',
        'purchase_completed'
      ];
      
      setDetectedEvents(mockDetectedEvents);
      
      // Initialize event mappings with detected events
      const initialMappings = COMMON_EVENT_TYPES
        .filter(event => mockDetectedEvents.includes(event.eventType))
        .map(event => ({
          eventType: event.eventType,
          displayName: event.displayName,
          pointsPerEvent: event.defaultPoints,
          maxEventsPerUser: 0, // unlimited
          maxEventsPerDay: 0, // unlimited
          cooldownSeconds: 0,
          eventConditions: '{}',
          enabled: true
        }));
      
      setEventMappings(initialMappings);
      
      // Set allowed origins
      const domain = new URL(websiteUrl).hostname;
      setIntegrationSettings(prev => ({
        ...prev,
        allowedOrigins: [domain]
      }));
      
      setCurrentStep(2);
      toast.success(`Found ${mockDetectedEvents.length} potential events on your website!`);
    } catch (error) {
      toast.error('Failed to analyze website. Please check the URL and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Configure Event Mappings
  const updateEventMapping = (index: number, field: keyof EventMapping, value: any) => {
    setEventMappings(prev => prev.map((mapping, i) => 
      i === index ? { ...mapping, [field]: value } : mapping
    ));
  };

  const addCustomEvent = () => {
    setEventMappings(prev => [...prev, {
      eventType: '',
      displayName: '',
      pointsPerEvent: 10,
      maxEventsPerUser: 0,
      maxEventsPerDay: 0,
      cooldownSeconds: 0,
      eventConditions: '{}',
      enabled: true
    }]);
  };

  const removeEventMapping = (index: number) => {
    setEventMappings(prev => prev.filter((_, i) => i !== index));
  };

  // Step 3: Generate Integration Code
  const generateIntegrationScript = () => {
    const enabledMappings = eventMappings.filter(mapping => mapping.enabled);
    
    const script = `
<!-- Alpha4 Onboard SDK Integration -->
<script src="https://onboard.alpha4.io/sui-points-adapter.js"></script>
<script>
  window.AlphaPointsSDK.init({
    partnerCapId: "${partnerCap.id}",
    network: "testnet", // Change to "mainnet" for production
    allowedOrigins: ${JSON.stringify(integrationSettings.allowedOrigins, null, 2)},
    rateLimitPerMinute: ${integrationSettings.rateLimitPerMinute},
    requireUserSignature: ${integrationSettings.requireUserSignature},
    eventMappings: ${JSON.stringify(enabledMappings.map(mapping => ({
      eventType: mapping.eventType,
      pointsPerEvent: mapping.pointsPerEvent,
      maxEventsPerUser: mapping.maxEventsPerUser,
      maxEventsPerDay: mapping.maxEventsPerDay,
      cooldownSeconds: mapping.cooldownSeconds
    })), null, 4)},
    
    // Auto-detect and bind events
    autoDetect: true,
    
    // Optional: Custom event handlers
    onPointsAwarded: function(eventType, points, userAddress) {
      console.log(\`User \${userAddress} earned \${points} points for \${eventType}\`);
      // Optional: Show notification to user
    },
    
    onError: function(error) {
      console.error('Alpha Points SDK Error:', error);
    }
  });
  
  // Manual event submission example:
  // window.AlphaPointsSDK.submitEvent('user_signup', { userId: 'user123' });
</script>

<!-- Optional: Add Alpha Points widget -->
<div id="alpha-points-widget" 
     data-position="bottom-right" 
     data-theme="dark">
</div>
`;

    setGeneratedScript(script);
    setCurrentStep(3);
  };

  // Step 4: Deploy to Blockchain
  const deployIntegration = async () => {
    setIsLoading(true);
    try {
      // Step 1: Update integration settings
      const settingsTransaction = buildUpdateIntegrationSettingsTransaction(
        partnerCap.id,
        integrationSettings.allowedOrigins,
        undefined, // webhook URL
        undefined, // API key hash
        integrationSettings.rateLimitPerMinute,
        integrationSettings.requireUserSignature,
        integrationSettings.integrationEnabled
      );

      await new Promise((resolve, reject) => {
        signAndExecuteTransaction(
          { transaction: settingsTransaction },
          {
            onSuccess: () => resolve(true),
            onError: (error) => reject(error)
          }
        );
      });

      // Step 2: Configure event mappings
      const enabledMappings = eventMappings.filter(mapping => mapping.enabled);
      
      for (const mapping of enabledMappings) {
        const eventTransaction = buildConfigureEventMappingTransaction(
          partnerCap.id,
          mapping.eventType,
          mapping.pointsPerEvent,
          mapping.maxEventsPerUser,
          mapping.maxEventsPerDay,
          mapping.cooldownSeconds,
          mapping.eventConditions
        );

        await new Promise((resolve, reject) => {
          signAndExecuteTransaction(
            { transaction: eventTransaction },
            {
              onSuccess: () => resolve(true),
              onError: (error) => reject(error)
            }
          );
        });
      }

      toast.success('Zero-Dev integration deployed successfully!');
      setCurrentStep(4);
    } catch (error) {
      console.error('Deployment failed:', error);
      toast.error('Failed to deploy integration. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-bold text-white mb-2">Website Analysis</h3>
        <p className="text-gray-400">Enter your website URL to discover integration opportunities</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Website URL *
          </label>
          <Input
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://your-website.com"
            className="w-full"
          />
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <h4 className="font-medium text-blue-400 mb-2">What we'll analyze:</h4>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• Form submissions (signup, contact, etc.)</li>
            <li>• Button clicks with data attributes</li>
            <li>• E-commerce events (purchases, cart actions)</li>
            <li>• Social sharing buttons</li>
            <li>• Newsletter signups</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-bold text-white mb-2">Configure Events</h3>
        <p className="text-gray-400">Set up point rewards for user actions</p>
      </div>

      <div className="space-y-4">
        {eventMappings.map((mapping, index) => (
          <div key={index} className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={mapping.enabled}
                  onChange={(e) => updateEventMapping(index, 'enabled', e.target.checked)}
                  className="rounded"
                />
                <span className="text-lg">
                  {COMMON_EVENT_TYPES.find(t => t.eventType === mapping.eventType)?.icon || '⚡'}
                </span>
                <h4 className="font-medium text-white">{mapping.displayName || 'Custom Event'}</h4>
              </div>
              <button
                onClick={() => removeEventMapping(index)}
                className="text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            </div>

            {mapping.enabled && (
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Event Type
                  </label>
                  <Input
                    value={mapping.eventType}
                    onChange={(e) => updateEventMapping(index, 'eventType', e.target.value)}
                    placeholder="e.g., user_signup"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Display Name
                  </label>
                  <Input
                    value={mapping.displayName}
                    onChange={(e) => updateEventMapping(index, 'displayName', e.target.value)}
                    placeholder="e.g., User Registration"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Points per Event
                  </label>
                  <Input
                    type="number"
                    value={mapping.pointsPerEvent}
                    onChange={(e) => updateEventMapping(index, 'pointsPerEvent', parseInt(e.target.value) || 0)}
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Max Events per User (0 = unlimited)
                  </label>
                  <Input
                    type="number"
                    value={mapping.maxEventsPerUser}
                    onChange={(e) => updateEventMapping(index, 'maxEventsPerUser', parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        <Button
          onClick={addCustomEvent}
          variant="outline"
          className="w-full"
        >
          Add Custom Event
        </Button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-bold text-white mb-2">Integration Code</h3>
        <p className="text-gray-400">Copy and paste this code into your website</p>
      </div>

      <div className="space-y-4">
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-white">HTML Integration Code</h4>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(generatedScript);
                toast.success('Code copied to clipboard!');
              }}
              variant="outline"
              size="sm"
            >
              Copy Code
            </Button>
          </div>
          <pre className="text-sm text-gray-300 overflow-x-auto max-h-96">
            <code>{generatedScript}</code>
          </pre>
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <h4 className="font-medium text-yellow-400 mb-2">Installation Instructions:</h4>
          <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
            <li>Copy the code above</li>
            <li>Paste it before the closing &lt;/body&gt; tag in your website</li>
            <li>Deploy the configuration to the blockchain (next step)</li>
            <li>Test the integration on your website</li>
          </ol>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-bold text-white mb-2">Integration Complete!</h3>
        <p className="text-gray-400">Your Zero-Dev integration is now live</p>
      </div>

      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6 text-center">
        <div className="text-4xl mb-4">🎉</div>
        <h4 className="text-lg font-medium text-white mb-2">Success!</h4>
        <p className="text-gray-300 mb-4">
          Your website is now integrated with Alpha Points. Users will automatically earn points for configured actions.
        </p>
        
        <div className="grid md:grid-cols-2 gap-4 mt-6">
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h5 className="font-medium text-white mb-2">Events Configured</h5>
            <p className="text-2xl font-bold text-green-400">
              {eventMappings.filter(m => m.enabled).length}
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h5 className="font-medium text-white mb-2">Domains Whitelisted</h5>
            <p className="text-2xl font-bold text-blue-400">
              {integrationSettings.allowedOrigins.length}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <h4 className="font-medium text-blue-400 mb-2">Next Steps:</h4>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>• Test the integration on your website</li>
          <li>• Monitor point awards in your partner dashboard</li>
          <li>• Adjust event configurations as needed</li>
          <li>• Consider adding the Alpha Points widget for user visibility</li>
        </ul>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Zero-Dev Integration Setup</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center mt-6">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step <= currentStep
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400'
                }`}>
                  {step < currentStep ? '✓' : step}
                </div>
                {step < 4 && (
                  <div className={`w-16 h-0.5 ${
                    step < currentStep ? 'bg-blue-600' : 'bg-gray-700'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
        </div>

        <div className="p-6 border-t border-gray-700 flex justify-between">
          <Button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            variant="outline"
            disabled={currentStep === 1 || isLoading}
          >
            Previous
          </Button>

          <div className="flex gap-2">
            {currentStep === 1 && (
              <Button
                onClick={handleWebsiteAnalysis}
                disabled={!websiteUrl || isLoading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? 'Analyzing...' : 'Analyze Website'}
              </Button>
            )}
            {currentStep === 2 && (
              <Button
                onClick={generateIntegrationScript}
                disabled={eventMappings.filter(m => m.enabled).length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Generate Code
              </Button>
            )}
            {currentStep === 3 && (
              <Button
                onClick={deployIntegration}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                {isLoading ? 'Deploying...' : 'Deploy to Blockchain'}
              </Button>
            )}
            {currentStep === 4 && (
              <Button
                onClick={onComplete}
                className="bg-green-600 hover:bg-green-700"
              >
                Complete Setup
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 