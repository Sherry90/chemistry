// Phase 08 §8.5/§8.9 (scope-cut) — jsdom 은 WebGL2 미지원 → <Viewport /> 가 throw 없이
// fallback 반환. 실 scene 그래프/시각 검증은 dev 서버 수동 + Phase 15 Playwright (R1).
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

describe('<Viewport /> WebGL2 gate', () => {
  it('renders fallback when WebGL2 unavailable (jsdom)', () => {
    const { getByText } = render(<Viewport fallback={<span>no-webgl</span>} />);
    expect(getByText('no-webgl')).toBeInTheDocument();
  });

  it('renders nothing (no throw) when no fallback provided', () => {
    const { container } = render(<Viewport />);
    expect(container).toBeEmptyDOMElement();
  });
});
