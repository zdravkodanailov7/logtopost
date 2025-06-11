"use client";

import { ChevronDown, Moon, Sun, LogOut } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface UserDropdownProps {
    userEmail?: string;
    theme?: string;
    onToggleTheme: () => void;
    onLogout: () => void;
}

export default function UserDropdown({ 
    userEmail, 
    theme, 
    onToggleTheme, 
    onLogout 
}: UserDropdownProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 rounded-lg px-2 py-1 hover:text-accent-foreground cursor-pointer flex-1 min-w-0 focus:outline-none focus:ring-0">
                    <span className="truncate text-xs flex-1 text-left">{userEmail || 'User'}</span>
                    <ChevronDown className="h-2.5 w-2.5 flex-shrink-0" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                side="right"
                align="start"
                className="w-44"
            >
                <DropdownMenuItem onClick={onToggleTheme} className="cursor-pointer text-xs">
                    {theme === 'light' ? (
                        <Moon className="mr-2 h-2.5 w-2.5" />
                    ) : (
                        <Sun className="mr-2 h-2.5 w-2.5" />
                    )}
                    <span>Switch to {theme === 'light' ? 'dark' : 'light'} mode</span>
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-xs">
                    <LogOut className="mr-2 h-2.5 w-2.5" />
                    <span>Log out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
} 