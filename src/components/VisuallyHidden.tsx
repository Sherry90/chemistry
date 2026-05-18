// Phase 10 §6.11 — VisuallyHidden (Radix). 스크린리더 전용 텍스트.
import type * as React from 'react';
import { forwardRef } from 'react';
import * as RVH from '@radix-ui/react-visually-hidden';

export type VisuallyHiddenProps = React.ComponentPropsWithoutRef<typeof RVH.Root>;

export const VisuallyHidden = forwardRef<HTMLSpanElement, VisuallyHiddenProps>(
  function VisuallyHidden(props, ref) {
    return <RVH.Root ref={ref} {...props} />;
  },
);
