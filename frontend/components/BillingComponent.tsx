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
  Crown,
} from 'lucide-react';
import { PLAN_OPTIONS } from '@/lib/plans';
import { ConfirmationDialog } from './ui/confirmation-dialog';

interface BillingInfo {
  plan_type: string;
  subscription_status: string;
  has_had_trial: boolean;
  trial_ends_at?: string;
  subscription_ends_at?: string;
  trial_expired: boolean;
  usage: {
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
  };
  current_plan?: {
    name: string;
    price: number;
    currency: string;
    generations: number;
    features: string[];
  };
  upgrade_required: boolean;
}

export function BillingComponent() {
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEndingTrial, setIsEndingTrial] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isStartingSubscription, setIsStartingSubscription] = useState(false);
  const [isRestartingSubscription, setIsRestartingSubscription] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationType, setConfirmationType] = useState<'start' | 'cancel' | 'subscription' | 'restart'>('start');
  const { isAuthenticated, refreshUser } = useAuth();

  // Get the Premium plan details
  const premiumPlan = PLAN_OPTIONS.premium;

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
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/billing/subscription`,
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

  const handleCancelClick = () => {
    setConfirmationType('cancel');
    setShowConfirmation(true);
  };

  const handleStartSubscriptionClick = () => {
    setConfirmationType('subscription');
    setShowConfirmation(true);
  };

  const handleRestartSubscriptionClick = () => {
    setConfirmationType('restart');
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
        { plan: 'premium' },
        { 
          withCredentials: true,
          headers: headers
        }
      );

      if (response.data.url) {
        window.location.href = response.data.url; // Redirect to Stripe checkout
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error: any) {
      console.error('End trial error:', error);
      toast.error(error.response?.data?.error || 'Failed to end trial. Please try again.');
    } finally {
      setIsEndingTrial(false);
    }
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers: any = { 'Content-Type': 'application/json' };
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/billing/cancel-subscription`,
        {},
        { 
          withCredentials: true,
          headers: headers
        }
      );

      if (response.data.success) {
        toast.success(response.data.message || 'Subscription cancelled successfully.');
        fetchBillingInfo(); // Refresh the billing data
        await refreshUser(); // Refresh user context to update sidebar immediately
        setShowConfirmation(false);
      } else {
        throw new Error(response.data.error || 'Failed to cancel');
      }
    } catch (error: any) {
      console.error('Cancel error:', error);
      toast.error(error.response?.data?.error || 'Failed to cancel. Please try again.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleStartSubscription = async () => {
    setIsStartingSubscription(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers: any = { 'Content-Type': 'application/json' };
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/billing/start-subscription`,
        { plan: 'premium' },
        { 
          withCredentials: true,
          headers: headers
        }
      );

      if (response.data.url) {
        window.location.href = response.data.url; // Redirect to Stripe checkout
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error: any) {
      console.error('Start subscription error:', error);
      toast.error(error.response?.data?.error || 'Failed to start subscription. Please try again.');
    } finally {
      setIsStartingSubscription(false);
      setShowConfirmation(false);
    }
  };

  const handleRestartSubscription = async () => {
    setIsRestartingSubscription(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers: any = { 'Content-Type': 'application/json' };
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/billing/restart-subscription`,
        { plan: 'premium' },
        { 
          withCredentials: true,
          headers: headers
        }
      );

      if (response.data.success) {
        toast.success(response.data.message || 'Subscription restarted successfully!');
        
        // Wait for webhook to process and update database
        // Poll until subscription status is active
        let retryCount = 0;
        const maxRetries = 10; // Max 10 seconds
        
        const pollForUpdate = async () => {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          
          // Refresh both user context and billing info
          await refreshUser();
          await fetchBillingInfo();
          
          // Check if user context shows active subscription
          // We need to fetch fresh user data to check status
          try {
            const userResponse = await axios.get(
              `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/auth/me`,
              { 
                withCredentials: true,
                headers: headers
              }
            );
            
            if (userResponse.data?.user?.subscription_status === 'active') {
              // Success! Subscription is now active
              console.log('✅ Subscription successfully restarted and active');
              setShowConfirmation(false);
              return true;
            }
          } catch (error) {
            console.log('Error checking user status:', error);
          }
          
          retryCount++;
          if (retryCount < maxRetries) {
            console.log(`⏳ Waiting for subscription to activate... (${retryCount}/${maxRetries})`);
            return await pollForUpdate();
          } else {
            console.log('⚠️ Timeout waiting for subscription activation');
            setShowConfirmation(false);
            return false;
          }
        };
        
        await pollForUpdate();
      } else {
        throw new Error(response.data.error || 'Failed to restart subscription');
      }
    } catch (error: any) {
      console.error('Restart subscription error:', error);
      if (error.response?.data?.requiresPaymentMethod) {
        toast.error('Please add a payment method first.');
      } else {
        toast.error(error.response?.data?.error || 'Failed to restart subscription. Please try again.');
      }
    } finally {
      setIsRestartingSubscription(false);
      setShowConfirmation(false);
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
  const isTrialCancelled = billingInfo.subscription_status === 'cancelled' && billingInfo.plan_type === 'trial';
  const trialDaysRemaining = getTrialDaysRemaining();
  const isTrialActive = (isOnTrial || isTrialCancelled) && trialDaysRemaining > 0;

  // Check for fully cancelled subscription (not trial)
  const isSubscriptionCancelled = () => {
    if (!billingInfo) return false;
    const now = new Date();
    const isStatusCancelled = billingInfo.subscription_status === 'cancelled' || billingInfo.subscription_status === 'canceled';
    const isNotTrial = billingInfo.plan_type !== 'trial';
    const hasEnded = billingInfo.subscription_ends_at && now >= new Date(billingInfo.subscription_ends_at);
    
    return isStatusCancelled && isNotTrial && hasEnded;
  };

  const isCancelledSubscription = isSubscriptionCancelled();

  // Handle fully cancelled subscriptions
  if (isCancelledSubscription) {
    return (
      <div className="p-6 max-w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">Subscription Cancelled</h1>
          <p className="text-muted-foreground">Your subscription has ended. Restart your Premium subscription to continue using the app.</p>
        </div>

        {/* Premium Plan Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-purple-500" />
              Premium Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">Price</span>
                <span className="text-lg font-semibold">{premiumPlan.currency}{premiumPlan.price}/month</span>
              </div>
              <div className="pt-2">
                <h4 className="font-medium mb-2">Features:</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {premiumPlan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-current rounded-full"></div>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Restart Button */}
        <Card>
          <CardHeader>
            <CardTitle>Restart Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <Button 
                onClick={handleRestartSubscriptionClick}
                disabled={isRestartingSubscription}
                className="w-full mb-3"
                size="lg"
              >
                <Zap className="mr-2 h-4 w-4" />
                {isRestartingSubscription ? 'Starting...' : 'Restart Premium Subscription'}
              </Button>
              <div className="mt-4 text-xs text-muted-foreground text-center">
                <p>Your saved payment method will be charged immediately</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <ConfirmationDialog
          isOpen={showConfirmation}
          onClose={() => setShowConfirmation(false)}
          onConfirm={() => handleRestartSubscription()}
          title="Restart Premium Subscription"
          message={`Are you sure you want to restart the Premium subscription for ${premiumPlan.currency}${premiumPlan.price}/month? Your saved payment method will be charged immediately.`}
          confirmText="Restart Subscription"
          confirmVariant="default"
          isLoading={isRestartingSubscription}
        />
      </div>
    );
  }

  // If not on trial or cancelled trial, show simplified subscription info
  if (!isOnTrial && !isTrialCancelled) {
    return (
      <div className="p-6 max-w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">Premium Subscription</h1>
          <p className="text-muted-foreground">Your Premium subscription is active.</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-purple-500" />
              Premium Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="default">PREMIUM</Badge>
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

        {/* Cancel Subscription */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <Button 
                onClick={handleCancelClick}
                disabled={isCancelling}
                variant="destructive"
                className="w-full"
                size="lg"
              >
                <X className="mr-2 h-4 w-4" />
                {isCancelling ? 'Cancelling...' : 'Cancel Premium Subscription'}
              </Button>
              <div className="mt-4 text-xs text-muted-foreground text-center">
                <p>Your subscription will end immediately upon cancellation</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <ConfirmationDialog
          isOpen={showConfirmation}
          onClose={() => setShowConfirmation(false)}
          onConfirm={handleCancel}
          title="Cancel Premium Subscription"
          message={`Are you sure you want to cancel your Premium subscription for ${premiumPlan.currency}${premiumPlan.price}/month? Your access will end immediately and you will lose all Premium features.`}
          confirmText="Cancel Subscription"
          confirmVariant="destructive"
          isLoading={isCancelling}
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">
          {isTrialCancelled ? 'Cancelled Trial' : 'Free Trial'}
        </h1>
        <p className="text-muted-foreground">
          {isTrialCancelled 
            ? trialDaysRemaining > 0 
              ? `Trial cancelled, but you can continue using the app for ${trialDaysRemaining} more days`
              : 'Your trial has expired'
            : trialDaysRemaining > 0 
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

      {/* Premium Plan Info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-purple-500" />
            Premium Plan
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {isTrialCancelled ? 'Start a Premium subscription' : 'Upgrade to Premium anytime'}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-medium">Price</span>
              <span className="text-lg font-semibold">{premiumPlan.currency}{premiumPlan.price}/month</span>
            </div>
            <div className="pt-2">
              <h4 className="font-medium mb-2">Features:</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {premiumPlan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-current rounded-full"></div>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          {isTrialCancelled ? (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Your trial has been cancelled. You can continue using the app until it expires.
              </p>
              <Button 
                onClick={handleStartSubscriptionClick}
                disabled={isStartingSubscription}
                className="w-full mb-3"
                size="lg"
              >
                <Zap className="mr-2 h-4 w-4" />
                {isStartingSubscription ? 'Starting...' : 'Start Premium Subscription'}
              </Button>
              <div className="mt-4 text-xs text-muted-foreground text-center">
                <p>No more free trials available - you've already used your trial</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button 
                  onClick={handleStartPlanClick}
                  disabled={isEndingTrial || isCancelling}
                  className="w-full"
                  size="lg"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Start Premium Plan
                </Button>
                
                <Button 
                  onClick={handleCancelClick}
                  disabled={isEndingTrial || isCancelling}
                  variant="outline"
                  className="w-full"
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel Trial
                </Button>
              </div>
              
              <div className="mt-4 text-xs text-muted-foreground text-center">
                <p>Start your Premium subscription immediately or cancel anytime</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmationDialog
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={
          confirmationType === 'start' 
            ? handleEndTrialEarly 
            : confirmationType === 'subscription'
              ? handleStartSubscription
              : confirmationType === 'restart'
                ? () => handleRestartSubscription()
                : handleCancel
        }
        title={
          confirmationType === 'start' 
            ? 'Start Premium Subscription' 
            : confirmationType === 'subscription'
              ? 'Start Premium Subscription'
              : confirmationType === 'restart'
                ? 'Restart Premium Subscription'
                : 'Cancel Trial'
        }
        message={
          confirmationType === 'start' 
            ? `Are you sure you want to end your trial and start the Premium plan for ${premiumPlan.currency}${premiumPlan.price}/month?`
            : confirmationType === 'subscription'
              ? `Are you sure you want to start the Premium subscription for ${premiumPlan.currency}${premiumPlan.price}/month? Billing starts immediately with no free trial.`
              : confirmationType === 'restart'
                ? `Are you sure you want to restart the Premium subscription for ${premiumPlan.currency}${premiumPlan.price}/month? Your saved payment method will be charged immediately.`
                : 'Are you sure you want to cancel your trial? Your access will end immediately.'
        }
        confirmText={
          confirmationType === 'start' 
            ? 'Start Premium' 
            : confirmationType === 'subscription'
              ? 'Start Subscription'
              : confirmationType === 'restart'
                ? 'Restart Subscription'
                : 'Cancel Trial'
        }
        confirmVariant={confirmationType === 'cancel' ? 'destructive' : 'default'}
        isLoading={isEndingTrial || isCancelling || isStartingSubscription || isRestartingSubscription}
      />
    </div>
  );
} 