// Phase 08 §6.3.2 / §8.3 — CPK 색 (Phase 02 Element 메타 위).
import { getElement } from '@/chemistry/elements';
import type { ElementNumber } from '@/chemistry/elements/types';

/** Element.cpkColorHex 그대로 (`#RRGGBB`). */
export function cpkColorOf(element: ElementNumber): `#${string}` {
  return getElement(element).cpkColorHex;
}

export interface BondSplitColors {
  /** A→mid cylinder 색. */
  readonly a: `#${string}`;
  /** mid→B cylinder 색. */
  readonly b: `#${string}`;
  /** 양 끝 원소 동일 → 1 cyl 최적화 가능 (P7 별개). */
  readonly single: boolean;
}

export function bondSplitColors(elementA: ElementNumber, elementB: ElementNumber): BondSplitColors {
  const a = cpkColorOf(elementA);
  const b = cpkColorOf(elementB);
  return { a, b, single: elementA === elementB };
}

/** `#RRGGBB` → [r,g,b] 0..1 (InstancedBufferAttribute('color',3) 용). */
export function hexToRgb01(hex: `#${string}`): readonly [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}
