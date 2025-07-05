import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users } from '../schema';
import { eq } from 'drizzle-orm';
import { authenticateRequest } from '../utils/auth';

// Plan limits configuration (updated to match new plan structure)
const PLAN_LIMITS = {
  trial: 10, // 10 generations during 7-day trial
  premium: 100, // £9.99/month - 100 generations
};

export const checkGenerationLimit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = authenticateRequest(req);
    
    console.log('🔍 [checkGenerationLimit] Starting usage check for userId:', userId);
    
    if (!userId) {
      console.log('❌ [checkGenerationLimit] No userId found - returning 401');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      console.log('❌ [checkGenerationLimit] User not found in database - returning 404');
      res.status(404).json({ error: 'User not found' });
      return;
    }

    console.log('👤 [checkGenerationLimit] User found:', {
      id: user.id,
      email: user.email,
      subscription_status: user.subscription_status,
      plan_type: user.plan_type,
      trial_ends_at: user.trial_ends_at,
      trial_generations_used: user.trial_generations_used,
      generations_used_this_month: user.generations_used_this_month,
      current_time: new Date().toISOString()
    });

    // Check if trial has expired (including cancelled trials)
    const isTrialExpired = (user.subscription_status === 'trial' || user.subscription_status === 'cancelled') 
      && user.trial_ends_at && new Date() > user.trial_ends_at;
    
    console.log('📅 [checkGenerationLimit] Trial expiry check:', {
      isTrialStatus: user.subscription_status === 'trial' || user.subscription_status === 'cancelled',
      trial_ends_at: user.trial_ends_at,
      current_time: new Date(),
      isTrialExpired
    });
    
    if (isTrialExpired) {
      console.log('🚫 [checkGenerationLimit] Trial expired - returning 403');
      res.status(403).json({ 
        error: 'Trial expired', 
        message: 'Your trial has expired. Please upgrade to continue generating posts.',
        upgrade_required: true,
        pricing: {
          premium: '£9.99/month for 100 generations'
        }
      });
      return;
    }

    // Check if subscription is inactive (but allow cancelled trials until they expire)
    const isSubscriptionInactive = user.subscription_status === 'past_due' || 
        (user.subscription_status === 'canceled' && !user.trial_ends_at);
    
    console.log('💳 [checkGenerationLimit] Subscription status check:', {
      subscription_status: user.subscription_status,
      isPastDue: user.subscription_status === 'past_due',
      isCanceledWithoutTrial: user.subscription_status === 'canceled' && !user.trial_ends_at,
      isSubscriptionInactive
    });
    
    if (isSubscriptionInactive) {
      console.log('🚫 [checkGenerationLimit] Subscription inactive - returning 403');
      res.status(403).json({ 
        error: 'Subscription inactive', 
        message: 'Your subscription is inactive. Please update your payment method or upgrade your plan.',
        upgrade_required: true
      });
      return;
    }

    // Check generation limits
    const limit = PLAN_LIMITS[user.plan_type as keyof typeof PLAN_LIMITS] || 0;
    const used = (user.subscription_status === 'trial' || user.subscription_status === 'cancelled') 
      ? user.trial_generations_used 
      : user.generations_used_this_month;

    console.log('📊 [checkGenerationLimit] Generation limits check:', {
      plan_type: user.plan_type,
      limit,
      used,
      remaining: limit - used,
      isTrialOrCancelled: user.subscription_status === 'trial' || user.subscription_status === 'cancelled',
      limitReached: used >= limit
    });

    if (used >= limit) {
      const isTrialStatus = user.subscription_status === 'trial' || user.subscription_status === 'cancelled';
      console.log('🚫 [checkGenerationLimit] Generation limit reached - returning 403');
      res.status(403).json({ 
        error: 'Generation limit reached', 
        message: `You've reached your ${limit} generation limit for this ${isTrialStatus ? 'trial' : 'month'}.`,
        limit,
        used,
        plan: user.plan_type,
        upgrade_required: true,
        pricing: {
          premium: '£9.99/month for 100 generations'
        }
      });
      return;
    }

    // Add user data to request for use in the route
    (req as any).user = user;
    
    console.log('✅ [checkGenerationLimit] All checks passed - proceeding to AI generation');
    next();
  } catch (error) {
    console.error('❌ [checkGenerationLimit] Usage check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export { PLAN_LIMITS }; 