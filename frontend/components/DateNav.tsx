import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DateNavProps {
    date: Date;
    onPrevious: () => void;
    onNext: () => void;
}

export function DateNav({ date, onPrevious, onNext }: DateNavProps) {
    // Format date for display (e.g., "02/12/2025")
    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric'
        });
    };

    return (
        <div className="w-full border-border p-1 flex-shrink-0">
            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onPrevious}
                    className="flex items-center text-xs py-0.5 px-1 h-auto border-none cursor-pointer"
                >
                    <ChevronLeft className="h-2.5 w-2.5" />
                </Button>
                
                <h1 className="text-xs font-normal text-foreground">
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
            </div>
        </div>
    );
} 