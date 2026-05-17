// Phase 08 §6.2.2 — covalent radius → Å 환산 (Phase 02 Element 메타).
import { getElement } from '@/chemistry/elements';
import type { ElementNumber } from '@/chemistry/elements/types';
import { ATOM_RADIUS_SCALE } from './constants';

/** covalentRadiusPm → Å. */
export function covalentRadiusAngstrom(element: ElementNumber): number {
  return getElement(element).covalentRadiusPm / 100;
}

/** ball-and-stick 구 표시 반지름 (Å). */
export function atomDisplayRadius(element: ElementNumber): number {
  return covalentRadiusAngstrom(element) * ATOM_RADIUS_SCALE;
}
