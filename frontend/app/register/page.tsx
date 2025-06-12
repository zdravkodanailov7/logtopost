'use client';

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
// import { useAuth } from "@/contexts/AuthContext";
// import { useState } from "react";
// import { useRouter } from "next/navigation";

export default function RegisterPage() {
  // const { register, loading } = useAuth();
  // const [email, setEmail] = useState('');
  // const [password, setPassword] = useState('');
  // const [confirmPassword, setConfirmPassword] = useState('');
  // const [error, setError] = useState('');
  // const router = useRouter();

  // const handleSubmit = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   setError('');

  //   if (password !== confirmPassword) {
  //     setError('Passwords do not match');
  //     return;
  //   }

  //   if (password.length < 6) {
  //     setError('Password must be at least 6 characters long');
  //     return;
  //   }

  //   try {
  //     await register(email, password);
  //     router.push('/'); // Redirect to home page after successful registration
  //   } catch (err) {
  //     setError(err instanceof Error ? err.message : 'Registration failed');
  //   }
  // };
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30">
        <div className="container mx-auto flex h-12 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center space-x-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
              <span className="text-xs font-bold text-primary-foreground">L</span>
            </div>
            <h1 className="text-sm font-semibold text-foreground">LogToPost</h1>
          </Link>
          
          <ThemeToggle />
        </div>
      </header>

      {/* Temporarily Disabled Message */}
      <main className="flex items-center justify-center min-h-[calc(100vh-3rem)] px-4">
        <div className="w-full max-w-sm">
          <div className="rounded border border-border bg-card p-8 text-center">
            <div className="mb-6">
              <div className="text-4xl mb-4">🚧</div>
              <h2 className="text-lg font-bold text-foreground mb-2">Registration Temporarily Disabled</h2>
              <p className="text-sm text-muted-foreground mb-4">
                We're busy teaching our servers how to make the perfect digital sandwich. 
                They're almost ready, but they keep arguing about whether the pickles go on top or bottom! 🥪
              </p>
              <p className="text-xs text-muted-foreground">
                Come back soon - we promise it'll be worth the wait!
              </p>
            </div>

            <div className="space-y-3">
              <Button disabled className="w-full h-8 text-xs opacity-50 cursor-not-allowed">
                Create account (Coming Soon!)
              </Button>
              
              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  Already have an account?{" "}
                  <Link href="/login" className="text-primary hover:text-primary/80 font-medium cursor-pointer">
                    Sign in
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 