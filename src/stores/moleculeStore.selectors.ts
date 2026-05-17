// Phase 07 §5.1 — moleculeStore selector helpers.
import type { Molecule } from '@/chemistry/compounds/types';
import type { AsyncState, IngestError, MoleculeId } from './_shared/types';
import type { MoleculeStoreState } from './moleculeStore.types';

export const selectActiveMolecule = (s: MoleculeStoreState): Molecule | null =>
  s.activeId ? (s.molecules[s.activeId] ?? null) : null;

export const selectMoleculeById =
  (id: MoleculeId) =>
  (s: MoleculeStoreState): Molecule | null =>
    s.molecules[id] ?? null;

export const selectMoleculeIds = (s: MoleculeStoreState): ReadonlyArray<MoleculeId> => s.ids;

export const selectIngestState = (s: MoleculeStoreState): AsyncState<MoleculeId, IngestError> =>
  s.ingest;

/**
 * Phase 13 export 용 — 직렬화 가능한 dump (Date/Map/Set/함수 미포함).
 * 정확한 필드 동결은 Phase 13 가 export 포맷 결정 시 수행 (본 Phase 는 *형태 보장*만).
 */
export type MoleculeSnapshot = Molecule;

export const selectMoleculeSnapshot =
  (id: MoleculeId) =>
  (s: MoleculeStoreState): MoleculeSnapshot | null => {
    const m = s.molecules[id];
    return m ? (structuredClone(m) as MoleculeSnapshot) : null;
  };
