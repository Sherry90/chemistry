import type { ElementNumber } from './types';
import { getElement } from './registry';
import type { Locale } from '@/types/settings';

export function elementSymbolOf(n: ElementNumber): string {
  return getElement(n).symbol;
}

export function elementNameOf(n: ElementNumber, locale: Locale): string {
  const el = getElement(n);
  if (locale === 'ko') return el.nameKo;
  return el.nameEn;
}
