// Phase 07 §6.5 — selector 안정성 보조.
// 빈 컬렉션은 모듈 상수(동일 참조)로 둬 매 렌더 리렌더 폭발을 막는다.
import type { Atom } from '@/chemistry/compounds/types';
import type { Bond } from '@/chemistry/bonds/types';
import type { MoleculeId } from '@/chemistry/compounds/ids';

export const EMPTY_ATOMS: ReadonlyArray<Atom> = Object.freeze([]);
export const EMPTY_BONDS: ReadonlyArray<Bond> = Object.freeze([]);
export const EMPTY_IDS: ReadonlyArray<MoleculeId> = Object.freeze([]);
export const EMPTY_STRINGS: ReadonlyArray<string> = Object.freeze([]);
