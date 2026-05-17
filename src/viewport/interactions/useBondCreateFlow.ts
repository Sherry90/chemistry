// Phase 09 §4.7 / §5.3 / §6.4 (D5) — 결합 생성 플로우.
// 두 atom 선택(같은 분자) + B 키 / 외부 트리거(Toolbar, Phase 11) → addBond
// (없으면) 또는 차수 cycle(있으면, 1→2→3→1). 다른 분자끼리는 거부 + warn.
import { useUiStore } from '@/stores';
import { useMoleculeStore } from '@/stores';
import type { MoleculeId } from '@/chemistry/compounds/ids';
import type { AtomId } from '@/chemistry/compounds/ids';
import { existsBond, findBondIndex } from '@/chemistry/compounds/bondUtils';
import type { BondOrder } from '@/chemistry/bonds/types';
import { parseViewportId } from '../ids/viewportId';
import { atomIdToIndex } from '../ids/lookup';

export interface BondCreateFlowState {
  readonly stage: 'idle' | 'awaitingSecond';
  /** stage === 'awaitingSecond' 일 때만 의미. */
  readonly firstAtom: { readonly molId: MoleculeId; readonly atomId: AtomId } | null;
}

export interface BondCreateFlowApi {
  /** 현재 selection.atomIds 가 정확히 2개(같은 분자)면 결합 생성/차수 cycle. */
  createFromSelection(): boolean;
  readonly state: BondCreateFlowState;
}

const nextOrder = (cur: BondOrder): BondOrder => (cur === 1 ? 2 : cur === 2 ? 3 : 1);

/**
 * 키보드 B / viewportApi.createBondFromSelection / Toolbar 가 호출하는 단일
 * 진입점. 성공(addBond 또는 setBondOrder 발화) 시 true, 그 외 false.
 */
export function createBondFromSelection(): boolean {
  const sel = useUiStore.getState().selection;
  if (sel.atomIds.length !== 2) return false;
  const a = parseViewportId(sel.atomIds[0]!);
  const b = parseViewportId(sel.atomIds[1]!);
  if (!a || a.kind !== 'atom' || !b || b.kind !== 'atom') return false;
  if (a.molId !== b.molId) {
    // 다른 분자 합치기는 비목표 (architecture §1.4) — Phase 11 가 toast 문구.
    useUiStore.getState().actions.notify({
      level: 'warn',
      messageKey: 'shortcuts.bondCreate.diffMolecule',
    });
    return false;
  }
  const mol = useMoleculeStore.getState().molecules[a.molId];
  if (!mol) return false;
  const aIndex = atomIdToIndex(mol, a.atomId);
  const bIndex = atomIdToIndex(mol, b.atomId);
  if (aIndex < 0 || bIndex < 0) return false;

  const acts = useMoleculeStore.getState().actions;
  if (existsBond(mol, aIndex, bIndex)) {
    const bondIdx = findBondIndex(mol, aIndex, bIndex);
    acts.setBondOrder(a.molId, bondIdx, nextOrder(mol.bonds[bondIdx]!.order));
  } else {
    acts.addBond(a.molId, aIndex, bIndex, 1);
  }
  return true;
}

/** selection 으로부터 파생한 플로우 상태 (1 atom = awaitingSecond). */
export function deriveBondCreateState(atomIds: ReadonlyArray<string>): BondCreateFlowState {
  if (atomIds.length === 1) {
    const p = parseViewportId(atomIds[0]!);
    if (p && p.kind === 'atom') {
      return { stage: 'awaitingSecond', firstAtom: { molId: p.molId, atomId: p.atomId } };
    }
  }
  return { stage: 'idle', firstAtom: null };
}

/** <Viewport /> 안에서 마운트 — Toolbar(Phase 11) 가 api 로 외부 트리거. */
export function useBondCreateFlow(): BondCreateFlowApi {
  const atomIds = useUiStore((s) => s.selection.atomIds);
  return {
    createFromSelection: createBondFromSelection,
    state: deriveBondCreateState(atomIds),
  };
}
