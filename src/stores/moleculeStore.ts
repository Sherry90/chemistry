// Phase 07 §4.2 / §5.1 / §6.2 / §6.4 — moleculeStore.
// 비동기 진입점(텍스트/CID) + 동기 편집(undoable) + Undo/Redo placeholder.
import { castDraft } from 'immer';
import type { Molecule, Atom } from '@/chemistry/compounds/types';
import type { Bond, BondOrder } from '@/chemistry/bonds/types';
import { createBondId, moleculeIdForCid } from '@/chemistry/compounds/ids';
import { withRegeneratedIds } from '@/chemistry/compounds/regenerateIds';
import { parseSmiles, parseInchi, toMoleculeWith3D } from '@/engine';
import { getCompoundByCid } from '@/services/pubchem';
import type { Result } from '@/types/result';
import { ok, err } from '@/types/result';
import { logger } from '@/utils/logger';
import { createAppStore } from './_shared/createStore';
// Phase 09: placeholder → swappable `dispatcher` 싱글톤 (phase-11 §1942 패턴).
// 액션 본문 불변 — createUndoStack() 주입은 setUndoDispatcher 가 처리.
import { dispatcher } from './_shared/undoable';
import { newMoleculeId, type IngestError, type MoleculeId } from './_shared/types';
import { withGlobalLoading, cascadeRemoveMolecule } from './_shared/_crossStore';
import { makeInitialMoleculeState, type MoleculeStoreState } from './moleculeStore.types';

export type { MoleculeStoreState };

export interface MoleculeStoreActions {
  // ── 비동기 진입점 ──
  addFromSmiles(input: string): Promise<Result<MoleculeId, IngestError>>;
  addFromInchi(input: string): Promise<Result<MoleculeId, IngestError>>;
  addFromCompound(cid: number): Promise<Result<MoleculeId, IngestError>>;

  // ── 동기 ──
  setActive(id: MoleculeId | null): void; // 비-undoable (UI 포인터)
  removeMolecule(id: MoleculeId): void; // undoable: molecule.remove
  replace(id: MoleculeId, next: Molecule): void; // undoable: molecule.replace
  moveAtom(id: MoleculeId, atomIndex: number, position: readonly [number, number, number]): void; // undoable: atom.move
  setBondOrder(id: MoleculeId, bondIndex: number, order: BondOrder): void; // undoable: bond.setOrder
  addBond(id: MoleculeId, aAtomIndex: number, bAtomIndex: number, order: BondOrder): void; // undoable: bond.create
  removeBond(id: MoleculeId, bondIndex: number): void; // undoable: bond.break
  addAtom(id: MoleculeId, atom: Atom): void; // undoable: atom.add
  removeAtom(id: MoleculeId, atomIndex: number): void; // undoable: atom.remove

  // ── Phase 11 retrofit (D-LOAD-PRODUCTS, §6.12) ──
  /** ReactionResult.products 단일 분자를 작업공간 적재 (단일 entry undoable,
   *  ID 재발급, setActive). undoable: molecule.add-from-product. */
  addFromMolecule(m: Molecule): MoleculeId;
  /** 여러 분자를 하나의 undoable group 으로 적재. 마지막을 active. */
  addFromMolecules(ms: ReadonlyArray<Molecule>): ReadonlyArray<MoleculeId>;

  clear(): void; // 비-undoable (일괄 리셋)
  undo(): void;
  redo(): void;
}

export type MoleculeStore = MoleculeStoreState & {
  readonly actions: MoleculeStoreActions;
};

// 텍스트/CID 진입점 stale-guard — 엔진 진입점은 signal 미수용이므로 모듈-레벨
// 시퀀스로 "최신 호출만 commit" (advisor §1). setState(init,true) 로 못 지움 → 리셋 훅.
let ingestSeq = 0;

export function __resetMoleculeInternals(): void {
  ingestSeq = 0;
}

function classifyThrow(e: unknown): IngestError {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('RdkitBackend not set')) return { kind: 'rdkit-not-ready' };
  return { kind: 'internal', message: msg };
}

/** ParseError → IngestError. RdkitNotReady 만 별도 분기. */
function mapParseError(p: { code: string; message: string }): IngestError {
  if (p.code === 'RdkitNotReady') return { kind: 'rdkit-not-ready' };
  return { kind: 'parse', detail: p as never };
}

export const useMoleculeStore = createAppStore<MoleculeStore>('moleculeStore', (set, get) => {
  /** inchiKey 중복 탐지 — 동일 InChIKey 분자가 이미 있으면 그 id 반환. */
  function findDuplicateId(inchiKey: string | null): MoleculeId | null {
    if (!inchiKey) return null;
    const { molecules, ids } = get();
    for (const id of ids) {
      const m = molecules[id];
      if (m && m.inchiKey === inchiKey) return id;
    }
    return null;
  }

  function commitNewMolecule(mol: Molecule): MoleculeId {
    dispatcher.dispatchUndoable(
      { undoable: true, kind: 'molecule.create', labelKey: 'stores.undo.moleculeCreate' },
      () =>
        set((s) => {
          s.molecules[mol.id] = castDraft(mol);
          if (!s.ids.includes(mol.id)) s.ids.push(mol.id);
          s.activeId = mol.id;
        }),
    );
    return mol.id;
  }

  async function ingestFromText(
    input: string,
    parse: typeof parseSmiles,
  ): Promise<Result<MoleculeId, IngestError>> {
    const seq = ++ingestSeq;
    set((s) => {
      s.ingest = { kind: 'loading', startedAt: Date.now() };
    });
    return withGlobalLoading(async (): Promise<Result<MoleculeId, IngestError>> => {
      let result: Result<MoleculeId, IngestError>;
      try {
        const parsed = await parse(input);
        if (!parsed.ok) {
          result = err(mapParseError(parsed.error));
        } else {
          const embedded = await toMoleculeWith3D(parsed.value);
          if (!embedded.ok) {
            result = err({ kind: 'embed', detail: embedded.error });
          } else {
            const dup = findDuplicateId(embedded.value.inchiKey);
            if (dup) {
              result = err({ kind: 'duplicate', existingId: dup });
            } else {
              const mol: Molecule = { ...embedded.value, id: newMoleculeId() };
              result = ok(commitNewMolecule(mol));
            }
          }
        }
      } catch (e) {
        result = err(classifyThrow(e));
      }
      // stale: 더 최신 호출이 있으면 commit 안 함 (값은 반환).
      if (seq !== ingestSeq) return result;
      set((s) => {
        s.ingest = castDraft(
          result.ok
            ? ({ kind: 'success', value: result.value, settledAt: Date.now() } as const)
            : ({ kind: 'error', error: result.error, settledAt: Date.now() } as const),
        );
      });
      return result;
    });
  }

  return {
    ...makeInitialMoleculeState(),
    actions: {
      addFromSmiles: (input) => ingestFromText(input, parseSmiles),
      addFromInchi: (input) => ingestFromText(input, parseInchi),

      addFromCompound: async (cid) => {
        const seq = ++ingestSeq;
        set((s) => {
          s.ingest = { kind: 'loading', startedAt: Date.now() };
        });
        return withGlobalLoading(async (): Promise<Result<MoleculeId, IngestError>> => {
          let result: Result<MoleculeId, IngestError>;
          try {
            const mid = moleculeIdForCid(cid);
            if (get().molecules[mid]) {
              result = err({ kind: 'duplicate', existingId: mid });
            } else {
              const r = await getCompoundByCid(cid);
              if (!r.ok) {
                result = err({ kind: 'pubchem', detail: r.error });
              } else {
                const c = r.value;
                const dup = findDuplicateId(c.inchiKey);
                if (dup) {
                  result = err({ kind: 'duplicate', existingId: dup });
                } else if (c.defaultMolecule) {
                  const mol: Molecule = { ...c.defaultMolecule, id: mid };
                  result = ok(commitNewMolecule(mol));
                } else {
                  const parsed = await parseSmiles(c.smiles);
                  if (!parsed.ok) {
                    result = err(mapParseError(parsed.error));
                  } else {
                    const embedded = await toMoleculeWith3D(parsed.value);
                    if (!embedded.ok) {
                      result = err({ kind: 'embed', detail: embedded.error });
                    } else {
                      const mol: Molecule = { ...embedded.value, id: mid };
                      result = ok(commitNewMolecule(mol));
                    }
                  }
                }
              }
            }
          } catch (e) {
            result = err(classifyThrow(e));
          }
          if (seq !== ingestSeq) return result;
          set((s) => {
            s.ingest = castDraft(
              result.ok
                ? ({ kind: 'success', value: result.value, settledAt: Date.now() } as const)
                : ({ kind: 'error', error: result.error, settledAt: Date.now() } as const),
            );
          });
          return result;
        });
      },

      setActive: (id) =>
        set((s) => {
          s.activeId = id == null ? null : s.molecules[id] ? id : s.activeId;
        }),

      removeMolecule: (id) => {
        if (!get().molecules[id]) {
          logger.warn('moleculeStore.removeMolecule: unknown id', { id });
          return;
        }
        dispatcher.dispatchUndoable(
          { undoable: true, kind: 'molecule.remove', labelKey: 'stores.undo.moleculeRemove' },
          () =>
            set((s) => {
              delete s.molecules[id];
              s.ids = s.ids.filter((x) => x !== id);
              if (s.activeId === id) s.activeId = s.ids[0] ?? null;
            }),
        );
        cascadeRemoveMolecule(id); // P1 예외 — reaction/ui stale 정리
      },

      replace: (id, next) => {
        if (!get().molecules[id]) {
          logger.warn('moleculeStore.replace: unknown id', { id });
          return;
        }
        dispatcher.dispatchUndoable(
          { undoable: true, kind: 'molecule.replace', labelKey: 'stores.undo.moleculeReplace' },
          () =>
            set((s) => {
              s.molecules[id] = castDraft({ ...next, id }); // id 강제 보존 (advisor §6)
            }),
        );
      },

      moveAtom: (id, atomIndex, position) =>
        dispatcher.dispatchUndoable(
          { undoable: true, kind: 'atom.move', labelKey: 'stores.undo.atomMove' },
          () =>
            set((s) => {
              const m = s.molecules[id];
              const a = m?.atoms[atomIndex];
              if (!a) {
                logger.warn('moleculeStore.moveAtom: out of range', { id, atomIndex });
                return;
              }
              a.position = { x: position[0], y: position[1], z: position[2] };
            }),
        ),

      setBondOrder: (id, bondIndex, order) =>
        dispatcher.dispatchUndoable(
          { undoable: true, kind: 'bond.setOrder', labelKey: 'stores.undo.bondSetOrder' },
          () =>
            set((s) => {
              const b = s.molecules[id]?.bonds[bondIndex];
              if (!b) {
                logger.warn('moleculeStore.setBondOrder: out of range', { id, bondIndex });
                return;
              }
              b.order = order;
            }),
        ),

      addBond: (id, aAtomIndex, bAtomIndex, order) =>
        dispatcher.dispatchUndoable(
          { undoable: true, kind: 'bond.create', labelKey: 'stores.undo.bondCreate' },
          () =>
            set((s) => {
              const m = s.molecules[id];
              const a = m?.atoms[aAtomIndex];
              const b = m?.atoms[bAtomIndex];
              if (!m || !a || !b) {
                logger.warn('moleculeStore.addBond: out of range', {
                  id,
                  aAtomIndex,
                  bAtomIndex,
                });
                return;
              }
              const bond: Bond = {
                id: createBondId(),
                aAtomId: a.id,
                bAtomId: b.id,
                order,
              };
              m.bonds.push(bond);
            }),
        ),

      removeBond: (id, bondIndex) =>
        dispatcher.dispatchUndoable(
          { undoable: true, kind: 'bond.break', labelKey: 'stores.undo.bondBreak' },
          () =>
            set((s) => {
              const m = s.molecules[id];
              if (!m || !m.bonds[bondIndex]) {
                logger.warn('moleculeStore.removeBond: out of range', { id, bondIndex });
                return;
              }
              m.bonds.splice(bondIndex, 1);
            }),
        ),

      addAtom: (id, atom) =>
        dispatcher.dispatchUndoable(
          { undoable: true, kind: 'atom.add', labelKey: 'stores.undo.atomAdd' },
          () =>
            set((s) => {
              const m = s.molecules[id];
              if (!m) {
                logger.warn('moleculeStore.addAtom: unknown id', { id });
                return;
              }
              m.atoms.push(atom);
            }),
        ),

      removeAtom: (id, atomIndex) =>
        dispatcher.dispatchUndoable(
          { undoable: true, kind: 'atom.remove', labelKey: 'stores.undo.atomRemove' },
          () =>
            set((s) => {
              const m = s.molecules[id];
              const a = m?.atoms[atomIndex];
              if (!m || !a) {
                logger.warn('moleculeStore.removeAtom: out of range', { id, atomIndex });
                return;
              }
              const removedId = a.id;
              m.atoms.splice(atomIndex, 1);
              // 매달린 결합 제거 (원자 참조 무결성).
              m.bonds = m.bonds.filter(
                (bd) => bd.aAtomId !== removedId && bd.bAtomId !== removedId,
              );
            }),
        ),

      // ── Phase 11 retrofit (D-LOAD-PRODUCTS §6.12) ──
      addFromMolecule: (m) =>
        dispatcher.dispatchUndoable(
          {
            undoable: true,
            kind: 'molecule.add-from-product',
            labelKey: 'stores.undo.moleculeAddFromProduct',
          },
          () => {
            const newId = newMoleculeId();
            const next = withRegeneratedIds(m, newId);
            set((s) => {
              s.molecules[newId] = castDraft(next);
              if (!s.ids.includes(newId)) s.ids.push(newId);
              s.activeId = newId;
            });
            return newId;
          },
        ),

      addFromMolecules: (ms) => {
        const ids: MoleculeId[] = [];
        if (ms.length === 0) return ids;
        const batchId = crypto.randomUUID();
        dispatcher.dispatchUndoable(
          {
            undoable: true,
            kind: 'molecule.add-from-product',
            labelKey: 'stores.undo.moleculeAddFromProducts',
            group: `add-products-${batchId}`,
          },
          () =>
            set((s) => {
              for (const m of ms) {
                const newId = newMoleculeId();
                ids.push(newId);
                s.molecules[newId] = castDraft(withRegeneratedIds(m, newId));
                if (!s.ids.includes(newId)) s.ids.push(newId);
              }
              if (ids.length > 0) s.activeId = ids[ids.length - 1]!;
            }),
        );
        return ids;
      },

      clear: () =>
        set((s) => {
          s.molecules = {};
          s.ids = [];
          s.activeId = null;
          s.ingest = { kind: 'idle' };
        }),

      // D-UNDO-TOAST §6.13: undo 성공 시에만 lastUndoSeq +1 (redo/no-op 불변).
      undo: () => {
        if (dispatcher.canUndo()) {
          set((s) => {
            s.lastUndoSeq += 1;
          });
        }
        dispatcher.undo();
      },
      redo: () => dispatcher.redo(),
    },
  };
});
