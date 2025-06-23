import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { eq, and } from 'drizzle-orm';
import { db } from './db';
import { users, emails, dailyLogs, posts } from './schema';
import { hashPassword, comparePassword, generateToken, verifyToken } from './utils/auth';
import dotenv from 'dotenv';
import aiRoutes from './routes/ai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://logtopost.com',
  'https://www.logtopost.com',
  process.env.FRONTEND_URL
].filter((origin): origin is string => Boolean(origin));

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(cookieParser());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`\n🚀 ${req.method} ${req.url} - ${new Date().toISOString()}`);
  console.log('Headers:', {
    'user-agent': req.headers['user-agent']?.substring(0, 50),
    'origin': req.headers.origin,
    'authorization': req.headers.authorization ? 'Bearer [PRESENT]' : 'None',
    'cookie': req.headers.cookie ? `Present (${req.headers.cookie.length} chars)` : 'None'
  });
  next();
});

// Email validation helper
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Register endpoint
app.post('/api/auth/register', async (req, res) => {
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

    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    
    if (existingUser.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(password);
    
    const [newUser] = await db.insert(users).values({
      email: email.toLowerCase(),
      password: hashedPassword,
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
        created_at: newUser.created_at
      },
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
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
app.get('/api/auth/me', async (req, res) => {
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

    // Get user from database
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      created_at: users.created_at,
      updated_at: users.updated_at
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

// Waitlist email collection endpoint
app.post('/api/emails/waitlist', async (req, res) => {
  try {
    const { email } = req.body;

    // Validation
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    // Check if email already exists in waitlist
    const existingEmail = await db.select().from(emails).where(eq(emails.email, email.toLowerCase()));
    
    if (existingEmail.length > 0) {
      return res.status(200).json({ 
        message: 'You\'re already on the waitlist!',
        alreadyExists: true 
      });
    }

    // Add email to waitlist
    const [newEmail] = await db.insert(emails).values({
      email: email.toLowerCase(),
      source: 'waitlist',
      metadata: JSON.stringify({ userAgent: req.headers['user-agent'] })
    }).returning({ id: emails.id, email: emails.email, created_at: emails.created_at });

    res.status(201).json({
      message: 'Successfully added to waitlist!',
      email: {
        id: newEmail.id,
        email: newEmail.email,
        created_at: newEmail.created_at
      }
    });

  } catch (error) {
    console.error('Waitlist signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper to authenticate and get user ID from token
const authenticateRequest = (req: Request): string | null => {
  console.log('🔐 Authentication attempt:', {
    method: req.method,
    url: req.url,
    headers: {
      authorization: req.headers.authorization ? 'Bearer [PRESENT]' : 'Not present',
      cookie: req.headers.cookie ? 'Present' : 'Not present'
    },
    cookies: req.cookies ? Object.keys(req.cookies) : 'No cookies parsed'
  });

  let token: string | null = null;

  // Check Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
    console.log('✅ Token found in Authorization header');
  }

  // If no token in header, check cookies
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
    console.log('✅ Token found in cookies');
  }

  // If no token found anywhere, return null
  if (!token) {
    console.log('❌ No token found in headers or cookies');
    return null;
  }

  console.log('🔍 Verifying token...');
  const decoded = verifyToken(token);
  
  if (decoded) {
    console.log('✅ Token valid for user:', decoded.userId);
    return decoded.userId;
  } else {
    console.log('❌ Token verification failed');
    return null;
  }
};

// LOG ENDPOINTS

// Get log for a specific date
app.get('/api/logs/:date', async (req, res) => {
  console.log('\n📅 GET /api/logs/:date request received');
  try {
    const userId = authenticateRequest(req);
    
    if (!userId) {
      console.log('❌ Authentication failed - returning 401');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    console.log('✅ User authenticated:', userId);

    const { date } = req.params;
    
    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const [log] = await db
      .select()
      .from(dailyLogs)
      .where(and(eq(dailyLogs.user_id, userId), eq(dailyLogs.log_date, date)));

    if (!log) {
      return res.status(404).json({ error: 'Log not found for this date', exists: false });
    }

    res.json({ log, exists: true });

  } catch (error) {
    console.error('Get log error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new log for a specific date
app.post('/api/logs', async (req, res) => {
  try {
    const userId = authenticateRequest(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { date, content = '' } = req.body;
    
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Check if log already exists for this date
    const existingLog = await db
      .select()
      .from(dailyLogs)
      .where(and(eq(dailyLogs.user_id, userId), eq(dailyLogs.log_date, date)));

    if (existingLog.length > 0) {
      return res.status(409).json({ error: 'Log already exists for this date' });
    }

    // Create new log
    const [newLog] = await db
      .insert(dailyLogs)
      .values({
        user_id: userId,
        log_date: date,
        content: content,
      })
      .returning();

    res.status(201).json({ 
      message: 'Log created successfully',
      log: newLog 
    });

  } catch (error) {
    console.error('Create log error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update an existing log
app.put('/api/logs/:date', async (req, res) => {
  try {
    const userId = authenticateRequest(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { date } = req.params;
    const { content } = req.body;
    
    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }

    if (content === undefined) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Update the log
    const [updatedLog] = await db
      .update(dailyLogs)
      .set({ 
        content: content,
        updated_at: new Date()
      })
      .where(and(eq(dailyLogs.user_id, userId), eq(dailyLogs.log_date, date)))
      .returning();

    if (!updatedLog) {
      return res.status(404).json({ error: 'Log not found for this date' });
    }

    res.json({ 
      message: 'Log updated successfully',
      log: updatedLog 
    });

  } catch (error) {
    console.error('Update log error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POSTS ENDPOINTS

// Get all posts for the authenticated user
app.get('/api/posts', async (req, res) => {
  try {
    const userId = authenticateRequest(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userPosts = await db
      .select()
      .from(posts)
      .where(eq(posts.user_id, userId))
      .orderBy(posts.created_at);

    res.json({ 
      posts: userPosts,
      count: userPosts.length 
    });

  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get posts for a specific date (based on daily log date)
app.get('/api/posts/by-date/:date', async (req, res) => {
  try {
    const userId = authenticateRequest(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { date } = req.params;
    
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Find daily log for this date and user
    const [dailyLog] = await db
      .select()
      .from(dailyLogs)
      .where(and(
        eq(dailyLogs.user_id, userId),
        eq(dailyLogs.log_date, date)
      ))
      .limit(1);

    if (!dailyLog) {
      // No daily log for this date, return empty posts
      return res.json({ 
        posts: [],
        count: 0,
        daily_log: null
      });
    }

    // Get posts linked to this daily log
    const postsForDate = await db
      .select()
      .from(posts)
      .where(and(
        eq(posts.user_id, userId),
        eq(posts.daily_log_id, dailyLog.id)
      ))
      .orderBy(posts.created_at);

    res.json({ 
      posts: postsForDate,
      count: postsForDate.length,
      daily_log: dailyLog
    });

  } catch (error) {
    console.error('Get posts by date error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new post
app.post('/api/posts', async (req, res) => {
  try {
    const userId = authenticateRequest(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { content, status = 'pending', daily_log_id } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Create new post
    const [newPost] = await db
      .insert(posts)
      .values({
        user_id: userId,
        content: content,
        status: status,
        daily_log_id: daily_log_id || null,
      })
      .returning();

    res.status(201).json({ 
      message: 'Post created successfully',
      post: newPost 
    });

  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update an existing post
app.put('/api/posts/:id', async (req, res) => {
  try {
    const userId = authenticateRequest(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { content, platform, used } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Post ID is required' });
    }

    // Build update object with only provided fields
    const updateData: any = { updated_at: new Date() };
    if (content !== undefined) updateData.content = content;
    if (platform !== undefined) updateData.platform = platform;
    if (used !== undefined) updateData.used = used;

    // Update the post (only if it belongs to the user)
    const [updatedPost] = await db
      .update(posts)
      .set(updateData)
      .where(and(eq(posts.id, id), eq(posts.user_id, userId)))
      .returning();

    if (!updatedPost) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json({ 
      message: 'Post updated successfully',
      post: updatedPost 
    });

  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a post
app.delete('/api/posts/:id', async (req, res) => {
  try {
    const userId = authenticateRequest(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Post ID is required' });
    }

    // Delete the post (only if it belongs to the user)
    const [deletedPost] = await db
      .delete(posts)
      .where(and(eq(posts.id, id), eq(posts.user_id, userId)))
      .returning({ id: posts.id });

    if (!deletedPost) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json({ 
      message: 'Post deleted successfully'
    });

  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Add AI routes
app.use('/api/ai', aiRoutes);

// User profile endpoints
app.get('/api/user/profile', async (req: Request, res: Response) => {
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

app.put('/api/user/profile', async (req: Request, res: Response) => {
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 