// Phase 11 — panels-local className 머지 (clsx + tailwind-merge). @/components
// _shared/classNames 는 components 내부 전용(eslint §7.2) 이므로 panels 자체 보유
// (phase-10 §5.4 "외부 cn 필요 시 Phase 11 결정" → 본 Phase = panels-local).
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
