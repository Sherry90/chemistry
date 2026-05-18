// Phase 10 §6.11 — Tabs (Radix). ←/→ nav + aria-selected 무료.
import type * as React from 'react';
import { forwardRef } from 'react';
import * as RTabs from '@radix-ui/react-tabs';
import { cn } from './_shared/classNames';

export type TabsProps = React.ComponentPropsWithoutRef<typeof RTabs.Root>;

export function Tabs({ className, ...props }: TabsProps) {
  return <RTabs.Root className={cn('flex flex-col', className)} {...props} />;
}

export const TabsList = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof RTabs.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <RTabs.List
      ref={ref}
      className={cn('flex gap-1 border-b border-border', className)}
      {...props}
    />
  );
});

export type TabsTriggerProps = React.ComponentPropsWithoutRef<typeof RTabs.Trigger>;

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(function TabsTrigger(
  { className, ...props },
  ref,
) {
  return (
    <RTabs.Trigger
      ref={ref}
      className={cn(
        'px-3 py-2 text-sm text-fg-muted border-b-2 border-transparent',
        'data-[state=active]:border-accent data-[state=active]:text-fg-primary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        className,
      )}
      {...props}
    />
  );
});

export const TabsContent = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof RTabs.Content>
>(function TabsContent({ className, ...props }, ref) {
  return (
    <RTabs.Content
      ref={ref}
      className={cn('flex-1 py-3 focus-visible:outline-none', className)}
      {...props}
    />
  );
});
