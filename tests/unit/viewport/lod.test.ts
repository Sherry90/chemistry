import { describe, it, expect } from 'vitest';
import {
  pickLodLevel,
  shouldUseLineBonds,
  sphereGeometryFor,
  cylinderGeometryFor,
} from '@/viewport/_shared/lod';
import { LOD_THRESHOLDS } from '@/viewport/_shared/types';
import { getLodLevel } from '@/viewport/renderers/lod/useLodLevel';

describe('LOD branch (thresholds tuned by Phase 14 §4.1/§4.2)', () => {
  it('pickLodLevel boundary at atomCountForLowSegments', () => {
    const lowSeg = LOD_THRESHOLDS.atomCountForLowSegments;
    expect(pickLodLevel(lowSeg - 1)).toBe('high');
    expect(pickLodLevel(lowSeg)).toBe('medium');
    expect(pickLodLevel(lowSeg + 1)).toBe('medium');
    expect(pickLodLevel(0)).toBe('high');
  });

  it('shouldUseLineBonds boundary at atomCountForLineBonds', () => {
    const lineBond = LOD_THRESHOLDS.atomCountForLineBonds;
    expect(shouldUseLineBonds(lineBond - 1)).toBe(false);
    expect(shouldUseLineBonds(lineBond)).toBe(true);
  });

  it('logic independent of concrete threshold values', () => {
    const custom = { atomCountForLowSegments: 10, atomCountForLineBonds: 20 };
    expect(pickLodLevel(10, custom)).toBe('medium');
    expect(shouldUseLineBonds(20, custom)).toBe(true);
  });

  it('geometry caches return stable refs across three LOD levels', () => {
    expect(sphereGeometryFor('high')).toBe(sphereGeometryFor('high'));
    expect(sphereGeometryFor('high')).not.toBe(sphereGeometryFor('medium'));
    expect(sphereGeometryFor('medium')).not.toBe(sphereGeometryFor('line'));
    expect(cylinderGeometryFor('high')).toBe(cylinderGeometryFor('high'));
    expect(cylinderGeometryFor('high')).not.toBe(cylinderGeometryFor('medium'));
  });
});

describe('getLodLevel hysteresis (Phase 14 §5.1 / D13 — ±10 buffer)', () => {
  const T = { atomCountForLowSegments: 100, atomCountForLineBonds: 500 } as const;

  it('high → medium only above lowSeg + buffer', () => {
    expect(getLodLevel('high', 100, T)).toBe('high'); // 정확히 임계
    expect(getLodLevel('high', 109, T)).toBe('high'); // hysteresis 안쪽
    expect(getLodLevel('high', 110, T)).toBe('medium'); // 경계 + buffer
  });

  it('medium → high only below lowSeg - buffer', () => {
    expect(getLodLevel('medium', 91, T)).toBe('medium'); // hysteresis 안쪽
    expect(getLodLevel('medium', 89, T)).toBe('high'); // 경계 - buffer 미만
  });

  it('medium → line only above lineBond + buffer', () => {
    expect(getLodLevel('medium', 509, T)).toBe('medium');
    expect(getLodLevel('medium', 510, T)).toBe('line');
  });

  it('line → medium only below lineBond - buffer', () => {
    expect(getLodLevel('line', 491, T)).toBe('line');
    expect(getLodLevel('line', 489, T)).toBe('medium');
  });
});
