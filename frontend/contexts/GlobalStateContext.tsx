"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface GlobalStateContextType {
  // Date state
  date: Date;
  setDate: (date: Date) => void;
  
  // Text size state
  textSize: 'small' | 'medium' | 'large';
  setTextSize: (size: 'small' | 'medium' | 'large') => void;
  
  // Sidebar state
  activeSidebarItem: string;
  setActiveSidebarItem: (item: string) => void;
  
  // AI generation state
  selectedText: string;
  setSelectedText: (text: string) => void;
  aiLoading: boolean;
  setAiLoading: (loading: boolean) => void;
  
  // Client state
  isClient: boolean;
  
  // Helper functions
  handleDateChange: (newDate: Date) => void;
  handleTextSizeChange: (size: 'small' | 'medium' | 'large') => void;
  handleSidebarItemChange: (item: string) => void;
  isSubscriptionCancelled: () => boolean;
  lockedItems: string[];
}

const GlobalStateContext = createContext<GlobalStateContextType | undefined>(undefined);

export const useGlobalState = () => {
  const context = useContext(GlobalStateContext);
  if (context === undefined) {
    throw new Error('useGlobalState must be used within a GlobalStateProvider');
  }
  return context;
};

interface GlobalStateProviderProps {
  children: ReactNode;
}

export const GlobalStateProvider: React.FC<GlobalStateProviderProps> = ({ children }) => {
  const [date, setDate] = useState(new Date());
  const [textSize, setTextSize] = useState<'small' | 'medium' | 'large'>('small');
  const [isClient, setIsClient] = useState(false);
  const [activeSidebarItem, setActiveSidebarItem] = useState('logs');
  const [selectedText, setSelectedText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  
  const { user } = useAuth();

  // Define locked items
  const lockedItems = ['logs', 'posts'];

  // Check if subscription is fully cancelled
  const isSubscriptionCancelled = () => {
    if (!user) return false;
    
    // Check if subscription is cancelled and trial/subscription has ended
    const now = new Date();
    const isStatusCancelled = user.subscription_status === 'cancelled' || user.subscription_status === 'canceled';
    
    if (isStatusCancelled) {
      // Check if trial has ended
      if (user.trial_ends_at) {
        const trialEndDate = new Date(user.trial_ends_at);
        if (now >= trialEndDate) {
          return true;
        }
      }
      
      // Check if subscription has ended
      if (user.subscription_ends_at) {
        const subscriptionEndDate = new Date(user.subscription_ends_at);
        if (now >= subscriptionEndDate) {
          return true;
        }
      }
    }
    
    return false;
  };

  // Initialize client state and load saved preferences
  useEffect(() => {
    setIsClient(true);
    const savedDate = localStorage.getItem('selected_date');
    const savedTextSize = localStorage.getItem('text_size');
    const savedSidebarItem = localStorage.getItem('activeSidebarItem');
    
    if (savedDate) setDate(new Date(savedDate));
    if (savedTextSize && ['small', 'medium', 'large'].includes(savedTextSize)) {
      setTextSize(savedTextSize as 'small' | 'medium' | 'large');
    }
    if (savedSidebarItem && ['logs', 'posts', 'billing', 'profile'].includes(savedSidebarItem)) {
      setActiveSidebarItem(savedSidebarItem);
    }
  }, []);

  // Set default sidebar item based on subscription status
  useEffect(() => {
    if (user) {
      const isCancelled = isSubscriptionCancelled();
      
      // If current item is locked, switch to billing
      if (isCancelled && lockedItems.includes(activeSidebarItem)) {
        setActiveSidebarItem('billing');
        localStorage.setItem('activeSidebarItem', 'billing');
      }
    }
  }, [user, activeSidebarItem]);

  // Handle date change
  const handleDateChange = (newDate: Date) => {
    setDate(newDate);
    if (isClient) {
      localStorage.setItem('selected_date', newDate.toISOString());
    }
  };

  // Handle text size change
  const handleTextSizeChange = (size: 'small' | 'medium' | 'large') => {
    setTextSize(size);
    if (isClient) {
      localStorage.setItem('text_size', size);
    }
  };

  // Handle sidebar item change
  const handleSidebarItemChange = (item: string) => {
    // Check if the item is locked due to cancelled subscription
    const isCancelled = isSubscriptionCancelled();
    
    if (isCancelled && lockedItems.includes(item)) {
      // Don't allow switching to locked items
      return;
    }
    
    setActiveSidebarItem(item);
    localStorage.setItem('activeSidebarItem', item);
  };

  const value: GlobalStateContextType = {
    date,
    setDate,
    textSize,
    setTextSize,
    activeSidebarItem,
    setActiveSidebarItem,
    selectedText,
    setSelectedText,
    aiLoading,
    setAiLoading,
    isClient,
    handleDateChange,
    handleTextSizeChange,
    handleSidebarItemChange,
    isSubscriptionCancelled,
    lockedItems,
  };

  return (
    <GlobalStateContext.Provider value={value}>
      {children}
    </GlobalStateContext.Provider>
  );
}; 