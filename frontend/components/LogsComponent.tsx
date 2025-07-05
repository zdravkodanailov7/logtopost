"use client";

import { useState, useEffect, useRef } from 'react';
import { DateNav } from './DateNav';
import { useAuth } from '@/contexts/AuthContext';
import { getLogByDate, createLog, updateLog, DailyLog } from '@/lib/logs';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Wand2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function LogsComponent() {
  const [date, setDate] = useState(new Date());
  const [isClient, setIsClient] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logExists, setLogExists] = useState(false);
  const [currentLog, setCurrentLog] = useState<DailyLog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [textSize, setTextSize] = useState<'small' | 'medium' | 'large'>('small');
  
  const { isAuthenticated, user } = useAuth();

  // Get text size class
  const getTextSizeClass = () => {
    switch (textSize) {
      case 'small':
        return 'text-xs';
      case 'medium':
        return 'text-sm';
      case 'large':
        return 'text-base';
      default:
        return 'text-xs';
    }
  };

  // Load text size from localStorage and save changes
  useEffect(() => {
    if (isClient) {
      const savedTextSize = localStorage.getItem('text_size') as 'small' | 'medium' | 'large';
      if (savedTextSize && ['small', 'medium', 'large'].includes(savedTextSize)) {
        setTextSize(savedTextSize);
      }
    }
  }, [isClient]);

  const handleTextSizeChange = (size: 'small' | 'medium' | 'large') => {
    setTextSize(size);
    if (isClient) {
      localStorage.setItem('text_size', size);
    }
  };

  // Load log for the current date
  const loadLog = async (dateToLoad: Date) => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await getLogByDate(dateToLoad);
      
      if (result && result.exists && result.log) {
        console.log('Setting text content:', result.log.content?.length || 0, 'characters');
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

  // Initialize client state and load saved date
  useEffect(() => {
    setIsClient(true);
    // Load saved date from localStorage after hydration
    const savedDate = localStorage.getItem('selected_date');
    if (savedDate) {
      setDate(new Date(savedDate));
    }
  }, []);

  // Load log when date changes or user authentication status changes
  useEffect(() => {
    if (isAuthenticated && isClient) {
      loadLog(date);
    } else {
      setText('');
      setLogExists(false);
      setCurrentLog(null);
      setLoading(false);
    }
  }, [date, isAuthenticated, isClient]);

  // Auto-resize textarea when text changes or component mounts
  useEffect(() => {
    const resizeTextarea = () => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    };

    // Small delay to ensure the text is rendered and DOM is ready
    const timer = setTimeout(resizeTextarea, 10);
    
    return () => clearTimeout(timer);
  }, [text, logExists]);

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
    if (!isAuthenticated || !currentLog) return;
    
    setSaving(true);
    
    try {
      await updateLog(date, content);
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
    if (isClient) {
      localStorage.setItem('selected_date', newDate.toISOString());
    }
  };

  const goToNextDay = () => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + 1);
    setDate(newDate);
    if (isClient) {
      localStorage.setItem('selected_date', newDate.toISOString());
    }
  };

  const goToToday = () => {
    const newDate = new Date();
    setDate(newDate);
    if (isClient) {
      localStorage.setItem('selected_date', newDate.toISOString());
    }
  };

  const handleSelectionChange = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = textarea.value.substring(start, end);
      setSelectedText(selected);
    }
  };

  const handleSendToAI = async () => {
    if (!selectedText.trim() || !isAuthenticated || !currentLog) return;
    
    setAiLoading(true);
    setError(null);
    
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const token = localStorage.getItem('auth_token');
      const headers: any = { 'Content-Type': 'application/json' };
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const textarea = textareaRef.current;
      const selectionStart = textarea ? textarea.selectionStart : 0;
      const selectionEnd = textarea ? textarea.selectionEnd : 0;

      const requestData = {
        logText: selectedText,
        dailyLogId: currentLog.id,
        selectionStart: selectionStart,
        selectionEnd: selectionEnd,
      };

      // Debug logging
      console.log('🚀 Sending AI request:', {
        url: `${API_BASE}/api/ai/generate-posts`,
        logText: selectedText,
        logTextLength: selectedText.length,
        dailyLogId: currentLog.id,
        selectionStart,
        selectionEnd,
        requestData,
        hasToken: !!token,
        tokenPrefix: token ? token.substring(0, 10) + '...' : 'none'
      });

      const response = await axios.post(
        `${API_BASE}/api/ai/generate-posts`,
        requestData,
        { 
          withCredentials: true,
          headers: headers
        }
      );

      console.log('✅ AI response received:', response.data);

      // Check if we have tweets in the response (successful generation)
      if (response.data.tweets && response.data.tweets.length > 0) {
        console.log('Posts generated successfully:', response.data.tweets);
        // Clear the selection
        setSelectedText('');
        if (textarea) {
          textarea.setSelectionRange(0, 0);
        }
        // Show success message
        setError(null);
      } else if (response.data.success) {
        console.log('Posts generated successfully');
        // Clear the selection
        setSelectedText('');
        if (textarea) {
          textarea.setSelectionRange(0, 0);
        }
      } else {
        console.error('Failed to generate posts:', response.data.error);
        setError(response.data.error || 'Failed to generate posts. Please try again.');
      }
    } catch (err: any) {
      console.error('❌ Error generating posts:', err);
      
      // Log detailed error information
      if (err.response) {
        console.error('🔍 Response error details:', {
          status: err.response.status,
          statusText: err.response.statusText,
          data: err.response.data,
          headers: err.response.headers
        });
      } else if (err.request) {
        console.error('🔍 Request error details:', err.request);
      } else {
        console.error('🔍 General error details:', err.message);
      }
      
      if (err.response?.status === 402) {
        setError('You have reached your usage limit. Please upgrade your plan or wait for your limit to reset.');
      } else if (err.response?.status === 401) {
        setError('Authentication failed. Please try logging in again.');
      } else if (err.response?.status === 400) {
        const errorMsg = err.response?.data?.error || err.response?.data?.message || 'Bad request - please check your input';
        setError(`Request error: ${errorMsg}`);
      } else {
        setError('Failed to generate posts. Please try again.');
      }
    } finally {
      setAiLoading(false);
    }
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
      <DateNav 
        date={date} 
        onPrevious={goToPreviousDay} 
        onNext={goToNextDay} 
        onDateClick={goToToday} 
        onGeneratePosts={handleSendToAI}
        isGenerateDisabled={!selectedText || aiLoading}
        isGenerating={aiLoading}
        showGenerateButton={true}
        textSize={textSize}
        onTextSizeChange={handleTextSizeChange}
      />
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="px-[50px] lg:px-[300px] pt-[50px] lg:pt-[50px] pb-[100px] lg:pb-[200px]">
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
            <div className="flex">
              {/* Textarea container */}
              <div className="flex-1 relative bg-background">
                <textarea
                  ref={(el) => {
                    textareaRef.current = el;
                    if (el && text) {
                      // Immediately resize when textarea mounts with content
                      setTimeout(() => {
                        el.style.height = 'auto';
                        el.style.height = `${el.scrollHeight}px`;
                      }, 0);
                    }
                  }}
                  className={`w-full ${getTextSizeClass()} bg-transparent text-foreground
                             placeholder:text-muted-foreground focus:outline-none
                             resize-none border-none relative z-10`}
                  style={{ minHeight: '100px' }}
                  value={text}
                  onChange={e => {
                    setText(e.target.value);
                    // Auto-resize textarea to fit content
                    e.target.style.height = 'auto';
                    e.target.style.height = `${e.target.scrollHeight}px`;
                    setSelectedText(''); // Clear selection on change
                  }}
                  onBlur={e => saveLog(e.target.value)}
                  onSelect={handleSelectionChange}
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
                           transition-colors cursor-pointer"
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