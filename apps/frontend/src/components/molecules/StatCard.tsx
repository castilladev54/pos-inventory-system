import { ReactNode } from 'react';

type TrendDirection = 'up' | 'down' | 'neutral';

interface StatCardProps {
  icon?: ReactNode;
  label: string;
  value: string | number;
  trend?: string;
  trendDir?: TrendDirection;
  className?: string;
}

const trendColor: Record<TrendDirection, string> = {
  up:      'text-emerald-400',
  down:    'text-red-400',
  neutral: 'text-gray-400',
};

const StatCard = ({
  icon,
  label,
  value,
  trend,
  trendDir = 'neutral',
  className = '',
}: StatCardProps) => (
  <article
    className={`bg-[#1a1a24] border border-white/10 rounded-xl p-4 flex items-center gap-4 ${className}`}
  >
    {icon && (
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
        {icon}
      </div>
    )}

    <div className="min-w-0">
      <p className="text-gray-400 text-xs sm:text-sm truncate">{label}</p>
      <p className="text-xl sm:text-2xl font-bold text-white leading-tight">{value}</p>
      {trend && (
        <p className={`text-xs mt-0.5 ${trendColor[trendDir]}`}>{trend}</p>
      )}
    </div>
  </article>
);

export default StatCard;
