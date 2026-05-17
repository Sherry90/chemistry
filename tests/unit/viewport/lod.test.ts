import { describe, it, expect } from 'vitest';
import {
  pickLodLevel,
  shouldUseLineBonds,
  sphereGeometryFor,
  cylinderGeometryFor,
} from '@/viewport/_shared/lod';
import { DEFAULT_LOD_THRESHOLDS } from '@/viewport/_shared/types';

describe('LOD branch (thresholds tuned by Phase 14)', () => {
  it('pickLodLevel boundary at atomCountForLowSegments', () => {
    expect(pickLodLevel(299)).toBe('high');
    expect(pickLodLevel(300)).toBe('low');
    expect(pickLodLevel(301)).toBe('low');
    expect(pickLodLevel(0)).toBe('high');
  });

  it('shouldUseLineBonds boundary at atomCountForLineBonds', () => {
    expect(shouldUseLineBonds(1499)).toBe(false);
    expect(shouldUseLineBonds(1500)).toBe(true);
  });

  it('logic independent of concrete threshold values', () => {
    const custom = { atomCountForLowSegments: 10, atomCountForLineBonds: 20 };
    expect(pickLodLevel(10, custom)).toBe('low');
    expect(shouldUseLineBonds(20, custom)).toBe(true);
    expect(DEFAULT_LOD_THRESHOLDS.atomCountForLowSegments).toBe(300);
  });

  it('geometry caches return stable refs with differing segment counts', () => {
    expect(sphereGeometryFor('high')).toBe(sphereGeometryFor('high'));
    expect(sphereGeometryFor('high')).not.toBe(sphereGeometryFor('low'));
    expect(cylinderGeometryFor('high')).toBe(cylinderGeometryFor('high'));
  });
});
