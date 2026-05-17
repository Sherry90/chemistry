// Phase 09 §5.6 / §6.8 (D10) — 텍스트 입력 컨텍스트 검사.
// <input>/<textarea>/[contenteditable=true] 안 키 이벤트면 전역 단축키 미발화
// (native undo 등 우선). Phase 12 SMILES 입력이 자동으로 이 가드 통과.
export function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if (target.isContentEditable) return true;
  return false;
}
