"use client";
import { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import * as motion from "motion/react-client";

export interface CounterRef {
  refetch: () => Promise<void>;
}

export const Counter = forwardRef<CounterRef>((props, ref) => {
  const [count, setCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0); // For re-animating when count changes

  const fetchCount = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/waitlist/count`);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch count: ${response.status} ${response.statusText}`
        );
      }
      const data = await response.json();

      if (typeof data.count !== "number") {
        throw new Error("Invalid count received from API");
      }

      const newCount = data.count;
      if (newCount !== count) {
        setKey(prev => prev + 1); // Trigger re-animation for new count
      }
      setCount(newCount);
    } catch (err) {
      console.error("Error fetching waitlist count:", err);
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
      setCount(null);
    } finally {
      setIsLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    refetch: fetchCount,
  }));

  useEffect(() => {
    fetchCount();
  }, []);

  if (isLoading) {
    return <div className="h-6" aria-live="polite"></div>;
  }

  if (error) {
    return null;
  }

  if (count === null) {
    return null;
  }

  return (
    <motion.p
      key={key} // Re-animate when key changes
      initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.8, type: "spring" }}
      className="text-sm text-muted-foreground"
      aria-live="polite"
    >
      Join <span className="font-bold">{count.toLocaleString()}</span>+ others
      who signed up
    </motion.p>
  );
});