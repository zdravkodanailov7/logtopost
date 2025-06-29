import express, { Request, Response } from 'express';
import { authenticateRequest } from '../utils/auth';
import { db } from '../db';
import { users } from '../schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

// Pricing configuration (GBP)
const PLAN_PRICING = {
  basic: {
    name: 'Basic',
    price: 7.99,
    currency: 'gbp',
    generations: 50,
    stripe_price_id: 'price_basic_monthly_gbp', // Set this when you create products in Stripe
  },
  pro: {
    name: 'Pro',
    price: 14.99,
    currency: 'gbp',
    generations: 150,
    stripe_price_id: 'price_pro_monthly_gbp', // Set this when you create products in Stripe
  },
  advanced: {
    name: 'Advanced',
    price: 24.99,
    currency: 'gbp',
    generations: 500,
    stripe_price_id: 'price_advanced_monthly_gbp', // Set this when you create products in Stripe
  }
};

const PLAN_LIMITS = {
  trial: 10,
  basic: PLAN_PRICING.basic.generations,
  pro: PLAN_PRICING.pro.generations,
  advanced: PLAN_PRICING.advanced.generations
};

// Note: You'll need to install stripe package: npm install stripe
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
//   apiVersion: '2023-10-16',
// });

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

// Create checkout session (placeholder - you'll need to implement Stripe)
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

    // TODO: Implement Stripe checkout session creation
    // const session = await stripe.checkout.sessions.create({
    //   customer: user.stripe_customer_id,
    //   payment_method_types: ['card'],
    //   line_items: [
    //     {
    //       price: selectedPlan.stripe_price_id,
    //       quantity: 1,
    //     },
    //   ],
    //   mode: 'subscription',
    //   success_url: `${process.env.FRONTEND_URL}/dashboard?success=true`,
    //   cancel_url: `${process.env.FRONTEND_URL}/pricing?canceled=true`,
    // });

    res.json({ 
      message: 'Stripe integration needed',
      plan: selectedPlan,
      next_steps: [
        '1. Install stripe package: npm install stripe',
        '2. Set up Stripe account and get API keys',
        '3. Create products in Stripe dashboard with GBP pricing:',
        `   - Basic: £${selectedPlan.price}/month`,
        `   - Pro: £${PLAN_PRICING.pro.price}/month`,
        `   - Advanced: £${PLAN_PRICING.advanced.price}/month`,
        '4. Update stripe_price_id values in PLAN_PRICING',
        '5. Implement checkout session creation',
        '6. Set up webhooks for subscription events'
      ]
    });

  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

export default router; 