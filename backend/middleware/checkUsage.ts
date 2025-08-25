import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users } from '../schema';
import { eq } from 'drizzle-orm';
import { authenticateRequest } from '../utils/auth';

// Plan limits configuration (updated to match new plan structure)
const PLAN_LIMITS = {
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
      is_admin: user.is_admin,
      subscription_status: user.subscription_status,
      generations_used_this_month: user.generations_used_this_month,
      current_time: new Date().toISOString()
    });

    // Bypass all limits for admin users
    if (user.is_admin) {
      console.log('👑 [checkGenerationLimit] Admin user detected - bypassing all limits');
      (req as any).user = user;
      next();
      return;
    }

    // Check if subscription is inactive
    const isSubscriptionInactive = user.subscription_status !== 'active';
    
    console.log('💳 [checkGenerationLimit] Subscription status check:', {
      subscription_status: user.subscription_status,
      isSubscriptionInactive
    });
    
    if (isSubscriptionInactive) {
      console.log('🚫 [checkGenerationLimit] Subscription inactive - returning 403');
      res.status(403).json({ 
        error: 'Subscription required', 
        message: 'You need an active Premium subscription to generate posts.',
        upgrade_required: true
      });
      return;
    }

    // Check generation limits based on subscription status
    const isActive = user.subscription_status === 'active';
    const limit = isActive ? PLAN_LIMITS.premium : 0;
    const used = user.generations_used_this_month;

    console.log('📊 [checkGenerationLimit] Generation limits check:', {
      subscription_status: user.subscription_status,
      isActive,
      limit,
      used,
      remaining: limit - used,
      limitReached: used >= limit
    });

    if (used >= limit) {
      console.log('🚫 [checkGenerationLimit] Generation limit reached - returning 403');
      res.status(403).json({ 
        error: 'Generation limit reached', 
        message: `You've reached your ${limit} generation limit for this month.`,
        limit,
        used,
        subscription_status: user.subscription_status,
        upgrade_required: false, // They already have premium, just hit the limit
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