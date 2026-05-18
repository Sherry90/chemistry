// Phase 07 §4.2 — moleculeStore 상태 타입.
import type { Molecule } from '@/chemistry/compounds/types';
import type { AsyncState, IngestError, MoleculeId } from './_shared/types';

export type { IngestError };

export interface MoleculeStoreState {
  /** MoleculeId → Molecule. immer + persist 호환 위해 Map 이 아닌 plain object (P3). */
  readonly molecules: Readonly<Record<MoleculeId, Molecule>>;
  readonly ids: ReadonlyArray<MoleculeId>; // 안정적 정렬 보장 (삽입 순서)
  readonly activeId: MoleculeId | null;

  /** 텍스트/CID 진입점의 비동기 상태. 마지막 호출만 추적. */
  readonly ingest: AsyncState<MoleculeId, IngestError>;

  /** Undo/Redo placeholder — Phase 09 가 인수 (현재 항상 false). */
  readonly canUndo: boolean;
  readonly canRedo: boolean;

  /** Phase 11 D-UNDO-TOAST §6.13 — undo 성공 시 +1 (redo/일반 변경 불변).
   *  단일 관찰자(useUndoSelectionToast)가 구독하는 단조 카운터. */
  readonly lastUndoSeq: number;
}

export function makeInitialMoleculeState(): MoleculeStoreState {
  return {
    molecules: {},
    ids: [],
    activeId: null,
    ingest: { kind: 'idle' },
    canUndo: false,
    canRedo: false,
    lastUndoSeq: 0,
  };
}
