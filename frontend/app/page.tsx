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

function PricingSection() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const plans = [
    {
      name: "Basic",
      price: "£7.99",
      generations: 50,
      features: [
        "50 post generations per month",
        "All core features",
        "Email support"
      ]
    },
    {
      name: "Pro",
      price: "£14.99",
      generations: 150,
      features: [
        "150 post generations per month",
        "Priority support", 
        "Custom AI prompts",
        "Advanced analytics"
      ],
      popular: true
    },
    {
      name: "Advanced",
      price: "£24.99",
      generations: 500,
      features: [
        "500 post generations per month",
        "Priority support",
        "Custom AI prompts", 
        "Advanced analytics",
        "Early access to new features"
      ]
    }
  ];

  const handleGetStarted = () => {
    if (isAuthenticated) {
      router.push('/dashboard');
    } else {
      router.push('/register');
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      <motion.div
        className="grid md:grid-cols-3 gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      >
        {plans.map((plan, index) => (
          <motion.div
            key={plan.name}
            className={`relative rounded-lg border p-6 ${
              plan.popular 
                ? 'border-primary bg-primary/5 scale-105' 
                : 'border-border bg-card'
            }`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium">
                  Most Popular
                </span>
              </div>
            )}
            
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
              <div className="mb-4">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="text-muted-foreground mb-6">
                {plan.generations} generations per month
              </p>
            </div>

            <ul className="space-y-3 mb-8">
              {plan.features.map((feature, featureIndex) => (
                <li key={featureIndex} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>

            <Button 
              onClick={handleGetStarted}
              className={`w-full ${
                plan.popular 
                  ? 'bg-primary hover:bg-primary/90' 
                  : 'bg-secondary hover:bg-secondary/80'
              }`}
            >
              Get Started
            </Button>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        className="text-center mt-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.6 }}
      >
        <p className="text-sm text-muted-foreground mb-4">
          🆓 Start with a 7-day free trial • 10 generations included
        </p>
        <p className="text-xs text-muted-foreground">
          All plans include access to our AI-powered content generation engine
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

      <footer className="sticky top-[100vh]">
        <Button size="icon" variant="ghost" className="cursor-pointer">
          <Link href="https://x.com/zdanailov7" target="_blank">
            <FaXTwitter />
          </Link>
        </Button>
      </footer>
    </div>
  );
}
