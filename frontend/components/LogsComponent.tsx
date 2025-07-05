"use client";

import { useState, useEffect, useRef } from 'react';
import { DateNav } from './DateNav';
import { useAuth } from '@/contexts/AuthContext';
import { getLogByDate, createLog, updateLog, DailyLog } from '@/lib/logs';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Wand2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PostsSheet } from './PostsSheet';

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
  const [postGenerations, setPostGenerations] = useState<any[]>([]);
  const [selectedGeneration, setSelectedGeneration] = useState<any>(null);
  const [generationPosts, setGenerationPosts] = useState<any[]>([]);
  const [showPostsDialog, setShowPostsDialog] = useState(false);
  const [hoveredGeneration, setHoveredGeneration] = useState<string | null>(null);
  
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

  // Debug: Log postGenerations when they change
  useEffect(() => {
    console.log('PostGenerations updated:', postGenerations);
    console.log('Text length:', text.length);
  }, [postGenerations, text]);

  const handleTextSizeChange = (size: 'small' | 'medium' | 'large') => {
    setTextSize(size);
    if (isClient) {
      localStorage.setItem('text_size', size);
    }
  };

  // Load post generations for the current log
  const loadPostGenerations = async (logId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: any = { 'Content-Type': 'application/json' };
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/ai/post-generations/${logId}`,
        { 
          withCredentials: true,
          headers: headers
        }
      );
      
      console.log('Loaded post generations:', res.data.generations);
      setPostGenerations(res.data.generations || []);
    } catch (err) {
      console.error('Error loading post generations:', err);
      setPostGenerations([]);
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
        
        // Load post generations for this log
        console.log('Loading post generations for log:', result.log.id);
        await loadPostGenerations(result.log.id);
        console.log('Finished loading post generations');
      } else {
        setText('');
        setCurrentLog(null);
        setLogExists(false);
        setPostGenerations([]);
      }
    } catch (err) {
      console.error('Error loading log:', err);
      setError('Failed to load log. Please try again.');
      setText('');
      setLogExists(false);
      setPostGenerations([]);
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

  // Handle selection change in textarea
  const handleSelectionChange = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      const selection = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
      setSelectedText(selection);
    }
  };

  // Send selected text to AI endpoint
  const handleSendToAI = async () => {
    if (!selectedText) return;
    
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    setAiLoading(true);
    try {
      // Get token from localStorage and add Authorization header
      const token = localStorage.getItem('auth_token');
      const headers: any = { 'Content-Type': 'application/json' };
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const requestData = { 
        logText: selectedText,
        dailyLogId: currentLog?.id,
        selectionStart: textarea.selectionStart,
        selectionEnd: textarea.selectionEnd
      };

      console.log('🚀 Sending AI request:', {
        url: `${process.env.NEXT_PUBLIC_API_URL}/api/ai/generate-posts`,
        headers: { ...headers, Authorization: token ? `Bearer ${token.substring(0, 20)}...` : 'None' },
        data: requestData,
        user: user ? { id: user.id, email: user.email } : 'No user'
      });

      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/ai/generate-posts`,
        requestData,
        { 
          withCredentials: true,
          headers: headers
        }
      );
      const data = res.data;
      console.log('✅ AI generated posts successfully:', data.tweets);
      console.log('✅ Saved posts:', data.saved_posts);
      console.log('✅ Post generation:', data.post_generation);
      
      // Reload post generations to show the new blue dot
      if (currentLog?.id) {
        console.log('🔄 Reloading post generations for log:', currentLog.id);
        await loadPostGenerations(currentLog.id);
      } else {
        console.log('⚠️ No currentLog.id available for reloading generations');
      }
      
      // You could show a success message here
    } catch (err) {
      console.error('❌ Error sending to AI:', err);
      
      if (axios.isAxiosError(err)) {
        console.error('📊 Axios Error Details:', {
          status: err.response?.status,
          statusText: err.response?.statusText,
          data: err.response?.data,
          config: {
            url: err.config?.url,
            method: err.config?.method,
            headers: err.config?.headers
          }
        });
        
        // Log specific error details for 403
        if (err.response?.status === 403) {
          console.error('🚫 403 Forbidden Details:', {
            errorMessage: err.response?.data?.error,
            message: err.response?.data?.message,
            upgradeRequired: err.response?.data?.upgrade_required,
            usage: err.response?.data?.used ? `${err.response.data.used}/${err.response.data.limit}` : 'Unknown',
            plan: err.response?.data?.plan,
            pricing: err.response?.data?.pricing
          });
        }
      } else {
        console.error('❌ Non-Axios Error:', err);
      }
    } finally {
      setAiLoading(false);
    }
  };

  // Handle clicking on a blue dot to show posts
  const handleDotClick = async (generation: any) => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: any = { 'Content-Type': 'application/json' };
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/ai/posts/${generation.id}`,
        { 
          withCredentials: true,
          headers: headers
        }
      );
      
      setSelectedGeneration(generation);
      setGenerationPosts(res.data.posts || []);
      setShowPostsDialog(true);
    } catch (err) {
      console.error('Error loading posts for generation:', err);
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
              {/* Left sidebar for generation dots */}
              <div className="w-8 flex-shrink-0 relative">
              </div>
              
              {/* Textarea container */}
              <div className="flex-1 relative bg-background">
                {/* Text highlight overlay */}
                {hoveredGeneration && (
                  <div 
                    className={`absolute inset-0 pointer-events-none ${getTextSizeClass()} bg-background text-transparent
                               resize-none border-none whitespace-pre-wrap break-words`}
                    style={{ 
                      height: textareaRef.current?.style.height || 'auto', 
                      minHeight: '100px',
                      padding: textareaRef.current ? window.getComputedStyle(textareaRef.current).padding : '0'
                    }}
                  >
                    {(() => {
                      const generation = postGenerations.find(g => g.id === hoveredGeneration);
                      if (!generation) return text;
                      
                      const beforeText = text.substring(0, generation.selection_start);
                      const selectedText = text.substring(generation.selection_start, generation.selection_end);
                      const afterText = text.substring(generation.selection_end);
                      
                      return (
                        <>
                          {beforeText}
                          <span className="bg-primary/20 text-red-500 z-10">{selectedText}</span>
                          {afterText}
                        </>
                      );
                    })()}
                  </div>
                )}
                
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
                
                {/* Generation dots */}
                {text && postGenerations.map((generation, index) => {
                  // Calculate position based on selection_end, but cap it to actual content
                  const actualSelectionEnd = Math.min(generation.selection_end, text.trimEnd().length);
                  const textBeforeEnd = text.substring(0, actualSelectionEnd);
                  const lines = textBeforeEnd.split('\n');
                  const lineNumber = lines.length - 1;
                  
                  // Position dots in the left margin
                  const lineHeight = getTextSizeClass() === 'text-xs' ? 16 : 
                                   getTextSizeClass() === 'text-sm' ? 20 : 24;
                  const top = lineNumber * lineHeight + 5;
                  
                  console.log(`Rendering dot ${index + 1} at line ${lineNumber}, top: ${top}px, selection_end: ${generation.selection_end}, actual_end: ${actualSelectionEnd}`);
                  
                  return (
                    <div
                      key={generation.id}
                      className="absolute w-4 h-4 bg-chart-1/20 hover:bg-chart-1/60 border border-green-500/60 hover:border-green-500 rounded-full cursor-pointer z-10 transition-all duration-400 hover:scale-125"
                      style={{ top: `${top}px`, left: `-22px` }}
                      onClick={() => handleDotClick(generation)}
                      onMouseEnter={() => setHoveredGeneration(generation.id)}
                      onMouseLeave={() => setHoveredGeneration(null)}
                      title={`Generated ${new Date(generation.created_at).toLocaleString()}`}
                    />
                  );
                })}
                
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

      {/* Posts Sheet */}
      <PostsSheet 
        isOpen={showPostsDialog}
        onOpenChange={setShowPostsDialog}
        selectedGeneration={selectedGeneration}
        generationPosts={generationPosts}
        setGenerationPosts={setGenerationPosts}
      />
    </div>
  );
}