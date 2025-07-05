'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { getUserProfile, updateUserProfile, deleteAccount, UserProfile } from '@/lib/profile';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from "sonner";
import { ConfirmationDialog } from './ui/confirmation-dialog';

// Default prompt from the backend
const DEFAULT_PROMPT = `You are writing standalone tweets for a developer building a SaaS app. Your tone is dry, sharp, and honest. No fluff. No soft reflections. Just real updates, observations, and rants.

You write like you're texting another dev — direct, clear, no filler.

Don’t write tweets that feel like broken fragments or bullet points.
If two or three related thoughts belong together, combine them into one tweet.
Use up to 280 characters when it makes sense. Each tweet should feel like a complete thought, not a half-sentence.

Avoid fancy punctuation — no dashes, no semicolons, no colons. Use lowercase unless it’s a proper noun.
No British filler (e.g. “bloody”, “folks”). Avoid the word “apparently.” Swearing is fine but only if it hits.

No hashtags. No threads. No promotional tone.

Generate between 3 and 6 tweets per generation. Each one should stand alone.`;

export function ProfileComponent() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { isAuthenticated, logout } = useAuth();

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

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteAccount();
      toast.success('Account deleted successfully');
      // Clear local storage and redirect to home
      localStorage.removeItem('auth_token');
      logout();
      window.location.href = '/';
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
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
        <div className="relative">
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Enter your AI prompt here..."
            maxLength={2000}
            className="w-full h-[500px] p-4 border border-border rounded-lg resize-none font-mono text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none"
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace' }}
          />
        </div>
        
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
          className="flex-1"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
        
        <Button
          variant="outline"
          onClick={resetToDefault}
          disabled={isSaving}
        >
          Reset to Default
        </Button>
      </div>

      {/* Delete Account Section */}
      <div className="mt-12 pt-6 border-t border-destructive/20">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-destructive mb-2">Danger Zone</h2>
          <p className="text-sm text-muted-foreground">
            Once you delete your account, there is no going back. This will permanently delete your account, 
            all your logs, posts, and cancel any active subscriptions.
          </p>
        </div>

        <Button
          variant="destructive"
          onClick={() => setShowDeleteDialog(true)}
          className="cursor-pointer"
        >
          Delete Account
        </Button>
      </div>

      <ConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteAccount}
        title="Delete Account"
        message="Are you sure you want to delete your account? This will permanently delete all your data, logs, posts, and cancel any active subscriptions. This action cannot be undone."
        confirmText="Delete Account"
        confirmVariant="destructive"
        isLoading={isDeleting}
      />
    </div>
  );
} 