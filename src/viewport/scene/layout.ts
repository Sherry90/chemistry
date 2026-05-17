// Phase 08 §4.2 / §6.4 (D2) — 다중 분자 레이아웃 (순수 결정함수, state 없음).
import type { Molecule } from '@/chemistry/compounds/types';
import type { MoleculeId } from '@/chemistry/compounds/ids';
import { GROUP_PADDING_ANGSTROM } from '../_shared/constants';

export interface MoleculeLayoutTransform {
  readonly translation: readonly [number, number, number];
  readonly rotationQuaternion?: readonly [number, number, number, number];
  readonly scale?: number;
}

export interface MoleculeBBox {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
  readonly center: readonly [number, number, number];
  readonly diagonal: number; // Å, 카메라 거리 산출용
}

const ZERO_BBOX: MoleculeBBox = {
  min: [0, 0, 0],
  max: [0, 0, 0],
  center: [0, 0, 0],
  diagonal: 0,
};

export function computeBBox(molecule: Molecule): MoleculeBBox {
  if (molecule.atoms.length === 0) return ZERO_BBOX;
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (const a of molecule.atoms) {
    const { x, y, z } = a.position;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  const dx = maxX - minX,
    dy = maxY - minY,
    dz = maxZ - minZ;
  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
    center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
    diagonal: Math.sqrt(dx * dx + dy * dy + dz * dz),
  };
}

/**
 * 입력 순서 보존 (moleculeStore.ids 가 안정 정렬 — 본 함수는 재정렬 안 함, §11 #4).
 * ≤3: 가로 1열. >3: ⌈√n⌉ × ⌈√n⌉ grid. 셀 = max(diagonal) + GROUP_PADDING.
 */
export function computeMoleculeLayout(
  molecules: ReadonlyArray<Molecule>,
): ReadonlyMap<MoleculeId, MoleculeLayoutTransform> {
  const result = new Map<MoleculeId, MoleculeLayoutTransform>();
  const n = molecules.length;
  if (n === 0) return result;
  if (n === 1) {
    result.set(molecules[0]!.id, { translation: [0, 0, 0] });
    return result;
  }

  const bboxes = molecules.map(computeBBox);
  const maxDim = Math.max(...bboxes.map((b) => b.diagonal), 0);
  const cols = n <= 3 ? n : Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const cell = maxDim + GROUP_PADDING_ANGSTROM;

  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const bbox = bboxes[i]!;
    const tx = (col - (cols - 1) / 2) * cell - bbox.center[0];
    const ty = 0;
    const tz = (row - (rows - 1) / 2) * cell - bbox.center[2];
    result.set(molecules[i]!.id, { translation: [tx, ty, tz] });
  }
  return result;
}

export function computeAggregateBBox(
  items: ReadonlyArray<{ molecule: Molecule; transform: MoleculeLayoutTransform }>,
): MoleculeBBox {
  if (items.length === 0) return ZERO_BBOX;
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (const { molecule, transform } of items) {
    const b = computeBBox(molecule);
    const [tx, ty, tz] = transform.translation;
    minX = Math.min(minX, b.min[0] + tx);
    minY = Math.min(minY, b.min[1] + ty);
    minZ = Math.min(minZ, b.min[2] + tz);
    maxX = Math.max(maxX, b.max[0] + tx);
    maxY = Math.max(maxY, b.max[1] + ty);
    maxZ = Math.max(maxZ, b.max[2] + tz);
  }
  const dx = maxX - minX,
    dy = maxY - minY,
    dz = maxZ - minZ;
  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
    center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
    diagonal: Math.sqrt(dx * dx + dy * dy + dz * dz),
  };
}
