import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface UserProfile {
  id: string;
  email: string;
  custom_prompt: string | null;
}

export interface UpdateProfileRequest {
  custom_prompt: string | null;
}

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

// Request interceptor to add auth header
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  console.log('🔧 Profile API interceptor:', {
    url: config.url,
    token: token ? 'Present' : 'Missing',
    headers: config.headers.Authorization ? 'Will be set' : 'Not set'
  });
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('✅ Authorization header set for profile request');
  } else {
    console.log('❌ No token in localStorage for profile request');
  }
  return config;
});

// Get user profile
export const getUserProfile = async (): Promise<UserProfile> => {
  try {
    const response = await api.get('/api/user/profile');
    return response.data;
  } catch (error) {
    console.error('Error fetching profile:', error);
    throw error;
  }
};

// Update user profile
export const updateUserProfile = async (profileData: UpdateProfileRequest): Promise<UserProfile> => {
  try {
    const response = await api.put('/api/user/profile', profileData);
    return response.data;
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
};

// Delete user account and all related data
export const deleteAccount = async (): Promise<void> => {
  try {
    await api.delete('/api/user/account');
  } catch (error) {
    console.error('Error deleting account:', error);
    throw error;
  }
}; 