'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { getUserProfile, updateUserProfile, UserProfile } from '@/lib/profile';
import { useAuth } from '@/contexts/AuthContext';

// Simple toast replacement - can be upgraded later
const toast = {
  success: (message: string) => alert(`✅ ${message}`),
  error: (message: string) => alert(`❌ ${message}`)
};

// Default prompt from the backend
const DEFAULT_PROMPT = `You are Zdravko, a 20-year-old dev building SaaS apps, with a dark sense of humour and a blunt, no-bullshit tone.

Here is today's log:
{LOG_TEXT}

Generate tweets based on what Zdravko did or learned today.
Stick to his voice: sharp, a bit cynical, occasionally funny, but never soft or self-indulgent.
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
- Keep it real, not corny

Return the response as a JSON array of strings, where each string is a tweet. Example format:
{
  "tweets": [
    "first tweet here",
    "second tweet here",
    "third tweet here"
  ]
}`;

export function ProfileComponent() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDefault, setShowDefault] = useState(false);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfile();
    }
  }, [isAuthenticated]);

  const fetchProfile = async () => {
    try {
      const data = await getUserProfile();
      setProfile(data);
      setCustomPrompt(data.custom_prompt || '');
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const saveProfile = async () => {
    setIsSaving(true);
    try {
      const updatedProfile = await updateUserProfile({
        custom_prompt: customPrompt.trim() || null,
      });
      setProfile(updatedProfile);
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefault = () => {
    setCustomPrompt('');
  };

  // Don't show anything if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Please log in to view your profile.</p>
      </div>
    );
  }


  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-muted rounded mb-4"></div>
          <div className="h-8 bg-muted rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2 text-foreground">AI Prompt Settings</h1>
        <p className="text-muted-foreground">
          Customize how the AI generates posts from your daily logs. Leave empty to use the default prompt.
        </p>
      </div>

      {/* Current Status */}
      <div className="mb-6 p-4 bg-muted/50 rounded-lg border border-border">
        <h3 className="font-semibold mb-2 text-foreground">Current Status:</h3>
        <p className={`text-sm ${profile?.custom_prompt ? 'text-primary' : 'text-chart-2'}`}>
          {profile?.custom_prompt ? '✓ Using custom prompt' : '⚡ Using default prompt'}
        </p>
      </div>

      {/* Default Prompt Reference */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-foreground">Default Prompt (Reference)</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDefault(!showDefault)}
          >
            {showDefault ? 'Hide' : 'Show'} Default
          </Button>
        </div>
        
        {showDefault && (
          <div className="p-4 bg-card rounded-lg border border-border">
            <pre className="text-sm whitespace-pre-wrap text-card-foreground">
              {DEFAULT_PROMPT}
            </pre>
          </div>
        )}
      </div>

      {/* Custom Prompt Editor */}
      <div className="mb-6">
        <label className="block font-semibold mb-2 text-foreground">
          Your Custom Prompt {!customPrompt.trim() && <span className="text-muted-foreground">(Empty - will use default)</span>}
        </label>
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="Enter your custom AI prompt here, or leave empty to use the default..."
          className="w-full h-64 p-4 border border-border rounded-lg resize-none font-mono text-sm bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-ring"
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace' }}
        />
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-muted-foreground">
            Tip: Use {'{LOG_TEXT}'} as a placeholder for the daily log content
          </p>
          <p className="text-xs text-muted-foreground">
            {customPrompt.length} characters
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={saveProfile}
          disabled={isSaving}
          className="flex-1"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
        
        {customPrompt.trim() && (
          <Button
            variant="outline"
            onClick={resetToDefault}
            disabled={isSaving}
          >
            Reset to Default
          </Button>
        )}
      </div>

      {/* Help Text */}
      <div className="mt-6 p-4 bg-accent/20 rounded-lg border border-border">
        <h4 className="font-semibold text-foreground mb-2">How it works:</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Your custom prompt will be used when generating posts from logs</li>
          <li>• Use {'{LOG_TEXT}'} where you want the daily log content to be inserted</li>
          <li>• If you leave this empty, the default prompt will be used</li>
          <li>• Changes take effect immediately for new post generations</li>
        </ul>
      </div>
    </div>
  );
} 