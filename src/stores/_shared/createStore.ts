// Phase 07 §5.5 / §6.1 — 공통 미들웨어 합성.
// 순서(바깥→안): devtools → persist(선택) → subscribeWithSelector → immer.
//
// zustand v5 의 미들웨어 mutator 스레딩은 "적용 순서대로 outer→inner" 를 요구한다.
// persist 가 *선택적* 이라 두 합성 경로의 creator mutator 튜플이 달라진다
// (값 레벨 분기라 단일 제네릭 타입으로 둘 다 만족 불가). 따라서 creator 본문은
// `AppStateCreator<T>` 로 강타입(immer draft set) 을 유지하고, 합성 파이프라인에서만
// 본 헬퍼 내부에 국한된 cast 를 둔다 (런타임 정확, 호출측 타입 영향 0).
import { create, type StateCreator, type StoreApi, type UseBoundStore, type Mutate } from 'zustand';
import { devtools, persist, subscribeWithSelector, type PersistOptions } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

/**
 * 각 스토어 creator 의 공개 타입. `set` 은 immer draft 세터,
 * 외부 구독은 subscribeWithSelector 로 가능.
 */
export type AppStateCreator<T> = StateCreator<
  T,
  [['zustand/immer', never], ['zustand/subscribeWithSelector', never]],
  [],
  T
>;

/**
 * 합성 파이프라인의 `as never` cast 가 mutator 타입 스레딩을 끊으므로 반환 타입을
 * 명시 고정한다. 소비자(Phase 08)가 의존하는 표면: `.subscribe(selector, listener, opts)`
 * (subscribeWithSelector) + immer draft `setState`. devtools/persist 는 런타임에만
 * 적용 — 소비자/테스트가 `.persist` 등을 타입으로 요구하지 않음.
 */
export type AppStore<T> = UseBoundStore<
  Mutate<StoreApi<T>, [['zustand/subscribeWithSelector', never], ['zustand/immer', never]]>
>;

const DEVTOOLS_ENABLED = import.meta.env.DEV;

/**
 * `devtools(persist?(subscribeWithSelector(immer(creator))))` 합성.
 * persistOptions 가 있으면 persist 적용 (settingsStore 만), 없으면 생략.
 * devtools 는 `import.meta.env.DEV` 게이트 — PROD 빌드에서 트리쉐이크.
 */
export function createAppStore<T extends object, P = T>(
  name: string,
  creator: AppStateCreator<T>,
  persistOptions?: PersistOptions<T, P>,
): AppStore<T> {
  // immer / subscribeWithSelector 는 항상 적용. mutator 스레딩은 합성 시점에만
  // 관여하므로 헬퍼 내부 cast 로 흡수 (creator 본문 타입은 위 AppStateCreator 가 보장).
  type Loose = StateCreator<T, [], []>;
  const innermost = subscribeWithSelector(immer(creator)) as unknown as Loose;
  const persisted: Loose = persistOptions
    ? (persist(innermost as never, persistOptions) as unknown as Loose)
    : innermost;
  return create<T>()(
    devtools(persisted as never, { name, enabled: DEVTOOLS_ENABLED }),
  ) as unknown as AppStore<T>;
}
