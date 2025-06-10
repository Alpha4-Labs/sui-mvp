import React, { useState } from 'react';
import { ArrowRight, DollarSign, Coins, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { usePartnerOnboarding } from '../hooks/usePartnerOnboarding';
import { OnboardingProgress } from './PartnerSetupCheck';
import { toast } from 'react-toastify';

interface GuidedPartnerOnboardingProps {
  onSuccess?: (result: { partnerCapId: string; statsId: string }) => void;
  className?: string;
}

const SUI_INPUT_DECIMALS = 9;

export function GuidedPartnerOnboarding({ onSuccess, className = "" }: GuidedPartnerOnboardingProps) {
  const [partnerName, setPartnerName] = useState('');
  const [suiCollateral, setSuiCollateral] = useState('');
  const [customQuota, setCustomQuota] = useState('');
  const [useCustomQuota, setUseCustomQuota] = useState(false);
  
  const { 
    createPartnerWithFullSetup, 
    isLoading, 
    error, 
    onboardingStep,
    calculateRecommendedDailyQuota 
  } = usePartnerOnboarding();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!partnerName.trim()) {
      toast.error('Please enter a partner name.');
      return;
    }
    
    if (!suiCollateral || parseFloat(suiCollateral) <= 0) {
      toast.error('Please enter a valid SUI collateral amount.');
      return;
    }

    try {
      const suiAmountMist = BigInt(Math.floor(parseFloat(suiCollateral) * Math.pow(10, SUI_INPUT_DECIMALS)));
      
      let dailyQuotaToUse: number | undefined;
      if (useCustomQuota && customQuota) {
        dailyQuotaToUse = parseInt(customQuota);
        if (dailyQuotaToUse <= 0) {
          toast.error('Custom daily quota must be greater than 0.');
          return;
        }
      }

      const result = await createPartnerWithFullSetup(
        partnerName.trim(),
        suiAmountMist,
        dailyQuotaToUse
      );

      if (result) {
        onSuccess?.(result);
        // Reset form on success
        setPartnerName('');
        setSuiCollateral('');
        setCustomQuota('');
        setUseCustomQuota(false);
      }
    } catch (error: any) {
      console.error('Onboarding submission error:', error);
      toast.error('Failed to start onboarding. Please check your inputs and try again.');
    }
  };

  const getRecommendedQuota = () => {
    if (!suiCollateral || parseFloat(suiCollateral) <= 0) return 0;
    try {
      const suiAmountMist = BigInt(Math.floor(parseFloat(suiCollateral) * Math.pow(10, SUI_INPUT_DECIMALS)));
      return calculateRecommendedDailyQuota(suiAmountMist);
    } catch {
      return 0;
    }
  };

  const recommendedQuota = getRecommendedQuota();

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Progress indicator during onboarding */}
      <OnboardingProgress step={onboardingStep} />
      
      <Card className="border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <Sparkles className="h-5 w-5" />
            Guided Partner Onboarding
          </CardTitle>
          <CardDescription>
            Create your PartnerCapFlex and Stats objects together in one seamless process.
            This gives you full access to the V2 system with advanced analytics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Partner Name */}
            <div className="space-y-2">
              <Label htmlFor="partnerName">Partner Name</Label>
              <Input
                id="partnerName"
                type="text"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                placeholder="e.g., My DeFi Protocol"
                disabled={isLoading}
                className="w-full"
              />
              <p className="text-sm text-gray-600">
                This name will identify your partnership on the platform.
              </p>
            </div>

            {/* SUI Collateral */}
            <div className="space-y-2">
              <Label htmlFor="suiCollateral" className="flex items-center gap-2">
                <Coins className="h-4 w-4" />
                SUI Collateral Amount
              </Label>
              <Input
                id="suiCollateral"
                type="number"
                step="0.1"
                min="0.1"
                value={suiCollateral}
                onChange={(e) => setSuiCollateral(e.target.value)}
                placeholder="e.g., 10"
                disabled={isLoading}
                className="w-full"
              />
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  Your SUI collateral backs your daily point quota
                </span>
                {recommendedQuota > 0 && (
                  <span className="text-blue-600 font-medium">
                    Estimated quota: {recommendedQuota.toLocaleString()} points/day
                  </span>
                )}
              </div>
            </div>

            {/* Custom Quota (Optional) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useCustomQuota"
                  checked={useCustomQuota}
                  onChange={(e) => setUseCustomQuota(e.target.checked)}
                  disabled={isLoading}
                  className="rounded"
                />
                <Label htmlFor="useCustomQuota" className="text-sm">
                  Set custom daily quota (optional)
                </Label>
              </div>
              
              {useCustomQuota && (
                <div className="space-y-2">
                  <Label htmlFor="customQuota" className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Custom Daily Quota
                  </Label>
                  <Input
                    id="customQuota"
                    type="number"
                    min="1"
                    value={customQuota}
                    onChange={(e) => setCustomQuota(e.target.value)}
                    placeholder={`Default: ${recommendedQuota}`}
                    disabled={isLoading}
                    className="w-full"
                  />
                  <p className="text-sm text-gray-600">
                    Override the automatic quota calculation. Leave empty to use the recommended quota based on your collateral.
                  </p>
                </div>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="text-sm text-red-800">
                  <strong>Error:</strong> {error}
                </div>
              </div>
            )}

            {/* Benefits Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-2">What you'll get:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm text-blue-700">
                <div>✅ PartnerCapFlex with TVL-backed quotas</div>
                <div>✅ PartnerPerkStatsV2 for analytics</div>
                <div>✅ V2 perk claiming system access</div>
                <div>✅ Advanced quota management</div>
                <div>✅ Revenue reinvestment features</div>
                <div>✅ Real-time stats tracking</div>
              </div>
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              disabled={isLoading || !partnerName.trim() || !suiCollateral}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3"
            >
              {isLoading ? (
                <>
                  {onboardingStep === 'partnercap' && '⏳ Creating PartnerCapFlex...'}
                  {onboardingStep === 'stats' && '⏳ Creating Stats Object...'}
                  {onboardingStep === 'idle' && '⏳ Starting...'}
                </>
              ) : (
                <>
                  Start Guided Onboarding
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 