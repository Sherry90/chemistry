import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Molecule } from '@/chemistry/compounds/types';

const { parseSmiles, parseInchi, toMoleculeWith3D, getCompoundByCid } = vi.hoisted(() => ({
  parseSmiles: vi.fn(),
  parseInchi: vi.fn(),
  toMoleculeWith3D: vi.fn(),
  getCompoundByCid: vi.fn(),
}));
vi.mock('@/engine', () => ({ parseSmiles, parseInchi, toMoleculeWith3D }));
vi.mock('@/services/pubchem', () => ({ getCompoundByCid, resolveCompoundByName: vi.fn() }));
vi.mock('@/data/compounds', () => ({ searchCompoundManifest: vi.fn(() => []) }));
vi.mock('@/engine/reaction', () => ({ predict: vi.fn() }));

import { useMoleculeStore, __resetMoleculeInternals } from '@/stores/moleculeStore';
import { makeInitialMoleculeState } from '@/stores/moleculeStore.types';
import { useReactionStore } from '@/stores/reactionStore';
import { makeInitialReactionState } from '@/stores/reactionStore.types';
import { phase07PlaceholderDispatcher } from '@/stores/_shared/undoable';
import { moleculeIdForCid } from '@/chemistry/compounds/ids';
import { fakeMolecule, hardReset } from './_helpers';

const okParsed = { ok: true, value: { canonicalSmiles: 'CO' } } as const;

beforeEach(() => {
  __resetMoleculeInternals();
  hardReset(useMoleculeStore, makeInitialMoleculeState);
  hardReset(useReactionStore, makeInitialReactionState);
  vi.clearAllMocks();
});

describe('moleculeStore — addFromSmiles', () => {
  it('idle → loading → success; molecule + activeId committed', async () => {
    parseSmiles.mockResolvedValue(okParsed);
    toMoleculeWith3D.mockResolvedValue({ ok: true, value: fakeMolecule() });

    const p = useMoleculeStore.getState().actions.addFromSmiles('CO');
    expect(useMoleculeStore.getState().ingest.kind).toBe('loading');
    const res = await p;

    expect(res.ok).toBe(true);
    const st = useMoleculeStore.getState();
    expect(st.ingest.kind).toBe('success');
    expect(st.ids).toHaveLength(1);
    expect(st.activeId).toBe(st.ids[0]);
  });

  it('parse failure → ingest error kind=parse', async () => {
    parseSmiles.mockResolvedValue({
      ok: false,
      error: { code: 'SmilesSyntax', message: 'bad' },
    });
    const res = await useMoleculeStore.getState().actions.addFromSmiles('???');
    expect(res.ok).toBe(false);
    const ing = useMoleculeStore.getState().ingest;
    expect(ing.kind).toBe('error');
    if (ing.kind === 'error') expect(ing.error.kind).toBe('parse');
  });

  it('two concurrent calls: only the latest commits (stale guard)', async () => {
    parseSmiles.mockResolvedValue(okParsed);
    let resolveFirst!: (v: unknown) => void;
    toMoleculeWith3D
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r as (v: unknown) => void)))
      .mockResolvedValueOnce({ ok: true, value: fakeMolecule({ canonicalSmiles: 'SECOND' }) });

    const p1 = useMoleculeStore.getState().actions.addFromSmiles('A');
    const p2 = useMoleculeStore.getState().actions.addFromSmiles('B');
    // parseSmiles await 통과 후에야 toMoleculeWith3D(=resolveFirst 캡처)가 호출됨.
    await vi.waitFor(() => expect(resolveFirst).toBeTypeOf('function'));
    resolveFirst({ ok: true, value: fakeMolecule({ canonicalSmiles: 'FIRST' }) });
    await Promise.all([p1, p2]);

    const st = useMoleculeStore.getState();
    expect(st.ids).toHaveLength(1); // first never committed
    expect(st.ingest.kind).toBe('success');
    expect(st.molecules[st.ids[0]!]!.canonicalSmiles).toBe('SECOND');
  });
});

describe('moleculeStore — addFromCompound', () => {
  it('uses moleculeIdForCid as the stable id', async () => {
    getCompoundByCid.mockResolvedValue({
      ok: true,
      value: { inchiKey: 'X', smiles: 'CO', defaultMolecule: fakeMolecule() },
    });
    const cid = 962;
    const res = await useMoleculeStore.getState().actions.addFromCompound(cid);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toBe(moleculeIdForCid(cid));
    expect(useMoleculeStore.getState().molecules[moleculeIdForCid(cid)]).toBeTruthy();
  });

  it('same CID twice → duplicate with existingId', async () => {
    getCompoundByCid.mockResolvedValue({
      ok: true,
      value: { inchiKey: 'X', smiles: 'CO', defaultMolecule: fakeMolecule() },
    });
    await useMoleculeStore.getState().actions.addFromCompound(123);
    const res = await useMoleculeStore.getState().actions.addFromCompound(123);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe('duplicate');
      if (res.error.kind === 'duplicate') expect(res.error.existingId).toBe(moleculeIdForCid(123));
    }
  });
});

describe('moleculeStore — subscribeWithSelector handoff (Phase 08)', () => {
  it('exposes the selector subscribe overload', () => {
    const seen: Array<string | null> = [];
    const unsub = useMoleculeStore.subscribe(
      (s) => s.activeId,
      (next) => seen.push(next),
      { fireImmediately: true },
    );
    expect(typeof unsub).toBe('function');
    unsub();
  });
});

describe('moleculeStore — edits', () => {
  it('removeMolecule cascades into reactionStore reactantIds', async () => {
    parseSmiles.mockResolvedValue(okParsed);
    toMoleculeWith3D.mockResolvedValue({ ok: true, value: fakeMolecule() });
    await useMoleculeStore.getState().actions.addFromSmiles('CO');
    const id = useMoleculeStore.getState().ids[0]!;

    useReactionStore.getState().actions.addReactant(id);
    expect(useReactionStore.getState().reactantIds).toContain(id);

    useMoleculeStore.getState().actions.removeMolecule(id);
    expect(useMoleculeStore.getState().molecules[id]).toBeUndefined();
    expect(useReactionStore.getState().reactantIds).not.toContain(id);
  });

  it('moveAtom dispatches an undoable atom.move meta', async () => {
    parseSmiles.mockResolvedValue(okParsed);
    toMoleculeWith3D.mockResolvedValue({ ok: true, value: fakeMolecule() });
    await useMoleculeStore.getState().actions.addFromSmiles('CO');
    const id = useMoleculeStore.getState().ids[0]!;

    const spy = vi.spyOn(phase07PlaceholderDispatcher, 'dispatchUndoable');
    useMoleculeStore.getState().actions.moveAtom(id, 0, [9, 9, 9]);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'atom.move', undoable: true }),
      expect.any(Function),
    );
    expect(useMoleculeStore.getState().molecules[id]!.atoms[0]!.position).toEqual({
      x: 9,
      y: 9,
      z: 9,
    });
    spy.mockRestore();
  });

  it('replace() forces id preservation even if next carries a stray id', async () => {
    parseSmiles.mockResolvedValue(okParsed);
    toMoleculeWith3D.mockResolvedValue({ ok: true, value: fakeMolecule() });
    await useMoleculeStore.getState().actions.addFromSmiles('CO');
    const id = useMoleculeStore.getState().ids[0]!;

    const stray = fakeMolecule({ canonicalSmiles: 'REPLACED' }); // 다른 id 보유
    expect(stray.id).not.toBe(id);
    useMoleculeStore.getState().actions.replace(id, stray);

    expect(useMoleculeStore.getState().molecules[id]!.id).toBe(id);
    expect(useMoleculeStore.getState().molecules[id]!.canonicalSmiles).toBe('REPLACED');
    expect(useMoleculeStore.getState().molecules[stray.id]).toBeUndefined();
  });

  it('setBondOrder yields a new molecule reference (immer structural share)', async () => {
    parseSmiles.mockResolvedValue(okParsed);
    toMoleculeWith3D.mockResolvedValue({ ok: true, value: fakeMolecule() });
    await useMoleculeStore.getState().actions.addFromSmiles('CO');
    const id = useMoleculeStore.getState().ids[0]!;
    const before: Molecule = useMoleculeStore.getState().molecules[id]!;

    useMoleculeStore.getState().actions.setBondOrder(id, 0, 2);
    const after = useMoleculeStore.getState().molecules[id]!;
    expect(after).not.toBe(before);
    expect(after.bonds[0]!.order).toBe(2);
    expect(before.bonds[0]!.order).toBe(1); // 이전 객체 불변
  });
});
