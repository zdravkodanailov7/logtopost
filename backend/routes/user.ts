import express, { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users, posts, dailyLogs } from '../schema';
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

// Get user usage stats - DISABLED: Schema fields don't match current database
// router.get('/usage', async (req: Request, res: Response) => {
//   // This endpoint is disabled due to schema mismatch
//   res.status(501).json({ error: 'Usage endpoint not implemented' });
// });

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
        subscription_status: users.subscription_status
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Cancel ALL Stripe subscriptions and delete customer if exists
    if (user.stripe_customer_id) {
      try {
        // Import stripe here to avoid dependency issues if not configured
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        
        console.log(`🔍 Checking for all subscriptions for customer: ${user.stripe_customer_id}`);
        
        // List all subscriptions for this customer
        const subscriptions = await stripe.subscriptions.list({
          customer: user.stripe_customer_id,
          limit: 100 // Get up to 100 subscriptions (should be more than enough)
        });
        
        console.log(`📋 Found ${subscriptions.data.length} subscriptions for customer`);
        
        // Cancel each active subscription
        for (const subscription of subscriptions.data) {
          if (subscription.status === 'active' || subscription.status === 'trialing' || subscription.status === 'past_due') {
            console.log(`🚫 Cancelling subscription: ${subscription.id} (status: ${subscription.status})`);
            await stripe.subscriptions.cancel(subscription.id);
            console.log(`✅ Cancelled subscription: ${subscription.id}`);
          } else {
            console.log(`⚠️ Skipping subscription: ${subscription.id} (status: ${subscription.status})`);
          }
        }
        
        // Delete the entire Stripe customer (this also deletes all associated data)
        await stripe.customers.del(user.stripe_customer_id);
        console.log(`✅ Deleted Stripe customer: ${user.stripe_customer_id}`);
        
      } catch (stripeError) {
        console.error('❌ Error cleaning up Stripe data:', stripeError);
        // Continue with deletion even if Stripe cleanup fails
      }
    }

    // Delete all related data in the correct order
    console.log(`🗑️ Starting data deletion for user ${user.email} (${userId})`);
    
    let deletedCounts = {
      posts: 0,
      logs: 0,
      user: 0
    };

    try {
      // 1. Delete posts
      console.log('🗑️ Deleting posts...');
      await db.delete(posts).where(eq(posts.user_id, userId));
      console.log('✅ Posts deleted');
      deletedCounts.posts = 1; // We can't get exact count without returning, but operation succeeded
    } catch (error) {
      console.error('⚠️ Error deleting posts:', error);
      // Continue with deletion
    }

    try {
      // 2. Delete daily logs
      console.log('🗑️ Deleting daily logs...');
      await db.delete(dailyLogs).where(eq(dailyLogs.user_id, userId));
      console.log('✅ Daily logs deleted');
      deletedCounts.logs = 1;
    } catch (error) {
      console.error('⚠️ Error deleting daily logs:', error);
      // Continue with deletion
    }

    try {
      // 3. Finally delete the user
      console.log('🗑️ Deleting user...');
      await db.delete(users).where(eq(users.id, userId));
      console.log('✅ User deleted');
      deletedCounts.user = 1;
    } catch (error) {
      console.error('❌ Error deleting user:', error);
      throw error; // This is critical, so we should throw
    }

    console.log(`✅ Account deletion completed for user ${user.email}:`, deletedCounts);

    res.json({ 
      message: 'Account deleted successfully',
      deleted: deletedCounts
    });

  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router; 