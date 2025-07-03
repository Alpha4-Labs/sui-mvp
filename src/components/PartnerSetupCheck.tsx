import React from 'react';
import { AlertTriangle, CheckCircle, ArrowRight, TrendingUp, BarChart3, Target } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';

interface PartnerSetupCheckProps {
  partnerCapId?: string;
  hasStatsObject: boolean;
  isLoading?: boolean;
  onCreateStats?: () => void;
  onStartFullOnboarding?: () => void;
  className?: string;
}

export function PartnerSetupCheck({
  partnerCapId,
  hasStatsObject,
  isLoading = false,
  onCreateStats,
  onStartFullOnboarding,
  className = ""
}: PartnerSetupCheckProps) {
  
  // If user has both objects, show success state
  if (partnerCapId && hasStatsObject) {
    return (
      <Alert className={`bg-green-50 border-green-200 ${className}`}>
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          <div className="flex items-center justify-between">
            <div>
              <strong>✅ Setup Complete!</strong> You have full V2 system access with advanced analytics.
            </div>
            <div className="flex gap-2 text-xs text-green-600">
              <span className="flex items-center gap-1">
                <Target className="h-3 w-3" />
                Quota Management
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                V2 Features
              </span>
              <span className="flex items-center gap-1">
                <BarChart3 className="h-3 w-3" />
                Analytics
              </span>
            </div>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // If user has PartnerCap but no stats, show upgrade prompt
  if (partnerCapId && !hasStatsObject) {
    return (
      <Card className={`border-yellow-200 bg-yellow-50 ${className}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <CardTitle className="text-yellow-800">Complete Your Setup</CardTitle>
          </div>
          <CardDescription className="text-yellow-700">
            You have a PartnerCapFlex but need a Stats object to unlock full V2 features.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="flex items-center gap-2 text-yellow-700">
              <BarChart3 className="h-4 w-4" />
              <span>Advanced Analytics</span>
            </div>
            <div className="flex items-center gap-2 text-yellow-700">
              <Target className="h-4 w-4" />
              <span>Better Quota Management</span>
            </div>
            <div className="flex items-center gap-2 text-yellow-700">
              <TrendingUp className="h-4 w-4" />
              <span>V2 Perk Claiming</span>
            </div>
          </div>
          
          <Button 
            onClick={onCreateStats}
            disabled={isLoading}
            className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
          >
            {isLoading ? (
              <>⏳ Creating Stats Object...</>
            ) : (
              <>
                Create Stats Object
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // If user has no setup at all, show full onboarding
  return (
    <Card className={`border-blue-200 bg-blue-50 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-blue-800 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Get Started with Partner Onboarding
        </CardTitle>
        <CardDescription className="text-blue-700">
          Create your PartnerCapFlex and Stats objects together for a seamless experience.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm text-blue-700">
          <div className="space-y-2">
            <div className="font-medium">You'll get:</div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3" />
                <span>TVL-backed quotas</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3" />
                <span>Revenue recycling</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3" />
                <span>Advanced analytics</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="font-medium">Process:</div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-blue-200 rounded-full text-xs flex items-center justify-center">1</span>
                <span>Create PartnerCapFlex</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-blue-200 rounded-full text-xs flex items-center justify-center">2</span>
                <span>Create Stats object</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-blue-200 rounded-full text-xs flex items-center justify-center">✓</span>
                <span>Ready to create perks!</span>
              </div>
            </div>
          </div>
        </div>
        
        <Button 
          onClick={onStartFullOnboarding}
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isLoading ? (
            <>⏳ Starting Onboarding...</>
          ) : (
            <>
              Start Guided Onboarding
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

interface OnboardingProgressProps {
  step: 'idle' | 'partnercap' | 'stats' | 'complete';
  className?: string;
}

export function OnboardingProgress({ step, className = "" }: OnboardingProgressProps) {
  if (step === 'idle' || step === 'complete') return null;

  return (
    <Card className={`border-blue-200 bg-blue-50 ${className}`}>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <div>
              <div className="font-medium text-blue-800">
                {step === 'partnercap' && 'Step 1/2: Creating PartnerCapFlex...'}
                {step === 'stats' && 'Step 2/2: Creating Stats object...'}
              </div>
              <div className="text-sm text-blue-600">
                {step === 'partnercap' && 'Setting up your quota management and collateral tracking'}
                {step === 'stats' && 'Enabling advanced analytics and V2 features'}
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <div className={`w-3 h-3 rounded-full ${step === 'partnercap' ? 'bg-blue-600 animate-pulse' : 'bg-blue-300'}`} />
            <div className={`w-3 h-3 rounded-full ${step === 'stats' ? 'bg-blue-600 animate-pulse' : 'bg-blue-300'}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 