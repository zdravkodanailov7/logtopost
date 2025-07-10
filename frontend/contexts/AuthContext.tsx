'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, loginUser, registerUser, getCurrentUser, saveToken, saveUser, getToken, getStoredUser, logout } from '@/lib/auth';
import axios from 'axios';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  createCheckoutSession: (plan: string) => Promise<string>;
  canEditPrompt: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = getToken();
        const storedUser = getStoredUser();

        if (token && storedUser) {
          // Verify token is still valid
          try {
            const { user: currentUser } = await getCurrentUser(token);
            setUser(currentUser);
          } catch (error) {
            // Token is invalid, clear stored data
            logout();
            console.log('Token expired or invalid, logged out');
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const handleLogin = async (email: string, password: string) => {
    try {
      setLoading(true);
      const response = await loginUser(email, password);
      
      saveToken(response.token);
      saveUser(response.user);
      setUser(response.user);
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (email: string, password: string) => {
    try {
      setLoading(true);
      const response = await registerUser(email, password);
      
      saveToken(response.token);
      saveUser(response.user);
      setUser(response.user);
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    setUser(null);
  };

  const createCheckoutSession = async (plan: string): Promise<string> => {
    const token = localStorage.getItem('auth_token');
    const headers: any = { 'Content-Type': 'application/json' };
    
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/billing/create-checkout-session`,
        { plan },
        { 
          withCredentials: true,
          headers: headers
        }
      );

      return response.data.url;
    } catch (error: any) {
      console.error('Checkout error:', error);
      throw new Error(error.response?.data?.error || 'Failed to create checkout session');
    }
  };

  // Check if user can edit custom prompt (active subscription)
  const canEditPrompt = !!(user && user.subscription_status === 'active');

  const refreshUser = async () => {
    try {
      const token = getToken();
      if (token) {
        const { user: currentUser } = await getCurrentUser(token);
        setUser(currentUser);
        saveUser(currentUser);
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
      // If refresh fails, the user might be logged out
      handleLogout();
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    isAuthenticated: !!user,
    createCheckoutSession,
    canEditPrompt,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 