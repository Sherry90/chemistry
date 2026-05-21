// Phase 13 §4.3 / §4.4 — Molecule ↔ MoleculeSnapshot 변환 helper.
// 결정적 atomIndex (atoms[] 순서 그대로) 와 새 brand ID 부여 (ids.ts indexToId 패턴 mirror).
import type { Molecule, Atom } from '@/chemistry/compounds/types';
import type { Bond } from '@/chemistry/bonds/types';
import type { MoleculeId, AtomId } from '@/chemistry/compounds/ids';
import { createAtomId, createBondId, createMoleculeId } from '@/chemistry/compounds/ids';
import type { Vec3 } from '@/types/geometry';
import type { MoleculeSnapshot } from './types';

export function toSnapshot(m: Molecule): MoleculeSnapshot {
  // origin 정보: Molecule 본체에 origin 필드 없음 → 기본 'user-input'.
  // phase-13 후속이 Molecule 에 origin 추가하면 retrofit.
  const atomIndexOf = new Map<AtomId, number>();
  m.atoms.forEach((a, i) => atomIndexOf.set(a.id, i));
  return {
    id: m.id,
    canonicalSmiles: m.canonicalSmiles,
    inchi: m.inchi,
    inchiKey: m.inchiKey,
    totalCharge: m.totalCharge,
    spinMultiplicity: m.spinMultiplicity,
    atoms: m.atoms.map((a) => ({
      // Atom.position 은 Vec3 ({x,y,z}) → SerializedAtom.position 은 tuple.
      elementNumber: a.elementNumber,
      position: [a.position.x, a.position.y, a.position.z] as const,
      formalCharge: a.formalCharge,
      implicitHCount: a.implicitHCount,
      // TODO phase-13 follow-up: Atom 이 isotope 필드를 얻으면 (compounds/types.ts:14 TODO) 여기에 hydrate.
    })),
    bonds: m.bonds.map((b) => ({
      aAtomIndex: atomIndexOf.get(b.aAtomId) ?? 0,
      bAtomIndex: atomIndexOf.get(b.bAtomId) ?? 0,
      order: b.order,
    })),
    stereo: m.stereo,
    origin: { kind: 'user-input' },
  };
}

export function fromSnapshot(s: MoleculeSnapshot, newMoleculeId?: MoleculeId): Molecule {
  const atomIdList: AtomId[] = s.atoms.map(() => createAtomId());
  const atoms: ReadonlyArray<Atom> = s.atoms.map((a, i) => {
    const [x, y, z] = a.position;
    const position: Vec3 = { x, y, z };
    return {
      id: atomIdList[i]!,
      elementNumber: a.elementNumber as Atom['elementNumber'],
      position,
      formalCharge: a.formalCharge,
      implicitHCount: a.implicitHCount,
    };
  });
  const bonds: ReadonlyArray<Bond> = s.bonds.map((b) => ({
    id: createBondId(),
    aAtomId: atomIdList[b.aAtomIndex]!,
    bAtomId: atomIdList[b.bAtomIndex]!,
    order: b.order,
  }));
  return {
    id: newMoleculeId ?? createMoleculeId(),
    canonicalSmiles: s.canonicalSmiles,
    inchi: s.inchi,
    inchiKey: s.inchiKey,
    totalCharge: s.totalCharge,
    spinMultiplicity: s.spinMultiplicity,
    atoms,
    bonds,
    stereo: s.stereo,
  };
}
