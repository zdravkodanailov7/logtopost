import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SALT_ROUNDS = 12;

export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

export const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

export const verifyToken = (token: string): { userId: string } | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return decoded;
  } catch (error) {
    return null;
  }
};

// Helper to authenticate and get user ID from token
export const authenticateRequest = (req: any): string | null => {
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
