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
  Crown,
  ExternalLink,
} from 'lucide-react';
import { PLAN_OPTIONS } from '@/lib/plans';
import { ConfirmationDialog } from './ui/confirmation-dialog';

interface BillingInfo {
  subscription_status: string;
  generations_used_this_month: number;
  is_cancelled?: boolean;
  cancel_at_period_end?: boolean;
  trial_ends_at?: string | null;
  subscription_ends_at?: string | null;
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
}

export function BillingComponent() {
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationType, setConfirmationType] = useState<'upgrade' | 'portal' | 'cancel'>('upgrade');
  const { isAuthenticated, refreshUser } = useAuth();

  // Get the Premium plan details
  const premiumPlan = PLAN_OPTIONS.premium;

  useEffect(() => {
    if (isAuthenticated) {
      fetchBillingInfo();
    }
  }, [isAuthenticated]);

  // Auto-refresh when returning from portal (check URL for portal return)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated) {
        // Small delay to ensure user sees the refresh
        setTimeout(fetchBillingInfo, 1000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAuthenticated]);

  const fetchBillingInfo = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: any = { 'Content-Type': 'application/json' };
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/billing/subscription-stripe`,
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

  const handleUpgradeClick = () => {
    setConfirmationType('upgrade');
    setShowConfirmation(true);
  };

  const handleManageBillingClick = () => {
    setConfirmationType('portal');
    setShowConfirmation(true);
  };

  const handleCancelClick = () => {
    setConfirmationType('cancel');
    setShowConfirmation(true);
  };



  const handleCreateCheckout = async () => {
    setIsCreatingCheckout(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers: any = { 'Content-Type': 'application/json' };
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/billing/create-checkout-session`,
        {}, // Backend handles trial logic based on database state
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
      console.error('Checkout error:', error);
      toast.error(error.response?.data?.error || 'Failed to create checkout session. Please try again.');
    } finally {
      setIsCreatingCheckout(false);
      setShowConfirmation(false);
    }
  };



  const handleManageBilling = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: any = { 'Content-Type': 'application/json' };
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/billing/create-portal-session`,
        {},
        { 
          withCredentials: true,
          headers: headers
        }
      );

      if (response.data.url) {
        window.location.href = response.data.url; // Redirect to Stripe portal
      } else {
        throw new Error('No portal URL received');
      }
    } catch (error: any) {
      console.error('Portal error:', error);
      toast.error(error.response?.data?.error || 'Failed to open billing portal. Please try again.');
    } finally {
      setShowConfirmation(false);
    }
  };

  const handleCancelSubscription = async () => {
    setIsProcessing(true);
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
        toast.success(response.data.message || 'Subscription cancelled successfully');
        await fetchBillingInfo(); // Refresh billing info
      } else {
        throw new Error('Cancellation failed');
      }
    } catch (error: any) {
      console.error('Cancel error:', error);
      toast.error(error.response?.data?.error || 'Failed to cancel subscription. Please try again.');
    } finally {
      setIsProcessing(false);
      setShowConfirmation(false);
    }
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

  const isActive = billingInfo.subscription_status === 'active' && !billingInfo.is_cancelled;
  const isCancelled = billingInfo.subscription_status === 'cancelled' || billingInfo.subscription_status === 'canceled' || billingInfo.is_cancelled;
  const willCancel = billingInfo.cancel_at_period_end;
  const isInactive = billingInfo.subscription_status === 'inactive' || (!isActive && !isCancelled);

  return (
    <div className="p-6 max-w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">
          {isActive && !willCancel ? 'Premium Subscription' : 'No Active Subscription'}
        </h1>
        <p className="text-muted-foreground">
          {isActive && !willCancel
            ? 'Your Premium subscription is active.'
            : willCancel
              ? 'Your subscription will end at the current billing period. Subscribe again to continue using Premium features.'
              : isCancelled
                ? 'Your subscription has been cancelled. Subscribe to Premium to continue using the app.'
                : 'Subscribe to Premium to start generating posts.'
          }
        </p>
      </div>

      {/* Usage Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {(isActive && !willCancel) ? (
              <Crown className="h-5 w-5 text-purple-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-500" />
            )}
            {isActive && !willCancel
              ? 'Premium Usage'
              : willCancel
                ? 'Usage (Subscription Ending)'
                : 'Usage (No Active Subscription)'
            }
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

      {/* Premium Plan Info (show if not active or will cancel) */}
      {(!isActive || willCancel || isCancelled) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-purple-500" />
              Premium Plan
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Upgrade to Premium for more generations and features
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
      )}

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>
            {(isActive && !willCancel) 
              ? 'Subscription Management' 
              : 'Subscribe to Premium'
            }
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(isActive && !willCancel) ? (
            <div className="text-center space-y-3">
              <Button 
                onClick={handleManageBillingClick}
                className="w-full"
                size="lg"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Manage Billing
              </Button>
              <Button 
                onClick={handleCancelClick}
                variant="outline"
                className="w-full"
                size="sm"
              >
                Cancel Subscription
              </Button>
              <div className="mt-4 text-xs text-muted-foreground text-center">
                <p>Manage your subscription, payment methods, and billing history</p>
              </div>
            </div>
          ) : willCancel ? (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Your subscription will end at the current billing period. Subscribe again to continue using Premium features.
              </p>
              <Button 
                onClick={handleUpgradeClick}
                disabled={isCreatingCheckout}
                className="w-full mb-2"
                size="lg"
              >
                <Zap className="mr-2 h-4 w-4" />
                {isCreatingCheckout ? 'Creating...' : 'Subscribe to Premium'}
              </Button>
              <Button 
                onClick={handleManageBillingClick}
                variant="outline"
                className="w-full"
                size="sm"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Manage Billing
              </Button>
            </div>
          ) : isCancelled ? (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Your subscription has been cancelled. You currently have no active subscription.
              </p>
              <Button 
                onClick={handleUpgradeClick}
                disabled={isCreatingCheckout}
                className="w-full"
                size="lg"
              >
                <Zap className="mr-2 h-4 w-4" />
                {isCreatingCheckout ? 'Creating...' : 'Subscribe to Premium'}
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                You currently have no active subscription.
              </p>
              <Button 
                onClick={handleUpgradeClick}
                disabled={isCreatingCheckout}
                className="w-full mb-3"
                size="lg"
              >
                <Zap className="mr-2 h-4 w-4" />
                {isCreatingCheckout ? 'Creating...' : 'Subscribe to Premium'}
              </Button>
              <div className="mt-4 text-xs text-muted-foreground text-center">
                <p>Immediate access to 100 generations • Cancel anytime</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmationDialog
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={
          confirmationType === 'upgrade' 
            ? handleCreateCheckout
            : confirmationType === 'cancel'
              ? handleCancelSubscription
              : handleManageBilling
        }
        title={
          confirmationType === 'upgrade' 
            ? 'Upgrade to Premium'
            : confirmationType === 'cancel'
              ? 'Cancel Subscription'
              : 'Manage Billing'
        }
        message={
          confirmationType === 'upgrade' 
            ? `Upgrade to Premium for ${premiumPlan.currency}${premiumPlan.price}/month? You'll get immediate access to 100 generations.`
            : confirmationType === 'cancel'
              ? 'Are you sure you want to cancel your subscription? You will keep access until the end of your current billing period.'
              : 'Open Stripe billing portal to manage your subscription and payment methods?'
        }
        confirmText={
          confirmationType === 'upgrade' 
            ? 'Upgrade Now'
            : confirmationType === 'cancel'
              ? 'Cancel Subscription'
              : 'Open Portal'
        }
        confirmVariant={confirmationType === 'cancel' ? 'destructive' : 'default'}
        isLoading={isCreatingCheckout || isProcessing}
      />
    </div>
  );
} 