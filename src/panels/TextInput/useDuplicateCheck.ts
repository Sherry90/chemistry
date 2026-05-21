// Phase 12 §6.6 — useDuplicateCheck: preview Molecule 의 InChIKey 가 작업공간의 기존 분자와 매칭되는지 검사.
import { useMemo } from 'react';
import { useMoleculeStore, selectMoleculeIds } from '@/stores';
import type { MoleculeId } from '@/stores';
import type { Molecule } from '@/chemistry/compounds/types';

export interface DuplicateInfo {
  readonly exists: boolean;
  readonly existingId: MoleculeId | null;
}

export function useDuplicateCheck(preview: Molecule | null): DuplicateInfo {
  const ids = useMoleculeStore(selectMoleculeIds);
  const molecules = useMoleculeStore((s) => s.molecules);
  return useMemo(() => {
    if (!preview || !preview.inchiKey) return { exists: false, existingId: null };
    for (const id of ids) {
      const m = molecules[id];
      if (m?.inchiKey && m.inchiKey === preview.inchiKey) {
        return { exists: true, existingId: id };
      }
    }
    return { exists: false, existingId: null };
  }, [preview, ids, molecules]);
}
