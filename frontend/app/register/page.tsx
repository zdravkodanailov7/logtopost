'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function RegisterPage() {
  const { register, loading, createCheckoutSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check if user selected a plan before registering
    const plan = localStorage.getItem('selectedPlan');
    if (plan) {
      setSelectedPlan(plan);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    try {
      await register(email, password);
      
      // Clear the selected plan from localStorage
      localStorage.removeItem('selectedPlan');
      
      // If user had selected a plan, redirect to checkout
      if (selectedPlan) {
        toast.success('Account created! Redirecting to checkout...');
        try {
          const checkoutUrl = await createCheckoutSession(selectedPlan);
          window.location.href = checkoutUrl;
        } catch (checkoutError) {
          console.error('Checkout error:', checkoutError);
          toast.error('Failed to start checkout. Please try again from the dashboard.');
          router.push('/dashboard');
        }
      } else {
        toast.success('Account created successfully!');
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  };
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30">
        <div className="container mx-auto flex h-12 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#162216] transition-all duration-500 ease-in-out">
              <span className="text-lg font-bold text-[#00B23C]">LP</span>
            </div>
            <h1 className="text-xl font-semibold text-foreground transition-colors duration-500 ease-in-out">LogToPost</h1>
          </Link>
          
          <ThemeToggle />
        </div>
      </header>

      {/* Registration Form */}
      <main className="flex items-center justify-center min-h-[calc(100vh-3rem)] px-4">
        <div className="w-full max-w-sm">
          <div className="rounded border border-border bg-card p-8">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold text-foreground mb-2">Create Account</h2>
              {selectedPlan && (
                <p className="text-sm text-muted-foreground">
                  Creating account for <span className="font-medium text-primary">{selectedPlan}</span> plan
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
                  {error}
                </div>
              )}
              
              <div>
                <Input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full"
                />
              </div>
              
              <div>
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full"
                />
              </div>
              
              <div>
                <Input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full"
                />
              </div>

              <Button 
                type="submit" 
                disabled={loading}
                className="w-full cursor-pointer"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </Button>
            </form>
            
            <div className="text-center mt-6">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="text-primary hover:text-primary/80 font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 