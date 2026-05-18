// Phase 10 §6.11 — Label (Radix). htmlFor 연결 + 클릭 포커스 무료.
import type * as React from 'react';
import { forwardRef } from 'react';
import * as RLabel from '@radix-ui/react-label';
import { cn } from './_shared/classNames';

export type LabelProps = React.ComponentPropsWithoutRef<typeof RLabel.Root>;

export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { className, ...props },
  ref,
) {
  return (
    <RLabel.Root
      ref={ref}
      className={cn('text-sm font-medium text-fg-primary', className)}
      {...props}
    />
  );
});
