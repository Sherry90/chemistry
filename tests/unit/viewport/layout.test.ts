import { describe, it, expect } from 'vitest';
import { computeBBox, computeMoleculeLayout, computeAggregateBBox } from '@/viewport/scene/layout';
import { GROUP_PADDING_ANGSTROM } from '@/viewport/_shared/constants';
import { fakeMolecule } from '../stores/_helpers';
import type { MoleculeId } from '@/chemistry/compounds/ids';

const molAt = (id: string, cx: number) =>
  fakeMolecule({
    id: id as MoleculeId,
    atoms: [
      {
        id: `${id}-a` as never,
        elementNumber: 6 as never,
        position: { x: cx - 1, y: 0, z: 0 },
        formalCharge: 0,
        implicitHCount: 0,
      },
      {
        id: `${id}-b` as never,
        elementNumber: 6 as never,
        position: { x: cx + 1, y: 0, z: 0 },
        formalCharge: 0,
        implicitHCount: 0,
      },
    ],
    bonds: [],
  });

describe('computeBBox', () => {
  it('empty atoms → zero bbox', () => {
    const b = computeBBox(fakeMolecule({ atoms: [], bonds: [] }));
    expect(b.diagonal).toBe(0);
  });
  it('center + diagonal', () => {
    const b = computeBBox(molAt('m', 5)); // atoms at x=4 and x=6
    expect(b.center).toEqual([5, 0, 0]);
    expect(b.diagonal).toBeCloseTo(2, 6);
  });
});

describe('computeMoleculeLayout', () => {
  it('empty → empty map', () => {
    expect(computeMoleculeLayout([]).size).toBe(0);
  });
  it('single → translation [0,0,0]', () => {
    const m = molAt('m1', 0);
    expect(computeMoleculeLayout([m]).get(m.id)!.translation).toEqual([0, 0, 0]);
  });
  it('two → horizontal row, centered, bbox-center corrected', () => {
    const a = molAt('a', 10); // center x=10
    const b = molAt('b', -7); // center x=-7
    const layout = computeMoleculeLayout([a, b]);
    const cell = 2 + GROUP_PADDING_ANGSTROM; // maxDim=2
    // cols=2: col0 → (0-0.5)*cell - center.x ; col1 → (1-0.5)*cell - center.x
    expect(layout.get(a.id)!.translation[0]).toBeCloseTo(-0.5 * cell - 10, 6);
    expect(layout.get(b.id)!.translation[0]).toBeCloseTo(0.5 * cell + 7, 6);
  });
  it('four → 2×2 grid', () => {
    const ms = [molAt('a', 0), molAt('b', 0), molAt('c', 0), molAt('d', 0)];
    const layout = computeMoleculeLayout(ms);
    expect(layout.size).toBe(4);
    // cols=2, rows=2: tz differs between row0 and row1
    const tzA = layout.get(ms[0]!.id)!.translation[2];
    const tzC = layout.get(ms[2]!.id)!.translation[2];
    expect(tzA).not.toBeCloseTo(tzC, 6);
  });
  it('deterministic + order-preserving', () => {
    const ms = [molAt('a', 0), molAt('b', 0)];
    const l1 = computeMoleculeLayout(ms);
    const l2 = computeMoleculeLayout(ms);
    expect([...l1.keys()]).toEqual([...l2.keys()]);
    expect([...l1.keys()]).toEqual([ms[0]!.id, ms[1]!.id]);
  });
});

describe('computeAggregateBBox', () => {
  it('unions translated bboxes', () => {
    const a = molAt('a', 0);
    const agg = computeAggregateBBox([
      { molecule: a, transform: { translation: [0, 0, 0] } },
      { molecule: a, transform: { translation: [10, 0, 0] } },
    ]);
    expect(agg.min[0]).toBeCloseTo(-1, 6);
    expect(agg.max[0]).toBeCloseTo(11, 6);
  });
});
