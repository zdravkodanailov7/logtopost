"use client";

import { useState, useEffect, useMemo } from 'react';
import { DateNav } from './DateNav';
import { useAuth } from '@/contexts/AuthContext';
import { getPosts, Post, togglePostUsed, getPostsByDate } from '@/lib/posts';
import { Check } from 'lucide-react';
import { toast } from "sonner";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  ColumnDef,
} from '@tanstack/react-table';

const columnHelper = createColumnHelper<Post>();

export default function PostsComponent() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(new Date());
  const [isClient, setIsClient] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; postId: string } | null>(null);
  const [updatingPost, setUpdatingPost] = useState<string | null>(null);
  
  const { isAuthenticated } = useAuth();

  // Load posts for the selected date
  const loadPosts = async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await getPostsByDate(date);
      setPosts(result.posts || []);
    } catch (err) {
      console.error('Error loading posts:', err);
      setError('Failed to load posts. Please try again.');
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

  useEffect(() => {
    if (isAuthenticated && isClient) {
      loadPosts();
    } else {
      setPosts([]);
      setLoading(false);
    }
  }, [isAuthenticated, date, isClient]);

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  // Handle toggling used status
  const handleToggleUsed = async (postId: string, currentUsed: boolean) => {
    setUpdatingPost(postId);
    try {
      await togglePostUsed(postId, !currentUsed);
      // Update local state
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId 
            ? { ...post, used: !currentUsed }
            : post
        )
      );
    } catch (error) {
      console.error('Error updating post:', error);
      toast.error('Failed to update post');
    } finally {
      setUpdatingPost(null);
    }
  };

  // Handle copy to clipboard
  const handleCopyContent = async (post: Post) => {
    try {
      await navigator.clipboard.writeText(post.content);
      toast.success("Copied to clipboard!");
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = post.content;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        toast.success("Copied to clipboard!");
      } catch (fallbackError) {
        toast.error("Failed to copy to clipboard");
      }
    }
  };

  // Define columns
  const columns = useMemo<ColumnDef<Post, any>[]>(() => [
    columnHelper.accessor('content', {
      header: 'Content',
      cell: ({ row }) => {
        const post = row.original;
        return (
          <div className="space-y-2">
            <div
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  postId: post.id
                });
              }}
              className="p-2 -m-2 rounded transition-colors relative group cursor-text"
            >
              <p className={`text-sm whitespace-pre-wrap transition-opacity ${
                post.used ? 'text-muted-foreground opacity-60' : 'text-foreground'
              }`}>
                {post.content}
              </p>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor('used', {
      header: 'Used',
      cell: ({ row }) => {
        const post = row.original;
        const isUpdating = updatingPost === post.id;
        
        return (
          <div className="flex items-center pl-2">
            <button
              onClick={() => handleToggleUsed(post.id, post.used)}
              disabled={isUpdating}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
                post.used 
                  ? 'bg-primary border-primary text-primary-foreground' 
                  : 'border-muted-foreground hover:border-primary'
              } ${isUpdating ? 'opacity-50' : ''}`}
              title={post.used ? "Mark as unused" : "Mark as used"}
            >
              {post.used && <Check className="w-3 h-3" />}
            </button>
          </div>
        );
      },
      size: 100,
      enableSorting: true,
    }),
  ], []);

  const table = useReactTable({
    data: posts,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

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

  // Don't show anything if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Please log in to view your posts.</p>
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
        showGenerateButton={false}
      />
      
      {/* Error message */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
          {error}
        </div>
      )}

      {/* Table Container */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse space-y-4 w-full px-6">
              <div className="h-12 bg-muted rounded-lg"></div>
              <div className="h-12 bg-muted rounded-lg"></div>
              <div className="h-12 bg-muted rounded-lg"></div>
            </div>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                No posts found for {date.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}.
              </p>
              <p className="text-sm text-muted-foreground">
                Go to your logs and select text to generate posts from your daily entries.
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border sticky top-0">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="text-left px-6 py-1 text-xs font-medium text-muted-foreground uppercase"
                        style={{ 
                          width: header.id === 'content' ? '85%' : 
                                 header.id === 'used' ? '15%' : 
                                 header.getSize() 
                        }}
                      >
                        {header.isPlaceholder ? null : (
                          <div
                            className={header.column.getCanSort() ? 'cursor-pointer select-none text-xs flex items-center hover:text-primary' : ''}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                            {header.column.getCanSort() && (
                              <span className="ml-1 text-muted-foreground">
                                {header.column.getIsSorted() === 'asc' ? '↑' : 
                                 header.column.getIsSorted() === 'desc' ? '↓' : '↕'}
                              </span>
                            )}
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={`border-b border-border transition-colors hover:bg-muted/30 ${
                      index % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-2">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-card border border-border rounded-lg shadow-lg z-50 py-1"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              const post = posts.find(p => p.id === contextMenu.postId);
              if (post) {
                handleCopyContent(post);
              }
              setContextMenu(null);
            }}
            className="w-full px-4 py-2 text-sm text-left hover:bg-muted transition-colors cursor-pointer"
          >
            Copy Post
          </button>
        </div>
      )}
    </div>
  );
} 