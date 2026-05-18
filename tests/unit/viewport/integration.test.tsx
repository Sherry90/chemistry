// Phase 09 §8.12 — 컴포넌트 통합. jsdom 은 WebGL2 미지원 → <Viewport /> 가
// fallback 반환(Phase 08 scene.test.tsx 와 동일 scope-cut).
// (v0.x 정합) Phase 10 §6.1 이 createUndoStack 주입/전역 단축키를 AppLayout 으로
// 이관 → <Viewport> 단독 마운트는 더 이상 dispatcher 를 주입하지 않는다.
// 해당 회귀는 Phase 10 AppLayout 컴포넌트 테스트(C2)가 담당. 본 테스트는
// fallback 렌더 무throw 만 가드.
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

beforeEach(() => __resetWebGL2Cache());

describe('<Viewport /> (jsdom scope-cut)', () => {
  it('WebGL2 없으면 fallback (throw 없음)', () => {
    const { getByText } = render(<Viewport fallback={<span>no-webgl</span>} />);
    expect(getByText('no-webgl')).toBeInTheDocument();
  });

  it('fallback 없으면 빈 렌더 (throw 없음)', () => {
    const { container } = render(<Viewport />);
    expect(container).toBeEmptyDOMElement();
  });
});
