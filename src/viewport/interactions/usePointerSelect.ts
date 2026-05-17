// Phase 09 §6.3 (D6) — 클릭 선택. 일반=단일 교체, Shift=토글 add/remove,
// 빈 영역(no-shift)=clearSelection. box select 는 Phase 14+.
import { useUiStore } from '@/stores';
import type { PickedTarget } from '../ids/picking';
import { viewportIdForAtom, viewportIdForBond } from '../ids/viewportId';

/**
 * raycast 결과(picked, 없으면 null) + shiftKey 로 selection 갱신.
 * R3F 이벤트 핸들러가 raycast 후 본 순수 함수 호출 (테스트 용이, §8.4).
 */
export function selectFromPick(picked: PickedTarget | null, shiftKey: boolean): void {
  const ui = useUiStore.getState();
  if (!picked) {
    if (!shiftKey) ui.actions.clearSelection();
    return;
  }
  const sid =
    picked.kind === 'atom'
      ? viewportIdForAtom(picked.molId, picked.atomId)
      : viewportIdForBond(picked.molId, picked.bondId);
  const isAtom = picked.kind === 'atom';

  if (shiftKey) {
    const cur = ui.selection;
    const list = isAtom ? cur.atomIds : cur.bondIds;
    const next = list.includes(sid) ? list.filter((x) => x !== sid) : [...list, sid];
    ui.actions.setSelection({
      atomIds: isAtom ? next : cur.atomIds,
      bondIds: isAtom ? cur.bondIds : next,
    });
  } else {
    ui.actions.setSelection({
      atomIds: isAtom ? [sid] : [],
      bondIds: isAtom ? [] : [sid],
    });
  }
}
