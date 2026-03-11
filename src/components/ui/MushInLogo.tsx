import React from 'react';

/* ── MUSHIN Icon — self-contained, works on dark AND light backgrounds ── */
export const MushInIcon = ({ size = 32, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}
    xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="mi-blade" x1="16" y1="3" x2="16" y2="16" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#DDB6FF"/>
        <stop offset="100%" stopColor="#9955EE"/>
      </linearGradient>
      <filter id="mi-jglow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="0.8" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    {/* Opaque dark body — renders correctly on any background color */}
    <path d="M16 1L31 16L16 31L1 16Z" fill="#0A0416" stroke="#9B4FE8" strokeWidth="1.1"/>
    {/* Upper blade */}
    <path d="M16 5.5 L19.8 15.5 L16 14.2 L12.2 15.5 Z" fill="url(#mi-blade)"/>
    {/* Lower shard */}
    <path d="M16 26.5 L12.8 17 L16 18 L19.2 17 Z" fill="#7C3AED" opacity="0.45"/>
    {/* Tsuba crossguard */}
    <line x1="10.5" y1="16" x2="21.5" y2="16" stroke="#A855F7" strokeWidth="1.3" strokeLinecap="round"/>
    {/* Jewel */}
    <circle cx="16" cy="16" r="2.6" fill="#8B3FD4" filter="url(#mi-jglow)"/>
    <circle cx="16" cy="16" r="1.4" fill="#DDB6FF"/>
  </svg>
);

/* ── MUSHIN Full Wordmark Logo ── */
export const MushInLogo = ({
  height = 40,
  className = '',
  iconOnly = false,
}: {
  height?: number;
  className?: string;
  iconOnly?: boolean;
}) => {
  if (iconOnly) return <MushInIcon size={height} className={className}/>;
  const w = Math.round(height * 5);
  return (
    <svg width={w} height={height} viewBox="0 0 200 40" fill="none" className={className}
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ml-blade" x1="20" y1="3" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#DDB6FF"/>
          <stop offset="100%" stopColor="#9955EE"/>
        </linearGradient>
        <linearGradient id="ml-txt" x1="52" y1="0" x2="200" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF"/>
          <stop offset="55%" stopColor="#DDB6FF"/>
          <stop offset="100%" stopColor="#A855F7"/>
        </linearGradient>
        <filter id="ml-jg" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="0.7" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* Icon mark */}
      <path d="M20 2L38 20L20 38L2 20Z" fill="#0A0416" stroke="#9B4FE8" strokeWidth="1.2"/>
      <path d="M20 7 L24 19 L20 17.5 L16 19 Z" fill="url(#ml-blade)"/>
      <path d="M20 33 L16.5 21.5 L20 23 L23.5 21.5 Z" fill="#7C3AED" opacity="0.45"/>
      <line x1="13" y1="20" x2="27" y2="20" stroke="#A855F7" strokeWidth="1.3" strokeLinecap="round"/>
      <circle cx="20" cy="20" r="2.5" fill="#8B3FD4" filter="url(#ml-jg)"/>
      <circle cx="20" cy="20" r="1.3" fill="#DDB6FF"/>
      {/* Wordmark */}
      <text x="50" y="27"
        fontFamily="'Inter','Helvetica Neue',Arial,sans-serif"
        fontWeight="800"
        fontSize="18"
        letterSpacing="3.5"
        fill="url(#ml-txt)">MUSHIN</text>
    </svg>
  );
};

export default MushInLogo;
