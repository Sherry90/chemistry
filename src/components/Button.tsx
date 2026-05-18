// Phase 10 §6.11 — Button. Radix Slot(asChild) + 토큰 + loading. forwardRef.
import type * as React from 'react';
import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from './_shared/classNames';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly loading?: boolean;
  readonly iconStart?: React.ReactNode;
  readonly iconEnd?: React.ReactNode;
  readonly asChild?: boolean;
  readonly type?: 'button' | 'submit' | 'reset';
}

function buttonStyles(variant: ButtonVariant, size: ButtonSize): string {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:pointer-events-none';
  const variantClass: Record<ButtonVariant, string> = {
    primary: 'bg-accent text-accent-fg hover:bg-accent/90',
    secondary: 'bg-bg-panel-elevated text-fg-primary border border-border hover:bg-bg-panel',
    ghost: 'text-fg-primary hover:bg-bg-panel-elevated',
    danger: 'bg-error text-white hover:bg-error/90',
  };
  const sizeClass: Record<ButtonSize, string> = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
  };
  return cn(base, variantClass[variant], sizeClass[size]);
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading,
    iconStart,
    iconEnd,
    asChild,
    className,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : type}
      className={cn(buttonStyles(variant, size), className)}
      aria-busy={loading || undefined}
      disabled={loading || disabled}
      {...props}
    >
      {/* asChild=Slot 은 단일 자식 요구 (React.Children.only) — 아이콘 래핑은
          asChild 가 아닐 때만. asChild 시 호출자가 아이콘 합성 책임. */}
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <Spinner size="sm" /> : iconStart}
          {children}
          {iconEnd}
        </>
      )}
    </Comp>
  );
});
