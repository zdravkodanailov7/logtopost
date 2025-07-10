import express, { Request, Response } from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { db } from '../db';
import { posts, users } from '../schema';
import { authenticateRequest, verifyToken } from '../utils/auth';
import { checkGenerationLimit, PLAN_LIMITS } from '../middleware/checkUsage';
import { eq } from 'drizzle-orm';

dotenv.config();

const router = express.Router();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Default prompt fallback
const DEFAULT_PROMPT = `you're writing standalone tweets for a dev building a SaaS app. tone is dry, direct, honest. no filler, no analogies, no rhetorical questions, no "considering" or "hope." only say what you actually did or realised. don't invent details or assume times you didn't mention.

style: texting another dev. use lowercase unless it's a proper noun (python, stripe). avoid fancy punctuation (no dashes, semicolons, colons).

tweets should feel complete—combine tightly related points into one tweet. if you only have one thought, say it in 1–2 sentences. if you have two, still keep it under 280 characters.

swearing is allowed but only if it lands. no British slang ("bloody," "folks," etc.). no hashtags. no threads. no promo.

generate 4–6 tweets per run. each must stand alone and contain only real actions or observations the user provided.`;

// Sanitize user's custom prompt to prevent prompt injection
const sanitizeCustomPrompt = (customPrompt: string | null): string => {
  if (!customPrompt || customPrompt.trim() === '') {
    return '';
  }
  
  // Remove potentially harmful instructions
  const dangerousPatterns = [
    /ignore\s+(?:previous|above|all)\s+instructions?/gi,
    /forget\s+(?:previous|above|all)\s+instructions?/gi,
    /new\s+instructions?/gi,
    /system\s*:/gi,
    /assistant\s*:/gi,
    /user\s*:/gi,
    /\{[^}]*\}/g, // Remove JSON-like structures
    /return\s+(?:json|response|format)/gi,
    /respond\s+(?:with|as|in)/gi,
    /output\s+(?:json|format)/gi,
  ];
  
  let sanitized = customPrompt.trim();
  
  // Remove dangerous patterns
  dangerousPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });
  
  // Limit length and clean up
  sanitized = sanitized.slice(0, 300).trim();
  
  // Ensure it ends with a period for proper sentence structure
  if (sanitized && !sanitized.endsWith('.') && !sanitized.endsWith('!') && !sanitized.endsWith('?')) {
    sanitized += '.';
  }
  
  return sanitized;
};

// POST /api/ai/generate-posts
router.post('/generate-posts', checkGenerationLimit, async (req: Request, res: Response) => {
  try {
    console.log('🎯 [AI Route] Starting post generation request');
    
    const userId = authenticateRequest(req);
    
    console.log('🔐 [AI Route] Authentication check:', {
      userId: userId,
      hasAuthHeader: !!req.headers.authorization,
      userAgent: req.headers['user-agent']
    });
    
    if (!userId) {
      console.log('❌ [AI Route] Authentication failed - returning 401');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get user from middleware (it's attached to req.user)
    const user = (req as any).user;
    
    console.log('👤 [AI Route] User from middleware:', {
      id: user?.id,
      email: user?.email,
      plan_type: user?.plan_type,
      subscription_status: user?.subscription_status,
      hasCustomPrompt: !!user?.custom_prompt
    });

    const { logText, dailyLogId, selectionStart, selectionEnd } = req.body;

    console.log('📝 [AI Route] Request data:', {
      logTextLength: logText?.length || 0,
      dailyLogId,
      selectionStart,
      selectionEnd,
      hasLogText: !!logText
    });

    if (!logText) {
      console.log('❌ [AI Route] No log text provided - returning 400');
      res.status(400).json({ error: 'Log text is required' });
      return;
    }

    if (selectionStart === undefined || selectionEnd === undefined) {
      console.log('❌ [AI Route] Missing selection positions - returning 400');
      res.status(400).json({ error: 'Selection positions are required' });
      return;
    }

    // Always use default prompt + safely append user's custom prompt
    const sanitizedCustomPrompt = sanitizeCustomPrompt(user?.custom_prompt);
    const basePrompt = sanitizedCustomPrompt 
      ? `${DEFAULT_PROMPT}\n\nadditional personality note: ${sanitizedCustomPrompt}`
      : DEFAULT_PROMPT;
    
    console.log('🤖 [AI Route] Using prompt:', {
      hasCustomPrompt: !!user?.custom_prompt,
      customPromptLength: sanitizedCustomPrompt.length,
      isPromptSanitized: sanitizedCustomPrompt !== user?.custom_prompt
    });

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

    // Save generated posts to database with selection metadata
    const savedPosts = [];
    if (parsedResponse.tweets && Array.isArray(parsedResponse.tweets)) {
      for (const tweetContent of parsedResponse.tweets) {
        const [savedPost] = await db
          .insert(posts)
          .values({
            user_id: userId,
            content: tweetContent,
            selected_text: logText,
            selection_start: selectionStart,
            selection_end: selectionEnd,
            used: false, // New posts start as unused
            daily_log_id: dailyLogId || null,
          })
          .returning();
        
        savedPosts.push(savedPost);
      }
    }

    // After successful generation, increment usage (skip for admin users)
    if (!user.is_admin) {
      await db
        .update(users)
        .set({ 
          generations_used_this_month: user.generations_used_this_month + 1,
          updated_at: new Date()
        })
        .where(eq(users.id, userId));
    }

    // Calculate current usage for response (admin users show unlimited)
    let currentUsage, limit;
    
    if (user.is_admin) {
      currentUsage = 0;
      limit = 999999; // Unlimited for admins
    } else {
      currentUsage = user.generations_used_this_month + 1;
      const isActive = user.subscription_status === 'active';
      limit = isActive ? PLAN_LIMITS.premium : PLAN_LIMITS.trial;
    }

    res.json({
      tweets: parsedResponse.tweets,
      saved_posts: savedPosts,
      message: `Generated and saved ${savedPosts.length} posts`,
      used_custom_prompt: !!user?.custom_prompt,
      // Include usage info in response
      usage: {
        used: currentUsage,
        limit: limit,
        subscription_status: user.subscription_status,
        remaining: limit - currentUsage
      }
    });

  } catch (error) {
    console.error('AI generation error:', error);
    res.status(500).json({ error: 'Failed to generate posts' });
  }
});

// These endpoints are no longer needed since we simplified the schema
// Posts are now directly linked to daily logs instead of post generations

export default router; 