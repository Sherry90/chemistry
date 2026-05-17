// Phase 08 §6.5.2 (D1a) — atom/bond 삭제로 stale 가 된 selection 자동 정리.
import { useEffect } from 'react';
import { useMoleculeStore, useUiStore } from '@/stores';
import { parseViewportId } from '../ids/viewportId';

/**
 * <Viewport /> 마운트 시 1회 등록. moleculeStore.molecules 변화 → selection 의
 * 존재하지 않는 atom/bond id 를 걸러 uiStore.setSelection 으로 정리.
 *
 * `useUiStore.getState()` 는 subscribe 콜백 안의 *현재값 read* (Phase 07 §6.5.2 의
 * 명시 예외 — 재 dispatch 가 아니라 selector 등가 read + actions 통로로 write).
 */
export function useSelectionStaleGuard(): void {
  useEffect(() => {
    const unsub = useMoleculeStore.subscribe(
      (s) => s.molecules,
      (mols) => {
        const sel = useUiStore.getState().selection;
        const liveAtomIds = sel.atomIds.filter((sid) => {
          const p = parseViewportId(sid);
          if (!p || p.kind !== 'atom') return false;
          return mols[p.molId]?.atoms.some((a) => a.id === p.atomId) ?? false;
        });
        const liveBondIds = sel.bondIds.filter((sid) => {
          const p = parseViewportId(sid);
          if (!p || p.kind !== 'bond') return false;
          return mols[p.molId]?.bonds.some((b) => b.id === p.bondId) ?? false;
        });
        if (
          liveAtomIds.length !== sel.atomIds.length ||
          liveBondIds.length !== sel.bondIds.length
        ) {
          useUiStore.getState().actions.setSelection({
            atomIds: liveAtomIds,
            bondIds: liveBondIds,
          });
        }
      },
      { equalityFn: Object.is },
    );
    return () => unsub();
  }, []);
}
