// Phase 07 §4.4 — uiStore 상태 타입.
import type { Compound } from '@/chemistry/compounds/types';
import type { PubChemError } from '@/services/pubchem';
import type { AsyncState } from './_shared/types';

export type PanelKey =
  | 'periodic-table'
  | 'compound-browser'
  | 'conditions'
  | 'molecule-info'
  | 'reaction-result'
  | 'toolbar'
  | 'text-input'; // Phase 12

export type TextInputMode = 'smiles' | 'inchi' | 'formula';

export interface TextInputSeed {
  readonly kind: TextInputMode;
  readonly raw: string;
}

export type NotificationLevel = 'info' | 'success' | 'warn' | 'error';

export interface Notification {
  readonly id: string; // crypto.randomUUID()
  readonly level: NotificationLevel;
  readonly messageKey: string; // i18n 키 (common.json)
  readonly messageParams?: Readonly<Record<string, string | number>>;
  readonly createdAt: number;
  readonly dismissAfterMs: number | null; // null = 사용자 dismiss 까지 유지
}

export type CompoundSearchMode = 'name' | 'cid' | 'formula';

export interface CompoundSearchSlice {
  readonly query: string;
  readonly mode: CompoundSearchMode;
  readonly results: AsyncState<ReadonlyArray<Compound>, PubChemError>;
  readonly selectedCid: number | null; // 미리보기 강조
}

export interface UiStoreState {
  /**
   * 3D 뷰포트 선택 — 각 string 은 Phase 08 의 composite ViewportId
   * (`${MoleculeId}::a:${AtomId}` / `${MoleculeId}::b:${BondId}`). 본 store 는
   * string 으로만 다루고 도메인 의미는 viewport 헬퍼가 디코드 시 부여.
   */
  readonly selection: {
    readonly atomIds: ReadonlyArray<string>;
    readonly bondIds: ReadonlyArray<string>;
  };

  readonly panels: {
    readonly active: PanelKey | null;
    readonly isCompoundBrowserOpen: boolean;
    readonly isPeriodicTableOpen: boolean;
    readonly isReactionResultOpen: boolean;
    readonly isTextInputOpen: boolean; // Phase 12
    readonly textInputInitial: TextInputSeed | null; // Phase 12
  };

  readonly viewport: {
    readonly showAtomLabels: boolean; // 기본 false
    readonly backgroundOverride: 'theme' | 'light' | 'dark';
  };

  /** 전역 로딩 카운터 — 어떤 비동기 액션이든 inc/dec. */
  readonly globalLoading: { readonly count: number };

  readonly notifications: ReadonlyArray<Notification>;

  readonly compoundSearch: CompoundSearchSlice;
}

export function makeInitialUiState(): UiStoreState {
  return {
    selection: { atomIds: [], bondIds: [] },
    panels: {
      active: null,
      isCompoundBrowserOpen: false,
      isPeriodicTableOpen: false,
      isReactionResultOpen: false,
      isTextInputOpen: false,
      textInputInitial: null,
    },
    viewport: { showAtomLabels: false, backgroundOverride: 'theme' },
    globalLoading: { count: 0 },
    notifications: [],
    compoundSearch: { query: '', mode: 'name', results: { kind: 'idle' }, selectedCid: null },
  };
}
