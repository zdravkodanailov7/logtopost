import express, { Request, Response } from 'express';
import { authenticateRequest } from '../utils/auth';
import { db } from '../db';
import { users } from '../schema';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

const router = express.Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Pricing configuration (GBP) - Single Premium plan
const PLAN_PRICING = {
  premium: {
    name: 'Premium',
    price: 9.99,
    currency: 'gbp',
    generations: 100,
    stripe_price_id: process.env.STRIPE_PREMIUM_PRICE_ID || 'price_premium_monthly_gbp',
    features: ['Core features', 'Custom AI prompts']
  }
};

const PLAN_LIMITS = {
  trial: 10,
  premium: PLAN_PRICING.premium.generations
};

// Get available plans and pricing
router.get('/plans', (req: Request, res: Response) => {
  try {
    res.json({
      currency: 'GBP',
      trial: {
        name: 'Free Trial',
        price: 0,
        generations: 10,
        duration: '7 days'
      },
      plan: PLAN_PRICING.premium
    });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// Get current user's subscription info
router.get('/subscription', async (req: Request, res: Response) => {
  try {
    const userId = authenticateRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [user] = await db
      .select({
        id: users.id,
        subscription_status: users.subscription_status,
        generations_used_this_month: users.generations_used_this_month,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Determine limits based on subscription status
    const isActive = user.subscription_status === 'active';
    const limit = isActive ? PLAN_LIMITS.premium : PLAN_LIMITS.trial;
    const used = user.generations_used_this_month;

    res.json({
      ...user,
      current_plan: isActive ? PLAN_PRICING.premium : null,
      usage: {
        used,
        limit,
        remaining: Math.max(0, limit - used),
        percentage: Math.min(100, Math.round((used / limit) * 100))
      }
    });

  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to fetch subscription info' });
  }
});

// Create checkout session
router.post('/create-checkout-session', async (req: Request, res: Response) => {
  try {
    const userId = authenticateRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user details including subscription info
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        stripe_customer_id: users.stripe_customer_id,
        subscription_status: users.subscription_status,
        generations_used_this_month: users.generations_used_this_month,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't allow checkout if already active
    if (user.subscription_status === 'active') {
      return res.status(400).json({ error: 'Already have an active subscription' });
    }

    // Backend decides trial eligibility based on DB state
    // If they're currently on trial and have used generations, they've had their trial
    const hasAlreadyHadTrial = user.subscription_status === 'trial' && user.generations_used_this_month > 0;
    const shouldIncludeTrial = 
      user.subscription_status !== 'active' &&
      !hasAlreadyHadTrial;

    console.log('🏪 Trial eligibility check:', {
      userId: user.id,
      subscription_status: user.subscription_status,
      generations_used: user.generations_used_this_month,
      hasAlreadyHadTrial,
      shouldIncludeTrial
    });

    // Create or retrieve Stripe customer
    let customerId = user.stripe_customer_id;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      
      customerId = customer.id;
      
      await db
        .update(users)
        .set({ stripe_customer_id: customerId })
        .where(eq(users.id, userId));
    }

// Handle upgrade from trial by ending existing trial
    if (user.subscription_status === 'trial' && customerId) {
      // Find trialing subscription
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'trialing',
        limit: 1
      });

      if (subscriptions.data.length > 0) {
        const subId = subscriptions.data[0].id;
        
        console.log(`🏪 Upgrading trial for subscription ${subId}`);
        
        const updatedSubscription = await stripe.subscriptions.update(subId, {
          trial_end: 'now'
        });

        // Check if update was successful
        if (updatedSubscription.status === 'active') {
          // Update database immediately
          await db.update(users)
            .set({
              subscription_status: 'active',
              generations_used_this_month: 0,
              updated_at: new Date()
            })
            .where(eq(users.id, userId));

          const successUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?success=true`;
          
          console.log(`✅ Successfully upgraded user ${userId} to active`);
          return res.json({ url: successUrl });
        } else {
          throw new Error(`Subscription update failed: status ${updatedSubscription.status}`);
        }
      }
    }

    // Normal checkout flow
    // Create checkout session configuration
    const sessionConfig: any = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: PLAN_PRICING.premium.stripe_price_id,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?success=true`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`,
      metadata: {
        userId: user.id,
        originallyEligibleForTrial: shouldIncludeTrial.toString(),
      },
    };

    // Only add trial if eligible
    if (shouldIncludeTrial) {
      sessionConfig.subscription_data = {
        trial_period_days: 7,
      };
    }

    console.log('🏪 Creating checkout session:', {
      userId: user.id,
      email: user.email,
      shouldIncludeTrial,
      trialDays: shouldIncludeTrial ? 7 : 0
    });

    const session = await stripe.checkout.sessions.create(sessionConfig);

    res.json({ url: session.url });

  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Create Customer Portal session
router.post('/create-portal-session', async (req: Request, res: Response) => {
  try {
    const userId = authenticateRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        stripe_customer_id: users.stripe_customer_id,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.stripe_customer_id) {
      return res.status(400).json({ error: 'No billing account found' });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`,
    });

    res.json({ url: portalSession.url });

  } catch (error) {
    console.error('Create portal session error:', error);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});



// Simplified webhook handler
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig as string, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.log(`Webhook signature verification failed:`, err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        if (session.mode === 'subscription') {
          const userId = session.metadata?.userId;
          const hadTrialEligibility = session.metadata?.originallyEligibleForTrial === 'true';
          if (userId) {
            await db
              .update(users)
              .set({
                subscription_status: hadTrialEligibility ? 'trial' : 'active',
                updated_at: new Date()
              })
              .where(eq(users.id, userId));
            console.log(`✅ User ${userId} started ${hadTrialEligibility ? 'trial' : 'premium subscription'}`);
          }
        }
        break;

      case 'customer.subscription.updated':
        const updatedSubscription = event.data.object;
        const customerId = updatedSubscription.customer as string;
        
        const [userByCustomer] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.stripe_customer_id, customerId))
          .limit(1);
        
        if (userByCustomer) {
          const status = updatedSubscription.status === 'active' ? 'active' : 
                        updatedSubscription.status === 'trialing' ? 'trial' : 'cancelled';
          
          await db
            .update(users)
            .set({
              subscription_status: status,
              updated_at: new Date()
            })
            .where(eq(users.id, userByCustomer.id));
          
          console.log(`✅ Updated user ${userByCustomer.id} status to ${status}`);
        }
        break;

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object;
        const deletedCustomerId = deletedSubscription.customer as string;
        
        const [userByDeletedCustomer] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.stripe_customer_id, deletedCustomerId))
          .limit(1);
        
        if (userByDeletedCustomer) {
          await db
            .update(users)
            .set({
              subscription_status: 'cancelled',
              updated_at: new Date()
            })
            .where(eq(users.id, userByDeletedCustomer.id));
          
          console.log(`✅ Cancelled subscription for user ${userByDeletedCustomer.id}`);
        }
        break;

      case 'invoice.payment_succeeded':
        const succeededInvoice = event.data.object as any;
        const invoiceCustomerId = succeededInvoice.customer as string;
        
        const [userByInvoice] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.stripe_customer_id, invoiceCustomerId))
          .limit(1);
        
        if (userByInvoice) {
          // Reset usage for new billing period
          await db
            .update(users)
            .set({
              subscription_status: 'active',
              generations_used_this_month: 0,
              updated_at: new Date()
            })
            .where(eq(users.id, userByInvoice.id));
          
          console.log(`✅ Reset usage for user ${userByInvoice.id}`);
        }
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

export default router; 