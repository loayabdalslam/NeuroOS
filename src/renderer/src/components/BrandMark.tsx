import { memo } from 'react';

/** The Neuro mark: a nucleus inside three offset orbital arcs. */
export const BrandMark = memo(function BrandMark({
  size = 22,
  animated = false,
  mono = false,
}: {
  size?: number;
  animated?: boolean;
  mono?: boolean;
}): JSX.Element {
  const id = mono ? 'nm' : 'ng';
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden className={animated ? 'brand-mark brand-mark--animated' : 'brand-mark'}>
      <defs>
        <linearGradient id={`${id}-grad`} x1="4" y1="3" x2="28" y2="29" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--n-accent)" />
          <stop offset="0.55" stopColor="var(--n-violet)" />
          <stop offset="1" stopColor="var(--n-accent-strong)" />
        </linearGradient>
        <radialGradient id={`${id}-core`} cx="0.4" cy="0.35" r="0.8">
          <stop stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.55" stopColor="var(--n-accent)" />
          <stop offset="1" stopColor="var(--n-accent-strong)" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="4.2" fill={`url(#${id}-core)`} />
      <ellipse cx="16" cy="16" rx="13" ry="6.2" stroke={`url(#${id}-grad)`} strokeWidth="1.5" opacity="0.9" transform="rotate(-24 16 16)" />
      <ellipse cx="16" cy="16" rx="13" ry="6.2" stroke={`url(#${id}-grad)`} strokeWidth="1.2" opacity="0.55" transform="rotate(48 16 16)" />
      <ellipse cx="16" cy="16" rx="13" ry="6.2" stroke={`url(#${id}-grad)`} strokeWidth="0.9" opacity="0.32" transform="rotate(112 16 16)" />
      <circle cx="27.2" cy="9.4" r="1.5" fill="var(--n-accent)" />
      <circle cx="5.6" cy="23.4" r="1.1" fill="var(--n-violet)" />
    </svg>
  );
});

export function Wordmark({ compact = false }: { compact?: boolean }): JSX.Element {
  return (
    <span className="wordmark">
      <BrandMark size={compact ? 18 : 20} />
      <span className="wordmark__text display uppercase">Neuro<span className="wordmark__os">OS</span></span>
    </span>
  );
}
