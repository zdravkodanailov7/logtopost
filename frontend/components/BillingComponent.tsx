'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from "sonner";
import axios from 'axios';
import {
  Clock,
  AlertTriangle,
  RefreshCw,
  Zap,
  X,
  Check,
} from 'lucide-react';
import { PLAN_OPTIONS } from '@/lib/plans';
import { ConfirmationDialog } from './ui/confirmation-dialog';

interface BillingInfo {
  plan_type: string;
  subscription_status: string;
  trial_ends_at?: string;
  subscription_ends_at?: string;
  trial_expired: boolean;
  usage: {
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
  };
  pricing: {
    basic: { price: number; currency: string };
    pro: { price: number; currency: string };
    advanced: { price: number; currency: string };
  };
  upgrade_required: boolean;
}



export function BillingComponent() {
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string>('basic');
  const [isEndingTrial, setIsEndingTrial] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationType, setConfirmationType] = useState<'start' | 'cancel'>('start');
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      fetchBillingInfo();
    }
  }, [isAuthenticated]);

  const fetchBillingInfo = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: any = { 'Content-Type': 'application/json' };
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/user/usage`,
        { 
          withCredentials: true,
          headers: headers
        }
      );

      setBillingInfo(response.data);
    } catch (error) {
      console.error('Error fetching billing info:', error);
      toast.error('Failed to load billing information');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartPlanClick = () => {
    setConfirmationType('start');
    setShowConfirmation(true);
  };

  const handleCancelTrialClick = () => {
    setConfirmationType('cancel');
    setShowConfirmation(true);
  };

  const handleEndTrialEarly = async () => {
    setIsEndingTrial(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers: any = { 'Content-Type': 'application/json' };
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/billing/end-trial-early`,
        { plan: selectedPlan },
        { 
          withCredentials: true,
          headers: headers
        }
      );

      if (response.data.success) {
        toast.success(`Trial ended! You're now on the ${selectedPlan} plan.`);
        fetchBillingInfo(); // Refresh the data
        setShowConfirmation(false);
      } else {
        throw new Error(response.data.error || 'Failed to end trial');
      }
    } catch (error: any) {
      console.error('End trial error:', error);
      toast.error(error.response?.data?.error || 'Failed to end trial. Please try again.');
    } finally {
      setIsEndingTrial(false);
    }
  };

  const handleCancelTrial = async () => {
    setIsCancelling(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers: any = { 'Content-Type': 'application/json' };
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/billing/cancel-trial`,
        {},
        { 
          withCredentials: true,
          headers: headers
        }
      );

      if (response.data.success) {
        toast.success('Trial cancelled successfully.');
        fetchBillingInfo(); // Refresh the data
        setShowConfirmation(false);
      } else {
        throw new Error(response.data.error || 'Failed to cancel trial');
      }
    } catch (error: any) {
      console.error('Cancel trial error:', error);
      toast.error(error.response?.data?.error || 'Failed to cancel trial. Please try again.');
    } finally {
      setIsCancelling(false);
    }
  };

  const getTrialDaysRemaining = () => {
    if (!billingInfo?.trial_ends_at) return 0;
    const now = new Date();
    const trialEnd = new Date(billingInfo.trial_ends_at);
    const diffTime = trialEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  // Don't show anything if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Please log in to view billing information.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-muted rounded mb-4"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!billingInfo) {
    return (
      <div className="p-6">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Billing Information</h3>
          <p className="text-muted-foreground">Unable to load billing information.</p>
          <Button variant="outline" onClick={fetchBillingInfo} className="mt-4">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const isOnTrial = billingInfo.subscription_status === 'trial';
  const trialDaysRemaining = getTrialDaysRemaining();

  // If not on trial, show simplified subscription info
  if (!isOnTrial) {
    return (
      <div className="p-6 max-w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">Subscription</h1>
          <p className="text-muted-foreground">Your subscription is active.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="default">{billingInfo.plan_type.toUpperCase()}</Badge>
              <span className="text-sm text-muted-foreground">Active</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span>Generations Used</span>
                <span>{billingInfo.usage.used} / {billingInfo.usage.limit}</span>
              </div>
              <Progress value={billingInfo.usage.percentage} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Free Trial</h1>
        <p className="text-muted-foreground">
          {trialDaysRemaining > 0 
            ? `${trialDaysRemaining} days remaining in your trial`
            : 'Your trial has expired'
          }
        </p>
      </div>

      {/* Usage Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            Trial Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span>Post Generations</span>
              <span className="font-medium">{billingInfo.usage.used} / {billingInfo.usage.limit}</span>
            </div>
            <Progress value={billingInfo.usage.percentage} className="h-3" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{billingInfo.usage.remaining} remaining</span>
              <span>{billingInfo.usage.percentage}% used</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Choose Your Plan</CardTitle>
          <p className="text-sm text-muted-foreground">
            Select which plan you'd like to start when your trial ends
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(PLAN_OPTIONS).map(([key, plan]) => {
              const PlanIcon = plan.icon;
              const isSelected = selectedPlan === key;
              
              return (
                <div
                  key={key}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedPlan(key)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <PlanIcon className={`h-5 w-5 ${plan.color}`} />
                                             <div>
                         <h3 className="font-semibold">{plan.name}</h3>
                         <p className="text-sm text-muted-foreground">{plan.currency}{plan.price}/month</p>
                       </div>
                    </div>
                    {isSelected && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <ul className="mt-2 text-sm text-muted-foreground space-y-1">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-current rounded-full"></div>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Trial Actions</CardTitle>
        </CardHeader>
                <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button 
              onClick={handleStartPlanClick}
              disabled={isEndingTrial || isCancelling}
              className="w-full"
              size="lg"
            >
              <Zap className="mr-2 h-4 w-4" />
              Start {PLAN_OPTIONS[selectedPlan].name} Plan
            </Button>
            
            <Button 
              onClick={handleCancelTrialClick}
              disabled={isEndingTrial || isCancelling}
              variant="outline"
              className="w-full"
            >
              <X className="mr-2 h-4 w-4" />
              Cancel Trial
            </Button>
          </div>
          
          <div className="mt-4 text-xs text-muted-foreground text-center">
            <p>Start your subscription immediately or cancel anytime</p>
          </div>
        </CardContent>
      </Card>

      <ConfirmationDialog
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={confirmationType === 'start' ? handleEndTrialEarly : handleCancelTrial}
        title={confirmationType === 'start' ? 'Start Subscription' : 'Cancel Trial'}
        message={
          confirmationType === 'start' 
            ? `Are you sure you want to end your trial and start the ${PLAN_OPTIONS[selectedPlan].name} plan for ${PLAN_OPTIONS[selectedPlan].currency}${PLAN_OPTIONS[selectedPlan].price}/month?`
            : 'Are you sure you want to cancel your trial? You will lose access to the service immediately.'
        }
        confirmText={confirmationType === 'start' ? 'Start Subscription' : 'Cancel Trial'}
        confirmVariant={confirmationType === 'cancel' ? 'destructive' : 'default'}
        isLoading={isEndingTrial || isCancelling}
      />
    </div>
  );
} 