"use client";

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import SplitText from '@/components/ui/split-text';
import axios from 'axios';

interface PostsSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedGeneration: any;
  generationPosts: any[];
  setGenerationPosts: React.Dispatch<React.SetStateAction<any[]>>;
}

export function PostsSheet({ 
  isOpen, 
  onOpenChange, 
  selectedGeneration, 
  generationPosts, 
  setGenerationPosts 
}: PostsSheetProps) {
  
  const [isExpanded, setIsExpanded] = useState(false);
  const TRUNCATE_LENGTH = 200;
  
  // Function to get truncated or full text
  const getTruncatedText = (text: string) => {
    if (!text || text.length <= TRUNCATE_LENGTH || isExpanded) {
      return text;
    }
    return text.substring(0, TRUNCATE_LENGTH) + '...';
  };
  
  // Reset expansion state when sheet closes or generation changes
  useEffect(() => {
    setIsExpanded(false);
  }, [selectedGeneration, isOpen]);
  
  // Handle toggling used status (shows as crossed out)
  const handleToggleUsed = async (postId: string, currentUsed: boolean) => {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const token = localStorage.getItem('auth_token');
      const headers: any = { 'Content-Type': 'application/json' };
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      await axios.put(
        `${API_BASE}/api/posts/${postId}`,
        { used: !currentUsed },
        { 
          withCredentials: true,
          headers: headers
        }
      );
      
      // Update local state
      setGenerationPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId 
            ? { ...post, used: !currentUsed }
            : post
        )
      );
    } catch (err) {
      console.error('Error toggling used status:', err);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-[800px] sm:w-[900px] lg:w-[1000px] max-w-[90vw] p-4">
        <SheetHeader className="pb-4 pl-1">
          <SheetTitle className="sr-only">Generated Posts</SheetTitle>
          <SplitText as="h2" className="text-lg font-semibold">
            Generated Posts
          </SplitText>
        </SheetHeader>

        <div className="overflow-y-auto flex-1 pr-2">
          {selectedGeneration && (
            <div className="mb-3 p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground/50 mb-1 uppercase">Selected text</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {getTruncatedText(selectedGeneration.selected_text)}
              </p>
              {selectedGeneration.selected_text && selectedGeneration.selected_text.length > TRUNCATE_LENGTH && (
                <div className="text-right">
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-xs text-primary hover:text-green-500/80 cursor-pointer mt-2 font-medium transition-colors"
                  >
                    {isExpanded ? 'Show less' : 'Show all'}
                  </button>
                </div>
              )}
            </div>
          )}
          {generationPosts.map((post, index) => (
            <div key={post.id} className={index > 0 ? "mt-3" : ""}>
              <ContextMenu>
                <ContextMenuTrigger>
                  <div className="p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors">
                    <p className={`text-sm ${post.used ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {post.content}
                    </p>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem 
                    className="cursor-pointer"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(post.content);
                        console.log('Copied to clipboard');
                      } catch (err) {
                        console.error('Failed to copy:', err);
                      }
                    }}
                  >
                    Copy
                  </ContextMenuItem>
                  <ContextMenuItem 
                    className="cursor-pointer"
                    onClick={() => handleToggleUsed(post.id, post.used)}
                  >
                    {post.used ? 'Mark as unused' : 'Mark as used'}
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
} 