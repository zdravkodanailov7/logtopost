import express, { Request, Response } from 'express';
import { authenticateRequest } from '../utils/auth';
import { db } from '../db';
import { users } from '../schema';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

const router = express.Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Pricing configuration (GBP)
const PLAN_PRICING = {
  basic: {
    name: 'Basic',
    price: 7.99,
    currency: 'gbp',
    generations: 50,
    stripe_price_id: process.env.STRIPE_BASIC_PRICE_ID || 'price_basic_monthly_gbp',
  },
  pro: {
    name: 'Pro',
    price: 14.99,
    currency: 'gbp',
    generations: 150,
    stripe_price_id: process.env.STRIPE_PRO_PRICE_ID || 'price_pro_monthly_gbp',
  },
  advanced: {
    name: 'Advanced',
    price: 24.99,
    currency: 'gbp',
    generations: 500,
    stripe_price_id: process.env.STRIPE_ADVANCED_PRICE_ID || 'price_advanced_monthly_gbp',
  }
};

const PLAN_LIMITS = {
  trial: 10,
  basic: PLAN_PRICING.basic.generations,
  pro: PLAN_PRICING.pro.generations,
  advanced: PLAN_PRICING.advanced.generations
};

// Get available plans and pricing
router.get('/plans', async (req: Request, res: Response) => {
  try {
    res.json({
      currency: 'GBP',
      trial: {
        name: 'Free Trial',
        price: 0,
        generations: 10,
        duration: '7 days'
      },
      plans: PLAN_PRICING
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
        plan_type: users.plan_type,
        generations_used_this_month: users.generations_used_this_month,
        trial_generations_used: users.trial_generations_used,
        trial_ends_at: users.trial_ends_at,
        subscription_ends_at: users.subscription_ends_at,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const limit = PLAN_LIMITS[user.plan_type as keyof typeof PLAN_LIMITS] || 0;
    const used = user.subscription_status === 'trial' ? user.trial_generations_used : user.generations_used_this_month;

    // Get current plan pricing info
    const currentPlanPricing = user.plan_type !== 'trial' 
      ? PLAN_PRICING[user.plan_type as keyof typeof PLAN_PRICING] 
      : null;

    res.json({
      ...user,
      current_plan: currentPlanPricing,
      usage: {
        used,
        limit,
        remaining: limit - used,
        percentage: Math.round((used / limit) * 100)
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

    const { plan } = req.body; // 'basic', 'pro', or 'advanced'

    if (!PLAN_PRICING[plan as keyof typeof PLAN_PRICING]) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    const selectedPlan = PLAN_PRICING[plan as keyof typeof PLAN_PRICING];

    // Get user details
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

    // Create or retrieve Stripe customer
    let customerId = user.stripe_customer_id;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.id,
        },
      });
      
      customerId = customer.id;
      
      // Update user with Stripe customer ID
      await db
        .update(users)
        .set({ stripe_customer_id: customerId })
        .where(eq(users.id, userId));
    } else {
      // Verify that the customer still exists in Stripe
      try {
        await stripe.customers.retrieve(customerId);
      } catch (error: any) {
        if (error.code === 'resource_missing') {
          // Customer doesn't exist, create a new one
          const customer = await stripe.customers.create({
            email: user.email,
            metadata: {
              userId: user.id,
            },
          });
          
          customerId = customer.id;
          
          // Update user with new Stripe customer ID
          await db
            .update(users)
            .set({ stripe_customer_id: customerId })
            .where(eq(users.id, userId));
        } else {
          throw error;
        }
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: selectedPlan.stripe_price_id,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pricing?canceled=true`,
      metadata: {
        userId: user.id,
        planType: plan,
      },
      subscription_data: {
        trial_period_days: 7, // 7-day free trial
      },
    });

    res.json({ 
      url: session.url,
      sessionId: session.id 
    });

  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// End trial early and start subscription immediately
router.post('/end-trial-early', async (req: Request, res: Response) => {
  try {
    const userId = authenticateRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { plan } = req.body; // 'basic', 'pro', or 'advanced'

    if (!PLAN_PRICING[plan as keyof typeof PLAN_PRICING]) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    const selectedPlan = PLAN_PRICING[plan as keyof typeof PLAN_PRICING];

    // Get user details
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        stripe_customer_id: users.stripe_customer_id,
        subscription_status: users.subscription_status,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify user is on trial
    if (user.subscription_status !== 'trial') {
      return res.status(400).json({ error: 'User is not on trial' });
    }

    console.log('⚡ Ending trial early for user:', userId, 'plan:', plan);

    // Ensure user has a Stripe customer ID
    let customerId = user.stripe_customer_id;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.id,
        },
      });
      
      customerId = customer.id;
      
      await db
        .update(users)
        .set({ stripe_customer_id: customerId })
        .where(eq(users.id, userId));
    }

    // Create checkout session with immediate billing (no trial)
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: selectedPlan.stripe_price_id,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?success=true&trial_ended=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?canceled=true`,
      metadata: {
        userId: user.id,
        planType: plan,
        endTrialEarly: 'true',
      },
      // No trial_period_days here - immediate billing
    });

    console.log('✅ Created end-trial checkout session:', session.id);

    res.json({ 
      url: session.url,
      sessionId: session.id 
    });

  } catch (error) {
    console.error('End trial early error:', error);
    res.status(500).json({ error: 'Failed to end trial and create subscription' });
  }
});

// Create Customer Portal session
router.post('/create-portal-session', async (req: Request, res: Response) => {
  try {
    const userId = authenticateRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('🔗 Creating portal session for user:', userId);

    // Get user details
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

    console.log('👤 User details:', {
      id: user.id,
      email: user.email,
      stripe_customer_id: user.stripe_customer_id
    });

    // Ensure user has a Stripe customer ID
    let customerId = user.stripe_customer_id;
    
    if (!customerId) {
      console.log('🆕 Creating new Stripe customer for user:', user.email);
      // Create customer if none exists
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.id,
        },
      });
      
      customerId = customer.id;
      console.log('✅ Created Stripe customer:', customerId);
      
      // Update user with Stripe customer ID
      await db
        .update(users)
        .set({ stripe_customer_id: customerId })
        .where(eq(users.id, userId));
      
      console.log('💾 Updated database with customer ID');
    } else {
      console.log('✅ Using existing Stripe customer:', customerId);
    }

    console.log('🏪 Creating billing portal session...');
    
    // Create portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`,
    });

    console.log('✅ Portal session created successfully:', portalSession.id);

    res.json({ 
      url: portalSession.url 
    });

  } catch (error: any) {
    console.error('❌ Create portal session error:');
    console.error('Error type:', error.type);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error details:', error);
    
    // Return more specific error message
    const errorMessage = error.message || 'Failed to create portal session';
    res.status(500).json({ 
      error: errorMessage,
      details: error.type || 'unknown_error'
    });
  }
});

// Stripe webhook handler
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig as string, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.log(`Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('🔄 Checkout session completed:', session.id);
        console.log('📋 Session details:', {
          mode: session.mode,
          subscription: session.subscription,
          metadata: session.metadata
        });
        
        if (session.mode === 'subscription') {
          const subscriptionId = session.subscription as string;
          const userId = session.metadata?.userId;
          const planType = session.metadata?.planType;
          const isEndingTrial = session.metadata?.endTrial === 'true';
          const isEndingTrialEarly = session.metadata?.endTrialEarly === 'true';
          
          console.log('🔍 Extracted values:', {
            subscriptionId,
            userId,
            planType,
            isEndingTrial,
            isEndingTrialEarly
          });
          
          if (userId && planType) {
            try {
              // Get subscription details from Stripe
              console.log('📞 Retrieving subscription from Stripe:', subscriptionId);
              const subscription = await stripe.subscriptions.retrieve(subscriptionId);
              console.log('✅ Subscription retrieved successfully:', {
                id: subscription.id,
                status: subscription.status,
                current_period_end: (subscription as any).current_period_end
              });
              
              // Update user record with subscription details
              console.log('💾 Updating database for user:', userId);
              
              // Safely handle subscription end date
              const currentPeriodEnd = (subscription as any).current_period_end;
              const subscriptionEndDate = currentPeriodEnd && typeof currentPeriodEnd === 'number' 
                ? new Date(currentPeriodEnd * 1000) 
                : null;
              
              console.log('🗓️ Subscription end date:', {
                raw: currentPeriodEnd,
                processed: subscriptionEndDate
              });
              
              // Determine subscription status and plan type based on Stripe subscription
              let dbSubscriptionStatus: string;
              let dbPlanType: string;
              
              if (isEndingTrialEarly && subscription.status === 'active') {
                // User ended trial early - they should be active immediately
                dbSubscriptionStatus = 'active';
                dbPlanType = planType;
                console.log('⚡ User ended trial early, setting status to active and plan to:', planType);
              } else if (subscription.status === 'trialing') {
                dbSubscriptionStatus = 'trial';
                dbPlanType = 'trial';
                console.log('🎯 User is on trial, setting status to trial and plan to trial');
              } else if (subscription.status === 'active') {
                dbSubscriptionStatus = 'active';
                dbPlanType = planType;
                console.log('🎯 User is active, setting status to active and plan to:', planType);
              } else {
                dbSubscriptionStatus = subscription.status;
                dbPlanType = planType;
                console.log('🎯 User status is:', subscription.status, 'plan:', planType);
              }
              
              const updateResult = await db
                .update(users)
                .set({
                  stripe_subscription_id: subscriptionId,
                  subscription_status: dbSubscriptionStatus,
                  plan_type: dbPlanType,
                  subscription_ends_at: subscriptionEndDate,
                  // Reset usage counters for new subscription
                  generations_used_this_month: 0,
                  updated_at: new Date()
                })
                .where(eq(users.id, userId))
                .returning({ id: users.id });
              
              console.log('✅ Database update result:', updateResult);
              console.log(`✅ Updated user ${userId} with subscription ${subscriptionId}, status: ${dbSubscriptionStatus}, plan: ${dbPlanType}`);
            } catch (dbError) {
              console.error('❌ Error in checkout.session.completed:');
              console.error('Error details:', dbError);
              console.error('Error message:', dbError instanceof Error ? dbError.message : String(dbError));
              console.error('Error stack:', dbError instanceof Error ? dbError.stack : 'No stack trace');
              throw dbError;
            }
          } else {
            console.log('⚠️ Missing userId or planType:', { userId, planType });
          }
        } else {
          console.log('⚠️ Session mode is not subscription:', session.mode);
        }
        break;

      case 'customer.subscription.updated':
        const updatedSubscription = event.data.object;
        console.log('Subscription updated:', updatedSubscription.id);
        
        // Find user by subscription ID
        const [userBySubscription] = await db
          .select({ id: users.id, plan_type: users.plan_type })
          .from(users)
          .where(eq(users.stripe_subscription_id, updatedSubscription.id))
          .limit(1);
        
        if (userBySubscription) {
          // Determine subscription status and plan type based on Stripe subscription
          let dbSubscriptionStatus: string;
          let dbPlanType: string;
          
          if (updatedSubscription.status === 'trialing') {
            dbSubscriptionStatus = 'trial';
            dbPlanType = 'trial';
            console.log('🎯 Subscription updated to trial, setting status to trial and plan to trial');
          } else if (updatedSubscription.status === 'active') {
            dbSubscriptionStatus = 'active';
            // When transitioning from trial to active, use the stored plan type if it's not 'trial'
            const currentPlanType = userBySubscription.plan_type || 'basic';
            dbPlanType = currentPlanType === 'trial' ? 'basic' : currentPlanType;
            console.log('🎯 Subscription updated to active, setting status to active and plan to:', dbPlanType);
          } else {
            dbSubscriptionStatus = updatedSubscription.status;
            dbPlanType = userBySubscription.plan_type || 'basic';
            console.log('🎯 Subscription updated to status:', updatedSubscription.status, 'keeping plan:', dbPlanType);
          }
          
          // Update subscription status and end date
          await db
            .update(users)
            .set({
              subscription_status: dbSubscriptionStatus,
              plan_type: dbPlanType,
              subscription_ends_at: new Date((updatedSubscription as any).current_period_end * 1000),
              updated_at: new Date()
            })
            .where(eq(users.id, userBySubscription.id));
          
          console.log(`✅ Updated subscription status for user ${userBySubscription.id}: ${dbSubscriptionStatus} with plan: ${dbPlanType}`);
        }
        break;

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object;
        console.log('Subscription deleted:', deletedSubscription.id);
        
        // Find user by subscription ID
        const [userByDeletedSubscription] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.stripe_subscription_id, deletedSubscription.id))
          .limit(1);
        
        if (userByDeletedSubscription) {
          // Mark subscription as cancelled
          await db
            .update(users)
            .set({
              subscription_status: 'canceled',
              subscription_ends_at: new Date(deletedSubscription.ended_at ? deletedSubscription.ended_at * 1000 : Date.now()),
              updated_at: new Date()
            })
            .where(eq(users.id, userByDeletedSubscription.id));
          
          console.log(`✅ Marked subscription as cancelled for user ${userByDeletedSubscription.id}`);
        }
        break;

      case 'invoice.payment_failed':
        const failedInvoice = event.data.object;
        console.log('Payment failed for invoice:', failedInvoice.id);
        
        // Find user by customer ID
        const [userByCustomer] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.stripe_customer_id, failedInvoice.customer as string))
          .limit(1);
        
        if (userByCustomer) {
          // Mark subscription as past due
          await db
            .update(users)
            .set({
              subscription_status: 'past_due',
              updated_at: new Date()
            })
            .where(eq(users.id, userByCustomer.id));
          
          console.log(`✅ Marked subscription as past_due for user ${userByCustomer.id}`);
        }
        break;

      case 'invoice.payment_succeeded':
        const succeededInvoice = event.data.object;
        console.log('Payment succeeded for invoice:', succeededInvoice.id);
        
        // Find user by customer ID
        const [userBySucceededPayment] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.stripe_customer_id, succeededInvoice.customer as string))
          .limit(1);
        
        if (userBySucceededPayment) {
          // Reset usage for new billing period and ensure active status
          await db
            .update(users)
            .set({
              subscription_status: 'active',
              generations_used_this_month: 0, // Reset usage for new billing period
              updated_at: new Date()
            })
            .where(eq(users.id, userBySucceededPayment.id));
          
          console.log(`✅ Reset usage and marked active for user ${userBySucceededPayment.id}`);
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