// Phase 07 §4.2 / §5.1 / §6.2 / §6.4 — moleculeStore.
// 비동기 진입점(텍스트/CID) + 동기 편집(undoable) + Undo/Redo placeholder.
import { castDraft } from 'immer';
import type { Molecule, Atom } from '@/chemistry/compounds/types';
import type { Bond, BondOrder } from '@/chemistry/bonds/types';
import { createBondId, moleculeIdForCid } from '@/chemistry/compounds/ids';
import { withRegeneratedIds } from '@/chemistry/compounds/regenerateIds';
import {
  parseSmiles,
  parseInchi,
  parseFormula,
  formulaToParsedMol,
  toMoleculeWith3D,
} from '@/engine';
import { getCompoundByCid } from '@/services/pubchem';
import type { Result } from '@/types/result';
import { ok, err } from '@/types/result';
import { logger } from '@/utils/logger';
// Phase 13 §4.8 / §6.14 — CD6: 세션 변환 helper 는 chemistry 계층 (stores→io 역행 없음).
import type { SessionFile } from '@/chemistry/session/types';
import { fromSnapshot } from '@/chemistry/session/snapshot';
import type { ImportError } from '@/io/_shared/errors';
import { createAppStore } from './_shared/createStore';
// Phase 09: placeholder → swappable `dispatcher` 싱글톤 (phase-11 §1942 패턴).
// 액션 본문 불변 — createUndoStack() 주입은 setUndoDispatcher 가 처리.
import { dispatcher } from './_shared/undoable';
import { newMoleculeId, type IngestError, type MoleculeId } from './_shared/types';
import {
  withGlobalLoading,
  cascadeRemoveMolecule,
  applyImportedSessionCrossStore,
} from './_shared/_crossStore';
import { makeInitialMoleculeState, type MoleculeStoreState } from './moleculeStore.types';
import type { TextInputMode } from './uiStore.types';

export type { MoleculeStoreState };

export interface MoleculeStoreActions {
  // ── 비동기 진입점 ──
  addFromSmiles(input: string): Promise<Result<MoleculeId, IngestError>>;
  addFromInchi(input: string): Promise<Result<MoleculeId, IngestError>>;
  addFromCompound(cid: number): Promise<Result<MoleculeId, IngestError>>;

  // ── Phase 12 §5.4 retrofit (텍스트 입력 파이프라인) ──
  /**
   * 분자식 입력으로 Molecule 생성 + 작업공간 적재.
   * 1. parseFormula(input) → FormulaComposition 또는 ParseError
   * 2. formulaToParsedMol(comp) → ParsedMol 또는 ParseError (FormulaUnsupported 포함)
   * 3. toMoleculeWith3D(parsed) → Molecule 또는 EmbedError
   * 4. duplicate 검출 (InChIKey)
   * 5. molecules + activeId commit + ingest AsyncState success
   */
  addFromFormula(
    input: string,
    opts?: { signal?: AbortSignal },
  ): Promise<Result<MoleculeId, IngestError>>;
  /**
   * 텍스트 입력의 preview — Molecule 만 반환, state commit 없음.
   * ingest AsyncState 변경 안 함. 호출자가 panel-local state 로 보관.
   */
  previewFromText(args: {
    readonly kind: TextInputMode;
    readonly raw: string;
    readonly signal?: AbortSignal;
  }): Promise<Result<Molecule, IngestError>>;

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

  // ── Phase 13 retrofit (§4.8 / §5.4 / §6.14) ──
  /**
   * 모든 분자 clear + imported batch 적재 (replace 모드 진입점).
   * 단일 entry undoable. activeMoleculeId 가 molecules 안에 있으면 그 ID 로 setActive,
   * 아니면 첫 id 또는 null.
   * **kind 결정**: phase-07 UndoableActionKind union 에 `'molecule.import-replace'` 미존재 →
   * 새 kind 추가 회피하기 위해 기존 `'molecule.replace'` 재사용 (advisor 결정).
   */
  replaceAll(
    molecules: ReadonlyArray<Molecule>,
    opts?: { activeMoleculeId?: MoleculeId | null },
  ): void;

  /**
   * JSON Import 의 high-level 진입점.
   * 1. 사전 검증 단계 (G8 트랜잭션 보장) — 모든 fromSnapshot 시도. 실패 시 PartiallyFailed
   *    즉시 반환 (상태 변경 없음).
   * 2. mode='replace' → replaceAll + cross-store (condition/viewport) 적용.
   * 3. mode='append' → 각 분자 InChIKey 매칭 검사 → 매칭 시 skip, 아니면 addFromMolecule
   *    호출. duplicate 검출은 본 함수 내부에 격리 (옵션 Y — addFromMolecule 시그니처 무변경).
   * 4. dispatcher.clear() — 양쪽 모드 (D8: import = 새 baseline).
   * 5. selection 복원은 v1 skip (W2.1 export 시 selection 빈 배열로 직렬화).
   */
  applyImportedSession(
    session: SessionFile,
    opts?: { mode: 'replace' | 'append' },
  ): Promise<Result<{ imported: number; skipped: number }, ImportError>>;

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

      // ── Phase 12 §5.4 retrofit ──
      addFromFormula: async (input, opts) => {
        const seq = ++ingestSeq;
        const signal = opts?.signal;
        set((s) => {
          s.ingest = { kind: 'loading', startedAt: Date.now() };
        });
        return withGlobalLoading(async (): Promise<Result<MoleculeId, IngestError>> => {
          let result: Result<MoleculeId, IngestError>;
          try {
            if (signal?.aborted) {
              result = err({ kind: 'internal', message: 'aborted' });
            } else {
              const comp = parseFormula(input);
              if (!comp.ok) {
                result = err(mapParseError(comp.error));
              } else if (signal?.aborted) {
                result = err({ kind: 'internal', message: 'aborted' });
              } else {
                const parsed = await formulaToParsedMol(comp.value);
                if (!parsed.ok) {
                  result = err(mapParseError(parsed.error));
                } else if (signal?.aborted) {
                  result = err({ kind: 'internal', message: 'aborted' });
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
              }
            }
          } catch (e) {
            result = err(classifyThrow(e));
          }
          // stale-guard
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

      // state commit 없음 (ingest 변경 안 함, molecules 변경 안 함). 반환값만.
      previewFromText: async ({ kind, raw, signal }) => {
        try {
          if (signal?.aborted) return err({ kind: 'internal', message: 'aborted' });
          if (kind === 'smiles') {
            const parsed = await parseSmiles(raw);
            if (!parsed.ok) return err(mapParseError(parsed.error));
            if (signal?.aborted) return err({ kind: 'internal', message: 'aborted' });
            const embedded = await toMoleculeWith3D(parsed.value);
            if (!embedded.ok) return err({ kind: 'embed', detail: embedded.error });
            return ok(embedded.value);
          }
          if (kind === 'inchi') {
            const parsed = await parseInchi(raw);
            if (!parsed.ok) return err(mapParseError(parsed.error));
            if (signal?.aborted) return err({ kind: 'internal', message: 'aborted' });
            const embedded = await toMoleculeWith3D(parsed.value);
            if (!embedded.ok) return err({ kind: 'embed', detail: embedded.error });
            return ok(embedded.value);
          }
          // kind === 'formula'
          const comp = parseFormula(raw);
          if (!comp.ok) return err(mapParseError(comp.error));
          if (signal?.aborted) return err({ kind: 'internal', message: 'aborted' });
          const parsed = await formulaToParsedMol(comp.value);
          if (!parsed.ok) return err(mapParseError(parsed.error));
          if (signal?.aborted) return err({ kind: 'internal', message: 'aborted' });
          const embedded = await toMoleculeWith3D(parsed.value);
          if (!embedded.ok) return err({ kind: 'embed', detail: embedded.error });
          return ok(embedded.value);
        } catch (e) {
          return err(classifyThrow(e));
        }
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

      // ── Phase 13 §4.8 / §6.14 retrofit ──
      replaceAll: (molecules, opts) =>
        dispatcher.dispatchUndoable(
          { undoable: true, kind: 'molecule.replace', labelKey: 'stores.undo.moleculeReplace' },
          () =>
            set((s) => {
              s.molecules = {};
              s.ids = [];
              for (const m of molecules) {
                s.molecules[m.id] = castDraft(m);
                s.ids.push(m.id);
              }
              const requested = opts?.activeMoleculeId;
              if (requested && s.molecules[requested]) {
                s.activeId = requested;
              } else {
                s.activeId = s.ids[0] ?? null;
              }
            }),
        ),

      applyImportedSession: async (session, opts) => {
        const mode = opts?.mode ?? 'replace';

        // 1. 사전 검증 단계 (G8 트랜잭션 보장) — fromSnapshot 은 순수 변환이지만
        //    방어적으로 try/catch 로 감싼다.
        const conversions: Array<
          { ok: true; value: Molecule } | { ok: false; reason: string; index: number }
        > = session.molecules.map((snap, index) => {
          try {
            return { ok: true, value: fromSnapshot(snap) } as const;
          } catch (e) {
            return {
              ok: false,
              reason: e instanceof Error ? e.message : String(e),
              index,
            } as const;
          }
        });

        const failures = conversions.flatMap((r) =>
          r.ok ? [] : [{ moleculeIndex: r.index, reason: r.reason }],
        );

        // 모두 실패 — 진행 무의미
        if (failures.length === session.molecules.length && session.molecules.length > 0) {
          return err({
            kind: 'PartiallyFailed',
            imported: 0,
            skipped: 0,
            errors: failures,
          });
        }

        // replace 모드의 부분 실패 — clear 전 즉시 반환 (상태 변경 없음, G8 트랜잭션 보장)
        if (failures.length > 0 && mode === 'replace') {
          return err({
            kind: 'PartiallyFailed',
            imported: 0,
            skipped: failures.length,
            errors: failures,
          });
        }

        const validMolecules: ReadonlyArray<Molecule> = conversions.flatMap((r) =>
          r.ok ? [r.value] : [],
        );

        // 2. mode='replace'
        if (mode === 'replace') {
          get().actions.replaceAll(validMolecules, {
            activeMoleculeId: session.activeMoleculeId,
          });
          // 3. cross-store: condition / viewport (selection 복원은 v1 skip — TODO phase-13 follow-up)
          applyImportedSessionCrossStore(session);
          // 4. dispatcher.clear() (D8 — import = 새 baseline)
          dispatcher.clear();
          return ok({ imported: validMolecules.length, skipped: failures.length });
        }

        // 3. mode='append' — duplicate 검출 (옵션 Y)
        const { molecules: existingMols, ids: existingIds } = get();
        const existingInchiKeys = new Set<string>();
        for (const id of existingIds) {
          const k = existingMols[id]?.inchiKey;
          if (k) existingInchiKeys.add(k);
        }

        let imported = 0;
        let skipped = failures.length;

        for (const m of validMolecules) {
          if (m.inchiKey && existingInchiKeys.has(m.inchiKey)) {
            skipped++;
            continue;
          }
          get().actions.addFromMolecule(m);
          imported++;
          if (m.inchiKey) existingInchiKeys.add(m.inchiKey);
        }

        // append 모드 = condition / viewport 미적용 (사용자 의도 보존, §6.14)
        // 4. dispatcher.clear() (D8 — replace/append 양쪽)
        dispatcher.clear();
        return ok({ imported, skipped });
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
