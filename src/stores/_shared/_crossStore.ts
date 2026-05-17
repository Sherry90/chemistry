// Phase 07 §6.6 — 스토어 간 cross-action 격리 (P1 의 *유일한* 정식 통로).
// 이 모듈 밖에서 다른 스토어의 getState() 호출 금지 (§9 R3, 코드 리뷰 가이드).
//
// 상호 import 순환은 ESM live-binding 으로 안전 — 모든 store 참조가 함수 본문
// (호출 시점) 에서만 일어나므로 모듈 평가 시점 의존이 없다.
import type { Molecule } from '@/chemistry/compounds/types';
import type { MoleculeId } from '@/chemistry/compounds/ids';
import type { ReactionEngineError } from '@/engine/reaction';
import { useUiStore } from '../uiStore';
import { useReactionStore } from '../reactionStore';
import { useMoleculeStore } from '../moleculeStore';
import { mapReactionErrorToKey } from '../reactionStore.selectors';

/**
 * 비동기 액션을 감싸 전역 로딩 카운터를 증감. cross-store 영향의 단일 통로.
 * (성공/실패 무관 finally 에서 endLoading.)
 */
export async function withGlobalLoading<T>(fn: () => Promise<T>): Promise<T> {
  useUiStore.getState().actions.beginLoading();
  try {
    return await fn();
  } finally {
    useUiStore.getState().actions.endLoading();
  }
}

/** 반응 실패 → 토스트. Aborted 는 사용자 의도이므로 토스트 안 함 (§5.2). */
export function notifyReactionError(error: ReactionEngineError): void {
  if (error.kind === 'Aborted') return;
  useUiStore.getState().actions.notify({
    level: 'error',
    messageKey: mapReactionErrorToKey(error),
  });
}

/**
 * reactionStore 는 reactantIds 만 보유 — predict 입력 Molecule 은 moleculeStore 에 있다.
 * 본 헬퍼가 P1 의 sanctioned cross-read (reactionStore 액션이 직접 moleculeStore 안 봄).
 */
export function collectReactantMolecules(ids: ReadonlyArray<MoleculeId>): ReadonlyArray<Molecule> {
  const mols = useMoleculeStore.getState().molecules;
  return ids.flatMap((id) => {
    const m = mols[id];
    return m ? [m] : [];
  });
}

/**
 * 분자 삭제의 후속 정리 — reactionStore 반응물 집합 + uiStore 선택에서 stale id 제거.
 * moleculeStore.removeMolecule 내부에서만 호출 (P1 예외 #2).
 */
export function cascadeRemoveMolecule(id: MoleculeId): void {
  useReactionStore.getState().actions.removeReactant(id);
  const ui = useUiStore.getState();
  const prefix = `${id}::`;
  ui.actions.setSelection({
    atomIds: ui.selection.atomIds.filter((s) => !s.startsWith(prefix)),
    bondIds: ui.selection.bondIds.filter((s) => !s.startsWith(prefix)),
  });
}
