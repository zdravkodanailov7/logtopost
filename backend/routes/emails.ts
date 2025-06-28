import express, { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { emails } from '../schema';

const router = express.Router();

// Email validation helper
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Waitlist email collection endpoint
router.post('/waitlist', async (req: Request, res: Response) => {
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

export default router; 