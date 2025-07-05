import express, { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users, posts, postGenerations, dailyLogs } from '../schema';
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
        intended_plan_type: users.intended_plan_type,
        has_had_trial: users.has_had_trial,
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
    const used = (user.subscription_status === 'trial' || user.subscription_status === 'cancelled') 
      ? user.trial_generations_used 
      : user.generations_used_this_month;
    const remaining = limit - used;

    // Check if trial expired (including cancelled trials)
    const trialExpired = (user.subscription_status === 'trial' || user.subscription_status === 'cancelled') 
      && user.trial_ends_at && new Date() > user.trial_ends_at;

    res.json({
      plan_type: user.plan_type,
      subscription_status: user.subscription_status,
      intended_plan_type: user.intended_plan_type,
      has_had_trial: user.has_had_trial,
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

// Delete user account and all related data
router.delete('/account', async (req: Request, res: Response) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = decoded.userId;

    // First, get user data to check for Stripe subscription
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        stripe_customer_id: users.stripe_customer_id,
        stripe_subscription_id: users.stripe_subscription_id,
        subscription_status: users.subscription_status
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Cancel Stripe subscription and delete customer if exists
    if (user.stripe_customer_id || user.stripe_subscription_id) {
      try {
        // Import stripe here to avoid dependency issues if not configured
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        
        // Cancel subscription first if it exists and is active
        if (user.stripe_subscription_id && user.subscription_status === 'active') {
          await stripe.subscriptions.cancel(user.stripe_subscription_id);
          console.log(`✅ Cancelled Stripe subscription: ${user.stripe_subscription_id}`);
        }
        
        // Delete the entire Stripe customer (this also deletes all associated data)
        if (user.stripe_customer_id) {
          await stripe.customers.del(user.stripe_customer_id);
          console.log(`✅ Deleted Stripe customer: ${user.stripe_customer_id}`);
        }
        
      } catch (stripeError) {
        console.error('❌ Error cleaning up Stripe data:', stripeError);
        // Continue with deletion even if Stripe cleanup fails
      }
    }

    // Delete all related data in the correct order
    // 1. Delete posts
    const deletedPosts = await db
      .delete(posts)
      .where(eq(posts.user_id, userId))
      .returning({ id: posts.id });

    // 2. Delete post generations
    const deletedGenerations = await db
      .delete(postGenerations)
      .where(eq(postGenerations.user_id, userId))
      .returning({ id: postGenerations.id });

    // 3. Delete daily logs
    const deletedLogs = await db
      .delete(dailyLogs)
      .where(eq(dailyLogs.user_id, userId))
      .returning({ id: dailyLogs.id });

    // 4. Finally delete the user
    const deletedUser = await db
      .delete(users)
      .where(eq(users.id, userId))
      .returning({ id: users.id, email: users.email });

    console.log(`Account deletion completed for user ${user.email}:`, {
      posts: deletedPosts.length,
      generations: deletedGenerations.length,
      logs: deletedLogs.length,
      user: deletedUser.length
    });

    res.json({ 
      message: 'Account deleted successfully',
      deleted: {
        posts: deletedPosts.length,
        generations: deletedGenerations.length,
        logs: deletedLogs.length
      }
    });

  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router; 