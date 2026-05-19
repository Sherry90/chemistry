// Phase 11 §4.4 / D-CONDITIONS-UNITS — 표시 단위 변환 (저장은 K/atm 고정).
// 순수 + 라운드트립 안전.
import type { UnitSystem } from '@/stores';

export function kelvinToCelsius(k: number): number {
  return k - 273.15;
}
export function celsiusToKelvin(c: number): number {
  return c + 273.15;
}
export function atmToPa(a: number): number {
  return a * 101325;
}
export function paToAtm(p: number): number {
  return p / 101325;
}

export interface ConditionRanges {
  readonly temperature: { readonly min: number; readonly max: number; readonly step: number };
  readonly pressure: { readonly min: number; readonly max: number; readonly step: number };
}

export function rangesFor(units: UnitSystem): ConditionRanges {
  return {
    temperature:
      units.temperature === 'K'
        ? { min: 100, max: 1000, step: 5 }
        : { min: -173, max: 727, step: 5 },
    pressure:
      units.pressure === 'atm'
        ? { min: 0.1, max: 10, step: 0.1 }
        : { min: 10132, max: 1013250, step: 5066 },
  };
}
