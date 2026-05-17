// Phase 07 §4.1 — 스토어 공통 타입.
// 비동기 진입점의 4-상태 유니온 + 식별자 재수출 + undoable 메타 + 직렬화 에러.
import type { MoleculeId } from '@/chemistry/compounds/ids';
import { createMoleculeId, moleculeIdForCid } from '@/chemistry/compounds/ids';
import type { ParseError } from '@/engine/parser';
import type { EmbedError } from '@/engine/geometry';
import type { PubChemError } from '@/services/pubchem';
import type { ReactionEngineError } from '@/engine/reaction';
import type { RdkitInitError } from '@/engine/rdkit';

/**
 * 비동기 진입점의 4-상태 유니온. 모든 스토어가 동일 모양으로 사용한다.
 */
export type AsyncState<T, E> =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading'; readonly startedAt: number }
  | { readonly kind: 'success'; readonly value: T; readonly settledAt: number }
  | { readonly kind: 'error'; readonly error: E; readonly settledAt: number };

export type AsyncStateLoading = Extract<AsyncState<never, never>, { kind: 'loading' }>;
export type AsyncStateError<E> = Extract<AsyncState<never, E>, { kind: 'error' }>;

export const ASYNC_IDLE: AsyncState<never, never> = { kind: 'idle' };

/**
 * MoleculeId 는 **Phase 01 `@/chemistry/compounds/ids` 단일 정의** (CD1) 를 재수출만 한다
 * (본 store 가 재정의하지 않음). 생성은 Phase 01 `createMoleculeId()` (crypto.randomUUID 기반).
 */
export type { MoleculeId };
export const newMoleculeId = createMoleculeId;

/** CID → 결정적 MoleculeId (`cid:{CID}` 형식, Phase 01 재수출). */
export { moleculeIdForCid };

/**
 * Phase 09 와의 계약 — undoable 액션의 메타 정보.
 * labelKey 는 "원자 추가" / "결합 차수 변경" 등 i18n 키 (common.json#stores.undo.*).
 */
export interface UndoableMeta {
  readonly undoable: true;
  readonly labelKey: string; // i18n 키 — 실제 문구는 Phase 11 가 번역
  readonly group?: string; // 같은 group 의 연속 액션은 Phase 09 가 합칠 수 있음
}

/**
 * 텍스트/CID 진입점의 비동기 실패 분기 (Phase 07 §4.2, Phase 12 인계 표).
 * barrel 노출 — Phase 12 가 분기 표로 사용.
 */
export type IngestError =
  | { readonly kind: 'parse'; readonly detail: ParseError }
  | { readonly kind: 'embed'; readonly detail: EmbedError }
  | { readonly kind: 'pubchem'; readonly detail: PubChemError }
  | { readonly kind: 'duplicate'; readonly existingId: MoleculeId } // 동일 InChIKey 가 이미 존재
  | { readonly kind: 'rdkit-not-ready' }
  | { readonly kind: 'internal'; readonly message: string };

/**
 * 직렬화 가능한 에러 형태. 스토어 외부(특히 logger / DevTools) 로 노출될 때 사용.
 * Phase 03/05/06 의 좁혀진 에러 유니온을 별도 변환 없이 통과시킨다.
 */
export type SerializedError =
  | { readonly source: 'parse'; readonly detail: ParseError }
  | { readonly source: 'embed'; readonly detail: EmbedError }
  | { readonly source: 'pubchem'; readonly detail: PubChemError }
  | { readonly source: 'reaction'; readonly detail: ReactionEngineError }
  | { readonly source: 'rdkit'; readonly detail: RdkitInitError }
  | { readonly source: 'internal'; readonly message: string };

/** 유니온 망라 강제용 — switch 의 default 분기에서 호출. */
export function assertNever(x: never): never {
  throw new Error(`Unexpected variant: ${JSON.stringify(x)}`);
}
