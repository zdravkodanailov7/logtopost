import { Package, Shield, Crown, LucideIcon } from 'lucide-react';

export interface PlanOption {
  name: string;
  icon: LucideIcon;
  color: string;
  price: number;
  currency: string;
  generations: number;
  features: string[];
  popular?: boolean;
}

export const PLAN_OPTIONS: Record<string, PlanOption> = {
  basic: {
    name: 'Basic',
    icon: Package,
    color: 'text-green-500',
    price: 7.99,
    currency: '£',
    generations: 50,
    features: ['50 generations/month', 'Core features']
  },
  pro: {
    name: 'Pro',
    icon: Shield,
    color: 'text-purple-500',
    price: 14.99,
    currency: '£',
    generations: 150,
    features: ['150 generations/month', 'Custom AI prompts'],
    popular: true
  },
  advanced: {
    name: 'Advanced',
    icon: Crown,
    color: 'text-amber-500',
    price: 24.99,
    currency: '£',
    generations: 500,
    features: ['500 generations/month', 'Custom AI prompts']
  }
};

export const TRIAL_PLAN = {
  name: 'Free Trial',
  generations: 10,
  duration: 7, // days
  features: ['10 generations total', '7 days trial period']
}; 