import express, { Request, Response } from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { db } from '../db';
import { posts, users } from '../schema';
import { verifyToken } from '../utils/auth';
import { eq } from 'drizzle-orm';

dotenv.config();

const router = express.Router();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Default prompt fallback
const DEFAULT_PROMPT = `You are a developer building SaaS apps, with a dark sense of humour and a blunt, no-bullshit tone.

Generate tweets based on what you did or learned today.
Stick to your voice: sharp, a bit cynical, occasionally funny, but never soft or self-indulgent.
No therapy-speak. No "i regret eating this" nonsense. No vague life lessons or cringe reflections.
Make them sound like someone who's actually building, messing up, and learning—without crying about it.
They can be observations, questions, mini-rants, or dry one-liners.

Rules:
- No emojis
- Don't make it sound like a motivational thread
- Don't capitalise unless necessary
- Use British spelling
- Swear words allowed but not overused
- Avoid soft or sentimental takes
- Keep it real, not corny`;

// Authentication helper for this router
const authenticateRequest = (req: Request): string | null => {
  let token: string | null = null;

  // Check Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // If no token in header, check cookies
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return null;
  }

  const decoded = verifyToken(token);
  return decoded ? decoded.userId : null;
};

// POST /api/ai/generate-posts
router.post('/generate-posts', async (req: Request, res: Response) => {
  try {
    const userId = authenticateRequest(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { logText, dailyLogId } = req.body;

    if (!logText) {
      return res.status(400).json({ error: 'Log text is required' });
    }

    // Fetch user's custom prompt
    const [user] = await db
      .select({ custom_prompt: users.custom_prompt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Use custom prompt if available, otherwise use default
    const basePrompt = user?.custom_prompt || DEFAULT_PROMPT;
    
    // Build the complete prompt with log text and JSON format instructions
    const prompt = `${basePrompt}

Here is today's log:
${logText}

Return the response as a JSON array of strings, where each string is a tweet. Example format:
{
  "tweets": [
    "first tweet here",
    "second tweet here", 
    "third tweet here"
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a tweet generator that MUST return ONLY valid JSON arrays of tweets. No extra text or formatting."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const response = completion.choices[0].message.content;
    console.log('Raw AI response:', response);
    
    // Try to parse the response with better error handling
    let parsedResponse;
    try {
      if (!response) {
        throw new Error('Empty response from AI');
      }
      
      // Try to extract JSON from the response if it has extra text
      let jsonString = response.trim();
      
      // Look for JSON object boundaries
      const jsonStart = jsonString.indexOf('{');
      const jsonEnd = jsonString.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1) {
        jsonString = jsonString.substring(jsonStart, jsonEnd + 1);
      }
      
      parsedResponse = JSON.parse(jsonString);
      
      // Validate the structure
      if (!parsedResponse.tweets || !Array.isArray(parsedResponse.tweets)) {
        throw new Error('Invalid response structure');
      }
      
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Response that failed to parse:', response);
      
      // Fallback: try to extract tweets from a malformed response
      try {
        // Simple regex to find quoted strings that look like tweets
        const tweetMatches = response?.match(/"([^"]{10,280})"/g);
        if (tweetMatches && tweetMatches.length > 0) {
          const extractedTweets = tweetMatches.map(match => match.slice(1, -1)); // Remove quotes
          parsedResponse = { tweets: extractedTweets };
          console.log('Extracted tweets from malformed response:', extractedTweets);
        } else {
          throw new Error('Could not extract tweets from response');
        }
      } catch (fallbackError) {
        const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parse error';
        throw new Error(`Failed to parse AI response: ${errorMessage}`);
      }
    }

    // Save generated posts to database with pending status
    const savedPosts = [];
    if (parsedResponse.tweets && Array.isArray(parsedResponse.tweets)) {
      for (const tweetContent of parsedResponse.tweets) {
        const [savedPost] = await db
          .insert(posts)
          .values({
            user_id: userId,
            content: tweetContent,
            used: false, // New posts start as unused
            daily_log_id: dailyLogId || null,
          })
          .returning();
        
        savedPosts.push(savedPost);
      }
    }

    res.json({
      tweets: parsedResponse.tweets,
      saved_posts: savedPosts,
      message: `Generated and saved ${savedPosts.length} posts`,
      used_custom_prompt: !!user?.custom_prompt
    });

  } catch (error) {
    console.error('AI generation error:', error);
    res.status(500).json({ error: 'Failed to generate posts' });
  }
});

export default router; 