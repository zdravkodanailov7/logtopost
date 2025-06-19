"use client";

import { useState, useEffect } from 'react';
import { ComponentPropsWithoutRef, CSSProperties, FC } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Button } from '@/components/ui/button';
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    LogOut,
    ChevronDown,
    Home,
    FileText,
    BarChart3,
    Settings,
    Moon,
    Sun,
    MessageSquare,
} from 'lucide-react';
import {
    Sidebar,
    SidebarContent,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
} from '@/components/ui/sidebar';
import Link from "next/link";
import LogsComponent from '@/components/LogsComponent';
import PostsComponent from '@/components/PostsComponent';
import { ProfileComponent } from '@/components/ProfileComponent';
import UserDropdown from '@/components/UserDropdown';

export default function DashboardPage() {
    const { user, logout, loading, isAuthenticated } = useAuth();
    const router = useRouter();
    const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
    const [activeSidebarItem, setActiveSidebarItem] = useState('logs');
    const { theme, setTheme } = useTheme();

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!loading && !isAuthenticated) {
            router.push('/login');
        }
    }, [loading, isAuthenticated, router]);

    const handleLogout = () => {
        logout();
        router.push('/');
    };

    const toggleTheme = () => {
        setTheme(theme === 'light' ? 'dark' : 'light');
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
            title: "Profile",
            key: "profile",
            icon: Settings,
        },
    ];

    return (
        <SidebarProvider>
            <Sidebar>
                <SidebarHeader className="h-7 flex items-center justify-center bg-muted/50">
                    <div className="flex items-center space-x-2 w-full">
                        <UserDropdown 
                            userEmail={user?.email}
                            theme={theme}
                            onToggleTheme={toggleTheme}
                            onLogout={handleLogout}
                        />
                    </div>
                </SidebarHeader>
                <SidebarContent className="pt-4 px-1 bg-muted/50">
                    <SidebarMenu className="">
                        {menuItems.map((item) => (
                            <SidebarMenuItem key={item.title} className="">
                                <SidebarMenuButton 
                                    isActive={activeSidebarItem === item.key}
                                    tooltip={item.title}
                                    className={`px-3 py-3 rounded-lg transition-colors cursor-pointer ${
                                        activeSidebarItem === item.key 
                                            ? 'bg-accent text-accent-foreground' 
                                            : 'hover:text-foreground hover:bg-transparent'
                                    }`}
                                    onClick={() => setActiveSidebarItem(item.key)}
                                >
                                    <item.icon />
                                    <span>{item.title}</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarContent>
            </Sidebar>
            <SidebarInset className="flex flex-col h-screen">
                <div className="flex-1 h-0">
                    {/* Conditional Content Based on Active Sidebar Item */}
                    {activeSidebarItem === 'logs' && (
                        <LogsComponent />
                    )}
                    {activeSidebarItem === 'posts' && (
                        <PostsComponent />
                    )}
                    {activeSidebarItem === 'profile' && (
                        <ProfileComponent />
                    )}
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
} 