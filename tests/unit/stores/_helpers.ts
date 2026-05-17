// Phase 07 테스트 공용 — 가짜 도메인 객체 + 스토어 리셋.
import type { Molecule } from '@/chemistry/compounds/types';
import type { AtomId, BondId, MoleculeId } from '@/chemistry/compounds/ids';

export function fakeMolecule(over: Partial<Molecule> = {}): Molecule {
  const a0 = 'a0' as AtomId;
  const a1 = 'a1' as AtomId;
  return {
    id: ('m-' + crypto.randomUUID()) as MoleculeId,
    atoms: [
      {
        id: a0,
        elementNumber: 6 as Molecule['atoms'][number]['elementNumber'],
        position: { x: 0, y: 0, z: 0 },
        formalCharge: 0,
        implicitHCount: 3,
      },
      {
        id: a1,
        elementNumber: 8 as Molecule['atoms'][number]['elementNumber'],
        position: { x: 1.4, y: 0, z: 0 },
        formalCharge: 0,
        implicitHCount: 1,
      },
    ],
    bonds: [{ id: 'b0' as BondId, aAtomId: a0, bAtomId: a1, order: 1 }],
    totalCharge: 0,
    canonicalSmiles: 'CO',
    inchi: 'InChI=1S/CH4O/c1-2/h2H,1H3',
    inchiKey: 'OKKJLVBELUTLKV-UHFFFAOYSA-N',
    stereo: { atomStereo: [], bondStereo: [] },
    spinMultiplicity: 1,
    ...over,
  };
}

/** 전체 리셋 — replace=true 이지만 actions 는 보존 (state+actions 단일 객체). */
export function hardReset<S extends { actions: unknown }>(
  store: { getState: () => S; setState: (s: S, replace: true) => void },
  initial: () => Omit<S, 'actions'>,
): void {
  const actions = store.getState().actions;
  store.setState({ ...(initial() as object), actions } as S, true);
}
