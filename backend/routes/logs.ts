import express, { Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { dailyLogs } from '../schema';
import { authenticateRequest } from '../utils/auth';

const router = express.Router();

// Get log for a specific date
router.get('/:date', async (req: Request, res: Response) => {
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
      return res.status(200).json({ 
        exists: false, 
        log: null,
        message: 'No log found for this date'
      });
    }

    res.status(200).json({ 
      exists: true, 
      log,
      message: 'Log found successfully'
    });

  } catch (error) {
    console.error('Get log error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new log for a specific date
router.post('/', async (req: Request, res: Response) => {
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
router.put('/:date', async (req: Request, res: Response) => {
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

export default router; 