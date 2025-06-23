import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Wand2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DateNavProps {
    date: Date;
    onPrevious: () => void;
    onNext: () => void;
    onDateClick?: () => void;
    onGeneratePosts?: () => void;
    isGenerateDisabled?: boolean;
    showGenerateButton?: boolean;
}

export function DateNav({ 
    date, 
    onPrevious, 
    onNext, 
    onDateClick, 
    onGeneratePosts, 
    isGenerateDisabled = false,
    showGenerateButton = false 
}: DateNavProps) {
    // Format date for display (e.g., "02/12/2025")
    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric'
        });
    };

    return (
        <div className="w-full border-border p-1 flex-shrink-0 flex justify-center">
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
                
                {showGenerateButton && onGeneratePosts && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onGeneratePosts}
                                    disabled={isGenerateDisabled}
                                    className="ml-2 cursor-pointer"
                                >
                                    <Wand2 className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Generate posts from selected text</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>
        </div>
    );
} 