// Phase 09 §6.1.2 — moleculeStore snapshot 채취/복원.
// 의도적 deviation (문서 §6.1.2 draft 형 → partial-object 형):
//   문서는 `setState((draft) => { draft.molecules = snap.molecules })` 예시.
//   zustand 의 *공개* setState 는 immer 미들웨어가 함수 updater 만 produce 로
//   감싸고 객체 updater 는 그대로 shallow-merge 통과시킨다. 객체 partial 형은
//   immer 래핑 여부와 무관하게 동일 결과(actions/ingest/canUndo 보존 + 정확히
//   세 키만 교체)를 보장하며, snap 의 frozen 참조를 그대로 대입하므로 D1/P6 의
//   구조적 공유도 보존된다. replace=false (기본) — 나머지 키 머지 (문서 §6.1.2 주).
import { useMoleculeStore } from '../../moleculeStore';
import type { UndoSnapshot } from './types';

export function readSnapshot(): UndoSnapshot {
  const s = useMoleculeStore.getState();
  return { molecules: s.molecules, ids: s.ids, activeId: s.activeId };
}

export function writeSnapshot(snap: UndoSnapshot): void {
  // useUiStore.selection 은 건드리지 않는다 — atom 삭제로 stale 가 된 selection 은
  // Phase 08 useSelectionStaleGuard 가 다음 microtask 에 정리 (D14).
  useMoleculeStore.setState({
    molecules: snap.molecules,
    ids: snap.ids,
    activeId: snap.activeId,
  });
}
