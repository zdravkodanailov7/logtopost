"use client";

import { useState, useEffect, useMemo } from 'react';
import { DateNav } from './DateNav';
import { useAuth } from '@/contexts/AuthContext';
import { getPosts, Post, updatePostStatus, getPostsByDate } from '@/lib/posts';
import { Check, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [date, setDate] = useState(() => {
    // Initialize date from localStorage or default to today (shared with LogsComponent)
    if (typeof window !== 'undefined') {
      const savedDate = localStorage.getItem('selected_date');
      if (savedDate) {
        return new Date(savedDate);
      }
    }
    return new Date();
  });
  const [rejectingPost, setRejectingPost] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  
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

  useEffect(() => {
    if (isAuthenticated) {
      loadPosts();
    } else {
      setPosts([]);
      setLoading(false);
    }
  }, [isAuthenticated, date]); // Also reload when date changes

  // Posts are now loaded by date directly from the API, no filtering needed

  const getStatusColor = (status: Post['status']) => {
    switch (status) {
      case 'approved':
        return 'text-green-500';
      case 'rejected':
        return 'text-red-500';
      case 'pending':
      default:
        return 'text-chart-2';
    }
  };

  const getStatusDisplay = (post: Post) => {
    const isUpdating = updatingStatus === post.id;
    
    return (
      <Select
        value={post.status}
        onValueChange={(value: 'pending' | 'approved' | 'rejected') => {
          if (value === 'rejected') {
            setRejectingPost(post.id);
          } else {
            handleStatusUpdate(post.id, value);
          }
        }}
        disabled={isUpdating}
      >
        <SelectTrigger className={`w-fit h-auto p-0 text-xs font-medium cursor-pointer border-none shadow-none !bg-transparent hover:!bg-transparent focus:!bg-transparent data-[state=open]:!bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 ${getStatusColor(post.status)} hover:opacity-70 disabled:opacity-50 [&>svg]:hidden`}>
          <SelectValue>
            {isUpdating ? 'Updating...' : post.status.charAt(0).toUpperCase() + post.status.slice(1)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pending" className="text-xs cursor-pointer">
            <span className={getStatusColor('pending')}>Pending</span>
          </SelectItem>
          <SelectItem value="approved" className="text-xs cursor-pointer">
            <span className={getStatusColor('approved')}>Approved</span>
          </SelectItem>
          <SelectItem value="rejected" className="text-xs cursor-pointer">
            <span className={getStatusColor('rejected')}>Rejected</span>
          </SelectItem>
        </SelectContent>
      </Select>
    );
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
              onClick={() => handleCopyContent(post)}
              className="cursor-pointer p-2 -m-2 rounded transition-colors relative group"
              title="Click to copy to clipboard"
            >
              <p className="text-sm text-foreground whitespace-pre-wrap hover:text-foreground/70">
                {post.content}
              </p>
            </div>
            {post.rejection_reason && (
              <div className="text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
                <strong>Rejection reason:</strong> {post.rejection_reason}
              </div>
            )}
          </div>
        );
      },
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: ({ row }) => getStatusDisplay(row.original),
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
    localStorage.setItem('selected_date', newDate.toISOString());
  };

  const goToNextDay = () => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + 1);
    setDate(newDate);
    localStorage.setItem('selected_date', newDate.toISOString());
  };

  const goToToday = () => {
    const newDate = new Date();
    setDate(newDate);
    localStorage.setItem('selected_date', newDate.toISOString());
  };

  // Handle status update
  const handleStatusUpdate = async (postId: string, newStatus: 'pending' | 'approved' | 'rejected') => {
    if (newStatus === 'rejected') {
      setRejectingPost(postId);
      return;
    }

    setUpdatingStatus(postId);
    try {
      await updatePostStatus(postId, newStatus);
      await loadPosts(); // Reload posts to get updated data
    } catch (error) {
      console.error('Error updating status:', error);
      // Simple alert for now - you could use a proper toast system
      alert(`Failed to update post status to ${newStatus}`);
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Handle rejection with reason
  const handleRejectWithReason = async () => {
    if (!rejectingPost) return;

    setUpdatingStatus(rejectingPost);
    try {
      await updatePostStatus(rejectingPost, 'rejected', rejectionReason.trim() || undefined);
      await loadPosts(); // Reload posts to get updated data
      setRejectingPost(null);
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting post:', error);
      alert('Failed to reject post');
    } finally {
      setUpdatingStatus(null);
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
                          width: header.id === 'content' ? '80%' : 
                                 header.id === 'status' ? '20%' : 
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

      {/* Rejection Reason Modal */}
      {rejectingPost && (
        <div className="fixed inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-lg">
            <h3 className="text-lg font-semibold text-foreground mb-4">Reject Post</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Optionally provide a reason for rejecting this post:
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason (optional)..."
              className="w-full p-3 border border-border rounded-lg resize-none bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-ring"
              rows={3}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setRejectingPost(null);
                  setRejectionReason('');
                }}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectWithReason}
                disabled={updatingStatus === rejectingPost}
                className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50 transition-colors"
              >
                {updatingStatus === rejectingPost ? 'Rejecting...' : 'Reject Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 