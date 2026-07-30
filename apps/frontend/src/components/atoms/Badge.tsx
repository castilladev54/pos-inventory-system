import { ReactNode } from 'react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
  warning: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  danger:  'bg-red-500/15 text-red-400 border border-red-500/20',
  info:    'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  neutral: 'bg-white/5 text-gray-400 border border-white/10',
};

const Badge = ({ variant = 'neutral', children, className = '' }: BadgeProps) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}>
    {children}
  </span>
);

export default Badge;
