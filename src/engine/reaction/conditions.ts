import type { ReactionRule, Condition } from '@/chemistry/reactions/types';

/** 실수 비교의 부동소수점 안전 마진. T(K), P(atm) 등 실수 값에 적용. pH(정수)는 미적용. */
export const CONDITION_EPSILON = 0.01;

// Phase 06 §6.5 — 닫힌 구간 [min, max], ε tolerance (실수만).
export function matchesConditionRange(rule: ReactionRule, condition: Condition): boolean {
  const { temperatureK: tRange, pressureAtm: pRange, pH: phRange } = rule.conditionRange;

  if (
    tRange &&
    (condition.temperatureK < tRange[0] - CONDITION_EPSILON ||
      condition.temperatureK > tRange[1] + CONDITION_EPSILON)
  ) {
    return false;
  }
  if (
    pRange &&
    (condition.pressureAtm < pRange[0] - CONDITION_EPSILON ||
      condition.pressureAtm > pRange[1] + CONDITION_EPSILON)
  ) {
    return false;
  }
  if (phRange) {
    if (condition.pH === null) return false; // pH 무관 입력이면 매칭 불가
    if (condition.pH < phRange[0] || condition.pH > phRange[1]) return false;
  }
  return true;
}

/** 범위 밖이면 |값-경계| 합산, 범위 안이면 0. ε 미적용 (실제 차이 그대로). */
export function distanceFromRange(rule: ReactionRule, condition: Condition): number {
  let d = 0;
  const { temperatureK: tRange, pressureAtm: pRange, pH: phRange } = rule.conditionRange;

  if (tRange) {
    if (condition.temperatureK < tRange[0]) d += tRange[0] - condition.temperatureK;
    else if (condition.temperatureK > tRange[1]) d += condition.temperatureK - tRange[1];
  }
  if (pRange) {
    if (condition.pressureAtm < pRange[0]) d += pRange[0] - condition.pressureAtm;
    else if (condition.pressureAtm > pRange[1]) d += condition.pressureAtm - pRange[1];
  }
  if (phRange) {
    if (condition.pH === null) {
      d += Infinity;
    } else if (condition.pH < phRange[0]) {
      d += phRange[0] - condition.pH;
    } else if (condition.pH > phRange[1]) {
      d += condition.pH - phRange[1];
    }
  }
  return d;
}
