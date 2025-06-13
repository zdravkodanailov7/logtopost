"use client";

import { useState, useEffect } from 'react';
import { DateNav } from './DateNav';
import { useAuth } from '@/contexts/AuthContext';
import { getLogByDate, createLog, updateLog, DailyLog } from '@/lib/logs';

export default function LogsComponent() {
  const [date, setDate] = useState(new Date());
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logExists, setLogExists] = useState(false);
  const [currentLog, setCurrentLog] = useState<DailyLog | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { isAuthenticated, user } = useAuth();

  // Load log for the current date
  const loadLog = async (dateToLoad: Date) => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await getLogByDate(dateToLoad);
      
      if (result && result.exists && result.log) {
        setText(result.log.content || '');
        setCurrentLog(result.log);
        setLogExists(true);
      } else {
        setText('');
        setCurrentLog(null);
        setLogExists(false);
      }
    } catch (err) {
      console.error('Error loading log:', err);
      setError('Failed to load log. Please try again.');
      setText('');
      setLogExists(false);
    } finally {
      setLoading(false);
    }
  };

  // Load log when date changes or user authentication status changes
  useEffect(() => {
    if (isAuthenticated) {
      loadLog(date);
    } else {
      setText('');
      setLogExists(false);
      setCurrentLog(null);
      setLoading(false);
    }
  }, [date, isAuthenticated]);

  // Auto-resize textarea when text changes
  useEffect(() => {
    const textarea = document.querySelector('textarea');
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [text]);

  // Create a new log
  const handleCreateLog = async () => {
    if (!isAuthenticated) return;
    
    setSaving(true);
    setError(null);
    
    try {
      const result = await createLog(date, '');
      setCurrentLog(result.log);
      setLogExists(true);
      setText('');
      
      // Focus on textarea after creating
      setTimeout(() => {
        const textarea = document.querySelector('textarea');
        if (textarea) textarea.focus();
      }, 100);
      
    } catch (err) {
      console.error('Error creating log:', err);
      setError('Failed to create log. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Save/update log
  const saveLog = async (content: string) => {
    if (!isAuthenticated || !logExists) return;
    
    setSaving(true);
    setError(null);
    
    try {
      const result = await updateLog(date, content);
      setCurrentLog(result.log);
    } catch (err) {
      console.error('Error saving log:', err);
      setError('Failed to save log. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const goToPreviousDay = () => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() - 1);
    setDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + 1);
    setDate(newDate);
  };

  const goToToday = () => {
    setDate(new Date());
  };

  // Don't show anything if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Please log in to view your daily logs.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <DateNav date={date} onPrevious={goToPreviousDay} onNext={goToNextDay} onDateClick={goToToday} />
      
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="px-[100px] pt-[50px] pb-[100px]">
          <h1 className="text-3xl font-bold pb-[10px]">
            {date.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </h1>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {/* Loading state */}
          {loading ? (
            <div className="flex items-center justify-center min-h-[50vh]">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : logExists ? (
            /* Existing log - show textarea */
            <div className="relative">
              <textarea
                className="w-full text-xs bg-background text-foreground
                           placeholder:text-muted-foreground focus:outline-none
                           resize-none border-none overflow-hidden min-h-[50vh]"
                style={{ height: 'auto', minHeight: '50vh' }}
                value={text}
                onChange={e => {
                  setText(e.target.value);
                  // Auto-resize textarea to fit content
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onBlur={e => saveLog(e.target.value)}
                placeholder="Write your log for today…"
                disabled={saving}
              />
              
              {/* Saving indicator */}
              {saving && (
                <div className="absolute top-2 right-2 text-xs text-muted-foreground">
                  Saving...
                </div>
              )}
            </div>
          ) : (
            /* No log exists - show create button */
            <div className="flex items-center justify-center min-h-[50vh]">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">
                  No log entry found for this date.
                </p>
                <button
                  onClick={handleCreateLog}
                  disabled={saving}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md
                           hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors"
                >
                  {saving ? 'Creating...' : 'Create Log Entry'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}