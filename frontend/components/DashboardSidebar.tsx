"use client";

import {
  FileText,
  MessageSquare,
  CreditCard,
  Settings,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useRouter } from 'next/navigation';
interface DashboardSidebarProps {
  activeSidebarItem: string;
  onSidebarItemChange: (item: string) => void;
  user: any;
  isSubscriptionCancelled: boolean;
  lockedItems: string[];
}

export function DashboardSidebar({
  activeSidebarItem,
  onSidebarItemChange,
  user,
  isSubscriptionCancelled,
  lockedItems
}: DashboardSidebarProps) {
  const router = useRouter();
  const menuItems = [
    {
      title: "Logs",
      key: "logs",
      icon: FileText,
    },
    {
      title: "Posts",
      key: "posts",
      icon: MessageSquare,
    },
    {
      title: "Billing",
      key: "billing",
      icon: CreditCard,
    },
    {
      title: "Profile",
      key: "profile",
      icon: Settings,
    },
  ];

  return (
    <Sidebar className="border-none">
      <SidebarHeader className="h-10 flex items-start justify-center bg-muted/50 px-2">
        <div className="text-md font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => router.push('/')}>
          LogToPost
        </div>
      </SidebarHeader>
      <SidebarContent className="pt-2 px-1 bg-muted/50">
        <SidebarMenu className="">
          {menuItems.map((item) => {
            const isLocked = isSubscriptionCancelled && lockedItems.includes(item.key);
            const isActive = activeSidebarItem === item.key;
            
            return (
              <SidebarMenuItem key={item.title} className="">
                <SidebarMenuButton 
                  isActive={isActive}
                  tooltip={isLocked ? `${item.title} (Subscription Required)` : item.title}
                  className={`px-3 py-3 rounded-lg transition-colors ${
                    isLocked 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'cursor-pointer'
                  } ${
                    isActive
                      ? 'bg-accent text-accent-foreground' 
                      : 'hover:text-foreground hover:bg-transparent'
                  }`}
                  onClick={() => !isLocked && onSidebarItemChange(item.key)}
                >
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
} 