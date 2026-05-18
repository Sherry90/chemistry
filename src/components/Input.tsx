// Phase 10 §2.1 — Input (자체 native + 토큰). aria-invalid/describedby 지원.
import type * as React from 'react';
import { forwardRef } from 'react';
import { cn } from './_shared/classNames';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  readonly invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'h-10 w-full rounded-md border bg-bg-panel px-3 text-sm text-fg-primary',
        'placeholder:text-fg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        'disabled:opacity-50',
        invalid ? 'border-error' : 'border-border',
        className,
      )}
      {...props}
    />
  );
});
