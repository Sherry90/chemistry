// Phase 10 §4.7 / §6.11 — Dialog (Radix). focus trap/Esc/portal 무료.
// DialogContent 가 i18nTitleKey 필수 (a11y). description 미지정 시 Radix 경고
// 회피 위해 VisuallyHidden 빈 Description 렌더.
import type * as React from 'react';
import { forwardRef } from 'react';
import * as RDialog from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import { cn } from './_shared/classNames';

export interface DialogRootProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogRootProps) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </RDialog.Root>
  );
}

export const DialogTrigger = RDialog.Trigger;
export const DialogClose = RDialog.Close;
export const DialogTitle = RDialog.Title;
export const DialogDescription = RDialog.Description;

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly i18nTitleKey: string;
  readonly i18nDescriptionKey?: string;
  readonly size?: DialogSize;
}

const SIZE: Record<DialogSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  full: 'max-w-[95vw] h-[90vh]',
};

export const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(function DialogContent(
  { i18nTitleKey, i18nDescriptionKey, size = 'md', className, children, ...props },
  ref,
) {
  const { t } = useTranslation('common');
  return (
    <RDialog.Portal>
      <RDialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in" />
      <RDialog.Content
        ref={ref}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'w-full rounded-lg border border-border bg-bg-panel p-6 shadow-lg',
          'focus:outline-none',
          SIZE[size],
          className,
        )}
        {...props}
      >
        <RDialog.Title className="text-base font-semibold text-fg-primary">
          {t(i18nTitleKey)}
        </RDialog.Title>
        {i18nDescriptionKey ? (
          <RDialog.Description className="mt-1 text-sm text-fg-muted">
            {t(i18nDescriptionKey)}
          </RDialog.Description>
        ) : (
          // Radix 1.1+ 는 Description 부재 시 경고 — 빈 설명으로 무음 처리.
          <RDialog.Description className="sr-only" />
        )}
        <div className="mt-4">{children}</div>
      </RDialog.Content>
    </RDialog.Portal>
  );
});
