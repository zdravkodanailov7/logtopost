import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Wand2, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import UserDropdown from '@/components/UserDropdown';

interface DateNavProps {
    date: Date;
    onPrevious: () => void;
    onNext: () => void;
    onDateClick?: () => void;
    onGeneratePosts?: () => void;
    isGenerateDisabled?: boolean;
    isGenerating?: boolean;
    showGenerateButton?: boolean;
    textSize?: 'small' | 'medium' | 'large';
    onTextSizeChange?: (size: 'small' | 'medium' | 'large') => void;
    // Profile dropdown props
    userEmail?: string;
    theme?: string;
    onToggleTheme?: () => void;
    onLogout?: () => void;
}

export function DateNav({ 
    date, 
    onPrevious, 
    onNext, 
    onDateClick, 
    onGeneratePosts, 
    isGenerateDisabled = false,
    isGenerating = false,
    showGenerateButton = false,
    textSize = 'small',
    onTextSizeChange,
    userEmail,
    theme,
    onToggleTheme,
    onLogout
}: DateNavProps) {
    // Format date for display (e.g., "02/12/2025")
    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric'
        });
    };

    // Cycle through text sizes
    const handleTextSizeClick = () => {
        if (!onTextSizeChange) return;
        
        const nextSize = textSize === 'small' ? 'medium' : 
                        textSize === 'medium' ? 'large' : 'small';
        onTextSizeChange(nextSize);
    };

    // Get display text for current size
    const getTextSizeDisplay = () => {
        switch (textSize) {
            case 'small': return 'S';
            case 'medium': return 'M';
            case 'large': return 'L';
            default: return 'S';
        }
    };

    return (
        <div className="w-full border-border p-1 flex-shrink-0 flex justify-between items-center bg-muted/50">
            {/* Left side - Date navigation and controls */}
            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onPrevious}
                    className="flex items-center text-xs py-0.5 px-1 h-auto border-none cursor-pointer"
                >
                    <ChevronLeft className="h-2.5 w-2.5" />
                </Button>
                
                <h1 
                    className={`text-xs font-normal text-foreground ${onDateClick ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
                    onClick={onDateClick}
                >
                    {formatDate(date)}
                </h1>
                
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onNext}
                    className="flex items-center text-xs py-0.5 px-1 h-auto border-none cursor-pointer"
                >
                    <ChevronRight className="h-2.5 w-2.5" />
                </Button>

                {onTextSizeChange && (
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

            {/* Right side - Profile dropdown */}
            {userEmail && theme && onToggleTheme && onLogout && (
                <div className="flex items-center">
                    <UserDropdown 
                        userEmail={userEmail}
                        theme={theme}
                        onToggleTheme={onToggleTheme}
                        onLogout={onLogout}
                    />
                </div>
            )}
        </div>
    );
} 