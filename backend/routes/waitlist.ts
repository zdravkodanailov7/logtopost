import express, { Request, Response } from 'express';
import { db } from '../db';
import { emails } from '../schema';

const router = express.Router();

// Get waitlist count endpoint
router.get('/count', async (req: Request, res: Response) => {
  try {
    // Count total emails in the waitlist
    const emailCount = await db.select().from(emails);
    const count = emailCount.length;

    res.json({
      count: count,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Waitlist count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 