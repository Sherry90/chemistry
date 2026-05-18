// Phase 10 §6.11 — Separator (Radix). 의미/장식 구분 무료.
import type * as React from 'react';
import { forwardRef } from 'react';
import * as RSeparator from '@radix-ui/react-separator';
import { cn } from './_shared/classNames';

export type SeparatorProps = React.ComponentPropsWithoutRef<typeof RSeparator.Root>;

export const Separator = forwardRef<HTMLDivElement, SeparatorProps>(function Separator(
  { className, orientation = 'horizontal', ...props },
  ref,
) {
  return (
    <RSeparator.Root
      ref={ref}
      orientation={orientation}
      className={cn(
        'bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  );
});
