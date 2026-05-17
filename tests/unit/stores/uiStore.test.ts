import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Compound } from '@/chemistry/compounds/types';

// 무거운 도메인 의존은 mock (cross-store 순환으로 store 그래프 전체가 로드됨).
const { getCompoundByCid, resolveCompoundByName, searchCompoundManifest } = vi.hoisted(() => ({
  getCompoundByCid: vi.fn(),
  resolveCompoundByName: vi.fn(),
  searchCompoundManifest: vi.fn(),
}));
vi.mock('@/services/pubchem', () => ({ getCompoundByCid, resolveCompoundByName }));
vi.mock('@/data/compounds', () => ({ searchCompoundManifest }));
vi.mock('@/engine', () => ({
  parseSmiles: vi.fn(),
  parseInchi: vi.fn(),
  toMoleculeWith3D: vi.fn(),
}));
vi.mock('@/engine/reaction', () => ({ predict: vi.fn() }));

import { useUiStore, __resetUiInternals } from '@/stores/uiStore';
import { makeInitialUiState } from '@/stores/uiStore.types';
import { NOTIFICATION_QUEUE_MAX } from '@/stores/_shared/notifications';
import { hardReset } from './_helpers';

const fakeCompound = (cid: number): Compound =>
  ({ cid, name: { ko: null, en: `c${cid}` } }) as unknown as Compound;

beforeEach(() => {
  __resetUiInternals();
  hardReset(useUiStore, makeInitialUiState);
  vi.clearAllMocks();
});

describe('uiStore — global loading', () => {
  it('balances begin/end and never drops below 0', () => {
    const { beginLoading, endLoading } = useUiStore.getState().actions;
    beginLoading();
    beginLoading();
    expect(useUiStore.getState().globalLoading.count).toBe(2);
    endLoading();
    endLoading();
    endLoading();
    endLoading();
    endLoading();
    expect(useUiStore.getState().globalLoading.count).toBe(0);
  });
});

describe('uiStore — notifications', () => {
  it('notify returns an id; dismiss removes exactly that one', () => {
    const a = useUiStore.getState().actions.notify({ level: 'info', messageKey: 'k.a' });
    const b = useUiStore.getState().actions.notify({ level: 'error', messageKey: 'k.b' });
    expect(useUiStore.getState().notifications).toHaveLength(2);
    useUiStore.getState().actions.dismissNotification(a);
    const left = useUiStore.getState().notifications;
    expect(left).toHaveLength(1);
    expect(left[0]!.id).toBe(b);
  });

  it('caps the queue at NOTIFICATION_QUEUE_MAX with drop-oldest (R7)', () => {
    const ids: string[] = [];
    for (let i = 0; i < NOTIFICATION_QUEUE_MAX + 10; i++) {
      ids.push(useUiStore.getState().actions.notify({ level: 'info', messageKey: `k${i}` }));
    }
    const q = useUiStore.getState().notifications;
    expect(q).toHaveLength(NOTIFICATION_QUEUE_MAX);
    // 가장 오래된 10개 축출 → 잔존 첫 항목 === 11번째(index 10) push id.
    expect(q[0]!.id).toBe(ids[10]);
  });

  it('defaults dismissAfterMs to null when omitted', () => {
    useUiStore.getState().actions.notify({ level: 'info', messageKey: 'k' });
    expect(useUiStore.getState().notifications[0]!.dismissAfterMs).toBeNull();
  });
});

describe('uiStore — compound search', () => {
  it('name mode: idle → loading → success', async () => {
    resolveCompoundByName.mockResolvedValue({ ok: true, value: fakeCompound(962) });
    useUiStore.getState().actions.setCompoundSearchQuery('water');
    const p = useUiStore.getState().actions.runCompoundSearch();
    expect(useUiStore.getState().compoundSearch.results.kind).toBe('loading');
    await p;
    const r = useUiStore.getState().compoundSearch.results;
    expect(r.kind).toBe('success');
    if (r.kind === 'success') expect(r.value).toHaveLength(1);
  });

  it('name mode error surfaces PubChemError', async () => {
    resolveCompoundByName.mockResolvedValue({
      ok: false,
      error: { kind: 'NotFound', query: { type: 'name', value: 'zzz' }, retryable: false },
    });
    useUiStore.getState().actions.setCompoundSearchQuery('zzz');
    await useUiStore.getState().actions.runCompoundSearch();
    const r = useUiStore.getState().compoundSearch.results;
    expect(r.kind).toBe('error');
  });

  it('setCompoundSearchQuery does NOT reset existing results', async () => {
    resolveCompoundByName.mockResolvedValue({ ok: true, value: fakeCompound(1) });
    await useUiStore.getState().actions.runCompoundSearch();
    expect(useUiStore.getState().compoundSearch.results.kind).toBe('success');
    useUiStore.getState().actions.setCompoundSearchQuery('typing...');
    expect(useUiStore.getState().compoundSearch.results.kind).toBe('success');
  });

  it('selectCompoundSearchResult updates selectedCid only, preserves results', async () => {
    resolveCompoundByName.mockResolvedValue({ ok: true, value: fakeCompound(5) });
    await useUiStore.getState().actions.runCompoundSearch();
    useUiStore.getState().actions.selectCompoundSearchResult(5);
    expect(useUiStore.getState().compoundSearch.selectedCid).toBe(5);
    expect(useUiStore.getState().compoundSearch.results.kind).toBe('success');
  });

  it('global loading toggles around the search', async () => {
    let peak = 0;
    resolveCompoundByName.mockImplementation(async () => {
      peak = useUiStore.getState().globalLoading.count;
      return { ok: true, value: fakeCompound(2) };
    });
    await useUiStore.getState().actions.runCompoundSearch();
    expect(peak).toBe(1);
    expect(useUiStore.getState().globalLoading.count).toBe(0);
  });
});
