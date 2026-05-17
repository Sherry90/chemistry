// Phase 09 §8.1 — undoStack push/pop/group 합치기/FIFO drop/pending flush.
import { describe, it, expect, beforeEach } from 'vitest';
import { createUndoStack } from '@/viewport/undo/undoStack';
import type { UndoSnapshot } from '@/viewport/undo/types';
import type { UndoableActionKind, UndoableMeta } from '@/stores';

// 구별 가능한 가짜 snapshot — activeId 를 태그로 재활용.
function snap(tag: string): UndoSnapshot {
  return { molecules: {}, ids: [], activeId: tag as unknown as UndoSnapshot['activeId'] };
}

function meta(
  kind: UndoableActionKind,
  group?: string,
): UndoableMeta & { kind: UndoableActionKind } {
  return { undoable: true, labelKey: `t.${kind}`, kind, ...(group ? { group } : {}) };
}

describe('createUndoStack', () => {
  let cur: UndoSnapshot;
  let t: number;
  const now = () => t;
  const read = () => cur;
  const write = (s: UndoSnapshot) => {
    cur = s;
  };
  const make = (capacity = 50, mergeWindowMs = 200) =>
    createUndoStack({ capacity, mergeWindowMs, readSnapshot: read, writeSnapshot: write, now });

  beforeEach(() => {
    cur = snap('init');
    t = 1000;
  });

  it('dispatch (group=null) → canUndo true, canRedo false, 즉시 flush', () => {
    const st = make();
    cur = snap('A');
    st.dispatchUndoable(meta('atom.add'), () => {
      cur = snap('B');
    });
    expect(st.canUndo()).toBe(true);
    expect(st.canRedo()).toBe(false);
  });

  it('undo → prev 복원 / canRedo true / past 에서 제거; redo → next 복원', () => {
    const st = make();
    cur = snap('A');
    st.dispatchUndoable(meta('atom.add'), () => {
      cur = snap('B');
    });
    st.undo();
    expect(cur.activeId).toBe('A');
    expect(st.canUndo()).toBe(false);
    expect(st.canRedo()).toBe(true);
    st.redo();
    expect(cur.activeId).toBe('B');
    expect(st.canRedo()).toBe(false);
    expect(st.canUndo()).toBe(true);
  });

  it('새 액션 dispatch 후 future 비워짐 (P7)', () => {
    const st = make();
    st.dispatchUndoable(meta('atom.add'), () => {
      cur = snap('B');
    });
    st.undo(); // future=[entry]
    expect(st.canRedo()).toBe(true);
    st.dispatchUndoable(meta('atom.move'), () => {
      cur = snap('C');
    });
    expect(st.canRedo()).toBe(false);
  });

  it('같은 group + 200ms 안 → 1 entry 로 합침', () => {
    const st = make();
    cur = snap('A');
    st.dispatchUndoable(meta('atom.move', 'drag:x'), () => {
      cur = snap('B');
    });
    t += 50;
    st.dispatchUndoable(meta('atom.move', 'drag:x'), () => {
      cur = snap('C');
    });
    t += 50;
    st.dispatchUndoable(meta('atom.move', 'drag:x'), () => {
      cur = snap('D');
    });
    st.undo(); // 합쳐진 단일 entry → 그룹 시작 직전(A) 으로
    expect(cur.activeId).toBe('A');
    expect(st.canUndo()).toBe(false);
  });

  it('같은 group + 200ms 초과 → 2 entry', () => {
    const st = make();
    cur = snap('A');
    st.dispatchUndoable(meta('atom.move', 'drag:x'), () => {
      cur = snap('B');
    });
    t += 300; // > mergeWindow
    st.dispatchUndoable(meta('atom.move', 'drag:x'), () => {
      cur = snap('C');
    });
    st.undo(); // 두번째 entry: C → B
    expect(cur.activeId).toBe('B');
    st.undo(); // 첫번째 entry: B → A
    expect(cur.activeId).toBe('A');
  });

  it('다른 group 의 액션 → 이전 group flush', () => {
    const st = make();
    cur = snap('A');
    st.dispatchUndoable(meta('atom.move', 'drag:x'), () => {
      cur = snap('B');
    });
    t += 10;
    st.dispatchUndoable(meta('bond.setOrder', 'other'), () => {
      cur = snap('C');
    });
    st.undo(); // 'other' pending → C..C? prev=B next=C → B
    expect(cur.activeId).toBe('B');
    st.undo(); // 'drag:x' entry → A
    expect(cur.activeId).toBe('A');
  });

  it('capacity 초과 → 가장 오래된 drop', () => {
    const st = make(3);
    cur = snap('s0');
    for (let i = 1; i <= 5; i++) {
      const to = `s${i}`;
      st.dispatchUndoable(meta('atom.add'), () => {
        cur = snap(to);
      }); // group=null → 즉시 flush, 매번 1 entry
    }
    // past 길이 3 (s2→s3, s3→s4, s4→s5). undo 3회 가능, 4회째 no-op.
    st.undo();
    expect(cur.activeId).toBe('s4');
    st.undo();
    expect(cur.activeId).toBe('s3');
    st.undo();
    expect(cur.activeId).toBe('s2');
    st.undo();
    expect(cur.activeId).toBe('s2'); // 더 못 감 (drop 됨)
    expect(st.canUndo()).toBe(false);
  });

  it('undo() 는 pending flush 후 처리', () => {
    const st = make();
    cur = snap('A');
    st.dispatchUndoable(meta('atom.move', 'drag:x'), () => {
      cur = snap('B');
    });
    // pending 상태 (group, flush 전). undo → flush 후 prev 복원.
    expect(st.canUndo()).toBe(true);
    st.undo();
    expect(cur.activeId).toBe('A');
  });

  it('flush() 명시 호출 → pending 을 past 로 확정', () => {
    const st = make();
    cur = snap('A');
    st.dispatchUndoable(meta('atom.move', 'drag:x'), () => {
      cur = snap('B');
    });
    st.flush();
    st.dispatchUndoable(meta('atom.move', 'drag:x'), () => {
      cur = snap('C');
    });
    st.undo();
    expect(cur.activeId).toBe('B'); // 두번째 그룹 entry
    st.undo();
    expect(cur.activeId).toBe('A'); // 첫번째 flush 된 entry
  });

  it('clear() → 스택 전체 비움', () => {
    const st = make();
    st.dispatchUndoable(meta('atom.add'), () => {
      cur = snap('B');
    });
    st.clear();
    expect(st.canUndo()).toBe(false);
    expect(st.canRedo()).toBe(false);
  });
});
