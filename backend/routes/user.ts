import express, { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../schema';
import { verifyToken } from '../utils/auth';

const router = express.Router();

// User profile endpoints
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const [user] = await db
      .select({ 
        id: users.id,
        email: users.email,
        custom_prompt: users.custom_prompt
      })
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.put('/profile', async (req: Request, res: Response) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { custom_prompt } = req.body;

    const [updatedUser] = await db
      .update(users)
      .set({ 
        custom_prompt: custom_prompt || null,
        updated_at: new Date()
      })
      .where(eq(users.id, decoded.userId))
      .returning({
        id: users.id,
        email: users.email,
        custom_prompt: users.custom_prompt
      });

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(updatedUser);
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get user usage stats
router.get('/usage', async (req: Request, res: Response) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const [user] = await db
      .select({
        id: users.id,
        subscription_status: users.subscription_status,
        plan_type: users.plan_type,
        generations_used_this_month: users.generations_used_this_month,
        trial_generations_used: users.trial_generations_used,
        trial_ends_at: users.trial_ends_at,
        subscription_ends_at: users.subscription_ends_at,
      })
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate usage and limits (GBP pricing structure)
    const PLAN_LIMITS = {
      trial: 10,   // 7-day trial
      basic: 50,   // £7.99/month
      pro: 150,    // £14.99/month
      advanced: 500 // £24.99/month
    };

    const PLAN_PRICING = {
      basic: { price: 7.99, currency: 'GBP' },
      pro: { price: 14.99, currency: 'GBP' },
      advanced: { price: 24.99, currency: 'GBP' }
    };

    const limit = PLAN_LIMITS[user.plan_type as keyof typeof PLAN_LIMITS] || 0;
    const used = user.subscription_status === 'trial' ? user.trial_generations_used : user.generations_used_this_month;
    const remaining = limit - used;

    // Check if trial expired
    const trialExpired = user.subscription_status === 'trial' && user.trial_ends_at && new Date() > user.trial_ends_at;

    res.json({
      plan_type: user.plan_type,
      subscription_status: user.subscription_status,
      trial_ends_at: user.trial_ends_at,
      subscription_ends_at: user.subscription_ends_at,
      trial_expired: trialExpired,
      usage: {
        used,
        limit,
        remaining,
        percentage: Math.round((used / limit) * 100)
      },
      pricing: PLAN_PRICING,
      upgrade_required: remaining <= 0 || trialExpired
    });

  } catch (error) {
    console.error('Usage fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

export default router; 