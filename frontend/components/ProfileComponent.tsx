'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { getUserProfile, updateUserProfile, deleteAccount, UserProfile } from '@/lib/profile';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from "sonner";
import { ConfirmationDialog } from './ui/confirmation-dialog';

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
    const data = await getUserProfile();
    if (data) {
      setProfile(data);
      setCustomPrompt(data.custom_prompt || '');
    } else {
      console.error('Error fetching profile: No data returned');
      toast.error('Failed to load profile');
    }
    setIsLoading(false);
  };

  const saveProfile = async () => {
    setIsSaving(true);
    
    const promptToSave = customPrompt.trim() === '' ? null : customPrompt.trim();
    const result = await updateUserProfile({
      custom_prompt: promptToSave,
    });
    
    if (result.success && result.data) {
      setProfile(result.data);
      toast.success('Personality settings updated successfully!');
    } else {
      console.error('Error saving profile:', result.error);
      toast.error(result.error || 'Failed to save profile');
    }
    
    setIsSaving(false);
  };

  const resetToDefault = () => {
    setCustomPrompt('');
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    
    const result = await deleteAccount();
    
    if (result.success) {
      toast.success('Account deleted successfully');
      // Clear local storage and redirect to home
      localStorage.removeItem('auth_token');
      logout();
      window.location.href = '/';
    } else {
      console.error('Error deleting account:', result.error);
      toast.error(result.error || 'Failed to delete account');
    }
    
    setIsDeleting(false);
    setShowDeleteDialog(false);
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
        <h1 className="text-2xl font-bold mb-2 text-foreground">AI Personality Settings</h1>
        <p className="text-muted-foreground">
          Fine-tune the personality of your AI-generated posts. This gets added to the base prompt to adjust the tone and style.
        </p>
      </div>

      {/* Custom Personality Tweaks */}
      <div className="mb-6">
        <label className="block font-semibold mb-2 text-foreground">
          Personality Tweaks
          <span className="text-sm font-normal text-muted-foreground ml-2">(Optional)</span>
        </label>
        <p className="text-sm text-muted-foreground mb-3">
          Add personality adjustments like "be more casual", "add humor", "be more technical", etc. 
          This gets appended to the base prompt to customize the AI's personality.
        </p>
        
        <div className="relative">
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="e.g., be more casual, add humor when appropriate, focus on technical insights"
            maxLength={300}
            className="w-full h-32 p-4 border border-border rounded-lg resize-none text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        
        <div className="flex items-center justify-between mt-2">
          <p className={`text-xs ${customPrompt.length > 250 ? 'text-yellow-500' : customPrompt.length === 300 ? 'text-red-500' : 'text-muted-foreground'}`}>
            {customPrompt.length} / 300 characters
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
          {isSaving ? 'Saving...' : 'Save Personality Settings'}
        </Button>
        
        <Button
          variant="outline"
          onClick={resetToDefault}
          disabled={isSaving}
        >
          Clear Tweaks
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