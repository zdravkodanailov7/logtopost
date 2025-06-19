import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface Post {
  id: string;
  content: string;
  status: 'pending' | 'approved' | 'rejected';
  user_id: string;
  daily_log_id?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface PostsResponse {
  posts: Post[];
  count: number;
}

export interface CreatePostResponse {
  message: string;
  post: Post;
}

export interface UpdatePostResponse {
  message: string;
  post: Post;
}

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

// Request interceptor to add auth header
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Get all posts for the user
export const getPosts = async (): Promise<PostsResponse> => {
  try {
    const response = await api.get('/api/posts');
    return response.data;
  } catch (error) {
    console.error('Error fetching posts:', error);
    throw error;
  }
};

// Get posts for a specific date (based on daily log date)
export const getPostsByDate = async (date: Date): Promise<PostsResponse & { daily_log: any }> => {
  try {
    const dateString = date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    const response = await api.get(`/api/posts/by-date/${dateString}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching posts by date:', error);
    throw error;
  }
};

// Create a new post
export const createPost = async (post: {
  content: string;
  platform?: string;
  status?: string;
  daily_log_id?: string;
}): Promise<CreatePostResponse> => {
  try {
    const response = await api.post('/api/posts', post);
    return response.data;
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
};

// Update an existing post
export const updatePost = async (id: string, updates: {
  content?: string;
  status?: string;
  rejection_reason?: string;
}): Promise<UpdatePostResponse> => {
  try {
    const response = await api.put(`/api/posts/${id}`, updates);
    return response.data;
  } catch (error) {
    console.error('Error updating post:', error);
    throw error;
  }
};

// Update post status
export const updatePostStatus = async (id: string, status: 'pending' | 'approved' | 'rejected', rejectionReason?: string): Promise<UpdatePostResponse> => {
  try {
    const updates: any = { status };
    if (status === 'rejected' && rejectionReason) {
      updates.rejection_reason = rejectionReason;
    } else if (status !== 'rejected') {
      updates.rejection_reason = null; // Clear rejection reason when not rejecting
    }
    
    const response = await api.put(`/api/posts/${id}`, updates);
    return response.data;
  } catch (error) {
    console.error('Error updating post status:', error);
    throw error;
  }
};

// Approve a post
export const approvePost = async (id: string): Promise<UpdatePostResponse> => {
  try {
    const response = await api.put(`/api/posts/${id}`, { 
      status: 'approved',
      rejection_reason: null
    });
    return response.data;
  } catch (error) {
    console.error('Error approving post:', error);
    throw error;
  }
};

// Reject a post
export const rejectPost = async (id: string, reason?: string): Promise<UpdatePostResponse> => {
  try {
    const response = await api.put(`/api/posts/${id}`, { 
      status: 'rejected',
      rejection_reason: reason || null
    });
    return response.data;
  } catch (error) {
    console.error('Error rejecting post:', error);
    throw error;
  }
};

// Delete a post
export const deletePost = async (id: string): Promise<{ message: string }> => {
  try {
    const response = await api.delete(`/api/posts/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting post:', error);
    throw error;
  }
}; 