import type { Element, ElementNumber } from './types';
import { isValidElementNumber, validateElementsPayload } from './validation';
import rawData from '@/data/elements/elements.json';

function buildRegistry(): {
  byNumber: ReadonlyMap<number, Element>;
  bySymbol: ReadonlyMap<string, Element>;
  all: readonly Element[];
} {
  const validated = validateElementsPayload(rawData);
  if (!validated.ok) {
    throw new Error(`Element data validation failed:\n${validated.error.join('\n')}`);
  }
  const elements = validated.value;
  const byNumber = new Map<number, Element>();
  const bySymbol = new Map<string, Element>();
  for (const el of elements) {
    byNumber.set(el.number, el);
    bySymbol.set(el.symbol, el);
  }
  return { byNumber, all: elements, bySymbol };
}

const registry = buildRegistry();

export function getElement(n: ElementNumber): Element {
  const el = registry.byNumber.get(n);
  if (!el) throw new RangeError(`No element with atomic number ${n}`);
  return el;
}

export function getElementUnsafe(n: number): Element | undefined {
  return registry.byNumber.get(n);
}

export function getElementBySymbol(symbol: string): Element | undefined {
  return registry.bySymbol.get(symbol);
}

export function getAllElements(): readonly Element[] {
  return registry.all;
}

export { isValidElementNumber };
