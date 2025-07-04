import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

// Import route modules
import authRoutes from './routes/auth';
import logsRoutes from './routes/logs';
import postsRoutes from './routes/posts';
import emailsRoutes from './routes/emails';
import waitlistRoutes from './routes/waitlist';
import userRoutes from './routes/user';
import aiRoutes from './routes/ai';
import billingRoutes from './routes/billing';

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

// Special handling for Stripe webhook - needs raw body
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

// Regular JSON parsing for all other routes
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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/emails', emailsRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/user', userRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/billing', billingRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 