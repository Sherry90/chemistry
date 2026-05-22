// Phase 14 §5.1 — LOD 레벨 훅 + getLodLevel 순수 함수 (hysteresis ±10 — D13).
import { useEffect, useState } from 'react';
import type { LodLevel, LodThresholds } from '@/viewport/_shared/types';
import { LOD_THRESHOLDS } from '@/viewport/_shared/types';
import { useMoleculeStore } from '@/stores';

/**
 * 순수 함수 — 테스트 용이. hysteresis ±10 buffer 로 oscillation 방지.
 */
export function getLodLevel(
  currentLevel: LodLevel,
  totalAtomCount: number,
  thresholds: LodThresholds = LOD_THRESHOLDS,
): LodLevel {
  const { atomCountForLowSegments: lowSeg, atomCountForLineBonds: lineBond } = thresholds;
  const H = 10;

  if (currentLevel === 'high') {
    if (totalAtomCount >= lowSeg + H) return 'medium';
  } else if (currentLevel === 'medium') {
    if (totalAtomCount < lowSeg - H) return 'high';
    if (totalAtomCount >= lineBond + H) return 'line';
  } else {
    if (totalAtomCount < lineBond - H) return 'medium';
  }
  return currentLevel;
}

export function useLodLevel(): LodLevel {
  // 전체 분자의 atom 수 합산. useMoleculeStore 의 selector — record 전체 구독.
  const totalAtomCount = useMoleculeStore((s) => {
    let n = 0;
    for (const id of s.ids) {
      const m = s.molecules[id];
      if (m) n += m.atoms.length;
    }
    return n;
  });

  const [level, setLevel] = useState<LodLevel>('high');

  useEffect(() => {
    setLevel((prev) => getLodLevel(prev, totalAtomCount));
  }, [totalAtomCount]);

  return level;
}
