// Phase 10 §2.1 — Spinner (자체, Radix 미사용). LoadingOverlay/Button loading.
import type * as React from 'react';
import { forwardRef } from 'react';
import { cn } from './_shared/classNames';

export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  readonly size?: SpinnerSize;
}

const SIZE: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

export const Spinner = forwardRef<SVGSVGElement, SpinnerProps>(function Spinner(
  { size = 'md', className, ...props },
  ref,
) {
  return (
    <svg
      ref={ref}
      role="progressbar"
      aria-busy="true"
      viewBox="0 0 24 24"
      fill="none"
      className={cn('animate-spin text-accent', SIZE[size], className)}
      {...props}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
});
