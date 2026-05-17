// Phase 09 §6.5.1 (D7) — Tab/Shift+Tab atom 순환 (atomIndex 순서, active 분자만).
import { useMoleculeStore, useUiStore } from '@/stores';
import { parseViewportId } from '../ids/viewportId';
import { atomIdToIndex } from '../ids/lookup';
import { viewportIdForAtom } from '../ids/viewportId';

/** direction +1 = 다음, -1 = 이전. active 분자 없거나 atom 0개면 no-op. */
export function navAtom(direction: 1 | -1): void {
  const ms = useMoleculeStore.getState();
  const activeMol = ms.activeId ? ms.molecules[ms.activeId] : null;
  if (!activeMol || activeMol.atoms.length === 0) return;

  const ui = useUiStore.getState();
  const sel = ui.selection.atomIds
    .map(parseViewportId)
    .filter((x): x is NonNullable<typeof x> => x != null && x.kind === 'atom');
  const cur = sel.find((s) => s.kind === 'atom' && s.molId === activeMol.id);
  const curIdx = cur && cur.kind === 'atom' ? atomIdToIndex(activeMol, cur.atomId) : -1;

  const n = activeMol.atoms.length;
  const nextIdx = curIdx < 0 ? (direction > 0 ? 0 : n - 1) : (curIdx + direction + n) % n;

  const nextAtomId = activeMol.atoms[nextIdx]!.id;
  useUiStore.getState().actions.setSelection({
    atomIds: [viewportIdForAtom(activeMol.id, nextAtomId)],
    bondIds: [],
  });
}

export function useKeyboardNav(): {
  readonly next: () => void;
  readonly prev: () => void;
} {
  return { next: () => navAtom(1), prev: () => navAtom(-1) };
}
