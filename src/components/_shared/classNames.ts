// Phase 10 §6.11 — Tailwind class 머지. clsx (조건부 결합) + tailwind-merge
// (conflicting utility 해소: 'p-4 p-6' → 'p-6'). @/components barrel 미노출
// (외부는 primitive 만 사용; 외부 cn 필요 시 Phase 11 가 @/utils/cn 결정).
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
