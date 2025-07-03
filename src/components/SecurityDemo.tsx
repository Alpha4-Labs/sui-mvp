import React, { useState, useCallback } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

interface SecurityTest {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: 'pending' | 'success' | 'failed';
  message: string;
  gasUsed?: number;
}

export const SecurityDemo: React.FC = () => {
  const [currentDomain, setCurrentDomain] = useState('localhost:3000');
  const [userAddress, setUserAddress] = useState('0x1234...abcd');
  const [eventType, setEventType] = useState('user_signup');
  const [securityTests, setSecurityTests] = useState<SecurityTest[]>([
    {
      id: 'domain_validation',
      name: 'Domain Whitelist Check',
      description: 'Verify the origin domain is allowed',
      icon: <span className="text-blue-400">🌐</span>,
      status: 'pending',
      message: 'Waiting to test...',
    },
    {
      id: 'rate_limiting',
      name: 'Rate Limiting',
      description: 'Check if user is within rate limits',
      icon: <span className="text-yellow-400">⏱️</span>,
      status: 'pending',
      message: 'Waiting to test...',
    },
    {
      id: 'signature_verification',
      name: 'Signature Verification',
      description: 'Validate user signature',
      icon: <span className="text-purple-400">🔑</span>,
      status: 'pending',
      message: 'Waiting to test...',
    },
    {
      id: 'replay_protection',
      name: 'Replay Protection',
      description: 'Prevent duplicate submissions',
      icon: <span className="text-green-400">🛡️</span>,
      status: 'pending',
      message: 'Waiting to test...',
    },
    {
      id: 'quota_check',
      name: 'Event Quota Check',
      description: 'Verify user has not exceeded limits',
      icon: <span className="text-cyan-400">⚡</span>,
      status: 'pending',
      message: 'Waiting to test...',
    }
  ]);

  const [isRunning, setIsRunning] = useState(false);
  const [totalGasUsed, setTotalGasUsed] = useState(0);

  const simulateSecurityCheck = useCallback(async (test: SecurityTest): Promise<SecurityTest> => {
    // Simulate different security scenarios
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    const gasUsed = Math.floor(100 + Math.random() * 500);

    switch (test.id) {
      case 'domain_validation':
        if (currentDomain === 'localhost:3000' || currentDomain === 'yourdomain.com') {
          return {
            ...test,
            status: 'success',
            message: `✅ Domain "${currentDomain}" is whitelisted`,
            gasUsed
          };
        } else {
          return {
            ...test,
            status: 'failed',
            message: `❌ Domain "${currentDomain}" not in whitelist`,
            gasUsed
          };
        }

      case 'rate_limiting':
        const requestsThisMinute = Math.floor(Math.random() * 15);
        if (requestsThisMinute < 10) {
          return {
            ...test,
            status: 'success',
            message: `✅ Rate limit OK (${requestsThisMinute}/10 requests this minute)`,
            gasUsed
          };
        } else {
          return {
            ...test,
            status: 'failed',
            message: `❌ Rate limit exceeded (${requestsThisMinute}/10 requests)`,
            gasUsed
          };
        }

      case 'signature_verification':
        const hasValidSignature = Math.random() > 0.2; // 80% success rate
        if (hasValidSignature) {
          return {
            ...test,
            status: 'success',
            message: `✅ Valid signature from ${userAddress}`,
            gasUsed
          };
        } else {
          return {
            ...test,
            status: 'failed',
            message: `❌ Invalid or missing signature`,
            gasUsed
          };
        }

      case 'replay_protection':
        const isReplay = Math.random() < 0.1; // 10% chance of replay
        if (!isReplay) {
          return {
            ...test,
            status: 'success',
            message: `✅ Event hash is unique`,
            gasUsed
          };
        } else {
          return {
            ...test,
            status: 'failed',
            message: `❌ Event hash already exists (replay attack)`,
            gasUsed
          };
        }

      case 'quota_check':
        const userEvents = Math.floor(Math.random() * 8);
        const dailyEvents = Math.floor(Math.random() * 3);
        if (userEvents < 5 && dailyEvents < 2) {
          return {
            ...test,
            status: 'success',
            message: `✅ Quota OK (${userEvents}/5 lifetime, ${dailyEvents}/2 daily)`,
            gasUsed
          };
        } else {
          return {
            ...test,
            status: 'failed',
            message: `❌ Quota exceeded (${userEvents}/5 lifetime, ${dailyEvents}/2 daily)`,
            gasUsed
          };
        }

      default:
        return test;
    }
  }, [currentDomain, userAddress]);

  const runSecurityTests = useCallback(async () => {
    setIsRunning(true);
    setTotalGasUsed(0);
    
    // Reset all tests
    setSecurityTests(prev => prev.map(test => ({
      ...test,
      status: 'pending' as const,
      message: 'Running...',
      gasUsed: undefined
    })));

    let cumulativeGas = 0;

    // Run tests sequentially to show the security flow
    for (let i = 0; i < securityTests.length; i++) {
      const test = securityTests[i];
      const result = await simulateSecurityCheck(test);
      cumulativeGas += result.gasUsed || 0;
      
      setSecurityTests(prev => prev.map(t => 
        t.id === test.id ? result : t
      ));
      
      setTotalGasUsed(cumulativeGas);

      // If a test fails, stop the chain
      if (result.status === 'failed') {
        // Mark remaining tests as skipped
        setSecurityTests(prev => prev.map((t, idx) => {
          if (idx > i) {
            return {
              ...t,
              status: 'pending' as const,
              message: '⏸️ Skipped due to previous failure'
            };
          }
          return t;
        }));
        break;
      }
    }

    setIsRunning(false);
  }, [securityTests, simulateSecurityCheck]);

  const getStatusIcon = (status: SecurityTest['status']) => {
    switch (status) {
      case 'success':
        return <span className="text-green-600 text-xl">✅</span>;
      case 'failed':
        return <span className="text-red-600 text-xl">❌</span>;
      default:
        return <span className="text-gray-400 text-xl">⏳</span>;
    }
  };

  const getStatusColor = (status: SecurityTest['status']) => {
    switch (status) {
      case 'success':
        return 'border-green-200 bg-green-50 dark:bg-green-900/20';
      case 'failed':
        return 'border-red-200 bg-red-50 dark:bg-red-900/20';
      default:
        return 'border-gray-200 bg-gray-50 dark:bg-gray-800';
    }
  };

  const allTestsPassed = securityTests.every(test => test.status === 'success');
  const hasFailures = securityTests.some(test => test.status === 'failed');

  return (
    <div className="bg-gray-900 text-white min-h-screen">
      <div className="max-w-4xl mx-auto p-6 pb-16 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">
            🔐 On-Chain Security Demo
          </h1>
          <p className="text-gray-300">
            See how Alpha Points validates events through multiple security layers
          </p>
        </div>

      {/* Configuration */}
      <div className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          🛡️ Test Configuration
        </h3>
        <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Origin Domain</label>
                <Input
                  value={currentDomain}
                  onChange={(e) => setCurrentDomain(e.target.value)}
                  placeholder="localhost:3000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">User Address</label>
                <Input
                  value={userAddress}
                  onChange={(e) => setUserAddress(e.target.value)}
                  placeholder="0x1234...abcd"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Event Type</label>
                <select 
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full p-2 bg-gray-900/50 border border-gray-600 rounded text-white"
                >
                  <option value="user_signup">User Signup</option>
                  <option value="purchase">Purchase</option>
                  <option value="newsletter_signup">Newsletter Signup</option>
                  <option value="social_share">Social Share</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Button 
                onClick={runSecurityTests}
                disabled={isRunning}
                className="flex items-center gap-2"
              >
                🛡️ {isRunning ? 'Running Security Tests...' : 'Run Security Tests'}
              </Button>
              
              {totalGasUsed > 0 && (
                <span className="text-xs bg-blue-600/20 text-blue-300 px-2 py-1 rounded flex items-center gap-1">
                  ⚡ {totalGasUsed} gas used
                </span>
              )}
            </div>
          </div>
        </div>

      {/* Security Tests */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Security Validation Chain</h2>
        
        {securityTests.map((test, index) => (
          <div key={test.id} className={`${getStatusColor(test.status)} transition-all duration-300 rounded-lg border p-4`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="font-mono bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                    {index + 1}
                  </span>
                  {test.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-white">{test.name}</h3>
                  <p className="text-sm text-gray-300">
                    {test.description}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {test.gasUsed && (
                  <span className="text-xs bg-gray-600/20 text-gray-300 px-2 py-1 rounded border">
                    {test.gasUsed} gas
                  </span>
                )}
                {getStatusIcon(test.status)}
              </div>
            </div>
            
            <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono">
              {test.message}
            </div>
          </div>
        ))}
      </div>

      {/* Results */}
      {!isRunning && securityTests.some(test => test.status !== 'pending') && (
        <div className={`p-4 rounded-lg border ${allTestsPassed ? 'border-green-600 bg-green-900/20' : 'border-red-600 bg-red-900/20'}`}>
          <div className="flex items-center gap-2">
            <span className="text-2xl">
              {allTestsPassed ? '✅' : '❌'}
            </span>
            <div className="font-semibold text-white">
              {allTestsPassed 
                ? '🎉 All security checks passed! Event would be processed and points minted.'
                : '🚫 Security validation failed. Event rejected to protect the system.'
              }
            </div>
          </div>
          
          {allTestsPassed && (
            <div className="mt-2 text-sm text-gray-300">
              <p>✅ Domain validated</p>
              <p>✅ Rate limits respected</p>
              <p>✅ Signature verified</p>
              <p>✅ Replay protection passed</p>
              <p>✅ Event quotas available</p>
              <p className="font-semibold mt-2 text-white">
                → Points would be minted to user address: {userAddress}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Security Info */}
      <div className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">⚠️</span>
          <h3 className="text-xl font-semibold text-white">Security Information</h3>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2 text-white">✅ Security Benefits:</h4>
              <ul className="space-y-1 text-gray-300">
                <li>• Prevents unauthorized domain access</li>
                <li>• Stops spam and abuse attacks</li>
                <li>• Ensures user consent via signatures</li>
                <li>• Blocks replay attacks</li>
                <li>• Enforces fair usage quotas</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-white">⚡ Performance:</h4>
              <ul className="space-y-1 text-gray-300">
                <li>• ~1200-1700 gas per event</li>
                <li>• All validation on-chain</li>
                <li>• No backend dependencies</li>
                <li>• Immediate feedback</li>
                <li>• Cryptographically secure</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
            <p className="text-sm text-gray-300">
              <strong className="text-blue-300">💡 How it works:</strong> Each event submission goes through this exact security chain on-chain. 
              If any step fails, the transaction is reverted and no points are minted. 
              This ensures complete security without relying on any backend services.
            </p>
          </div>
                 </div>
       </div>
     </div>
   </div>
 );
}; 