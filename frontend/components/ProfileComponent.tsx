'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { getUserProfile, updateUserProfile, UserProfile } from '@/lib/profile';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from "sonner";

// Default prompt from the backend
const DEFAULT_PROMPT = `You are Zdravko, a 20-year-old dev building SaaS apps, with a dark sense of humour and a blunt, no-bullshit tone.

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

export function ProfileComponent() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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
      setCustomPrompt(data.custom_prompt || DEFAULT_PROMPT);
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
      const promptToSave = customPrompt.trim() === DEFAULT_PROMPT ? null : customPrompt.trim();
      const updatedProfile = await updateUserProfile({
        custom_prompt: promptToSave,
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
    setCustomPrompt(DEFAULT_PROMPT);
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
          Customize how the AI generates posts from your daily logs.
        </p>
      </div>

      {/* Prompt Editor */}
      <div className="mb-6">
        <label className="block font-semibold mb-2 text-foreground">
          Prompt
        </label>
                <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="Enter your AI prompt here..."
          maxLength={2000}
          className="w-full h-[500px] p-4 border border-border rounded-lg resize-none font-mono text-sm bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-ring"
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace' }}
        />
        <div className="flex items-center justify-between mt-2">
            <p className={`text-xs ${customPrompt.length > 1800 ? 'text-yellow-500' : customPrompt.length === 2000 ? 'text-red-500' : 'text-muted-foreground'}`}>
              {customPrompt.length} / 2000 characters
            </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={saveProfile}
          disabled={isSaving}
          className="flex-1 cursor-pointer"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
        
        <Button
          variant="outline"
          onClick={resetToDefault}
          disabled={isSaving}
          className="cursor-pointer"
        >
          Reset to Default
        </Button>
      </div>
    </div>
  );
} 