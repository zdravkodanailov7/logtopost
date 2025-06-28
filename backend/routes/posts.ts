import express, { Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { posts, dailyLogs } from '../schema';
import { authenticateRequest } from '../utils/auth';

const router = express.Router();

// Get all posts for the authenticated user
router.get('/', async (req: Request, res: Response) => {
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
router.get('/by-date/:date', async (req: Request, res: Response) => {
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
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = authenticateRequest(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { content, daily_log_id } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Create new post
    const [newPost] = await db
      .insert(posts)
      .values({
        user_id: userId,
        content: content,
        used: false,
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
router.put('/:id', async (req: Request, res: Response) => {
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
router.delete('/:id', async (req: Request, res: Response) => {
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

export default router; 