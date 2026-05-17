// Phase 09 §8.12 — 컴포넌트 통합. jsdom 은 WebGL2 미지원 → <Viewport /> 가
// fallback 반환(Phase 08 scene.test.tsx 와 동일 scope-cut). 실 scene/raycast/
// 키보드 상호작용의 E2E 는 Phase 15 Playwright. 본 테스트는 Phase 09 가 추가한
// 마운트/언마운트 와이어링(undo dispatcher 주입·복귀, 전역 단축키 설치·해제)이
// throw 없이 동작하는지의 회귀 가드만 담당.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/engine', () => ({
  parseSmiles: vi.fn(),
  parseInchi: vi.fn(),
  toMoleculeWith3D: vi.fn(),
}));
vi.mock('@/engine/reaction', () => ({ predict: vi.fn() }));
vi.mock('@/services/pubchem', () => ({
  getCompoundByCid: vi.fn(),
  resolveCompoundByName: vi.fn(),
}));
vi.mock('@/data/compounds', () => ({ searchCompoundManifest: vi.fn(() => []) }));

import Viewport from '@/viewport';
import { __resetWebGL2Cache } from '@/viewport/capability/webgl2';
import { getActiveUndoDispatcher, phase07PlaceholderDispatcher } from '@/stores';

beforeEach(() => __resetWebGL2Cache());

describe('<Viewport /> Phase 09 wiring (jsdom scope-cut)', () => {
  it('WebGL2 없으면 fallback (throw 없음)', () => {
    const { getByText } = render(<Viewport fallback={<span>no-webgl</span>} />);
    expect(getByText('no-webgl')).toBeInTheDocument();
  });

  it('mount → undo dispatcher 주입, unmount → placeholder 복귀 (R9)', () => {
    const { unmount } = render(<Viewport />);
    // 마운트 effect 가 createUndoStack() 주입 (Canvas 부재와 무관, early return 前).
    expect(getActiveUndoDispatcher()).not.toBe(phase07PlaceholderDispatcher);
    unmount();
    // R9 — flush+clear+resetUndoDispatcher 후 placeholder 로 복귀.
    expect(getActiveUndoDispatcher()).toBe(phase07PlaceholderDispatcher);
  });
});
