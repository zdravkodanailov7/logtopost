import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users } from '../schema';
import { eq } from 'drizzle-orm';
import { authenticateRequest } from '../utils/auth';

// Plan limits configuration (matching GBP pricing structure)
const PLAN_LIMITS = {
  trial: 10, // 10 generations during 7-day trial
  basic: 50, // £7.99/month - 50 generations
  pro: 150,  // £14.99/month - 150 generations  
  advanced: 500 // £24.99/month - 500 generations
};

export const checkGenerationLimit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = authenticateRequest(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if trial has expired (including cancelled trials)
    const isTrialExpired = (user.subscription_status === 'trial' || user.subscription_status === 'cancelled') 
      && user.trial_ends_at && new Date() > user.trial_ends_at;
    
    if (isTrialExpired) {
      return res.status(403).json({ 
        error: 'Trial expired', 
        message: 'Your trial has expired. Please upgrade to continue generating posts.',
        upgrade_required: true,
        pricing: {
          basic: '£7.99/month',
          pro: '£14.99/month', 
          advanced: '£24.99/month'
        }
      });
    }

    // Check if subscription is inactive (but allow cancelled trials until they expire)
    if (user.subscription_status === 'past_due' || 
        (user.subscription_status === 'canceled' && !user.trial_ends_at)) {
      return res.status(403).json({ 
        error: 'Subscription inactive', 
        message: 'Your subscription is inactive. Please update your payment method or upgrade your plan.',
        upgrade_required: true
      });
    }

    // Check generation limits
    const limit = PLAN_LIMITS[user.plan_type as keyof typeof PLAN_LIMITS] || 0;
    const used = (user.subscription_status === 'trial' || user.subscription_status === 'cancelled') 
      ? user.trial_generations_used 
      : user.generations_used_this_month;

    if (used >= limit) {
      const isTrialStatus = user.subscription_status === 'trial' || user.subscription_status === 'cancelled';
      return res.status(403).json({ 
        error: 'Generation limit reached', 
        message: `You've reached your ${limit} generation limit for this ${isTrialStatus ? 'trial' : 'month'}.`,
        limit,
        used,
        plan: user.plan_type,
        upgrade_required: true,
        pricing: {
          basic: '£7.99/month for 50 generations',
          pro: '£14.99/month for 150 generations', 
          advanced: '£24.99/month for 500 generations'
        }
      });
    }

    // Add user data to request for use in the route
    (req as any).user = user;
    
    next();
  } catch (error) {
    console.error('Usage check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export { PLAN_LIMITS }; 