// Phase 07 §4.4 / §5.3 — uiStore. 선택 / 패널 / 뷰포트 옵션 / 전역 로딩 /
// 알림 큐 / 화합물 검색 sub-slice (D3·D4).
import { castDraft } from 'immer';
import type { Compound } from '@/chemistry/compounds/types';
import type { PubChemError } from '@/services/pubchem';
import { getCompoundByCid, resolveCompoundByName } from '@/services/pubchem';
import { searchCompoundManifest } from '@/data/compounds';
import { logger } from '@/utils/logger';
import { createAppStore } from './_shared/createStore';
import { clampNotifications } from './_shared/notifications';
import {
  makeInitialUiState,
  type CompoundSearchMode,
  type Notification,
  type PanelKey,
  type TextInputSeed,
  type UiStoreState,
} from './uiStore.types';

export type { UiStoreState };

export interface UiStoreActions {
  // ── 선택 ──
  setSelection(sel: { atomIds?: ReadonlyArray<string>; bondIds?: ReadonlyArray<string> }): void;
  clearSelection(): void;

  // ── 패널 ──
  setActivePanel(key: PanelKey | null): void;
  toggleCompoundBrowser(open?: boolean): void;
  togglePeriodicTable(open?: boolean): void;
  toggleReactionResult(open?: boolean): void;
  toggleTextInput(open?: boolean): void; // Phase 12
  setTextInputInitial(seed: TextInputSeed | null): void; // Phase 12

  // ── 뷰포트 표시 옵션 ──
  toggleAtomLabels(on?: boolean): void;
  setBackgroundOverride(mode: 'theme' | 'light' | 'dark'): void;

  // ── 전역 로딩 ──
  beginLoading(): void;
  endLoading(): void;

  // ── 알림 ──
  notify(n: NotifyInput): string;
  dismissNotification(id: string): void;
  clearNotifications(): void;

  // ── 화합물 검색 ──
  setCompoundSearchQuery(q: string): void;
  setCompoundSearchMode(m: CompoundSearchMode): void;
  // 의도적 deviation: 문서 §5.3 의 `opts?: { signal }` 미수용. store 가 자체
  // controller 로 이전 검색을 abort-replace (P5 패턴) 하므로 외부 signal 은 충돌.
  runCompoundSearch(): Promise<void>;
  selectCompoundSearchResult(cid: number | null): void;
  clearCompoundSearch(): void;
}

/** notify 입력 — id/createdAt 은 store 가 생성, dismissAfterMs 는 선택(기본 null). */
export type NotifyInput = Omit<Notification, 'id' | 'createdAt' | 'dismissAfterMs'> & {
  dismissAfterMs?: number | null;
};

export type UiStore = UiStoreState & { readonly actions: UiStoreActions };

// 진행 중 검색 controller 는 state 밖(모듈 레벨) 격리 — devtools/persist/getState 노출 회피.
let inflightSearch: AbortController | null = null;

/** 테스트 전용 — 모듈 레벨 inflight 리셋 (setState(init,true) 로는 못 지움). */
export function __resetUiInternals(): void {
  inflightSearch?.abort();
  inflightSearch = null;
}

const notFound = (mode: CompoundSearchMode, value: string | number): PubChemError => ({
  kind: 'NotFound',
  query: { type: mode === 'cid' ? 'cid' : 'name', value },
  retryable: false,
});

export const useUiStore = createAppStore<UiStore>('uiStore', (set, get) => ({
  ...makeInitialUiState(),
  actions: {
    setSelection: (sel) =>
      set((s) => {
        if (sel.atomIds) s.selection.atomIds = [...sel.atomIds];
        if (sel.bondIds) s.selection.bondIds = [...sel.bondIds];
      }),
    clearSelection: () =>
      set((s) => {
        s.selection.atomIds = [];
        s.selection.bondIds = [];
      }),

    setActivePanel: (key) =>
      set((s) => {
        s.panels.active = key;
      }),
    toggleCompoundBrowser: (open) =>
      set((s) => {
        s.panels.isCompoundBrowserOpen = open ?? !s.panels.isCompoundBrowserOpen;
      }),
    togglePeriodicTable: (open) =>
      set((s) => {
        s.panels.isPeriodicTableOpen = open ?? !s.panels.isPeriodicTableOpen;
      }),
    toggleReactionResult: (open) =>
      set((s) => {
        s.panels.isReactionResultOpen = open ?? !s.panels.isReactionResultOpen;
      }),

    // Phase 12 §5.3 — text-input 모달 토글. 닫을 때 seed 자동 cleanup.
    toggleTextInput: (open) =>
      set((s) => {
        const next = open ?? !s.panels.isTextInputOpen;
        s.panels.isTextInputOpen = next;
        if (!next) {
          s.panels.textInputInitial = null;
        }
      }),
    setTextInputInitial: (seed) =>
      set((s) => {
        s.panels.textInputInitial = seed;
      }),

    toggleAtomLabels: (on) =>
      set((s) => {
        s.viewport.showAtomLabels = on ?? !s.viewport.showAtomLabels;
      }),
    setBackgroundOverride: (mode) =>
      set((s) => {
        s.viewport.backgroundOverride = mode;
      }),

    beginLoading: () =>
      set((s) => {
        s.globalLoading.count += 1;
      }),
    endLoading: () =>
      set((s) => {
        s.globalLoading.count = Math.max(0, s.globalLoading.count - 1);
      }),

    notify: (n) => {
      const id = crypto.randomUUID();
      const entry: Notification = {
        id,
        level: n.level,
        messageKey: n.messageKey,
        createdAt: Date.now(),
        dismissAfterMs: n.dismissAfterMs ?? null,
        ...(n.messageParams !== undefined ? { messageParams: n.messageParams } : {}),
      };
      set((s) => {
        s.notifications = castDraft(clampNotifications([...s.notifications, entry]));
      });
      return id;
    },
    dismissNotification: (id) =>
      set((s) => {
        s.notifications = s.notifications.filter((x) => x.id !== id);
      }),
    clearNotifications: () =>
      set((s) => {
        s.notifications = [];
      }),

    setCompoundSearchQuery: (q) =>
      set((s) => {
        // 결과는 보존 (사용자가 입력하는 동안 이전 결과 유지 — §8.3).
        s.compoundSearch.query = q;
      }),
    setCompoundSearchMode: (m) =>
      set((s) => {
        s.compoundSearch.mode = m;
      }),

    runCompoundSearch: async () => {
      inflightSearch?.abort();
      const controller = new AbortController();
      inflightSearch = controller;

      const { query, mode } = get().compoundSearch;
      set((s) => {
        s.compoundSearch.selectedCid = null; // 새 검색 → 이전 미리보기 무효 (#1)
        s.compoundSearch.results = { kind: 'loading', startedAt: Date.now() };
      });

      get().actions.beginLoading();
      try {
        let value: ReadonlyArray<Compound> | null = null;
        let error: PubChemError | null = null;

        if (mode === 'cid') {
          const cid = Number.parseInt(query.trim(), 10);
          if (!Number.isFinite(cid) || cid <= 0) {
            error = notFound('cid', query);
          } else {
            const r = await getCompoundByCid(cid, { signal: controller.signal });
            if (r.ok) value = [r.value];
            else error = r.error;
          }
        } else if (mode === 'formula') {
          const entries = searchCompoundManifest({ query, limit: 20 });
          if (entries.length === 0) {
            error = notFound('formula', query);
          } else {
            const resolved = await Promise.all(
              entries.map((e) => getCompoundByCid(e.cid, { signal: controller.signal })),
            );
            const ok = resolved.flatMap((r) => (r.ok ? [r.value] : []));
            if (ok.length === 0) error = notFound('formula', query);
            else value = ok;
          }
        } else {
          const r = await resolveCompoundByName(query, { signal: controller.signal });
          if (r.ok) value = [r.value];
          else error = r.error;
        }

        // 가장 최신 호출만 commit (stale guard).
        if (inflightSearch !== controller) return;
        inflightSearch = null;
        set((s) => {
          s.compoundSearch.results = castDraft(
            value != null
              ? ({ kind: 'success', value, settledAt: Date.now() } as const)
              : ({ kind: 'error', error: error!, settledAt: Date.now() } as const),
          );
        });
      } catch (e) {
        if (inflightSearch !== controller) return;
        inflightSearch = null;
        logger.warn('uiStore: compound search threw', { error: String(e) });
        set((s) => {
          s.compoundSearch.results = castDraft({
            kind: 'error',
            error: { kind: 'Network', cause: String(e), retryable: true },
            settledAt: Date.now(),
          } as const);
        });
      } finally {
        get().actions.endLoading();
      }
    },
    selectCompoundSearchResult: (cid) =>
      set((s) => {
        s.compoundSearch.selectedCid = cid;
      }),
    clearCompoundSearch: () => {
      inflightSearch?.abort();
      inflightSearch = null;
      set((s) => {
        s.compoundSearch.query = '';
        s.compoundSearch.results = { kind: 'idle' };
        s.compoundSearch.selectedCid = null;
      });
    },
  },
}));
