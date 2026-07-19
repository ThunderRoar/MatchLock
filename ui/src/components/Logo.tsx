// The MatchLock mark: a thin-line padlock with a continuous shackle and two
// arrows converging at a center seam ("match"), in a violet→cyan neon gradient.

import React from 'react';

export const Logo: React.FC<{ size?: number; glow?: boolean }> = ({ size = 32, glow = true }) => {
  const gid = React.useId();
  const stroke = `url(#${gid}-vc)`;
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" aria-label="MatchLock">
      <defs>
        <linearGradient id={`${gid}-vc`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b7cff" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
        {glow && (
          <filter id={`${gid}-g`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>
      <g
        filter={glow ? `url(#${gid}-g)` : undefined}
        stroke={stroke}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* continuous shackle */}
        <path d="M70 104 V86 A30 30 0 0 1 130 86 V104" />
        {/* body */}
        <rect x="50" y="104" width="100" height="76" rx="16" fill="#0d0d18" />
        {/* center seam */}
        <path d="M100 120 V164" strokeWidth="6" />
        {/* left arrow -> */}
        <path d="M62 142 H90 M82 134 L92 142 L82 150" strokeWidth="7" />
        {/* right arrow <- */}
        <path d="M138 142 H110 M118 134 L108 142 L118 150" strokeWidth="7" />
      </g>
    </svg>
  );
};
