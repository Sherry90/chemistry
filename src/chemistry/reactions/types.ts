import type { Molecule } from '@/chemistry/compounds/types';
import type { ElementNumber } from '@/chemistry/elements/types';

export interface Condition {
  readonly temperatureK: number;
  readonly pressureAtm: number;
  readonly pH: number | null;
}

export type ThermoFlag = 'exothermic' | 'endothermic' | 'unknown';

// Phase 06 — U1 Minimal 확정 (3 카테고리).
export type RuleCategory =
  | 'acid-base-neutralization'
  | 'esterification-hydrolysis'
  | 'simple-redox';

export const ALL_RULE_CATEGORIES: ReadonlyArray<RuleCategory> = [
  'acid-base-neutralization',
  'esterification-hydrolysis',
  'simple-redox',
];

// Phase 06 — U2 라이선스 화이트리스트 (모두 호환 가능한 허용/약카피레프트).
export type ReactionRuleLicense =
  | 'Apache-2.0'
  | 'BSD-3-Clause'
  | 'BSD-2-Clause'
  | 'MIT'
  | 'CC-BY-4.0'
  | 'CC0-1.0'
  | 'in-house';

export const ALL_REACTION_RULE_LICENSES: ReadonlyArray<ReactionRuleLicense> = [
  'Apache-2.0',
  'BSD-3-Clause',
  'BSD-2-Clause',
  'MIT',
  'CC-BY-4.0',
  'CC0-1.0',
  'in-house',
];

export type RuleConfidence = 'high' | 'medium' | 'low';

export interface ReactionRule {
  readonly id: string; // (Phase 01)
  readonly smarts: string; // (Phase 01) Reaction SMARTS
  readonly conditionRange: Partial<{
    readonly temperatureK: readonly [number, number];
    readonly pressureAtm: readonly [number, number];
    readonly pH: readonly [number, number];
  }>;
  readonly thermo: ThermoFlag; // (Phase 01)
  readonly source: string; // (Phase 01)

  // ─── Phase 06 신규 ───
  readonly priority: number; // (Phase 01 TODO 클로즈) 0 = 최고. 동률은 id 사전순.
  readonly confidence: RuleConfidence; // (Phase 01 TODO 클로즈)
  readonly categories: ReadonlyArray<RuleCategory>; // (P7) prefilter 용
  readonly version: string; // (P7) 매니페스트 version 과 동일. 캐시 무효화 키 component (P8)
  readonly license: ReactionRuleLicense; // (U2) 출처 라이선스 화이트리스트
  readonly requiredElements: ReadonlyArray<ElementNumber>; // prefilter 가속 — 필수 원소
}

export type ReactionPredictionKind = 'rule-based' | 'heuristic-experimental';

export interface ReactionResult {
  readonly products: ReadonlyArray<Molecule>;
  readonly kind: ReactionPredictionKind;
  readonly appliedRuleId: string | null;
  readonly thermo: ThermoFlag;
  readonly notes: string | null; // i18n 키 (해석된 문자열 아님 — 엔진 UI 비의존, arch §3.4)

  // ─── Phase 06 신규 (§4.6) ───
  readonly confidence: number; // 0..1 — rule-based: ruleConfidenceToScore, heuristic: HEURISTIC_CONFIDENCE
}

// Phase 06 §4.5 — 매니페스트만으로 prefilter 가능한 경량 엔트리.
// chemistry 계층 정의 → data 가 합법적으로 import (arch §4.1, data→engine 역행 없음).
export interface ReactionManifestEntry {
  readonly id: string;
  readonly category: RuleCategory;
  readonly priority: number;
  readonly confidence: RuleConfidence;
  readonly thermo: ThermoFlag;
  readonly requiresPh: boolean; // condition.pH 필요 여부 사전 계산
  readonly requiredElements: ReadonlyArray<ElementNumber>;
  readonly chunk: string;
}

// Phase 06 §5.2 — chemistry 계층 정의 (data/engine 양쪽 import 가능).
export interface RuleSearchOptions {
  readonly categories?: ReadonlyArray<RuleCategory>;
  readonly requiresPh?: boolean | null; // null = 무관
  readonly minPriority?: number;
  readonly requiredElementsSubsetOf?: ReadonlyArray<ElementNumber>;
}
