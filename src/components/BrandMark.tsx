import React from 'react';

interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  subtitle?: string;
}

export const BrandMark: React.FC<BrandMarkProps> = ({
  size = 'md',
  showWordmark = true,
  subtitle = 'Global Exchange',
}) => {
  const dim = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';

  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <div
        className={`${dim} shrink-0 rounded-lg border border-[#F0B90B]/40 bg-[#181A20] dark:bg-[#0B0E11] flex items-center justify-center shadow-sm`}
      >
        <svg viewBox="0 0 36 36" fill="none" className="w-5 h-5" aria-hidden="true">
          <path
            d="M18 3L31 10.5V25.5L18 33L5 25.5V10.5L18 3Z"
            stroke="#F0B90B"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M18 9L25.5 23.5H21.2L18 16.8L14.8 23.5H10.5L18 9Z"
            fill="#F0B90B"
          />
          <path
            d="M13 26.5H23"
            stroke="#0ECB81"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      {showWordmark && (
        <div className="leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="font-bold tracking-tight text-slate-900 dark:text-[#EAECEF] text-sm">
              AUREX
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#B8860B] dark:text-[#F0B90B]">
              {subtitle}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-[#848E9C] tracking-tight">
            Multi-Asset & Cold Vault
          </p>
        </div>
      )}
    </div>
  );
};
