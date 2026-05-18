// Phase 10 §2.1 — IconButton (Button 위, 정사각 아이콘 전용). aria-label 필수.
import type * as React from 'react';
import { forwardRef } from 'react';
import { Button, type ButtonProps } from './Button';
import { cn } from './_shared/classNames';

export interface IconButtonProps extends Omit<ButtonProps, 'iconStart' | 'iconEnd' | 'children'> {
  /** 접근성 필수 — 아이콘만 있으므로 시각 텍스트 없음. */
  readonly 'aria-label': string;
  readonly children: React.ReactNode; // 아이콘 element
}

const SQUARE: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'w-8 px-0',
  md: 'w-10 px-0',
  lg: 'w-12 px-0',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { size = 'md', variant = 'ghost', className, children, ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      size={size}
      variant={variant}
      className={cn(SQUARE[size], className)}
      {...props}
    >
      {children}
    </Button>
  );
});
