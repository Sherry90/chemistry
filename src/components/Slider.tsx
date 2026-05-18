// Phase 10 §6.11 — Slider (Radix). role=slider + aria-value* + 키 step 무료.
import type * as React from 'react';
import { forwardRef } from 'react';
import * as RSlider from '@radix-ui/react-slider';
import { cn } from './_shared/classNames';

export type SliderProps = React.ComponentPropsWithoutRef<typeof RSlider.Root>;

export const Slider = forwardRef<HTMLSpanElement, SliderProps>(function Slider(
  { className, ...props },
  ref,
) {
  return (
    <RSlider.Root
      ref={ref}
      className={cn('relative flex h-5 w-full touch-none select-none items-center', className)}
      {...props}
    >
      <RSlider.Track className="relative h-1 w-full grow rounded-full bg-bg-panel-elevated">
        <RSlider.Range className="absolute h-full rounded-full bg-accent" />
      </RSlider.Track>
      <RSlider.Thumb
        className={cn(
          'block h-4 w-4 rounded-full border border-border bg-bg-panel shadow',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        )}
      />
    </RSlider.Root>
  );
});
