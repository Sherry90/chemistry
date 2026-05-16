// 식별 단일 정의 모듈 (CD1 — architecture.md §5.1, phase-01 §4.2 동결).
// 런타임 도메인 모델은 안정 brand ID 를 보유한다. 직렬화(청크 JSON·세션·SDF)는
// 컴팩트 정수 인덱스를 쓰고, 경계 코덱이 결정적으로 변환한다.
import type { Brand } from '@/types/brand';
import type { Vec3 } from '@/types/geometry';
import type { BondOrder } from '@/chemistry/bonds/types';
// 타입 전용 import (런타임 순환 없음 — 컴파일 시 소거).
import type { Atom, Molecule } from '@/chemistry/compounds/types';
import type { Bond } from '@/chemistry/bonds/types';

export type AtomId = Brand<string, 'AtomId'>;
export type BondId = Brand<string, 'BondId'>;
export type MoleculeId = Brand<string, 'MoleculeId'>;
export type CompoundId = Brand<number, 'CompoundId'>;

// 생성 팩토리 (crypto.randomUUID 기반; Node 20+/모던 브라우저 보장).
export const createAtomId = (): AtomId => crypto.randomUUID() as AtomId;
export const createBondId = (): BondId => crypto.randomUUID() as BondId;
export const createMoleculeId = (): MoleculeId => crypto.randomUUID() as MoleculeId;

/** PubChem CID 등 외부 정수를 brand 로 승격 (검증은 호출측 책임). */
export const asCompoundId = (cid: number): CompoundId => cid as CompoundId;

/** CID → 결정적 MoleculeId (`cid:{CID}` 형식). 동일 CID 재로드 시 동일 id (중복 식별). */
export const moleculeIdForCid = (cid: number): MoleculeId => `cid:${cid}` as MoleculeId;

// ── 직렬화 형태 (청크 JSON·세션 공용) — ID 없음, 정수 인덱스만 ───────────────
export interface SerializedAtom {
  readonly elementNumber: number; // 1..118
  readonly position: readonly [number, number, number];
  readonly formalCharge: number;
  readonly implicitHCount: number;
  readonly isotope?: number;
}

export interface SerializedBond {
  readonly aAtomIndex: number; // index into atoms[]
  readonly bAtomIndex: number;
  readonly order: BondOrder;
}

export interface SerializedMolecule {
  readonly atoms: ReadonlyArray<SerializedAtom>;
  readonly bonds: ReadonlyArray<SerializedBond>;
  readonly totalCharge: number;
  // canonicalSmiles/inchi/inchiKey/stereo/spinMultiplicity 는 phase-03 가
  // 확장한 직렬화 형태(SerializedDefaultMolecule, data/compounds 계층)에서 동반된다.
}

/** indexToId 가 복원하는 Molecule 의 구조적 핵심 (스칼라 메타는 호출측이 합성). */
export type MoleculeCore = Pick<Molecule, 'id' | 'atoms' | 'bonds' | 'totalCharge'>;

// ── 경계 코덱: 런타임 brand ID ↔ 결정적 정수 인덱스 ───────────────────────
// 순서는 molecule.atoms / molecule.bonds 배열 순서를 그대로 따른다 (결정적).
export interface MoleculeIdCodec {
  readonly atomIndexOf: ReadonlyMap<AtomId, number>;
  readonly bondIndexOf: ReadonlyMap<BondId, number>;
}

/** 직렬화 방향: 런타임 Molecule → AtomId/BondId ↦ 배열 인덱스 맵. */
export function idToIndex(molecule: Molecule): MoleculeIdCodec {
  const atomIndexOf = new Map<AtomId, number>();
  molecule.atoms.forEach((a, i) => atomIndexOf.set(a.id, i));
  const bondIndexOf = new Map<BondId, number>();
  molecule.bonds.forEach((b, i) => bondIndexOf.set(b.id, i));
  return { atomIndexOf, bondIndexOf };
}

/**
 * 역직렬화 방향: 인덱스 기반 SerializedMolecule → 새 brand ID 를 부여한
 * Molecule 의 구조적 핵심. 동일 입력 → 동일 구조(brand ID 값만 새로 생성).
 * 스칼라 메타(canonicalSmiles/inchi/...)는 호출측(data/compounds·io 경계)이
 * 합성하여 완전한 Molecule 을 만든다.
 *
 * 주: phase-01 §4.2 의 `indexToId(raw): Molecule` 시그니처는 *예시적*이다.
 * SerializedMolecule 자체가 스칼라를 갖지 않으므로(문서 정의), 실제 구현은
 * moleculeId 를 인자로 받고 MoleculeCore 를 반환한다 (호출측이 스칼라 합성).
 */
export function indexToId(raw: SerializedMolecule, moleculeId: MoleculeId): MoleculeCore {
  const atomIds: AtomId[] = raw.atoms.map(() => createAtomId());
  const atoms: Atom[] = raw.atoms.map((sa, i) => {
    const [x, y, z] = sa.position;
    const position: Vec3 = { x, y, z };
    const atom: Atom = {
      id: atomIds[i]!,
      elementNumber: sa.elementNumber as Atom['elementNumber'],
      position,
      formalCharge: sa.formalCharge,
      implicitHCount: sa.implicitHCount,
    };
    return atom;
  });

  const bonds: Bond[] = raw.bonds.map((sb) => {
    const a = atomIds[sb.aAtomIndex];
    const b = atomIds[sb.bAtomIndex];
    if (a === undefined || b === undefined) {
      throw new Error(
        `indexToId: bond references out-of-range atom index ` +
          `(aAtomIndex=${sb.aAtomIndex}, bAtomIndex=${sb.bAtomIndex}, atoms=${raw.atoms.length})`,
      );
    }
    return { id: createBondId(), aAtomId: a, bAtomId: b, order: sb.order };
  });

  return { id: moleculeId, atoms, bonds, totalCharge: raw.totalCharge };
}
