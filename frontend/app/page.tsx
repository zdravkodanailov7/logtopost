"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import * as motion from "motion/react-client";
import { FaXTwitter } from "react-icons/fa6";
import { Loader2, Check } from "lucide-react";
import SplitText from "@/components/ui/split-text";
import { Counter, CounterRef } from "@/components/counter";
import GradientText from "@/components/ui/gradient-text";
import { PLAN_OPTIONS } from "@/lib/plans";

// Environment variable to control app mode
const APP_MODE = process.env.NEXT_PUBLIC_APP_MODE || 'waitlist'; // 'waitlist' or 'live'

const formSchema = z.object({
  email: z
    .string({ required_error: "Email address is required." })
    .email("Please enter a valid email address."),
});

type FormValues = z.infer<typeof formSchema>;

function WaitlistForm({ onUserAdded }: { onUserAdded?: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);
    form.clearErrors(); // clear errors

    const validationResult = formSchema.safeParse(data);

    if (!validationResult.success) {
      // Show validation errors as toasts
      validationResult.error.errors.forEach((error) => {
        toast.error(error.message);
        form.setError(error.path[0] as keyof FormValues, {
          type: "manual",
          message: error.message,
        });
      });
      setIsSubmitting(false);
      return;
    }

    // Start timer for minimum loading time
    const startTime = Date.now();
    const minLoadingTime = 1000; // 1 second

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/emails/waitlist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validationResult.data),
      });

      let responseBody = {};
      try {
        // 204
        const text = await response.text();
        if (text) {
          responseBody = JSON.parse(text);
        }
      } catch (parseError) {
        console.error("Failed to parse response body:", parseError);
        if (!response.ok) {
          throw new Error(
            `HTTP error ${response.status}: ${
              response.statusText || "Request failed"
            }`
          );
        }
      }

      if (!response.ok) {
        throw new Error(
          (responseBody as { error?: string })?.error ||
            `Request failed with status: ${response.status}`
        );
      }

      // Ensure minimum loading time has passed
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minLoadingTime - elapsedTime);
      
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      if ((responseBody as { alreadyExists?: boolean })?.alreadyExists) {
        toast.info("You're already on the waitlist!");
      } else {
        toast.success(
          (responseBody as { message?: string })?.message ||
            "Successfully joined the waitlist!"
        );
        // Trigger counter refetch when a new user is added
        onUserAdded?.();
      }
      form.reset();
    } catch (error) {
      // Ensure minimum loading time has passed even for errors
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minLoadingTime - elapsedTime);
      
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      toast.error(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <motion.form
        onSubmit={form.handleSubmit(onSubmit)}
        className="relative flex w-full max-w-md flex-col gap-3 sm:flex-row"
        initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 2, type: "spring" }}
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormControl>
                <Input
                  placeholder="Enter your email"
                  type="email"
                  autoComplete="email"
                  className="h-11 rounded-md"
                  aria-label="Email address for waitlist"
                  aria-invalid={!!form.formState.errors.email}
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-11 shrink-0 rounded-md px-6 font-medium cursor-pointer"
          aria-live="polite"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" />
              Joining...
            </>
          ) : (
            "Join Waitlist"
          )}
        </Button>
      </motion.form>
    </Form>
  );
}

function ProcessSection() {
  return (
    <motion.div
      className="w-full max-w-4xl mx-auto mb-16"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.1 }}
    >
      <h2 className="text-2xl font-semibold text-center mb-8">How It Works</h2>
      <div className="grid md:grid-cols-2 gap-8 items-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-semibold">1</span>
          </div>
          <h3 className="text-lg font-medium mb-2">Write logs on absolutely anything</h3>
          <p className="text-muted-foreground">Capture your thoughts, experiences, and ideas in your own words</p>
        </div>
        <div className="text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-semibold">2</span>
          </div>
          <h3 className="text-lg font-medium mb-2">Convert them to X posts</h3>
          <p className="text-muted-foreground">Transform your raw thoughts into engaging posts that sound like you</p>
        </div>
      </div>
    </motion.div>
  );
}

function ProblemSolutionSection() {
  return (
    <motion.div
      className="w-full max-w-5xl mx-auto mb-16"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.15 }}
    >
      <div className="grid md:grid-cols-2 gap-12 items-center">
        {/* Without App - Problems */}
        <div className="text-center md:text-right">
          <h3 className="text-xl font-semibold mb-6 text-destructive">Without LogToPost</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3 md:justify-end">
              <span className="text-muted-foreground">Spending hours constructing the perfect tweet</span>
              <span className="text-destructive font-bold">×</span>
            </div>
            <div className="flex items-center gap-3 md:justify-end">
              <span className="text-muted-foreground">Staring at a blank compose window</span>
              <span className="text-destructive font-bold">×</span>
            </div>
            <div className="flex items-center gap-3 md:justify-end">
              <span className="text-muted-foreground">Overthinking what to write and if you should post</span>
              <span className="text-destructive font-bold">×</span>
            </div>
            <div className="flex items-center gap-3 md:justify-end">
              <span className="text-muted-foreground">Inconsistent posting due to writer's block</span>
              <span className="text-destructive font-bold">×</span>
            </div>
          </div>
        </div>

        {/* With App - Solutions */}
        <div className="text-center md:text-left">
          <h3 className="text-xl font-semibold mb-6 text-primary">With LogToPost</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-primary font-bold">✓</span>
              <span className="text-muted-foreground">Simply review and approve generated posts</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-primary font-bold">✓</span>
              <span className="text-muted-foreground">No more blank page syndrome</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-primary font-bold">✓</span>
              <span className="text-muted-foreground">Just click post or skip - that's it</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-primary font-bold">✓</span>
              <span className="text-muted-foreground">Consistent content that sounds like you</span>
            </div>
          </div>
        </div>
      </div>
      
             <div className="text-center mt-8 p-6 bg-muted/30 rounded-xl">
         <GradientText className="text-xl font-medium">
           Stop overthinking. Start posting.
         </GradientText>
       </div>
    </motion.div>
  );
}

function PricingSection() {
  const { isAuthenticated, createCheckoutSession } = useAuth();
  const router = useRouter();

  // Get the single Premium plan
  const plan = PLAN_OPTIONS.premium;
  const formattedPlan = {
    name: plan.name,
    price: `${plan.currency}${plan.price}`,
    generations: plan.generations,
    features: plan.features.map(feature => feature.replace('generations/month', 'post generations per month')),
    popular: plan.popular
  };

  const handleGetStarted = async () => {
    if (isAuthenticated) {
      // Create checkout session for premium plan
      try {
        const checkoutUrl = await createCheckoutSession('premium');
        window.location.href = checkoutUrl;
      } catch (error) {
        console.error('Checkout error:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to start checkout');
      }
    } else {
      // Store the selected plan and redirect to register
      localStorage.setItem('selectedPlan', 'premium');
      router.push('/register');
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      <ProcessSection />
      <ProblemSolutionSection />
      
      <motion.div
        className="flex justify-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      >
        <motion.div
          className="relative rounded-lg border p-8 border-primary bg-primary/5 max-w-md w-full"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
            <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
              Premium Plan
            </span>
          </div>
          
          <div className="text-center">
            <h3 className="text-2xl font-semibold mb-3">{formattedPlan.name}</h3>
            <div className="mb-6">
              <span className="text-4xl font-bold">{formattedPlan.price}</span>
              <span className="text-muted-foreground text-lg">/month</span>
            </div>
            <p className="text-muted-foreground mb-8 text-lg">
              {formattedPlan.generations} generations per month
            </p>
          </div>

          <ul className="space-y-4 mb-10">
            {formattedPlan.features.map((feature, featureIndex) => (
              <li key={featureIndex} className="flex items-center gap-3">
                <Check className="h-5 w-5 text-primary flex-shrink-0" />
                <span className="text-base">{feature}</span>
              </li>
            ))}
          </ul>

          <Button 
            onClick={handleGetStarted}
            className="w-full cursor-pointer bg-primary hover:bg-primary/90 text-lg py-6"
          >
            Start 7 Day Free Trial
          </Button>
        </motion.div>
      </motion.div>

      <motion.div
        className="text-center mt-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.6 }}
      >
        <p className="text-sm text-muted-foreground mb-2">
          Start with a 7-day free trial • 10 generations included
        </p>
        <p className="text-sm text-muted-foreground">
          Includes access to our AI-powered content generation engine and custom AI prompts
        </p>
      </motion.div>
    </div>
  );
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const counterRef = useRef<CounterRef>(null);

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

  const handleUserAdded = () => {
    counterRef.current?.refetch();
  };

  return (
    <>
      <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="font-semibold text-lg">
            Log to Post
          </div>
          <Button variant="ghost" onClick={() => router.push('/login')} className="cursor-pointer">
            Log In
          </Button>
        </div>
      </nav>
      
      <div className="flex flex-col min-h-screen justify-center items-center text-center px-6 py-12">
        <div className="mb-8">
          <SplitText className="text-5xl tracking-tighter font-medium mb-4">
            Turn Your Daily Thoughts Into Great Content
          </SplitText>
          <SplitText className="tracking-tight text-xl text-muted-foreground">
            Transform your raw thoughts into engaging posts that sound authentically like you.
          </SplitText>
        </div>

        {APP_MODE === 'waitlist' ? (
          // Waitlist Mode - Email Collection
          <>
            <WaitlistForm onUserAdded={handleUserAdded} />
            <div className="mt-4">
              <Counter ref={counterRef} />
            </div>
          </>
        ) : (
          // Live Mode - Pricing Plans
          <PricingSection />
        )}
      </div>
      
      <footer className="w-full py-8 text-center">
        <Button size="icon" variant="ghost" className="cursor-pointer">
          <Link href="https://x.com/zdanailov7" target="_blank">
            <FaXTwitter />
          </Link>
        </Button>
      </footer>
    </>
  );
}
