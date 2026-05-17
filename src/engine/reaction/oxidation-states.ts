// Phase 06 §6.7 — 휴리스틱 원자가 lookup. v1 커버 원소 10종.
// 키 = 원자번호, 값 = 가능한 (양의) 결합 원자가 목록 (단순화).
export const OXIDATION_STATES_V1: Readonly<Record<number, ReadonlyArray<number>>> = {
  1: [1], // H
  6: [4], // C  (sp3 기준 단순화)
  7: [3], // N
  8: [2], // O
  9: [1], // F
  15: [3, 5], // P
  16: [2, 4, 6], // S
  17: [1], // Cl
  35: [1], // Br
  53: [1], // I
};

/** 해당 원소의 최소 양의 결합 원자가 (불포화 판정 기준). lookup miss → null. */
export function targetValenceOf(elementNumber: number): number | null {
  const states = OXIDATION_STATES_V1[elementNumber];
  if (!states || states.length === 0) return null;
  return Math.min(...states);
}
