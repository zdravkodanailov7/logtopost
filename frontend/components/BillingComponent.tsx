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
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationType, setConfirmationType] = useState<'upgrade' | 'portal'>('upgrade');
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

  const handleUpgradeClick = () => {
    setConfirmationType('upgrade');
    setShowConfirmation(true);
  };

  const handleManageBillingClick = () => {
    setConfirmationType('portal');
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
  const isActive = billingInfo.subscription_status === 'active';
  const isCancelled = billingInfo.subscription_status === 'cancelled';
  const hasUsedUpTrial = isOnTrial && billingInfo.usage.remaining <= 0;

  return (
    <div className="p-6 max-w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">
          {isActive ? 'Premium Subscription' : hasUsedUpTrial ? 'Trial Expired' : isOnTrial ? 'Free Trial' : 'Subscription'}
        </h1>
        <p className="text-muted-foreground">
          {isActive 
            ? 'Your Premium subscription is active.'
            : hasUsedUpTrial
              ? 'Your free trial has ended. Upgrade to Premium to continue.'
              : isOnTrial 
                ? 'You are currently on a free trial.'
                : 'Your subscription is not active.'
          }
        </p>
      </div>

      {/* Usage Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isActive ? (
              <Crown className="h-5 w-5 text-purple-500" />
            ) : (
              <Clock className="h-5 w-5 text-blue-500" />
            )}
            {isActive ? 'Premium Usage' : 'Trial Usage'}
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

      {/* Premium Plan Info (show if not active) */}
      {!isActive && (
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
            {isActive ? 'Subscription Management' : 'Actions'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isActive ? (
            <div className="text-center">
              <Button 
                onClick={handleManageBillingClick}
                className="w-full"
                size="lg"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Manage Billing
              </Button>
              <div className="mt-4 text-xs text-muted-foreground text-center">
                <p>Manage your subscription, payment methods, and billing history</p>
              </div>
            </div>
          ) : isCancelled ? (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Your subscription has been cancelled. Upgrade to continue using the app.
              </p>
              <Button 
                onClick={handleUpgradeClick}
                disabled={isCreatingCheckout}
                className="w-full"
                size="lg"
              >
                <Zap className="mr-2 h-4 w-4" />
                {isCreatingCheckout ? 'Creating...' : 'Upgrade to Premium'}
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <Button 
                onClick={handleUpgradeClick}
                disabled={isCreatingCheckout}
                className="w-full mb-3"
                size="lg"
              >
                <Zap className="mr-2 h-4 w-4" />
                {isCreatingCheckout ? 'Creating...' : 'Upgrade to Premium'}
              </Button>
              <div className="mt-4 text-xs text-muted-foreground text-center">
                <p>
                  {hasUsedUpTrial 
                    ? 'Immediate access to 100 generations • Cancel anytime'
                    : 'Cancel anytime'
                  }
                </p>
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
            : handleManageBilling
        }
        title={
          confirmationType === 'upgrade' 
            ? 'Upgrade to Premium' 
            : 'Manage Billing'
        }
        message={
          confirmationType === 'upgrade' 
            ? `Upgrade to Premium for ${premiumPlan.currency}${premiumPlan.price}/month? ${hasUsedUpTrial ? "You'll get immediate access to 100 generations." : "You may be eligible for a 7-day free trial."}`
            : 'Open Stripe billing portal to manage your subscription and payment methods?'
        }
        confirmText={
          confirmationType === 'upgrade' 
            ? 'Upgrade Now' 
            : 'Open Portal'
        }
        confirmVariant="default"
        isLoading={isCreatingCheckout}
      />
    </div>
  );
} 