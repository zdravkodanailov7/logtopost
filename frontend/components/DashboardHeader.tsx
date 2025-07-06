"use client";

import { ChevronLeft, ChevronRight, Wand2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import UserDropdown from '@/components/UserDropdown';

interface DashboardHeaderProps {
  date: Date;
  onDateChange: (date: Date) => void;
  textSize: 'small' | 'medium' | 'large';
  onTextSizeChange: (size: 'small' | 'medium' | 'large') => void;
  user: any;
  theme: string;
  onToggleTheme: () => void;
  onLogout: () => void;
  activeSidebarItem: string;
  // Optional props for specific views
  onGeneratePosts?: () => void;
  isGenerateDisabled?: boolean;
  isGenerating?: boolean;
}

export function DashboardHeader({
  date,
  onDateChange,
  textSize,
  onTextSizeChange,
  user,
  theme,
  onToggleTheme,
  onLogout,
  activeSidebarItem,
  onGeneratePosts,
  isGenerateDisabled,
  isGenerating
}: DashboardHeaderProps) {
  
  // Show date navigation for logs/posts only
  const showDateNav = activeSidebarItem === 'logs' || activeSidebarItem === 'posts';
  // Show generate button for logs only  
  const showGenerateButton = activeSidebarItem === 'logs';
  // Show text size for logs only
  const showTextSize = activeSidebarItem === 'logs';

  const goToPrevious = () => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() - 1);
    onDateChange(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + 1);
    onDateChange(newDate);
  };

  const goToToday = () => {
    const newDate = new Date();
    onDateChange(newDate);
  };

  // Get display text for current text size
  const getTextSizeDisplay = () => {
    switch (textSize) {
      case 'small': return 'S';
      case 'medium': return 'M';
      case 'large': return 'L';
      default: return 'S';
    }
  };

  // Cycle through text sizes
  const handleTextSizeClick = () => {
    const nextSize = textSize === 'small' ? 'medium' : 
                    textSize === 'medium' ? 'large' : 'small';
    onTextSizeChange(nextSize);
  };

  // Format date for display (e.g., "02/12/2025")
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="w-full border-border p-1 flex-shrink-0 flex justify-between items-center bg-muted/50 h-10">
      {/* Left side - Date navigation and controls */}
      <div className="flex items-center gap-1">
        {showDateNav && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPrevious}
              className="flex items-center text-xs py-0.5 px-1 h-auto border-none cursor-pointer"
            >
              <ChevronLeft className="h-2.5 w-2.5" />
            </Button>
            
            <h1 
              className="text-xs font-normal text-foreground cursor-pointer hover:text-primary transition-colors"
              onClick={goToToday}
            >
              {formatDate(date)}
            </h1>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={goToNext}
              className="flex items-center text-xs py-0.5 px-1 h-auto border-none cursor-pointer"
            >
              <ChevronRight className="h-2.5 w-2.5" />
            </Button>
          </>
        )}

        {showTextSize && (
          <button
            onClick={handleTextSizeClick}
            className="ml-3 px-2 py-1 w-6 text-xs font-medium text-foreground hover:text-primary cursor-pointer transition-colors flex items-center justify-center"
          >
            {getTextSizeDisplay()}
          </button>
        )}
        
        {showGenerateButton && onGeneratePosts && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onGeneratePosts}
                  disabled={isGenerateDisabled || isGenerating}
                  className="ml-2 cursor-pointer"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {isGenerating 
                    ? "Generating posts..." 
                    : "Generate posts from selected text"
                  }
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Right side - Profile dropdown - always show */}
      <div className="flex items-center">
        <UserDropdown 
          userEmail={user?.email}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onLogout={onLogout}
        />
      </div>
    </div>
  );
} 