import { Crown, LucideIcon } from 'lucide-react';

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
  premium: {
    name: 'Premium',
    icon: Crown,
    color: 'text-purple-500',
    price: 9.99,
    currency: '£',
    generations: 100,
    features: ['100 generations/month', 'Core features', 'Custom AI prompts'],
    popular: true
  }
}; 