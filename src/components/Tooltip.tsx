// Phase 10 §6.11 — Tooltip (Radix). content 는 호출자가 i18n 처리(Phase 11).
// TooltipProvider 는 AppLayout 루트에 1회 (delayDuration 200ms 권장).
import type * as React from 'react';
import { forwardRef } from 'react';
import * as RTooltip from '@radix-ui/react-tooltip';
import { cn } from './_shared/classNames';

export const TooltipProvider = RTooltip.Provider;

export interface TooltipProps {
  readonly content: React.ReactNode;
  readonly children: React.ReactNode;
  readonly side?: 'top' | 'right' | 'bottom' | 'left';
  readonly delayDuration?: number;
}

export const Tooltip = forwardRef<HTMLButtonElement, TooltipProps>(function Tooltip(
  { content, children, side = 'top', delayDuration = 200 },
  ref,
) {
  return (
    <RTooltip.Root delayDuration={delayDuration}>
      <RTooltip.Trigger ref={ref} asChild>
        {children}
      </RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          sideOffset={6}
          className={cn(
            'z-50 rounded-md bg-bg-panel-elevated px-2 py-1 text-xs text-fg-primary',
            'border border-border shadow-md select-none',
            'data-[state=delayed-open]:animate-in data-[state=closed]:animate-out',
          )}
        >
          {content}
          <RTooltip.Arrow className="fill-border" />
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
});
