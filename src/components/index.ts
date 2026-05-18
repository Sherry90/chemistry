// Phase 10 §5.4 — @/components 공개 배럴 (primitives). _shared/classNames 미노출.
// Phase 01 의 ErrorBoundary/LocaleToggle/ThemeToggle 은 직접 경로 import 유지
// (본 배럴 비대상 — 기존 호출부 불변).
export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { IconButton } from './IconButton';
export type { IconButtonProps } from './IconButton';

export { Tooltip, TooltipProvider } from './Tooltip';
export type { TooltipProps } from './Tooltip';

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from './Dialog';
export type { DialogRootProps, DialogContentProps, DialogSize } from './Dialog';

export { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';
export type { TabsProps, TabsTriggerProps } from './Tabs';

export { Slider } from './Slider';
export type { SliderProps } from './Slider';

export { Switch } from './Switch';
export type { SwitchProps } from './Switch';

export { Spinner } from './Spinner';
export type { SpinnerProps, SpinnerSize } from './Spinner';

export { Input } from './Input';
export type { InputProps } from './Input';

export { Popover, PopoverTrigger, PopoverContent } from './Popover';
export type { PopoverContentProps } from './Popover';

export { Separator } from './Separator';
export type { SeparatorProps } from './Separator';

export { Label } from './Label';
export type { LabelProps } from './Label';

export { VisuallyHidden } from './VisuallyHidden';
export type { VisuallyHiddenProps } from './VisuallyHidden';
