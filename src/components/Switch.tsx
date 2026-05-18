// Phase 10 §6.11 — Switch (Radix). aria-checked + Space/Enter 토글 무료.
import type * as React from 'react';
import { forwardRef } from 'react';
import * as RSwitch from '@radix-ui/react-switch';
import { cn } from './_shared/classNames';

export type SwitchProps = React.ComponentPropsWithoutRef<typeof RSwitch.Root>;

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { className, ...props },
  ref,
) {
  return (
    <RSwitch.Root
      ref={ref}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        'bg-bg-panel-elevated data-[state=checked]:bg-accent',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        className,
      )}
      {...props}
    >
      <RSwitch.Thumb
        className={cn(
          'block h-4 w-4 translate-x-0.5 rounded-full bg-bg-panel transition-transform',
          'data-[state=checked]:translate-x-[1.125rem]',
        )}
      />
    </RSwitch.Root>
  );
});
