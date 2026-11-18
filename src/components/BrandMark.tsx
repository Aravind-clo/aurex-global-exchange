import React from 'react';

interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  subtitle?: string;
}

export const BrandMark: React.FC<BrandMarkProps> = ({
  size = 'md',
  showWordmark = true,
  subtitle = 'Exchange',
}) => {
  const dim = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';

  return (
    <div className="inline-flex items-center gap-2.5 select-none shrink-0">
      <div
        className={`${dim} shrink-0 rounded-lg border border-[#F59E0B]/35 bg-[#090A0D] flex items-center justify-center`}
      >
        <svg viewBox="0 0 36 36" fill="none" className="w-5 h-5" aria-hidden="true">
          <path
            d="M18 3.5L32.5 18L18 32.5L3.5 18L18 3.5Z"
            stroke="url(#nuvraPrismStroke)"
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
          <path
            d="M12 24.5V11.5L24 24.5V11.5"
            stroke="#EAECEF"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="18" cy="3.5" r="1.6" fill="#F59E0B" />
          <defs>
            <linearGradient id="nuvraPrismStroke" x1="3.5" y1="3.5" x2="32.5" y2="32.5" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F59E0B" />
              <stop offset="1" stopColor="#10B981" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      {showWordmark && (
        <div className="leading-tight whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <span className="font-bold tracking-tight text-slate-900 dark:text-[#EAECEF] text-sm">
              NUVRA
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#B8860B] dark:text-[#F59E0B]">
              {subtitle}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-[#848E9C] tracking-tight">
            REA Custody & Markets
          </p>
        </div>
      )}
    </div>
  );
};
