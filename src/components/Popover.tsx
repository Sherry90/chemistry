// Phase 10 §6.11 — Popover (Radix). portal + focus + Esc/외부클릭 무료.
import type * as React from 'react';
import { forwardRef } from 'react';
import * as RPopover from '@radix-ui/react-popover';
import { cn } from './_shared/classNames';

export const Popover = RPopover.Root;
export const PopoverTrigger = RPopover.Trigger;

export type PopoverContentProps = React.ComponentPropsWithoutRef<typeof RPopover.Content>;

export const PopoverContent = forwardRef<HTMLDivElement, PopoverContentProps>(
  function PopoverContent({ className, align = 'center', sideOffset = 6, ...props }, ref) {
    return (
      <RPopover.Portal>
        <RPopover.Content
          ref={ref}
          align={align}
          sideOffset={sideOffset}
          className={cn(
            'z-50 rounded-md border border-border bg-bg-panel p-3 shadow-md',
            'focus:outline-none data-[state=open]:animate-in',
            className,
          )}
          {...props}
        />
      </RPopover.Portal>
    );
  },
);
