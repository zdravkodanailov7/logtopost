import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface DailyLog {
  id: string;
  log_date: string;
  content: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface LogResponse {
  log: DailyLog;
  exists: boolean;
}

export interface CreateLogResponse {
  message: string;
  log: DailyLog;
}

export interface UpdateLogResponse {
  message: string;
  log: DailyLog;
}

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

// Request interceptor to add auth header
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token'); // Fixed: use 'auth_token' not 'token'
  console.log('🔧 Axios interceptor:', {
    url: config.url,
    token: token ? 'Present' : 'Missing',
    headers: config.headers.Authorization ? 'Will be set' : 'Not set'
  });
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('✅ Authorization header set for request');
  } else {
    console.log('❌ No token in localStorage');
  }
  return config;
});

// Format date to YYYY-MM-DD for API
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Get log for a specific date
export const getLogByDate = async (date: Date): Promise<LogResponse | null> => {
  try {
    const formattedDate = formatDate(date);
    const response = await api.get(`/api/logs/${formattedDate}`);
    
    return { log: response.data.log, exists: true };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return { log: null as any, exists: false };
    }
    console.error('Error fetching log:', error);
    throw error;
  }
};

// Create a new log
export const createLog = async (date: Date, content: string = ''): Promise<CreateLogResponse> => {
  try {
    const formattedDate = formatDate(date);
    
    const response = await api.post('/api/logs', {
      date: formattedDate,
      content,
    });

    return response.data;
  } catch (error) {
    console.error('Error creating log:', error);
    throw error;
  }
};

// Update an existing log
export const updateLog = async (date: Date, content: string): Promise<UpdateLogResponse> => {
  try {
    const formattedDate = formatDate(date);
    
    const response = await api.put(`/api/logs/${formattedDate}`, {
      content,
    });

    return response.data;
  } catch (error) {
    console.error('Error updating log:', error);
    throw error;
  }
}; 