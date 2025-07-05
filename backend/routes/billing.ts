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
      plan: PLAN_PRICING.premium // Single plan instead of multiple plans
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
    const currentPlanPricing = user.plan_type === 'premium' 
      ? PLAN_PRICING.premium 
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

    const { plan } = req.body; // Should be 'premium'

    if (plan !== 'premium') {
      return res.status(400).json({ error: 'Invalid plan selected. Only premium plan is available.' });
    }

    const selectedPlan = PLAN_PRICING.premium;

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
        planType: 'premium',
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

    const { plan } = req.body; // Should be 'premium'

    if (plan !== 'premium') {
      return res.status(400).json({ error: 'Invalid plan selected. Only premium plan is available.' });
    }

    const selectedPlan = PLAN_PRICING.premium;

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
        planType: 'premium',
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

// Start immediate subscription (no trial) for users who have already had trials
router.post('/start-subscription', async (req: Request, res: Response) => {
  try {
    const userId = authenticateRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { plan } = req.body; // Should be 'premium'

    if (plan !== 'premium') {
      return res.status(400).json({ error: 'Invalid plan selected. Only premium plan is available.' });
    }

    const selectedPlan = PLAN_PRICING.premium;

    // Get user details
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        stripe_customer_id: users.stripe_customer_id,
        has_had_trial: users.has_had_trial,
        subscription_status: users.subscription_status,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify user has had a trial (this route is only for users who've had trials)
    if (!user.has_had_trial) {
      return res.status(400).json({ error: 'This route is only for users who have had trials' });
    }

    console.log('🚀 Starting immediate subscription for user:', userId, 'plan:', plan);

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
      
      await db
        .update(users)
        .set({ stripe_customer_id: customerId })
        .where(eq(users.id, userId));
    }

    // Create checkout session with NO TRIAL - immediate billing
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: selectedPlan.stripe_price_id,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?success=true&subscription_started=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?canceled=true`,
      metadata: {
        userId: user.id,
        planType: 'premium',
        immediateSubscription: 'true',
      },
      // NO trial_period_days - immediate billing starts now
    });

    console.log('✅ Created immediate subscription checkout session:', session.id);

    res.json({ 
      url: session.url,
      sessionId: session.id 
    });

  } catch (error) {
    console.error('Start subscription error:', error);
    res.status(500).json({ error: 'Failed to start subscription' });
  }
});

// Cancel subscription/trial IMMEDIATELY (no more delayed cancellation)
router.post('/cancel-subscription', async (req: Request, res: Response) => {
  try {
    const userId = authenticateRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('❌ Cancelling subscription immediately for user:', userId);

    // Get user details
    const [user] = await db
      .select({
        id: users.id,
        subscription_status: users.subscription_status,
        stripe_subscription_id: users.stripe_subscription_id,
        trial_ends_at: users.trial_ends_at,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Handle trial cancellation
    if (user.subscription_status === 'trial') {
      // Immediate cancellation - set trial_ends_at to now and mark as having had trial
      await db
        .update(users)
        .set({
          subscription_status: 'cancelled',
          trial_ends_at: new Date(), // End trial immediately
          has_had_trial: true, // Ensure they can never get another trial
          updated_at: new Date()
        })
        .where(eq(users.id, userId));

      console.log('✅ Trial cancelled immediately for user:', userId);

      return res.json({ 
        success: true,
        message: 'Trial cancelled immediately. Your access has ended.',
        cancelled_at: new Date()
      });
    }

    // Handle active subscription cancellation
    if (user.subscription_status === 'active' && user.stripe_subscription_id) {
      // Cancel the subscription in Stripe immediately
      await stripe.subscriptions.cancel(user.stripe_subscription_id);

      // Update user record immediately
      await db
        .update(users)
        .set({
          subscription_status: 'cancelled',
          subscription_ends_at: new Date(), // End subscription immediately
          updated_at: new Date()
        })
        .where(eq(users.id, userId));

      console.log('✅ Active subscription cancelled immediately for user:', userId);

      return res.json({ 
        success: true,
        message: 'Subscription cancelled immediately. Your access has ended.',
        cancelled_at: new Date()
      });
    }

    // If user doesn't have an active subscription or trial
    return res.status(400).json({ error: 'No active subscription or trial to cancel' });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Restart cancelled subscription directly (no checkout window)
router.post('/restart-subscription', async (req: Request, res: Response) => {
  try {
    const userId = authenticateRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { plan } = req.body; // Should be 'premium'

    if (plan !== 'premium') {
      return res.status(400).json({ error: 'Invalid plan selected. Only premium plan is available.' });
    }

    const selectedPlan = PLAN_PRICING.premium;

    // Get user details
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        stripe_customer_id: users.stripe_customer_id,
        subscription_status: users.subscription_status,
        plan_type: users.plan_type,
        subscription_ends_at: users.subscription_ends_at,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify user has a cancelled subscription
    const isStatusCancelled = user.subscription_status === 'cancelled' || user.subscription_status === 'canceled';
    
    if (!isStatusCancelled) {
      return res.status(400).json({ error: 'Only cancelled subscriptions can be restarted' });
    }

    console.log('🔄 Restarting subscription for user:', userId, 'plan:', plan);

    // Ensure user has a Stripe customer ID
    let customerId = user.stripe_customer_id;
    
    if (!customerId) {
      return res.status(400).json({ error: 'No payment method on file. Please contact support.' });
    }

    // Get customer's payment methods
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    if (paymentMethods.data.length === 0) {
      return res.status(400).json({ 
        error: 'No payment method on file. Please add a payment method first.',
        requiresPaymentMethod: true 
      });
    }

    // Create NEW subscription with existing payment method
    // Note: Stripe creates a new subscription ID when restarting
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price: selectedPlan.stripe_price_id,
        },
      ],
      default_payment_method: paymentMethods.data[0].id,
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        userId: user.id,
        planType: 'premium',
        restartedSubscription: 'true',
      },
    });

    console.log('✅ New subscription created for restart:', subscription.id);

    // Update database immediately - don't wait for webhook
    // Calculate end date ourselves since we know it's a monthly plan
    const now = new Date();
    const subscriptionEnds = new Date(now);
    subscriptionEnds.setMonth(subscriptionEnds.getMonth() + 1);
    
    await db
      .update(users)
      .set({
        stripe_subscription_id: subscription.id,
        subscription_status: subscription.status === 'active' ? 'active' : subscription.status,
        plan_type: 'premium',
        subscription_ends_at: subscriptionEnds, // Always 1 month from now
        generations_used_this_month: 0, // Reset usage
        updated_at: now
      })
      .where(eq(users.id, userId));

    console.log('✅ Database updated immediately with new subscription ID:', subscription.id);

    res.json({ 
      success: true,
      message: `${selectedPlan.name} subscription restarted successfully`,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        plan: 'premium',
        current_period_end: (subscription as any).current_period_end
      }
    });

  } catch (error: any) {
    console.error('Restart subscription error:', error);
    
    // Handle specific Stripe errors
    if (error.type === 'StripeCardError') {
      return res.status(400).json({ 
        error: 'Payment failed. Please update your payment method.',
        requiresPaymentMethod: true 
      });
    }
    
    if (error.code === 'resource_missing') {
      return res.status(400).json({ error: 'Customer or payment method not found. Please contact support.' });
    }

    res.status(500).json({ error: 'Failed to restart subscription. Please try again.' });
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
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
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
          const isEndingTrialEarly = session.metadata?.endTrialEarly === 'true';
          
          console.log('🔍 Extracted values:', {
            subscriptionId,
            userId,
            planType,
            isEndingTrialEarly
          });
          
          if (userId && planType === 'premium') {
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
                dbPlanType = 'premium';
                console.log('⚡ User ended trial early, setting status to active and plan to premium');
              } else if (subscription.status === 'trialing') {
                dbSubscriptionStatus = 'trial';
                dbPlanType = 'trial';
                console.log('🎯 User is on trial, setting status to trial and plan to trial');
              } else if (subscription.status === 'active') {
                dbSubscriptionStatus = 'active';
                dbPlanType = 'premium';
                console.log('🎯 User is active, setting status to active and plan to premium');
              } else {
                dbSubscriptionStatus = subscription.status;
                dbPlanType = 'premium';
                console.log('🎯 User status is:', subscription.status, 'plan: premium');
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
            console.log('⚠️ Missing userId or invalid planType:', { userId, planType });
          }
        } else {
          console.log('⚠️ Session mode is not subscription:', session.mode);
        }
        break;

      case 'customer.subscription.created':
        const createdSubscription = event.data.object;
        console.log('🆕 Subscription created:', createdSubscription.id);
        console.log('📋 Created subscription metadata:', createdSubscription.metadata);
        console.log('📋 Subscription status:', createdSubscription.status);
        console.log('📋 Customer ID:', createdSubscription.customer);
        
        // Handle subscription restart case
        if (createdSubscription.metadata?.restartedSubscription === 'true') {
          const userId = createdSubscription.metadata?.userId;
          const planType = createdSubscription.metadata?.planType;
          
          if (userId && planType === 'premium') {
            console.log('🔄 Handling restarted subscription for user:', userId);
            
            // First, get the current user data to see what we're replacing
            const [currentUser] = await db
              .select({
                id: users.id,
                stripe_subscription_id: users.stripe_subscription_id,
                subscription_status: users.subscription_status,
                plan_type: users.plan_type
              })
              .from(users)
              .where(eq(users.id, userId))
              .limit(1);
            
            if (currentUser) {
              console.log('📋 Current user data before restart:', {
                userId: currentUser.id,
                oldSubscriptionId: currentUser.stripe_subscription_id,
                oldStatus: currentUser.subscription_status,
                oldPlanType: currentUser.plan_type
              });
              
              // Get the full subscription details to ensure we have current_period_end
              const fullSubscription = await stripe.subscriptions.retrieve(createdSubscription.id);
              
              // Update user record with new subscription details
              const updateResult = await db
                .update(users)
                .set({
                  stripe_subscription_id: createdSubscription.id, // NEW subscription ID
                  subscription_status: 'active',
                  plan_type: 'premium',
                  subscription_ends_at: new Date((fullSubscription as any).current_period_end * 1000),
                  generations_used_this_month: 0, // Reset usage
                  updated_at: new Date()
                })
                .where(eq(users.id, userId))
                .returning({ 
                  id: users.id, 
                  stripe_subscription_id: users.stripe_subscription_id,
                  subscription_status: users.subscription_status 
                });
              
              console.log('✅ Updated user with restarted subscription:', updateResult);
              console.log(`✅ User ${userId} subscription REPLACED:`, {
                oldSubscriptionId: currentUser.stripe_subscription_id,
                newSubscriptionId: createdSubscription.id,
                newStatus: 'active',
                newPlanType: 'premium'
              });
            } else {
              console.log('❌ User not found for subscription restart:', userId);
            }
          } else {
            console.log('⚠️ Missing userId or invalid planType in subscription creation:', { userId, planType });
          }
        } else {
          // Fallback: Handle regular subscription creation (not restart)
          // Try to find user by customer ID if no restart metadata
          const customerId = createdSubscription.customer as string;
          console.log('🔍 Looking for user by customer ID:', customerId);
          
          const [userByCustomer] = await db
            .select({ 
              id: users.id,
              stripe_subscription_id: users.stripe_subscription_id,
              subscription_status: users.subscription_status
            })
            .from(users)
            .where(eq(users.stripe_customer_id, customerId))
            .limit(1);
          
          if (userByCustomer) {
            console.log('📋 Found user by customer ID:', {
              userId: userByCustomer.id,
              currentSubscriptionId: userByCustomer.stripe_subscription_id,
              currentStatus: userByCustomer.subscription_status
            });
            
            // Only update if this is a new subscription (different ID)
            if (userByCustomer.stripe_subscription_id !== createdSubscription.id) {
              // Get the full subscription details to ensure we have current_period_end
              const fullSubscription = await stripe.subscriptions.retrieve(createdSubscription.id);
              
              const updateResult = await db
                .update(users)
                .set({
                  stripe_subscription_id: createdSubscription.id,
                  subscription_status: createdSubscription.status === 'active' ? 'active' : createdSubscription.status,
                  plan_type: 'premium',
                  subscription_ends_at: new Date((fullSubscription as any).current_period_end * 1000),
                  updated_at: new Date()
                })
                .where(eq(users.id, userByCustomer.id))
                .returning({ id: users.id });
              
              console.log('✅ Updated user subscription by customer ID:', updateResult);
              console.log(`✅ Subscription ID updated from ${userByCustomer.stripe_subscription_id} to ${createdSubscription.id}`);
            } else {
              console.log('⚠️ Subscription ID already matches, no update needed');
            }
          } else {
            console.log('⚠️ No user found for customer ID:', customerId);
          }
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
            dbPlanType = 'premium';
            console.log('🎯 Subscription updated to active, setting status to active and plan to premium');
          } else {
            dbSubscriptionStatus = updatedSubscription.status;
            dbPlanType = userBySubscription.plan_type === 'trial' ? 'premium' : userBySubscription.plan_type || 'premium';
            console.log('🎯 Subscription updated to status:', updatedSubscription.status, 'keeping plan:', dbPlanType);
          }
          
          // Guard against undefined current_period_end in webhook
          const currentPeriodEnd = (updatedSubscription as any).current_period_end;
          const subscriptionEndDate = typeof currentPeriodEnd === 'number' 
            ? new Date(currentPeriodEnd * 1000) 
            : undefined;
          
          // Update subscription status and end date
          const updateData: any = {
            subscription_status: dbSubscriptionStatus,
            plan_type: dbPlanType,
            updated_at: new Date()
          };
          
          if (subscriptionEndDate) {
            updateData.subscription_ends_at = subscriptionEndDate;
          }
          
          await db
            .update(users)
            .set(updateData)
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
          // Mark subscription as cancelled with immediate effect
          await db
            .update(users)
            .set({
              subscription_status: 'cancelled',
              subscription_ends_at: new Date(), // Immediate cancellation
              updated_at: new Date()
            })
            .where(eq(users.id, userByDeletedSubscription.id));
          
          console.log(`✅ Marked subscription as cancelled immediately for user ${userByDeletedSubscription.id}`);
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
        const succeededInvoice = event.data.object as any;
        console.log('Payment succeeded for invoice:', succeededInvoice.id);
        
        // Get the subscription ID from the invoice
        const subscriptionId = succeededInvoice.subscription as string;
        console.log('📋 Invoice subscription ID:', subscriptionId);
        console.log('📋 Invoice customer ID:', succeededInvoice.customer);
        
        // Find user by customer ID
        const [userBySucceededPayment] = await db
          .select({ 
            id: users.id,
            stripe_subscription_id: users.stripe_subscription_id,
            subscription_status: users.subscription_status,
            plan_type: users.plan_type
          })
          .from(users)
          .where(eq(users.stripe_customer_id, succeededInvoice.customer as string))
          .limit(1);
        
        if (userBySucceededPayment) {
          console.log('📋 Found user for payment success:', {
            userId: userBySucceededPayment.id,
            currentSubscriptionId: userBySucceededPayment.stripe_subscription_id,
            currentStatus: userBySucceededPayment.subscription_status,
            invoiceSubscriptionId: subscriptionId
          });
          
          // Only update if we have a valid subscription ID
          if (subscriptionId) {
            const needsSubscriptionIdUpdate = userBySucceededPayment.stripe_subscription_id !== subscriptionId;
            
            if (needsSubscriptionIdUpdate) {
              console.log('🔄 Updating subscription ID from invoice payment:', {
                oldId: userBySucceededPayment.stripe_subscription_id,
                newId: subscriptionId
              });
            }
            
            // Reset usage for new billing period and ensure active status
            await db
              .update(users)
              .set({
                subscription_status: 'active',
                plan_type: 'premium',
                stripe_subscription_id: subscriptionId, // Update subscription ID
                generations_used_this_month: 0, // Reset usage for new billing period
                updated_at: new Date()
              })
              .where(eq(users.id, userBySucceededPayment.id));
            
            if (needsSubscriptionIdUpdate) {
              console.log(`✅ Updated subscription ID and marked active for user ${userBySucceededPayment.id}:`, {
                oldSubscriptionId: userBySucceededPayment.stripe_subscription_id,
                newSubscriptionId: subscriptionId,
                status: 'active'
              });
            } else {
              console.log(`✅ Reset usage and marked active for user ${userBySucceededPayment.id}`);
            }
          } else {
            console.log('⚠️ No subscription ID found in invoice, only updating status');
            // Just update status and reset usage without changing subscription ID
            await db
              .update(users)
              .set({
                subscription_status: 'active',
                plan_type: 'premium',
                generations_used_this_month: 0,
                updated_at: new Date()
              })
              .where(eq(users.id, userBySucceededPayment.id));
            
            console.log(`✅ Updated status and reset usage for user ${userBySucceededPayment.id}`);
          }
        } else {
          console.log('❌ No user found for customer ID:', succeededInvoice.customer);
        }
        break;

      // Handle additional events that were showing as unhandled
      case 'charge.succeeded':
        console.log('Charge succeeded:', event.data.object.id);
        break;

      case 'payment_intent.succeeded':
        console.log('Payment intent succeeded:', event.data.object.id);
        break;

      case 'payment_intent.created':
        console.log('Payment intent created:', event.data.object.id);
        break;

      case 'invoice.created':
        console.log('Invoice created:', event.data.object.id);
        break;

      case 'invoice.finalized':
        console.log('Invoice finalized:', event.data.object.id);
        break;

      case 'invoice.paid':
        console.log('Invoice paid:', event.data.object.id);
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