"use client";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add keyboard shortcut for development login access
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        if (isAuthenticated) {
          router.push('/dashboard');
        } else {
          router.push('/login');
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isAuthenticated, router]);

  // Auto-hide notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  return (
    <div className="min-h-screen bg-background transition-all duration-500 ease-in-out">
      {/* Header with Login/Register buttons */}
      <header className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30 transition-all duration-500 ease-in-out">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#162216] transition-all duration-500 ease-in-out">
              <span className="text-lg font-bold text-[#00B23C]">LP</span>
            </div>
            <h1 className="text-xl font-semibold text-foreground transition-colors duration-500 ease-in-out">LogToPost</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex flex-col items-center overflow-hidden transition-all duration-500 ease-in-out">
        {/* Hero */}
        <section className="container flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-6 text-center">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-sm text-muted-foreground transition-all duration-500 ease-in-out">
              <span className="mr-2">🚀</span>
              LogToPost is coming soon
            </div>
            
            <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl transition-colors duration-500 ease-in-out">
              Turn your{" "}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent transition-all duration-500 ease-in-out">
                daily logs
              </span>{" "}
              into scroll-stopping posts
            </h1>
            
            <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground sm:text-xl transition-colors duration-500 ease-in-out">
              We're building the easiest way to track your ideas and transform them into content worth sharing. Join the waitlist to get early access.
            </p>
            
            {/* Notification */}
            {notification && (
              <div className={`
                mx-auto mb-6 max-w-md rounded-lg border p-4 transition-all duration-500 ease-in-out
                ${notification.type === 'success' 
                  ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200' 
                  : notification.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200'
                  : 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200'
                }
              `}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {notification.type === 'success' && (
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                      {notification.type === 'error' && (
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      )}
                      {notification.type === 'info' && (
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium">{notification.message}</p>
                    </div>
                  </div>
                  <div className="ml-auto pl-3">
                    <button
                      onClick={() => setNotification(null)}
                      className="inline-flex rounded-md p-1.5 hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:hover:bg-white/5"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Email signup */}
            <form
              className="flex flex-col gap-4 sm:flex-row sm:justify-center"
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const email = formData.get('email') as string;
                
                setIsSubmitting(true);
                setNotification(null);
                
                try {
                  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/emails/waitlist`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email }),
                  });
                  
                  const data = await response.json();
                  
                  if (response.ok) {
                    if (data.alreadyExists) {
                      setNotification({
                        type: 'info',
                        message: "You're already on the waitlist! We'll keep you updated."
                      });
                    } else {
                      setNotification({
                        type: 'success',
                        message: "Success! You've been added to the waitlist. We'll notify you when LogToPost is ready!"
                      });
                    }
                    (e.target as HTMLFormElement).reset();
                  } else {
                    setNotification({
                      type: 'error',
                      message: data.error || 'Something went wrong. Please try again.'
                    });
                  }
                } catch (error) {
                  console.error('Error submitting email:', error);
                  setNotification({
                    type: 'error',
                    message: 'Network error. Please check your connection and try again.'
                  });
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              <input
                name="email"
                type="email"
                required
                disabled={isSubmitting}
                placeholder="you@example.com"
                className="w-full rounded-md border border-border bg-background px-4 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary sm:w-80 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <Button 
                size="lg" 
                type="submit" 
                disabled={isSubmitting}
                className="text-base cursor-pointer transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Joining...' : 'Join Waitlist'}
              </Button>
            </form>
            
            <div className="mt-8 text-sm text-muted-foreground transition-colors duration-500 ease-in-out">
              No spam, just early access updates.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
