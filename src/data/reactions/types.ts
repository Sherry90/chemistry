import type {
  ReactionRule,
  RuleCategory,
  ReactionRuleLicense,
  RuleConfidence,
  ThermoFlag,
} from '@/chemistry/reactions/types';

// Phase 06 §4.5 — 청크 (카테고리별).
export interface ReactionChunkFile {
  readonly version: string; // ISO8601 build timestamp
  readonly category: RuleCategory;
  readonly rules: ReadonlyArray<ReactionRule>;
}

export interface ReactionLicenseSummaryEntry {
  readonly license: ReactionRuleLicense;
  readonly count: number;
  readonly attributionUrl: string | null;
}

export interface ReactionCategoryMeta {
  readonly chunk: string;
  readonly count: number;
  readonly priorityRange: readonly [number, number];
  readonly requiredElementsUnion: ReadonlyArray<number>;
}

// 직렬화 매니페스트 엔트리 (JSON; ElementNumber 브랜드는 런타임 캐스트).
export interface SerializedReactionManifestEntry {
  readonly id: string;
  readonly category: RuleCategory;
  readonly priority: number;
  readonly confidence: RuleConfidence;
  readonly thermo: ThermoFlag;
  readonly requiresPh: boolean;
  readonly requiredElements: ReadonlyArray<number>;
  readonly chunk: string;
}

export interface ReactionManifest {
  readonly version: string;
  readonly totalRules: number;
  readonly licenseSummary: ReadonlyArray<ReactionLicenseSummaryEntry>;
  readonly categories: Readonly<Record<RuleCategory, ReactionCategoryMeta>>;
  readonly entries: ReadonlyArray<SerializedReactionManifestEntry>;
}
