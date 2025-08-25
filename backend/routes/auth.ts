import express, { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../schema';
import { hashPassword, comparePassword, generateToken, verifyToken } from '../utils/auth';
import Stripe from 'stripe';

const router = express.Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Email validation helper
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Register endpoint
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists in our database
    const existingUser = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    
    if (existingUser.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(password);
    
    const [newUser] = await db.insert(users).values({
      email: email.toLowerCase(),
      password: hashedPassword,
      subscription_status: 'inactive',  // New users start inactive - need to subscribe
    }).returning({ id: users.id, email: users.email, created_at: users.created_at });

    // Generate JWT token
    const token = generateToken(newUser.id);

    // Set token as httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        created_at: newUser.created_at,
        subscription_status: 'inactive'
      },
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login endpoint
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = generateToken(user.id);

    // Set token as httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Protected route example - get user profile
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get user from database with subscription information
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      created_at: users.created_at,
      updated_at: users.updated_at,
      subscription_status: users.subscription_status,
      generations_used_this_month: users.generations_used_this_month,
      is_admin: users.is_admin,
      custom_prompt: users.custom_prompt
    }).from(users).where(eq(users.id, decoded.userId));

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Complete account setup for Stripe-first users
router.post('/complete-setup', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Find user with this email
    let [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    
    if (!user) {
      // User might not be created yet by webhook - check if they have a Stripe customer
      try {
        const existingCustomers = await stripe.customers.list({
          email: email.toLowerCase(),
          limit: 1
        });

        if (existingCustomers.data.length > 0) {
          const customerId = existingCustomers.data[0].id;
          
          // Check if this customer has active subscriptions
          const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            status: 'active',
            limit: 1
          });

          if (subscriptions.data.length > 0) {
            // Create the user account since they have paid but webhook hasn't run yet
            const hashedPassword = await hashPassword(password);
            
            const [newUser] = await db.insert(users).values({
              email: email.toLowerCase(),
              password: hashedPassword,
              subscription_status: 'active',
              stripe_customer_id: customerId,
              generations_used_this_month: 0,
            }).returning({ id: users.id, email: users.email, created_at: users.created_at });

            user = newUser;
            console.log(`✅ Created user account during setup for ${email}`);
          } else {
            return res.status(404).json({ error: 'No active subscription found. Please complete payment first.' });
          }
        } else {
          return res.status(404).json({ error: 'Account not found. Please complete payment first.' });
        }
      } catch (stripeError) {
        console.error('Error checking Stripe customer:', stripeError);
        return res.status(404).json({ error: 'Account not found. Please try again in a moment.' });
      }
    } else {
      // User exists - check if password is already set
      if (user.password) {
        return res.status(400).json({ error: 'Account setup already completed' });
      }

      // Hash password and update user
      const hashedPassword = await hashPassword(password);
      
      await db
        .update(users)
        .set({ 
          password: hashedPassword,
          updated_at: new Date()
        })
        .where(eq(users.id, user.id));
    }

    // Generate JWT token
    const token = generateToken(user.id);

    // Set token as httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      message: 'Account setup completed successfully',
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      },
      token
    });

  } catch (error) {
    console.error('Complete setup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 