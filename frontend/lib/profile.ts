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
export const getUserProfile = async (): Promise<UserProfile | null> => {
  try {
    const response = await api.get('/api/user/profile', {
      validateStatus: () => true // Accept all status codes
    });
    
    console.log('🔍 Get profile response:', {
      status: response.status,
      statusText: response.statusText,
      data: response.data
    });
    
    if (response.status === 200) {
      return response.data;
    } else {
      console.error('❌ Get profile failed:', response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ Error fetching profile:', error);
    return null;
  }
};

// Update user profile
export const updateUserProfile = async (profileData: UpdateProfileRequest): Promise<{ success: boolean; data?: UserProfile; error?: string }> => {
  try {
    const response = await api.put('/api/user/profile', profileData, {
      validateStatus: () => true // Accept all status codes
    });
    
    console.log('🔍 Update profile response:', {
      status: response.status,
      statusText: response.statusText,
      data: response.data
    });
    
    if (response.status === 200) {
      return { success: true, data: response.data };
    } else {
      console.error('❌ Update profile failed:', response.data);
      const errorMessage = response.data?.error || response.data?.message || 'Failed to update profile';
      return { success: false, error: errorMessage };
    }
  } catch (error: any) {
    console.error('❌ Error updating profile:', error);
    
    let errorMessage = 'Failed to update profile. Please try again.';
    
    if (error.code === 'ECONNABORTED') {
      errorMessage = 'Request timed out. Please try again.';
    } else if (error.request) {
      errorMessage = 'Network error. Please check your connection and try again.';
    } else if (error.response) {
      errorMessage = error.response.data?.error || error.response.data?.message || 'Server error occurred';
    }
    
    return { success: false, error: errorMessage };
  }
};

// Delete user account and all related data
export const deleteAccount = async (): Promise<{ success: boolean; error?: string }> => {
  return new Promise((resolve) => {
    (async () => {
      try {
        console.log('🗑️ Attempting to delete account...');
        
        const response = await api.delete('/api/user/account', {
          validateStatus: () => true // Accept all status codes
        });

        console.log('🔍 Delete account response:', {
          status: response.status,
          statusText: response.statusText,
          data: response.data
        });

        if (response.status === 200) {
          console.log('✅ Account deleted successfully');
          resolve({ success: true });
        } else {
          console.error('❌ Delete account failed:', response.data);
          const errorMessage = response.data?.error || response.data?.message || 'Failed to delete account';
          resolve({ success: false, error: errorMessage });
        }
      } catch (error: any) {
        console.error('❌ Error deleting account:', error);
        
        // Handle different types of errors
        let errorMessage = 'Failed to delete account. Please try again.';
        
        if (error.code === 'ECONNABORTED') {
          errorMessage = 'Request timed out. Please try again.';
        } else if (error.request) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.response) {
          errorMessage = error.response.data?.error || error.response.data?.message || 'Server error occurred';
        }
        
        resolve({ success: false, error: errorMessage });
      }
    })();
  });
}; 