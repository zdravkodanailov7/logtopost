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
import { Loader2 } from "lucide-react";
import SplitText from "@/components/ui/split-text";
import { Counter, CounterRef } from "@/components/counter";
import { SmoothCursor } from "@/components/ui/smooth-cursor";
import { MorphingText } from "@/components/ui/morphing-text";

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
    <div className="flex flex-col h-screen justify-center items-center text-center px-6">
      <SmoothCursor />
      <div className="mb-8">
        <SplitText className="text-5xl tracking-tighter font-medium mb-4">
          Turn Your Daily Thoughts Into Great Content
        </SplitText>
        <SplitText className="tracking-tight text-xl text-muted-foreground">
          Transform your raw thoughts into engaging posts that sound authentically like you.
        </SplitText>
      </div>
      <WaitlistForm onUserAdded={handleUserAdded} />
      <div className="mt-4">
        <Counter ref={counterRef} />
      </div>

      <div className="mt-24">
        <MorphingText className="tracking-tight text-[1.4rem] text-muted-foreground w-[400px]" texts={[
          "Stop overthinking your posts.",
          "Stop staring at blank screens.", 
          "Stop wondering what to say.",
          "Just share your raw thoughts.",
          "We'll make them shine.",
          "Authentic. Engaging. You.",
          "Content that actually converts."
        ]} />
      </div>
      <footer className="sticky top-[100vh]">
        <Button size="icon" variant="ghost" className="cursor-pointer">
          <Link href="https://x.com/logtopost" target="_blank">
            <FaXTwitter />
          </Link>
        </Button>
      </footer>
    </div>
  );
}
