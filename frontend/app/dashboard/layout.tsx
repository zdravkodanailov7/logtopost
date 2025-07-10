"use client";

import React, { useEffect } from 'react';
import { useAuth } from "@/contexts/AuthContext";
import { GlobalStateProvider, useGlobalState } from '@/contexts/GlobalStateContext';
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DashboardSidebar } from '@/components/DashboardSidebar';

// Inner component that uses the global state
function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, logout, loading } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  
  const {
    date,
    textSize,
    activeSidebarItem,
    selectedText,
    aiLoading,
    handleDateChange,
    handleTextSizeChange,
    handleSidebarItemChange,
    isSubscriptionCancelled,
    lockedItems,
    setSelectedText,
    setAiLoading,
  } = useGlobalState();

  // Authentication check - only redirect if loading is complete AND user is not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      console.log('🔐 Not authenticated after loading complete, redirecting to login');
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

  // Keyboard shortcuts for date navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      console.log('🎹 Key pressed:', {
        key: e.key,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        metaKey: e.metaKey
      });
      
      if (e.ctrlKey && (e.key === 'h' || e.key === 'l' || e.key === 'j')) {
        console.log('🎯 Ctrl + H/L/J key detected:', e.key);
        e.preventDefault();
        
        let newDate: Date;
        if (e.key === 'h') {
          console.log('⬅️ Going to previous day from:', date);
          newDate = new Date(date);
          newDate.setDate(newDate.getDate() - 1);
        } else if (e.key === 'l') {
          console.log('➡️ Going to next day from:', date);
          newDate = new Date(date);
          newDate.setDate(newDate.getDate() + 1);
        } else if (e.key === 'j') {
          console.log('📅 Going to today from:', date);
          newDate = new Date();
        } else {
          return; // Should never happen, but ensures newDate is always defined
        }
        console.log('📅 New date:', newDate);
        handleDateChange(newDate);
      }
    };

    console.log('🔧 Setting up keyboard listener');
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      console.log('🗑️ Removing keyboard listener');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [date, handleDateChange]);

  // Handle logout
  const handleLogout = () => {
    logout();
    router.push('/');
  };

  // Handle theme toggle
  const handleToggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  // Handle AI generation
  const handleGeneratePosts = async () => {
    // This will be called by the header button
    // The actual generation logic will be in the LogsComponent
    // We just trigger it via the window object (temporary solution)
    if ((window as any).handleSendToAI) {
      await (window as any).handleSendToAI();
    }
  };

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render dashboard if not authenticated (redirect is happening)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <SidebarProvider>
      <DashboardSidebar 
        activeSidebarItem={activeSidebarItem}
        onSidebarItemChange={handleSidebarItemChange}
        user={user}
        isSubscriptionCancelled={isSubscriptionCancelled()}
        lockedItems={lockedItems}
      />
      <SidebarInset className="flex flex-col h-screen">
        <DashboardHeader 
          date={date}
          onDateChange={handleDateChange}
          textSize={textSize}
          onTextSizeChange={handleTextSizeChange}
          user={user}
          theme={theme || 'light'}
          onToggleTheme={handleToggleTheme}
          onLogout={handleLogout}
          activeSidebarItem={activeSidebarItem}
          onGeneratePosts={handleGeneratePosts}
          isGenerateDisabled={!selectedText.trim() || aiLoading}
          isGenerating={aiLoading}
        />
        <div className="flex-1 h-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GlobalStateProvider>
      <DashboardContent>{children}</DashboardContent>
    </GlobalStateProvider>
  );
} 