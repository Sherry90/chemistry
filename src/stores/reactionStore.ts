// Phase 07 §4.3 / §5.2 / §6.2 — reactionStore.
// predict 진입점 + AbortController(모듈-레벨 격리, P5) + 조건/반응물 관리.
import { castDraft } from 'immer';
import type { Condition } from '@/chemistry/reactions/types';
import { predict, type PredictOutput } from '@/engine/reaction';
import { createAppStore } from './_shared/createStore';
import type { MoleculeId } from './_shared/types';
import {
  withGlobalLoading,
  notifyReactionError,
  collectReactantMolecules,
} from './_shared/_crossStore';
import { makeInitialReactionState, type ReactionStoreState } from './reactionStore.types';

export type { ReactionStoreState };

export interface ReactionStoreActions {
  setCondition(c: Condition): void;
  patchCondition(patch: Partial<Condition>): void;
  addReactant(id: MoleculeId): void;
  removeReactant(id: MoleculeId): void;
  setReactants(ids: ReadonlyArray<MoleculeId>): void;
  clearReactants(): void;

  /**
   * predict 진입점. 직전 호출이 loading 이면 P5 에 따라 abort() 후 새 controller.
   * 가장 최신 호출만 run 에 commit. 반환값은 호출자 즉시 분기용.
   */
  run(opts?: { force?: boolean }): Promise<PredictOutput>;
  cancel(): void;
  clearResult(): void;
}

export type ReactionStore = ReactionStoreState & {
  readonly actions: ReactionStoreActions;
};

/**
 * 진행 중 predict controller — state 밖(모듈-레벨) 격리. devtools 직렬화 /
 * getState() 노출 / persist 충돌 회피 (§4.3). 단일 진행 호출만 추적 (P5).
 */
let inflightReactionController: AbortController | null = null;

/** 테스트 전용 — 모듈-레벨 controller 리셋. */
export function __resetReactionInflight(): void {
  inflightReactionController?.abort();
  inflightReactionController = null;
}

export const useReactionStore = createAppStore<ReactionStore>('reactionStore', (set, get) => ({
  ...makeInitialReactionState(),
  actions: {
    setCondition: (c) =>
      set((s) => {
        s.condition = { ...c };
      }),
    patchCondition: (patch) =>
      set((s) => {
        s.condition = { ...s.condition, ...patch };
      }),

    addReactant: (id) =>
      set((s) => {
        if (!s.reactantSelected[id]) {
          s.reactantSelected[id] = true;
          s.reactantIds.push(id);
        }
      }),
    removeReactant: (id) =>
      set((s) => {
        if (s.reactantSelected[id]) {
          delete s.reactantSelected[id];
          s.reactantIds = s.reactantIds.filter((x) => x !== id);
        }
      }),
    setReactants: (ids) =>
      set((s) => {
        const next: Record<MoleculeId, true> = {};
        for (const id of ids) next[id] = true;
        s.reactantSelected = next;
        s.reactantIds = [...ids];
      }),
    clearReactants: () =>
      set((s) => {
        s.reactantSelected = {};
        s.reactantIds = [];
      }),

    run: async (opts) => {
      inflightReactionController?.abort();
      const controller = new AbortController();
      inflightReactionController = controller;
      set((s) => {
        s.run = { kind: 'loading', startedAt: Date.now() };
      });

      return withGlobalLoading(async (): Promise<PredictOutput> => {
        const { reactantIds, condition } = get();
        let outcome: PredictOutput;
        try {
          outcome = await predict(
            {
              reactants: collectReactantMolecules(reactantIds),
              condition,
            },
            { signal: controller.signal, force: opts?.force ?? false },
          );
        } catch (e) {
          outcome = {
            ok: false,
            error: { kind: 'Internal', detail: String(e), retryable: false },
          };
        }

        // 가장 최신 호출만 commit (P5 stale guard).
        if (inflightReactionController !== controller) return outcome;
        inflightReactionController = null;
        set((s) => {
          if (outcome.ok) {
            s.run = castDraft({
              kind: 'success',
              value: outcome.value,
              settledAt: Date.now(),
            } as const);
            s.lastResult = castDraft(outcome.value);
            s.lastAppliedRuleId = outcome.value.appliedRuleId ?? null;
          } else {
            s.run = castDraft({
              kind: 'error',
              error: outcome.error,
              settledAt: Date.now(),
            } as const);
          }
        });

        if (!outcome.ok) notifyReactionError(outcome.error); // Aborted 는 내부에서 skip
        return outcome;
      });
    },

    cancel: () => {
      inflightReactionController?.abort();
      inflightReactionController = null;
      set((s) => {
        if (s.run.kind === 'loading') s.run = { kind: 'idle' };
      });
    },

    clearResult: () =>
      set((s) => {
        s.lastResult = null;
        s.lastAppliedRuleId = null;
        s.run = { kind: 'idle' };
      }),
  },
}));
