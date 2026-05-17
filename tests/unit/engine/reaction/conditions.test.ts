import { describe, it, expect } from 'vitest';
import { matchesConditionRange, distanceFromRange } from '@/engine/reaction/conditions';
import { rule, condition } from './helpers';

describe('matchesConditionRange', () => {
  it('all ranges undefined → always true', () => {
    expect(matchesConditionRange(rule(), condition({ temperatureK: 9999 }))).toBe(true);
  });

  it('T boundary inclusive with epsilon', () => {
    const r = rule({ conditionRange: { temperatureK: [300, 400] } });
    expect(matchesConditionRange(r, condition({ temperatureK: 300 }))).toBe(true);
    expect(matchesConditionRange(r, condition({ temperatureK: 400 }))).toBe(true);
    expect(matchesConditionRange(r, condition({ temperatureK: 299.999 }))).toBe(true); // ε
    expect(matchesConditionRange(r, condition({ temperatureK: 299 }))).toBe(false);
    expect(matchesConditionRange(r, condition({ temperatureK: 401 }))).toBe(false);
  });

  it('pH range required but condition.pH null → false', () => {
    const r = rule({ conditionRange: { pH: [0, 7] } });
    expect(matchesConditionRange(r, condition({ pH: null }))).toBe(false);
    expect(matchesConditionRange(r, condition({ pH: 3 }))).toBe(true);
    expect(matchesConditionRange(r, condition({ pH: 8 }))).toBe(false);
  });

  it('one dimension out of range → false', () => {
    const r = rule({ conditionRange: { temperatureK: [300, 400], pressureAtm: [1, 2] } });
    expect(matchesConditionRange(r, condition({ temperatureK: 350, pressureAtm: 5 }))).toBe(false);
  });
});

describe('distanceFromRange', () => {
  it('0 inside range', () => {
    const r = rule({ conditionRange: { temperatureK: [300, 400] } });
    expect(distanceFromRange(r, condition({ temperatureK: 350 }))).toBe(0);
  });
  it('accumulates absolute distance outside', () => {
    const r = rule({ conditionRange: { temperatureK: [300, 400], pressureAtm: [1, 2] } });
    expect(distanceFromRange(r, condition({ temperatureK: 290, pressureAtm: 5 }))).toBe(13);
  });
  it('null pH against pH-required rule → Infinity', () => {
    const r = rule({ conditionRange: { pH: [0, 7] } });
    expect(distanceFromRange(r, condition({ pH: null }))).toBe(Infinity);
  });
});
