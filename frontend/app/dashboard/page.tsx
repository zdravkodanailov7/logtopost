"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useGlobalState } from '@/contexts/GlobalStateContext';
import LogsComponent from '@/components/LogsComponent';
import PostsComponent from '@/components/PostsComponent';
import { ProfileComponent } from '@/components/ProfileComponent';
import { BillingComponent } from '@/components/BillingComponent';

export default function DashboardPage() {
  const { isAuthenticated } = useAuth();
  const { date, textSize, activeSidebarItem } = useGlobalState();

  // Don't render anything if not authenticated (layout handles this)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      {/* Conditional Content Based on Active Sidebar Item */}
      {activeSidebarItem === 'logs' && (
        <LogsComponent 
          date={date}
          textSize={textSize}
        />
      )}
      {activeSidebarItem === 'posts' && <PostsComponent date={date} />}
      {activeSidebarItem === 'billing' && <BillingComponent />}
      {activeSidebarItem === 'profile' && <ProfileComponent />}
    </>
  );
} 