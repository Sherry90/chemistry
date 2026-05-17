// Phase 08 §5.4 — composite ViewportId 인코드/디코드.
// 형식: `${molId}::a:${atomId}` (atom) / `${molId}::b:${bondId}` (bond).
// molId 는 UUID(`[0-9a-f-]+`) 또는 `cid:{CID}` — 단일 `:` 만 포함하므로 `::` 분리 안전 (R10).
import type { AtomId, BondId, MoleculeId } from '@/chemistry/compounds/ids';
import type { ViewportAtomId, ViewportBondId, ViewportId } from '../_shared/types';

const SEP = '::';

export function viewportIdForAtom(molId: MoleculeId, atomId: AtomId): ViewportAtomId {
  return `${molId}${SEP}a:${atomId}` as ViewportAtomId;
}

export function viewportIdForBond(molId: MoleculeId, bondId: BondId): ViewportBondId {
  return `${molId}${SEP}b:${bondId}` as ViewportBondId;
}

/** 실패 시 null. prefix `a:`/`b:` 가 kind 를 캐리. */
export function parseViewportId(s: string): ViewportId | null {
  const idx = s.indexOf(SEP);
  if (idx <= 0) return null;
  const molId = s.slice(0, idx) as MoleculeId;
  const rest = s.slice(idx + SEP.length);
  if (rest.length < 3) return null;
  const prefix = rest.slice(0, 2);
  const id = rest.slice(2);
  if (id.length === 0) return null;
  if (prefix === 'a:') return { kind: 'atom', molId, atomId: id as AtomId };
  if (prefix === 'b:') return { kind: 'bond', molId, bondId: id as BondId };
  return null;
}

/** uiStore.selection.atomIds(string[]) → viewport-side atom 디코드 (atom kind 만). */
export function parseSelectedAtoms(
  atomIds: ReadonlyArray<string>,
): ReadonlyArray<{ molId: MoleculeId; atomId: AtomId }> {
  const out: Array<{ molId: MoleculeId; atomId: AtomId }> = [];
  for (const s of atomIds) {
    const p = parseViewportId(s);
    if (p && p.kind === 'atom') out.push({ molId: p.molId, atomId: p.atomId });
  }
  return out;
}
