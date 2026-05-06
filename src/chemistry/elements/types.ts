import type { Brand } from '@/types/brand';

export type ElementNumber = Brand<number, 'ElementNumber'>;
export type Block = 's' | 'p' | 'd' | 'f';
export type ElementCategory =
  | 'alkali-metal'
  | 'alkaline-earth-metal'
  | 'transition-metal'
  | 'post-transition-metal'
  | 'metalloid'
  | 'reactive-nonmetal'
  | 'noble-gas'
  | 'lanthanide'
  | 'actinide'
  | 'unknown';
export type StandardState = 'solid' | 'liquid' | 'gas' | 'unknown';
export type Occurrence = 'primordial' | 'from-decay' | 'synthetic';

export interface IsotopeSummary {
  readonly massNumber: number;
  readonly exactMass: number;
  readonly abundance: number | null;
  readonly halfLifeSeconds: number | null;
}

export interface Element {
  readonly number: ElementNumber;
  readonly symbol: string;
  readonly nameEn: string;
  readonly nameKo: string;
  readonly atomicMass: number;
  readonly electronConfigCondensed: string;
  readonly electronConfigFull: string;
  readonly electronegativity: number | null;
  readonly firstIonizationEnergyEV: number | null;
  readonly electronAffinityEV: number | null;
  readonly covalentRadiusPm: number;
  readonly vdwRadiusPm: number | null;
  readonly period: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly group: number | null;
  readonly block: Block;
  readonly category: ElementCategory;
  readonly standardState: StandardState;
  readonly meltingPointK: number | null;
  readonly boilingPointK: number | null;
  readonly densityGPerCm3: number | null;
  readonly occurrence: Occurrence;
  readonly isRadioactive: boolean;
  readonly primaryIsotope: IsotopeSummary;
  readonly cpkColorHex: `#${string}`;
  readonly yearDiscovered: number | null;
}
