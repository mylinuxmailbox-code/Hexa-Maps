import React from 'react';

export function HexaLogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hexaBrandGrad" x1="16" y1="10" x2="112" y2="118" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="55%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>
      <path
        d="M64 8L110 34.5V81.5L64 120L18 81.5V34.5L64 8Z"
        fill="url(#hexaBrandGrad)"
        stroke="#111827"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <polygon points="64,26 92,42 92,74 64,90 36,74 36,42" fill="#111827" />
      <path
        d="M44 68L64 38L84 68"
        stroke="#FBBF24"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="64" cy="64" r="7.5" fill="#FFFFFF" />
    </svg>
  );
}
