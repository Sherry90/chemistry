# Phase 07 — State Management (Stores)

> 본 문서는 `architecture.md` §13 의 Phase 07 상세 설계서다. 코드 작성은 모든 details 문서의 검토가 끝난 뒤에만 시작한다.
>
> **선행 문서**: `architecture.md` (특히 §3.4, §3.7, §3.8, §3.10, §6, §7, §8, §11, §12), `details/phase-01-foundation.md`, `details/phase-02-element-data.md`, `details/phase-03-chemistry-engine.md`, `details/phase-04-compound-data-pipeline.md`, `details/phase-05-runtime-data-layer.md`, `details/phase-06-reaction-engine.md`.

---

## 1. 목적 (Purpose)

`architecture.md` §3.4 ③ 의 "스토어가 유일한 부수효과 지점" 원칙을 코드로 안착시킨다. 본 Phase 의 핵심 약속은 다음 네 가지다.

1. **4 스토어 책임 분리** — `moleculeStore` / `reactionStore` / `uiStore` / `settingsStore` 각각의 상태·액션·selector 면을 동결한다 (architecture §8.1).
2. **단일 부수효과 지점** — Phase 03 의 `smilesTo3DMolecule`, Phase 05 의 `getCompoundByCid`, Phase 06 의 `predict` 등 비동기 진입점은 **스토어 액션 안에서만** 호출된다. 패널/뷰포트는 selector 와 액션만 본다.
3. **AsyncState 표면화** — 모든 비동기 진입점은 `idle | loading | success | error` 의 4-상태 유니온으로 노출된다. UI 가 로딩/에러를 조건부 렌더로 처리할 수 있는 단일 모양.
4. **Phase 09 와의 인터페이스 동결** — Undo/Redo 의 _어떤 액션이 undoable 인지_ 와 _액션 메타 형태_ 만 본 Phase 가 동결한다. 스택 자료구조·스냅샷 전략·메모리 한도는 Phase 09 가 인수 (architecture §3.8 마지막 줄). **Phase 09 §4.3 + §6.1 + D1/D2/D3 에서 다음과 같이 확정됨**: (a) **full `Molecule` snapshot per undoable action** — diff 아님, immer 구조적 공유로 변경 안 된 가지는 메모리 공유. (b) **FIFO 용량 N=50**, 초과 시 oldest drop. (c) **200 ms group merge window** — 동일 `UndoableMeta.group` 키의 연속 액션은 첫 액션의 prev 와 마지막 액션의 next 만 보관해 단일 entry 로 합쳐짐 (드래그 stream 압축에 핵심). flush 트리거 = (i) 200 ms 침묵 후 다른 액션, (ii) 다른 group 액션, (iii) undo/redo 호출. 본 Phase 의 `dispatchUndoable(meta, mutator)` 인터페이스는 무변경이며, Phase 09 가 dispatcher 만 본 구현으로 교체.

본 Phase 는 architecture §12 의 열린 질문 중 **(없음)** 을 닫지 않는다. 스토어 자체는 신규 화학 도메인 결정을 도입하지 않으며, Phase 01·03·06 이 이미 동결한 타입을 조립하는 계층이다.

---

## 2. 범위 (Scope)

### 2.1 포함

- **`moleculeStore`**: 분자 컬렉션 (`MoleculeId → Molecule`) 과 활성 분자 ID, 텍스트 입력 진입점 (`addFromSmiles` / `addFromInchi`), 화합물 진입점 (`addFromCompound(cid)`), 원자/결합 직접 편집 액션, undoable 액션 디스패치 인터페이스, `replace` / `clear` / `removeMolecule`.
- **`reactionStore`**: 반응물 ID 집합 (`ReadonlySet<MoleculeId>`), `Condition` (T/P/pH), `predict()` 호출 + AbortController 관리, `lastResult` / `appliedRuleId` / `thermo` / `isExperimental` 파생, `ReactionEngineError` 분기 매핑.
- **`uiStore`**: 3D 뷰포트 선택 (`atomIds` / `bondIds`), 패널/모달 토글, 뷰포트 표시 옵션 (라벨 토글, 배경 오버라이드 — architecture §3.10), 전역 로딩 카운터, 알림 큐 (toast queue), **화합물 검색 sub-slice** (P3).
- **`settingsStore`**: `theme` / `locale` / `renderMode` / `units` / `cvdMode`, **persist 미들웨어 적용 유일 스토어**. Phase 01 임시 키 (`chem.theme` / `chem.locale`) 1회 마이그레이션.
- **공통 유틸 (`src/stores/_shared/`)**: `AsyncState<T, E>` 타입, `MoleculeId` Brand, `UndoableMeta` 인터페이스, `createAppStore` 미들웨어 합성 헬퍼, selector helper.
- **테스트** (Vitest, jsdom 환경): 스토어 액션의 AsyncState 전이, persist 마이그레이션, undoable 메타 발행, AbortController 동작.
- **devtools 미들웨어 토글**: `import.meta.env.DEV` 게이트.

### 2.2 비포함 (다른 Phase / 비목표)

- **Undo/Redo 의 스택 자료구조 / 스냅샷 전략 / 메모리 한도** → Phase 09. 본 Phase 는 `dispatchUndoable(meta, prev, next)` 인터페이스만 동결, 실 스택은 `Phase09UndoStack` 자리표시 모듈로 비워둔다 (호출 시 logger.debug + no-op).
- **3D 뷰포트 실 렌더 / 드래그 핸들** → Phase 08, 09. 본 Phase 는 selector 만 제공.
- **패널 UI 컴포넌트 / Toolbar / 토스트 컴포넌트** → Phase 10, 11. 본 Phase 의 `notifications` 큐는 자료구조와 push/dismiss 액션까지만.
- **PNG / SDF export 직렬화** → Phase 13. 단, JSON snapshot selector (`selectMoleculeSnapshot(id)`) 의 _형태_ 는 본 Phase 에서 합의 (Phase 13 가 그대로 수용 가능한 직렬화 가능 dump).
- **PubChem 검색 결과 영속 캐시** → Phase 05 의 `services/cache` 가 책임. 본 Phase 의 `compoundSearch` slice 는 휘발성 (페이지 떠나면 사라짐).
- **i18n 실제 문구** — 본 Phase 는 키만 `common.json#stores.*` 네임스페이스로 정의 (예: `stores.error.smilesParse`). 실제 한·영 문구는 Phase 01 의 i18n 리소스 + Phase 11 의 패널 통합 시 채움.
- **단위계 변환 함수의 본 구현** — `K ↔ °C`, `atm ↔ Pa` 변환은 `src/utils/units.ts` 의 순수 함수로 별도 (`utils` 계층), 본 Phase 는 호출자.
- **Web Worker 메시지 라우팅** — Phase 14. 본 Phase 는 메인 스레드 호출만.

### 2.3 명시적 비결정 (후속 결정)

- **persist v1 → v2 마이그레이션 정책** — JSON export 포맷이 Phase 13 에서 확정된 후, settings 외 스토어가 영속화될지 재검토.
- **단위계 표시 i18n 키** — `°C` / `K` 표기 토글의 실제 i18n 키 이름은 Phase 11 패널 UI 가 채운다 (예: `panels.conditions.tempUnit.celsius`).
- **알림 자동 dismiss 시간** — 토스트의 디폴트 표시 시간(예: 4 초) 은 Phase 11 컴포넌트가 결정. 본 Phase 는 `dismissAfterMs?: number | null` 옵션 필드만 둔다.

---

## 3. 의존성 (Dependencies)

### 3.1 선행 Phase

| Phase                  | 본 Phase 가 사용하는 자산                                                                                                                                                                                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 (Foundation)        | `Result<T, E>`, `Logger` (`src/utils/logger.ts`), `Brand<T, K>`, `Condition`, `Molecule` / `Atom` / `Bond` (Phase 01 placeholder + Phase 03 확정본), `ReactionResult` / `ReactionPredictionKind` / `ThermoFlag`, i18n 네임스페이스(`common`, `chemistry`), 임시 저장 키 `chem.theme` / `chem.locale` (§2.4) |
| 02 (Element Data)      | `getElement(n)` / `elementSymbolOf` — uiStore 의 alphabet 키 입력 보조 (라벨 토글 디버깅용으로만 간접 의존, 직접 import 는 selector 에서 발생)                                                                                                                                                              |
| 03 (Chemistry Engine)  | `getRdkit()` / `RdkitStatus`, `parseSmiles`, `parseInchi`, `smilesTo3DMolecule`, `validateMolecule`, `Molecule` 확정본 / `Atom` / `Bond` / `BondOrder`, `ParseError` / `EmbedError`, `RdkitInitError`                                                                                                       |
| 04 (Compound Pipeline) | `loadCompoundChunkByCid(cid)` / `searchCompoundManifest(query)` (phase-04 §5 의 동적 import + 매니페스트 검색 API)                                                                                                                                                                                          |
| 05 (Runtime Data)      | `getCompoundByCid(cid, opts?)` / `resolveCompoundByName(name, opts?)` / `LookupResult` / `PubChemError` / `LookupOptions`                                                                                                                                                                                   |
| 06 (Reaction Engine)   | `predict(input, opts?)` / `PredictInput` / `PredictOptions` / `PredictOutput`, `ReactionEngineError`, `ReactionResult`, `Condition` (재노출), `ReactionPredictionKind`, i18n 키 `reaction.*`                                                                                                                |

본 Phase 는 **`src/chemistry`** / **`src/engine`** / **`src/services`** / **`src/data`** 만 import 한다. `viewport`/`panels`/`components` 는 본 Phase 가 import 하지 않는다 (의존 방향: `architecture.md` §4.1 다이어그램 — UI 가 stores 를 보지, stores 가 UI 를 보지 않음).

### 3.2 외부 라이브러리

| 라이브러리                 | 용도                                           | 비고                                              |
| -------------------------- | ---------------------------------------------- | ------------------------------------------------- |
| `zustand` (Phase 01 도입)  | 스토어 본체                                    | `create<T>()(...)` curry 형식 사용                |
| `zustand/middleware`       | `persist`, `subscribeWithSelector`, `devtools` | 별도 패키지 아님. 추가 의존성 없음                |
| `zustand/middleware/immer` | draft 패턴 갱신 (P2 확정)                      | `immer` peerDep 으로 동반 도입                    |
| `immer`                    | `zustand/middleware/immer` 의 peerDep          | ~5 KB (gzip), architecture §9.1 의 500 KB 예산 내 |
| `zustand/shallow`          | `useShallow` selector 안정성                   | zustand 4.4+ 내장                                 |

**신규 라이브러리는 `immer` 한 개.** architecture §2 의 "스택 외 추가는 근거와 함께 명시" 조항에 따른 명시적 추가다. 근거: 분자/원자/결합 트리의 깊은 갱신 (특히 좌표 이동, 결합 차수 변경) 을 spread 체인으로 표현하면 액션 코드가 길어지고 readonly 추론이 무너지기 쉽다. immer 는 draft 안에서 mutation-처럼 작성해도 결과는 동결된 새 객체가 된다 (architecture §3.4 ⑥ "불변 데이터" 와 호환).

### 3.3 결정 필요 사항 (Plan 단계에서 모두 확정)

| ID  | 질문                                 | 확정 답                                                                                                                                                                           | 본문 영향                                                            |
| --- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| D1  | `MoleculeId` 생성기                  | **Phase 01 `createMoleculeId()`** (`@/chemistry/compounds/ids`, crypto.randomUUID 기반, CD1 — 본 store 재정의 안 함). 외부 PubChem 화합물은 `moleculeIdForCid(cid)` = `cid:{CID}` | §4.1 재수출, §6.2 의 ID 충돌 방지                                    |
| D2  | `immer` 도입                         | **도입** (`zustand/middleware/immer` 사용)                                                                                                                                        | §3.2 라이브러리, §6.1 미들웨어 합성, §5.1 액션 시그니처가 draft 패턴 |
| D3  | 화합물 검색 슬라이스 위치            | **`uiStore` 내 sub-slice** (`compoundSearch`)                                                                                                                                     | §4.4 uiStore, §5.3 `compoundSearch.*` 액션                           |
| D4  | 알림 토스트 큐 본 Phase 포함         | **포함** (자료구조 + push/dismiss 액션). 컴포넌트는 Phase 11                                                                                                                      | §4.4 `notifications`, §5.3 `notify*` 액션                            |
| D5  | `settingsStore` persist 마이그레이션 | **신규 키 `chem.settings` + 1회 이관** (구 키 유지로 롤백 안전)                                                                                                                   | §4.5 persist 키, §6.3 마이그레이션 로직                              |

추가로, Plan 검토 단계에서 아키텍처/관례에 의해 자유도 없는 사항으로 판정된 **선결정 사항(P1–P6)** 은 다음과 같다.

| ID  | 결정                                                                                                                                                                     | 근거                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| P1  | 스토어 간 직접 `getState()` 크로스 호출 금지. 컴포넌트 레벨에서 selector 결합 또는 액션 인자 전달                                                                        | architecture §8.2 "스토어 간 직접 참조 금지"                                                           |
| P2  | 비동기 액션은 호출 직후 `kind: 'loading'` 으로 set, 진입점 `await` 후 success/error 분기                                                                                 | phase-05 §6.2 `LookupResult` 패턴 정합                                                                 |
| P3  | `moleculeStore` 의 분자 컨테이너는 `Map<MoleculeId, Molecule>` 가 아니라 **`Record<string, Molecule>` + `ids: ReadonlyArray<MoleculeId>`** (immer + persist 직렬화 친화) | immer 의 Map proxy 는 `Object.freeze`/구조적 공유에 비효율적. 일반 객체 + ids 배열 패턴이 zustand 권장 |
| P4  | Undoable 액션은 항상 `dispatchUndoable(meta, () => mutator)` 래퍼를 거친다. 일반 액션은 직접 set                                                                         | Phase 09 가 인수할 인터페이스 동결. 본 Phase 의 placeholder 는 mutator 만 실행                         |
| P5  | `reactionStore.run()` 은 직전 호출이 진행 중이면 새 `AbortController` 만들기 전에 이전 controller `abort()`                                                              | phase-06 §4.7 의 `'Aborted'` kind 가 자연스럽게 발화됨                                                 |
| P6  | persist 미들웨어 `version: 1` 시작. `migrate(persistedState, version)` 함수가 v0 → v1 처리                                                                               | Phase 13 의 export/import 가 v2 도입 시 안전                                                           |

---

## 4. 데이터 모델 / 타입

### 4.1 공통 타입 (`src/stores/_shared/types.ts`)

```ts
// src/stores/_shared/types.ts
import type { MoleculeId } from '@/chemistry/compounds/ids';
import { createMoleculeId } from '@/chemistry/compounds/ids';
import type { ParseError } from '@/engine/parser';
import type { EmbedError } from '@/engine/geometry';
import type { PubChemError } from '@/services/pubchem';
import type { ReactionEngineError } from '@/engine/reaction';
import type { RdkitInitError } from '@/engine/rdkit';

/**
 * 비동기 진입점의 4-상태 유니온. 모든 스토어가 동일 모양으로 사용한다.
 */
export type AsyncState<T, E> =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading'; readonly startedAt: number }
  | { readonly kind: 'success'; readonly value: T; readonly settledAt: number }
  | { readonly kind: 'error'; readonly error: E; readonly settledAt: number };

export const ASYNC_IDLE: AsyncState<never, never> = { kind: 'idle' };

/**
 * MoleculeId 는 **Phase 01 `@/chemistry/compounds/ids` 단일 정의** (CD1) 를 재수출만 한다
 * (본 store 가 재정의하지 않음). 생성은 Phase 01 `createMoleculeId()` (crypto.randomUUID 기반).
 */
export type { MoleculeId };
export const newMoleculeId = createMoleculeId;

/** CID → 결정적 MoleculeId (`cid:{CID}` 형식). 동일 CID 재로드 시 동일 id (중복 식별). */
export function moleculeIdForCid(cid: number): MoleculeId {
  return `cid:${cid}` as MoleculeId;
}

/**
 * Phase 09 와의 계약 — undoable 액션의 메타 정보.
 * label 은 "원자 추가" / "결합 차수 변경" 등 i18n 키 (common.json#stores.undo.*).
 */
export interface UndoableMeta {
  readonly undoable: true;
  readonly labelKey: string; // i18n 키 — 실제 문구는 Phase 11 가 번역
  readonly group?: string; // 같은 group 의 연속 액션은 Phase 09 가 합칠 수 있음
}

/**
 * 직렬화 가능한 에러 형태. 스토어 외부(특히 logger / DevTools) 로 노출될 때 사용.
 * Phase 03 의 ParseError / EmbedError, Phase 05 의 PubChemError, Phase 06 의 ReactionEngineError
 * 모두 구조적으로 호환되는 좁혀진 유니온이라 별도 변환 없이 통과시킨다.
 */
export type SerializedError =
  | { readonly source: 'parse'; readonly detail: ParseError }
  | { readonly source: 'embed'; readonly detail: EmbedError }
  | { readonly source: 'pubchem'; readonly detail: PubChemError }
  | { readonly source: 'reaction'; readonly detail: ReactionEngineError }
  | { readonly source: 'rdkit'; readonly detail: RdkitInitError }
  | { readonly source: 'internal'; readonly message: string };
```

### 4.2 `moleculeStore` 상태

```ts
// src/stores/moleculeStore.ts (state 부분)
import type { Molecule, BondOrder } from '@/chemistry/compounds';
import type { ParseError } from '@/engine/parser';
import type { EmbedError } from '@/engine/geometry';

export interface MoleculeStoreState {
  /**
   * MoleculeId → Molecule. immer + persist 호환을 위해 Map 이 아닌 plain object (P3).
   */
  readonly molecules: Readonly<Record<MoleculeId, Molecule>>;
  readonly ids: ReadonlyArray<MoleculeId>; // 안정적 정렬 보장
  readonly activeId: MoleculeId | null;

  /**
   * 텍스트/CID 진입점의 비동기 상태. 마지막 호출만 추적.
   */
  readonly ingest: AsyncState<MoleculeId, IngestError>;

  /**
   * Undo/Redo placeholder — Phase 09 가 인수.
   */
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export type IngestError =
  | { readonly kind: 'parse'; readonly detail: ParseError }
  | { readonly kind: 'embed'; readonly detail: EmbedError }
  | { readonly kind: 'pubchem'; readonly detail: import('@/services/pubchem').PubChemError }
  | { readonly kind: 'duplicate'; readonly existingId: MoleculeId } // 동일 InChIKey 가 이미 존재
  | { readonly kind: 'rdkit-not-ready' }
  | { readonly kind: 'internal'; readonly message: string };
```

**Undoable 액션 식별자** (architecture §3.8 의 7가지 동작에 1:1 대응):

```ts
// src/stores/_shared/undoable.ts
export type UndoableActionKind =
  | 'atom.add'
  | 'atom.remove'
  | 'atom.move'
  | 'bond.create'
  | 'bond.break'
  | 'bond.setOrder'
  | 'molecule.create'
  | 'molecule.replace'
  | 'molecule.remove';
```

### 4.3 `reactionStore` 상태

```ts
// src/stores/reactionStore.ts (state 부분)
import type { Condition, ReactionResult, ReactionEngineError } from '@/engine/reaction';

export interface ReactionStoreState {
  /**
   * 반응물 분자 ID 집합. moleculeStore.molecules 의 키와 일관성 유지는
   * (1) 컴포넌트가 두 selector 결합 (architecture §8.2) 또는
   * (2) moleculeStore.removeMolecule 내부에서 reactionStore.removeReactant 호출
   * 중 (2) 를 선택 (액션 인자 전달 패턴 — P1 의 예외).
   *
   * `ReadonlySet` 은 immer-친화적이지 않으므로 `Record<MoleculeId, true>` + ids 배열 패턴 (P3 와 동일).
   */
  readonly reactantSelected: Readonly<Record<MoleculeId, true>>;
  readonly reactantIds: ReadonlyArray<MoleculeId>;

  readonly condition: Condition;

  /**
   * predict 호출의 비동기 상태.
   */
  readonly run: AsyncState<ReactionResult, ReactionEngineError>;

  /**
   * 마지막 성공 결과의 빠른 접근용 (selector 로 파생할 수도 있지만, run 이 idle 로 돌아가도 결과는 유지하는 정책).
   */
  readonly lastResult: ReactionResult | null;
  readonly lastAppliedRuleId: string | null;
}

/**
 * 진행 중 호출의 controller 는 **state 에 두지 않는다** — devtools 직렬화 / `getState()` 노출 / persist 충돌을
 * 모두 피하기 위해 모듈 레벨 변수로 격리. (advisor 검토 §4.3 반영)
 *
 * UI 가 직접 만지지 못하고 `cancel()` 액션 경유로만 접근 가능하다. 단일 진행 중 호출만 추적
 * (P5: 이전 호출 abort 후 새 호출 시작 패턴이라 충분).
 */
let inflightReactionController: AbortController | null = null;

export const DEFAULT_CONDITION: Condition = {
  temperatureK: 298.15, // 25 °C
  pressureAtm: 1.0,
  pH: 7.0,
};
```

**파생 (selector)**:

- `selectIsExperimental`: `run.kind === 'success' && run.value.kind === 'heuristic-experimental'`
- `selectThermoFlag`: `lastResult?.thermo ?? 'unknown'`
- `selectIsRunning`: `run.kind === 'loading'`
- `selectErrorI18nKey`: `run.kind === 'error' ? mapReactionErrorToKey(run.error) : null` — 매핑은 §5.2 표 참조.

### 4.4 `uiStore` 상태

```ts
// src/stores/uiStore.ts (state 부분)
import type { Compound } from '@/chemistry/compounds';

export interface UiStoreState {
  /**
   * 3D 뷰포트의 선택.
   *
   * **각 string 은 Phase 08 §3.1 D1 / §4.1 의 *composite ViewportId* 형식**:
   *   - atomIds: `${MoleculeId}::a:${AtomId}` (예: `"a3f2-...::a:b1c4-..."`)
   *   - bondIds: `${MoleculeId}::b:${BondId}`
   *
   * 인코딩/디코딩 헬퍼는 `src/viewport/ids/viewportId.ts` 의
   * `viewportIdForAtom` / `viewportIdForBond` / `parseViewportId` (Phase 08 §5.4).
   *
   * 본 Phase 의 store 는 string 으로만 다루며, 도메인 의미 (어느 분자의 어느 atom 인지)
   * 는 viewport 헬퍼가 디코드 시점에 부여한다 (직렬화/persist 단순성).
   */
  readonly selection: {
    readonly atomIds: ReadonlyArray<string>;
    readonly bondIds: ReadonlyArray<string>;
  };

  /** 활성 패널 + 모달 — Phase 11 가 확장. 본 Phase 는 토글 자리만. */
  readonly panels: {
    readonly active: PanelKey | null;
    readonly isCompoundBrowserOpen: boolean;
    readonly isPeriodicTableOpen: boolean;
    readonly isReactionResultOpen: boolean;
  };

  /** 뷰포트 표시 옵션 (architecture §3.10). */
  readonly viewport: {
    readonly showAtomLabels: boolean; // 기본 false
    readonly backgroundOverride: 'theme' | 'light' | 'dark';
  };

  /** 전역 로딩 카운터 — 어떤 비동기 액션이든 inc/dec 호출. */
  readonly globalLoading: { readonly count: number };

  /** 토스트 큐 — D4 확정으로 본 Phase 정의. UI 컴포넌트는 Phase 11. */
  readonly notifications: ReadonlyArray<Notification>;

  /** 화합물 검색 sub-slice — D3 확정으로 uiStore 내. */
  readonly compoundSearch: CompoundSearchSlice;
}

export type PanelKey =
  | 'periodic-table'
  | 'compound-browser'
  | 'conditions'
  | 'molecule-info'
  | 'reaction-result'
  | 'toolbar';

export interface Notification {
  readonly id: string; // crypto.randomUUID()
  readonly level: 'info' | 'success' | 'warn' | 'error';
  readonly messageKey: string; // i18n 키 (common.json)
  readonly messageParams?: Readonly<Record<string, string | number>>;
  readonly createdAt: number;
  readonly dismissAfterMs: number | null; // null = 사용자 dismiss 까지 유지
}

export interface CompoundSearchSlice {
  readonly query: string;
  readonly mode: 'name' | 'cid' | 'formula';
  readonly results: AsyncState<ReadonlyArray<Compound>, import('@/services/pubchem').PubChemError>;
  readonly selectedCid: number | null; // 미리보기 강조
}
```

### 4.5 `settingsStore` 상태

```ts
// src/stores/settingsStore.ts (state 부분)

export type Theme = 'light' | 'dark' | 'system';
export type Locale = 'ko' | 'en';

/**
 * RenderMode — architecture §3.1 ⑤. 본 Phase 는 단일 변형이지만,
 * 유니온 타입으로 두어 Phase 14+ 의 확장에 준비한다.
 */
export type RenderMode = 'ball-and-stick';

export interface UnitSystem {
  readonly temperature: 'K' | 'C';
  readonly pressure: 'atm' | 'Pa';
}

export interface SettingsStoreState {
  readonly theme: Theme;
  readonly locale: Locale;
  readonly renderMode: RenderMode;
  readonly units: UnitSystem;
  readonly cvdMode: boolean; // 색약 모드 (architecture §3.5)
}

export const DEFAULT_SETTINGS: SettingsStoreState = {
  theme: 'system',
  locale: 'en', // Phase 01 §2.4 와 동일 fallback 순서
  renderMode: 'ball-and-stick',
  units: { temperature: 'K', pressure: 'atm' },
  cvdMode: false,
};

/**
 * persist 키 — D5 확정.
 *  v0 (Phase 01): localStorage `chem.theme`, `chem.locale` (별도 키)
 *  v1 (Phase 07): localStorage `chem.settings` (단일 직렬화 객체)
 *  마이그레이션은 §6.3 참조.
 */
export const PERSIST_KEY = 'chem.settings';
export const PERSIST_VERSION = 1;
export const LEGACY_THEME_KEY = 'chem.theme';
export const LEGACY_LOCALE_KEY = 'chem.locale';
```

---

## 5. 퍼블릭 API / 인터페이스

각 스토어는 `src/stores/{name}Store.ts` 의 `useXStore` 훅과 `selectors` / `actions` 묶음을 export 한다. 컴포넌트는 selector 만 import 하고, 액션은 훅에서 분해 (`useMoleculeStore((s) => s.actions.addFromSmiles)`).

### 5.1 `moleculeStore`

```ts
// src/stores/moleculeStore.ts (액션 계약)
export interface MoleculeStoreActions {
  // ── 비동기 진입점 ──
  addFromSmiles(
    input: string,
    opts?: { signal?: AbortSignal },
  ): Promise<Result<MoleculeId, IngestError>>;
  addFromInchi(
    input: string,
    opts?: { signal?: AbortSignal },
  ): Promise<Result<MoleculeId, IngestError>>;
  addFromCompound(
    cid: number,
    opts?: { signal?: AbortSignal },
  ): Promise<Result<MoleculeId, IngestError>>;

  // ── 동기 편집 (모두 undoable) ──
  setActive(id: MoleculeId | null): void;
  removeMolecule(id: MoleculeId): void;
  /**
   * 기존 분자 slot 의 내용을 새 Molecule 으로 *전체* 교체. `id` 는 보존.
   * **사용 사례**: Phase 12 의 SMILES/InChI 텍스트 입력으로 같은 slot 을 새 3D 구조로 갱신.
   * **호출자 책임**: `next.atoms[*].id`, `next.bonds[*].id` 는 새로 생성된 안정 ID 여야 한다
   * (Phase 01 `@/chemistry/compounds/ids` 의 `createAtomId()` / `createBondId()`, CD1). 호출 전
   * selection 정리는 phase-08 의 useSelectionStaleGuard 가 자동 처리.
   */
  replace(id: MoleculeId, next: Molecule): void;
  moveAtom(id: MoleculeId, atomIndex: number, position: readonly [number, number, number]): void;
  setBondOrder(id: MoleculeId, bondIndex: number, order: BondOrder): void;
  addBond(id: MoleculeId, aAtomIndex: number, bAtomIndex: number, order: BondOrder): void;
  removeBond(id: MoleculeId, bondIndex: number): void;
  /**
   * 분자에 새 원자를 추가. `atom` 객체는 **호출자가 완전히 구성** (id, element, position, formalCharge,
   * implicitHCount 모두 포함). `atom.id` 는 Phase 01 `@/chemistry/compounds/ids` 의
   * `createAtomId(): AtomId` (crypto.randomUUID 기반, CD1) 로 생성하여 주입. 본 store 는 받은 atom 을 그대로 분자의
   * `atoms[]` 끝에 push (atomIndex 는 자동 = 기존 길이). 본 호출은 단일 entry undoable.
   */
  addAtom(id: MoleculeId, atom: Molecule['atoms'][number]): void;
  removeAtom(id: MoleculeId, atomIndex: number): void;

  // ── 일괄 ──
  clear(): void;

  // ── Undo/Redo (Phase 09 가 본 구현 인수) ──
  undo(): void;
  redo(): void;
}
```

**selector helpers** (`src/stores/moleculeStore.selectors.ts`):

```ts
export const selectActiveMolecule = (s: MoleculeStoreState): Molecule | null =>
  s.activeId ? (s.molecules[s.activeId] ?? null) : null;

export const selectMoleculeById =
  (id: MoleculeId) =>
  (s: MoleculeStoreState): Molecule | null =>
    s.molecules[id] ?? null;

export const selectMoleculeIds = (s: MoleculeStoreState): ReadonlyArray<MoleculeId> => s.ids;

export const selectIngestState = (s: MoleculeStoreState): AsyncState<MoleculeId, IngestError> =>
  s.ingest;

/** Phase 13 export 용 — 직렬화 가능한 dump. */
export const selectMoleculeSnapshot =
  (id: MoleculeId) =>
  (s: MoleculeStoreState): MoleculeSnapshot | null => {
    const m = s.molecules[id];
    return m ? toSnapshot(m) : null;
  };
```

`MoleculeSnapshot` 타입의 정확한 필드는 Phase 13 가 export 포맷 결정 시 동결한다. 본 Phase 는 _형태가 직렬화 가능_ (Date / Map / Set / 함수 미포함) 한 dump 라는 보장만 한다.

### 5.2 `reactionStore`

```ts
// src/stores/reactionStore.ts (액션 계약)
export interface ReactionStoreActions {
  setCondition(c: Condition): void;
  patchCondition(patch: Partial<Condition>): void;
  addReactant(id: MoleculeId): void;
  removeReactant(id: MoleculeId): void;
  setReactants(ids: ReadonlyArray<MoleculeId>): void;
  clearReactants(): void;

  /**
   * predict 진입점. 직전 호출이 loading 이면 P5 에 따라 abort() 후 새 controller.
   * 결과는 run 상태에 commit 되며, 반환값은 호출자가 즉시 분기하고 싶을 때 활용.
   */
  run(opts?: { force?: boolean }): Promise<PredictOutput>;
  cancel(): void;
  clearResult(): void;
}
```

**ReactionEngineError → i18n 키 매핑 표** (selector `selectErrorI18nKey` 의 본문):

| `kind`                | i18n 키 (`common.json`)              | UI 처리 권장 (Phase 11)             |
| --------------------- | ------------------------------------ | ----------------------------------- |
| `RdkitNotReady`       | `reaction.error.rdkitNotReady`       | 재시도 버튼 + 진행 중 스피너        |
| `RdkitInitFailed`     | `reaction.error.rdkitInitFailed`     | 페이지 새로고침 안내                |
| `NoMatchingRule`      | `reaction.error.noMatchingRule`      | "예측 불가" 안내 + 입력 검토 가이드 |
| `HeuristicAbstained`  | `reaction.error.heuristicAbstained`  | 동상                                |
| `ConditionOutOfRange` | `reaction.error.conditionOutOfRange` | 권장 조건 범위 표시                 |
| `InvalidReactant`     | `reaction.error.invalidReactant`     | 분자 정보 패널 표시                 |
| `RunReactantsFailed`  | `reaction.error.runReactantsFailed`  | 일반 실패 토스트 + "다시 시도"      |
| `EmbedFailed`         | `reaction.error.embedFailed`         | 동상 (생성물 좌표 실패)             |
| `Aborted`             | `reaction.error.aborted`             | 토스트 표시 안 함 (사용자 의도)     |
| `Internal`            | `reaction.error.internal`            | 일반 실패 토스트                    |

매핑 함수는 `src/stores/reactionStore.selectors.ts` 에 `mapReactionErrorToKey(e: ReactionEngineError): string` 으로 위치.

**selector helpers**:

```ts
export const selectReactantIds = (s: ReactionStoreState): ReadonlyArray<MoleculeId> =>
  s.reactantIds;
export const selectCondition = (s: ReactionStoreState): Condition => s.condition;
export const selectRunState = (
  s: ReactionStoreState,
): AsyncState<ReactionResult, ReactionEngineError> => s.run;
export const selectIsRunning = (s: ReactionStoreState): boolean => s.run.kind === 'loading';
export const selectIsExperimental = (s: ReactionStoreState): boolean =>
  s.run.kind === 'success' && s.run.value.kind === 'heuristic-experimental';
export const selectThermoFlag = (s: ReactionStoreState) => s.lastResult?.thermo ?? 'unknown';
export const selectAppliedRuleId = (s: ReactionStoreState) => s.lastAppliedRuleId;
```

### 5.3 `uiStore`

```ts
// src/stores/uiStore.ts (액션 계약)
export interface UiStoreActions {
  // ── 선택 ──
  setSelection(sel: { atomIds?: ReadonlyArray<string>; bondIds?: ReadonlyArray<string> }): void;
  clearSelection(): void;

  // ── 패널 ──
  setActivePanel(key: PanelKey | null): void;
  toggleCompoundBrowser(open?: boolean): void;
  togglePeriodicTable(open?: boolean): void;
  toggleReactionResult(open?: boolean): void;

  // ── 뷰포트 표시 옵션 ──
  toggleAtomLabels(on?: boolean): void;
  setBackgroundOverride(mode: 'theme' | 'light' | 'dark'): void;

  // ── 전역 로딩 ──
  beginLoading(): void; // count++
  endLoading(): void; // count--, 0 미만 방지

  // ── 알림 ──
  notify(n: Omit<Notification, 'id' | 'createdAt'> & { dismissAfterMs?: number | null }): string; // id 반환
  dismissNotification(id: string): void;
  clearNotifications(): void;

  // ── 화합물 검색 ──
  setCompoundSearchQuery(q: string): void;
  setCompoundSearchMode(m: 'name' | 'cid' | 'formula'): void;
  /**
   * 현재 query/mode 로 검색 실행. **호출 직후 자동 동작**:
   *   1. 이전 결과 강조 (`selectedCid`) 를 `null` 로 리셋 (사용자가 새 검색을 시작했으므로 이전 미리보기 무효).
   *   2. AsyncState → `'loading'`, 새 AbortController 생성. 직전 호출이 in-flight 이면 cancel.
   *   3. 1차: phase-04 `searchCompoundManifest(query)` (동기, 매니페스트 hit). 결과 있으면 즉시 commit.
   *   4. 2차: phase-05 `resolveCompoundByName(query, { signal })` (비동기, 네트워크 fetch). 결과 또는 에러 commit.
   *   4a. mode === 'cid' / 'formula' 이면 phase-05 의 다른 endpoint (예: `getCompoundByCid`) 호출.
   * 본 액션은 호출자가 추가로 selection 을 리셋하지 않아도 된다 (#1 자동 처리).
   */
  runCompoundSearch(opts?: { signal?: AbortSignal }): Promise<void>;
  selectCompoundSearchResult(cid: number | null): void;
  clearCompoundSearch(): void;
}
```

**selector helpers**:

```ts
export const selectIsGloballyLoading = (s: UiStoreState): boolean => s.globalLoading.count > 0;
export const selectActivePanel = (s: UiStoreState): PanelKey | null => s.panels.active;
export const selectAtomLabelsOn = (s: UiStoreState): boolean => s.viewport.showAtomLabels;
export const selectNotifications = (s: UiStoreState) => s.notifications;
export const selectCompoundSearch = (s: UiStoreState): CompoundSearchSlice => s.compoundSearch;
```

### 5.4 `settingsStore`

```ts
// src/stores/settingsStore.ts (액션 계약)
export interface SettingsStoreActions {
  setTheme(theme: Theme): void;
  setLocale(locale: Locale): void;
  setRenderMode(mode: RenderMode): void;
  setTemperatureUnit(unit: 'K' | 'C'): void;
  setPressureUnit(unit: 'atm' | 'Pa'): void;
  toggleCvdMode(on?: boolean): void;
  resetToDefaults(): void;
}
```

**selector helpers**:

```ts
export const selectTheme = (s: SettingsStoreState): Theme => s.theme;
export const selectLocale = (s: SettingsStoreState): Locale => s.locale;
export const selectRenderMode = (s: SettingsStoreState): RenderMode => s.renderMode;
export const selectUnits = (s: SettingsStoreState): UnitSystem => s.units;
export const selectIsCvdOn = (s: SettingsStoreState): boolean => s.cvdMode;
```

### 5.5 공용 selector / 미들웨어 헬퍼

```ts
// src/stores/_shared/createStore.ts
import { create, type StateCreator } from 'zustand';
import { devtools, persist, subscribeWithSelector, type PersistOptions } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

/**
 * 공통 미들웨어 합성 — devtools(persist?(subscribeWithSelector(immer(creator)))).
 * persistOptions 를 주면 persist 적용 (settingsStore 만), 없으면 생략.
 */
export function createAppStore<T>(
  name: string,
  creator: StateCreator<
    T,
    [['zustand/immer', never], ['zustand/subscribeWithSelector', never]],
    [],
    T
  >,
  persistOptions?: PersistOptions<T>,
) {
  /* … */
}
```

각 스토어는 `createAppStore('moleculeStore', creator)` 형태로 생성한다.

### 5.6 `src/stores/index.ts` barrel export 표

후속 Phase (08, 11, 12, 13) 가 본 Phase 의 표면을 import 할 단일 진입점. **이 barrel 외 경로** (예: `@/stores/moleculeStore`, `@/stores/reactionStore.selectors`) **로 직접 import 금지** — ESLint `no-restricted-paths` 패턴으로 차단 (`src/stores/*` 중 `index.ts` 가 아닌 경로 외부 import 금지).

```ts
// src/stores/index.ts (요지)

// 훅 (zustand store 인스턴스)
export { useMoleculeStore } from './moleculeStore';
export { useReactionStore } from './reactionStore';
export { useUiStore } from './uiStore';
export { useSettingsStore } from './settingsStore';

// State / Action 인터페이스 타입 (selector 작성 / 테스트 mock 용)
export type { MoleculeStoreState } from './moleculeStore';
export type { ReactionStoreState } from './reactionStore';
export type { UiStoreState } from './uiStore';
export type { SettingsStoreState } from './settingsStore';

// AsyncState 등 공용 타입
export type {
  AsyncState,
  AsyncStateLoading,
  AsyncStateError,
  IngestError,
  SerializedError,
} from './_shared/types';

// 안정 selector — 공식 Phase 11 / Phase 08 인계 표면 (§12 hand-off 표 참고)
export {
  selectActiveMolecule,
  selectMoleculeById,
  selectMoleculeIds,
  selectAtomLabelsOn,
  selectBackgroundOverride,
  selectActivePanel,
  selectIsGloballyLoading,
  selectUnits,
} from './selectors';

// Reaction selectors / 매핑
export {
  selectIsExperimental,
  selectThermoFlag,
  mapReactionErrorToKey,
} from './reactionStore.selectors';

// Undoable 시스템 — Phase 09 가 dispatcher 본 구현으로 교체
export type { UndoableActionKind, UndoableMeta, UndoableDispatcher } from './_shared/undoable';
export { phase07PlaceholderDispatcher } from './_shared/undoable';
```

> **internal 모듈** (`_shared/_crossStore.ts`, `_shared/createStore.ts`, `*.persist.ts` 등) 은 barrel 미노출 — 본 Phase 내부에서만 사용. Phase 09 가 dispatcher 교체 시에는 `_shared/undoable.ts` 의 _export 시점에_ 본 구현으로 swap (호출자 코드 변경 0).

---

## 6. 핵심 로직 / 전략

### 6.1 미들웨어 합성

순서: `devtools` (가장 바깥) → `persist` (선택) → `subscribeWithSelector` → `immer` (가장 안쪽).

이유:

- **devtools 는 모든 setState 를 가로채야** Redux DevTools 에 액션 이름이 표시되므로 가장 바깥.
- **persist 는 도메인 데이터의 직렬화 형태** 를 결정하므로 immer/subscribeWithSelector 보다 바깥.
- **subscribeWithSelector** 는 스토어 외부에서 selector 단위 구독을 가능하게 한다 (Phase 08 의 `useFrame` 안 직접 구독, Phase 13 export 시 unsub 등).
- **immer 는 가장 안쪽** — set 콜백을 draft 변환.

### 6.2 비동기 액션 패턴

비동기 액션의 cross-store 영향(전역 로딩 카운터 inc/dec, 토스트 발화) 은 **모두 `_shared/_crossStore.ts` 의 `withGlobalLoading` 헬퍼 한 곳을 거친다** (§6.6 P1 의 단일 격리 지점). 액션 본문은 `withGlobalLoading` 호출과 도메인 호출만 알면 된다.

```ts
// src/stores/_shared/_crossStore.ts
import { useUiStore } from '@/stores/uiStore';

/**
 * 비동기 액션을 감싸 전역 로딩 카운터를 증감. 본 함수가 stores 간 cross-action 의 유일한 정식 통로.
 * (성공/실패와 무관하게 finally 에서 endLoading.)
 */
export async function withGlobalLoading<T>(fn: () => Promise<T>): Promise<T> {
  useUiStore.getState().actions.beginLoading();
  try {
    return await fn();
  } finally {
    useUiStore.getState().actions.endLoading();
  }
}
```

각 비동기 진입점은 다음 5단계를 따른다.

```ts
async function run(): Promise<PredictOutput> {
  // 1) 직전 호출이 loading 이면 cancel (모듈-레벨 controller — §4.3)
  inflightReactionController?.abort();

  // 2) AbortController + AsyncState=loading 으로 set
  const controller = new AbortController();
  inflightReactionController = controller;
  set((s) => {
    s.run = { kind: 'loading', startedAt: Date.now() };
  });

  // 3) 도메인 호출 — withGlobalLoading 으로 감싸 cross-store 영향 격리
  return withGlobalLoading(async () => {
    let outcome: PredictOutput;
    try {
      outcome = await predict(buildInput(get()), { signal: controller.signal });
    } catch (e) {
      outcome = { ok: false, error: { kind: 'Internal', detail: String(e), retryable: false } };
    }

    // 4) 이 호출이 가장 최신 호출일 때만 commit
    if (inflightReactionController !== controller) return outcome;
    inflightReactionController = null;
    set((s) => {
      s.run = outcome.ok
        ? { kind: 'success', value: outcome.value, settledAt: Date.now() }
        : { kind: 'error', error: outcome.error, settledAt: Date.now() };
      if (outcome.ok) {
        s.lastResult = outcome.value;
        s.lastAppliedRuleId = outcome.value.appliedRuleId ?? null;
      }
    });

    // 5) 사후 효과 (notify) — withGlobalLoading 안의 _crossStore 호출과 동일 통로
    if (!outcome.ok && outcome.error.kind !== 'Aborted') {
      useUiStore.getState().actions.notify({
        level: 'error',
        messageKey: mapReactionErrorToKey(outcome.error),
      });
    }
    return outcome;
  });
}
```

**AbortController 누수 방지** — 컴포넌트 언마운트 시에도 모듈 레벨 controller 가 다음 호출 시 abort 된다. UI 가 명시적으로 `cancel()` 을 호출하는 진입점도 노출 (`reactionStore.cancel`).

### 6.3 persist 마이그레이션 (settingsStore)

**핵심 함정**: Zustand `persist` 의 `migrate(persisted, version)` 콜백은 storage 에 값이 _있을 때만_ 호출된다. v0 사용자는 `chem.settings` 키가 부재하므로 — `getItem('chem.settings')` 이 `null` 반환 → persist 가 곧장 `DEFAULT_SETTINGS` 로 초기화 → migrate 가 발화하지 않아 사용자 설정 손실. (advisor 검토 §6.3 반영.)

따라서 v0 → v1 마이그레이션은 **custom storage adapter** 로 구현한다. adapter 의 `getItem` 이 `chem.settings` 부재 시 legacy 키를 합성해 v0-shaped JSON 을 반환하고, 이후 persist 표준 경로 (migrate → rehydrate) 가 자연스럽게 발화하도록 한다.

```ts
// src/stores/settingsStore.persist.ts
import { type PersistStorage, type StorageValue } from 'zustand/middleware';
import { logger } from '@/utils/logger';
import {
  DEFAULT_SETTINGS,
  LEGACY_LOCALE_KEY,
  LEGACY_THEME_KEY,
  PERSIST_KEY,
  PERSIST_VERSION,
  type Locale,
  type SettingsStoreState,
  type Theme,
} from './settingsStore.types';

const isTheme = (v: unknown): v is Theme => v === 'light' || v === 'dark' || v === 'system';
const isLocale = (v: unknown): v is Locale => v === 'ko' || v === 'en';

function tryParseJson<T>(raw: string | null, guard: (v: unknown) => v is T): T | null {
  if (raw == null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return guard(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * v0-aware storage adapter — chem.settings 가 부재하고 legacy 키 (chem.theme/chem.locale) 가 있으면
 * v0 모양의 StorageValue 를 합성해 반환. 이후 persist 의 migrate 가 v0 → v1 변환 책임을 가진다.
 */
export const legacyAwareStorage: PersistStorage<SettingsStoreState> = {
  getItem: (name) => {
    const raw = localStorage.getItem(name);
    if (raw) {
      try {
        return JSON.parse(raw) as StorageValue<SettingsStoreState>;
      } catch (e) {
        logger.warn('settingsStore: corrupted persist payload, falling back', { error: String(e) });
        return null;
      }
    }
    if (name !== PERSIST_KEY) return null;

    // chem.settings 부재 — legacy 키 흡수 시도
    const legacyTheme = tryParseJson(localStorage.getItem(LEGACY_THEME_KEY), isTheme);
    const legacyLocale = tryParseJson(localStorage.getItem(LEGACY_LOCALE_KEY), isLocale);
    if (legacyTheme == null && legacyLocale == null) return null;

    // v0 모양 — partial state, version: 0. migrate 가 받아 DEFAULT_SETTINGS 와 머지.
    return {
      state: {
        ...(legacyTheme != null && { theme: legacyTheme }),
        ...(legacyLocale != null && { locale: legacyLocale }),
      } as Partial<SettingsStoreState> as SettingsStoreState,
      version: 0,
    };
  },
  setItem: (name, value) => {
    localStorage.setItem(name, JSON.stringify(value));
  },
  removeItem: (name) => {
    localStorage.removeItem(name);
  },
};

export const settingsPersistOptions = {
  name: PERSIST_KEY,
  version: PERSIST_VERSION,
  storage: legacyAwareStorage,
  partialize: (s: SettingsStoreState) => s,

  /**
   * v0 (legacy 합성) → v1 마이그레이션. v0 의 partial 상태를 DEFAULT_SETTINGS 와 머지.
   * migrate 가 호출됐다는 건 storage 가 v0 shape 을 반환했다는 것 — 즉 legacy 키가 존재했다는 뜻.
   */
  migrate: (persisted: unknown, version: number): SettingsStoreState => {
    if (version >= PERSIST_VERSION) {
      // 이미 최신. (이 분기는 향후 v1 → v2 도입 시 의미를 가짐.)
      return { ...DEFAULT_SETTINGS, ...(persisted as Partial<SettingsStoreState>) };
    }
    // v0: { theme?, locale? } partial
    const partial = (persisted ?? {}) as Partial<SettingsStoreState>;
    return {
      ...DEFAULT_SETTINGS,
      ...(isTheme(partial.theme) && { theme: partial.theme }),
      ...(isLocale(partial.locale) && { locale: partial.locale }),
    };
  },

  /**
   * onRehydrateStorage 후 검증 — 손상된 값은 기본값 복귀 + 경고.
   */
  onRehydrateStorage: () => (state: SettingsStoreState | undefined, error: unknown) => {
    if (error) {
      logger.warn('settingsStore rehydrate failed', { error: String(error) });
      return;
    }
    if (!state) return;
    if (!isValidSettings(state)) {
      logger.warn('settingsStore rehydrate produced invalid state, falling back to defaults');
      useSettingsStore.setState(DEFAULT_SETTINGS, true);
    }
  },
};
```

**검증 시나리오 (§8.4 의 마이그레이션 테스트가 강제)**:
| 시나리오 | localStorage 초기 상태 | 첫 로드 후 state | 비고 |
|---------|------------------------|------------------|------|
| v0, theme + locale 존재 | `chem.theme: '"dark"'`, `chem.locale: '"ko"'` | `theme: 'dark', locale: 'ko'` + 그 외 기본값 | adapter 가 v0 합성 → migrate 호출 |
| v0, theme 만 존재 | `chem.theme: '"dark"'` | `theme: 'dark'` + locale 은 DEFAULT_SETTINGS.locale | partial migrate |
| v0, locale 만 존재 | `chem.locale: '"ko"'` | `locale: 'ko'` + theme 은 'system' | partial migrate |
| v0, legacy 키 모두 부재 (신규 사용자) | (비어 있음) | DEFAULT_SETTINGS | adapter 가 null 반환 → persist 기본 경로 |
| v1, 정상 값 | `chem.settings: '{"state":{"theme":"dark",...},"version":1}'` | 그대로 | migrate 미호출 |
| v1, 손상된 값 | `chem.settings: '{"state":{"theme":"banana"}}'` | DEFAULT_SETTINGS | onRehydrate 검증 실패 → setState |
| 동시 (legacy + v1 모두 존재) | 둘 다 존재 | v1 우선 (adapter 가 v1 raw 먼저 시도) | 롤백 후 다시 진입한 사용자 |

**구 키 (`chem.theme` / `chem.locale`) 는 본 Phase 에서 삭제하지 않는다.** 사용자가 v0 빌드로 롤백할 때 설정이 보존되도록 안전 윈도우를 둔다. 삭제 시점은 Phase 13/15 의 후속 결정 (§11).

### 6.4 Undo/Redo 인터페이스 동결

```ts
// src/stores/_shared/undoable.ts
export interface UndoableDispatcher {
  dispatchUndoable<T>(meta: UndoableMeta & { kind: UndoableActionKind }, mutator: () => T): T;
  undo(): void;
  redo(): void;
  readonly canUndo: () => boolean;
  readonly canRedo: () => boolean;
}

/**
 * Phase 07 placeholder — mutator 는 즉시 실행, 스택은 비어 있음 (canUndo/canRedo 항상 false).
 * Phase 09 가 같은 인터페이스로 stack 본 구현 + 단축키 바인딩 인수.
 */
export const phase07PlaceholderDispatcher: UndoableDispatcher = {
  dispatchUndoable: (meta, mutator) => {
    logger.debug('undoable action dispatched (Phase 07 placeholder)', {
      kind: meta.kind,
      label: meta.labelKey,
    });
    return mutator();
  },
  undo: () => logger.debug('undo() called — Phase 09 가 인수'),
  redo: () => logger.debug('redo() called — Phase 09 가 인수'),
  canUndo: () => false,
  canRedo: () => false,
};
```

`moleculeStore` 의 동기 편집 액션은 모두 다음 패턴으로 작성된다.

```ts
moveAtom: (id, atomIndex, position) => {
  dispatcher.dispatchUndoable(
    { undoable: true, kind: 'atom.move', labelKey: 'stores.undo.atomMove' },
    () => set((s) => {
      const m = s.molecules[id];
      if (!m) return;
      // immer draft 안에서 깊은 갱신
      m.atoms[atomIndex].position = position;
    }),
  );
},
```

Phase 09 가 `dispatcher` 를 본 구현으로 교체할 때 액션 본문은 손대지 않는다.

### 6.5 selector 안정성

- 객체/배열을 반환하는 selector 에는 `useShallow` 권장.
- `subscribeWithSelector` 미들웨어로 `useXStore.subscribe(selector, listener, opts?)` 외부 구독 가능.
- `equalityFn` 명시 시 의미 비교 충돌 가능 — 가급적 selector 가 primitive 또는 안정적 참조를 반환하도록 작성.

```ts
// 예: 활성 분자의 원자 수
const atomCount = useMoleculeStore((s) => {
  const m = s.activeId ? s.molecules[s.activeId] : null;
  return m?.atoms.length ?? 0;
});
```

복합 객체가 필요할 때:

```ts
const { atoms, bonds } = useMoleculeStore(
  useShallow((s) => {
    const m = s.activeId ? s.molecules[s.activeId] : null;
    return { atoms: m?.atoms ?? EMPTY_ATOMS, bonds: m?.bonds ?? EMPTY_BONDS };
  }),
);
```

빈 배열은 모듈 상수로 둬서 매 렌더 동일 참조 보장 (`EMPTY_ATOMS = Object.freeze([])` 패턴).

### 6.6 스토어 간 통신 금지 운영 (P1)

원칙: 다른 스토어를 _읽지/쓰지_ 않는다. 그러나 실무상 두 가지 cross-store 영향이 불가피하다 — (a) 비동기 액션의 전역 로딩 카운터 inc/dec, (b) 도메인 액션의 후속 효과 (예: molecule 삭제 시 reaction 의 stale id 정리, 비동기 실패 시 toast 발화). 이를 다음 세 패턴으로 격리한다.

1. **컴포넌트 레벨 결합** (가장 권장) — `useMoleculeStore(...)` 와 `useReactionStore(...)` 를 한 컴포넌트에서 호출 후 props 로 전달.
2. **`_shared/_crossStore.ts` 의 명시적 헬퍼** — `withGlobalLoading(fn)`, `notifyError(error)`, `cascadeRemoveMolecule(id)` 등. 액션 본문은 이 헬퍼만 알면 되고, cross-store 의 실제 호출은 헬퍼 내부에 격리. (advisor 검토 §6.2 반영 — 이 통로 외에서 `useUiStore.getState()` 호출 금지.)
3. **액션 인자 전달** — 상위 (orchestration) 가 두 스토어를 모두 알고 순서대로 호출. 예: 패널 컴포넌트가 `await moleculeStore.removeMolecule(id); reactionStore.removeReactant(id);` 직접 호출.

`_crossStore.ts` 외에서의 `useXStore.getState()` 호출은 코드 리뷰 가이드와 ESLint `no-restricted-syntax` 패턴으로 경고. 자동 검사가 완전치 않으므로 §9 R3 에 리스크 등록.

`_crossStore.ts` 가 노출하는 정식 통로 (Phase 07 v1):

| 헬퍼                         | 호출자                                                 | 효과                                                                    |
| ---------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| `withGlobalLoading(fn)`      | 모든 비동기 액션 (moleculeStore/reactionStore/uiStore) | uiStore.beginLoading → fn → finally endLoading                          |
| `notifyError(source, error)` | 비동기 실패 분기                                       | uiStore.notify({ level: 'error', messageKey: mapXxxErrorToKey(error) }) |
| `cascadeRemoveMolecule(id)`  | moleculeStore.removeMolecule 내부                      | reactionStore 의 reactant 집합과 selection 정리                         |

### 6.7 React 외부 호출 / 테스트 용이성

- 스토어는 React-독립 모듈. vitest 의 `useXStore.getState()` / `setState()` / `useXStore.subscribe(...)` 로 직접 검증.
- `beforeEach(() => useXStore.setState(initialState, true))` 로 전체 리셋. `true` 두 번째 인자가 partial 무시.
- React 컴포넌트 테스트에서는 `@testing-library/react` 의 `act()` 안에서 액션 호출.

---

## 7. 파일/모듈 레이아웃

```
src/stores/
├── _shared/
│   ├── types.ts                       # AsyncState, MoleculeId, UndoableMeta, SerializedError
│   ├── undoable.ts                    # UndoableActionKind, UndoableDispatcher, phase07Placeholder
│   ├── createStore.ts                 # 미들웨어 합성 헬퍼
│   ├── selectors.ts                   # 공용 selector 유틸 (EMPTY_ATOMS 등)
│   ├── notifications.ts               # NOTIFICATION_QUEUE_MAX=50, drop-oldest 헬퍼 (R7)
│   └── _crossStore.ts                 # 스토어 간 cross-action 격리 (P1 예외 지점)
├── moleculeStore.ts                   # state + create() 진입점
├── moleculeStore.actions.ts           # 액션 본문 (immer draft)
├── moleculeStore.selectors.ts
├── moleculeStore.types.ts             # MoleculeStoreState, IngestError
├── reactionStore.ts
├── reactionStore.actions.ts
├── reactionStore.selectors.ts
├── reactionStore.types.ts
├── uiStore.ts
├── uiStore.actions.ts
├── uiStore.selectors.ts
├── uiStore.types.ts
├── settingsStore.ts
├── settingsStore.persist.ts           # persist 옵션 + 마이그레이션
├── settingsStore.actions.ts
├── settingsStore.selectors.ts
└── index.ts                           # barrel export — 외부는 항상 이 모듈만 import

tests/unit/stores/
├── _shared/
│   ├── asyncState.test.ts
│   └── undoable.test.ts
├── moleculeStore.test.ts
├── reactionStore.test.ts
├── uiStore.test.ts
├── settingsStore.test.ts
└── settingsStore.persist.test.ts
```

**barrel export 규칙**: `src/stores/index.ts` 는 `useMoleculeStore` / `useReactionStore` / `useUiStore` / `useSettingsStore` 와 selector 함수만 export. 내부 actions 모듈은 직접 import 금지 — 액션은 항상 훅을 통해 접근. 이로써 패널/뷰포트가 `from '@/stores'` 한 줄로 안정적 import 가능.

**ESLint 레이어 가드** (Phase 01 §6 의 `eslint-plugin-import` + `no-restricted-paths` 패턴 재사용):

```jsonc
// .eslintrc 의 가드 추가분
{
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "patterns": [
          { "group": ["@/stores/*"], "message": "스토어는 @/stores 배럴에서만 import 하세요." },
          {
            "group": ["@/stores/_shared/_crossStore"],
            "message": "_crossStore 는 stores 내부 전용입니다.",
          },
        ],
      },
    ],
  },
}
```

---

## 8. 테스트 계획

원칙: architecture §10 "모든 함수를 테스트하지 않는다. 핵심 로직과 핵심 동작만." 본 Phase 의 핵심 동작은 (a) 비동기 AsyncState 전이, (b) persist 마이그레이션, (c) undoable 메타 발행, (d) 스토어 간 cross-action 일관성, (e) selector 안정성.

### 8.1 `moleculeStore` (`tests/unit/stores/moleculeStore.test.ts`)

- `addFromSmiles('CCO')` 성공 → ingest: idle → loading → success, molecules 에 새 ID, activeId 갱신.
- `addFromSmiles(invalid)` → ingest.kind === 'error', error.kind === 'parse'.
- `addFromSmiles` 두 번 연속 호출 (직전 호출 미완료) → 첫 호출은 abort, 두 번째 결과만 commit.
- `addFromCompound(cid)` 성공 → moleculeIdForCid(cid) 형식의 ID 사용 (P3).
- `addFromCompound(cid)` 가 동일 InChIKey 의 분자 이미 존재 시 → ingest.error.kind === 'duplicate' + existingId.
- `removeMolecule(id)` 가 cross-action 으로 reactionStore 의 reactantIds 에서도 제거.
- `moveAtom` 호출 → `dispatchUndoable` 가 `{ kind: 'atom.move' }` 메타로 발화 (spy 로 확인).
- `setBondOrder(id, idx, 2)` 후 selectMoleculeById 로 immer 결과가 새 객체 + 기존 객체 frozen 검증.

### 8.2 `reactionStore` (`tests/unit/stores/reactionStore.test.ts`)

- `setCondition` / `patchCondition` 의 부분 갱신.
- `addReactant` 후 `selectReactantIds` 가 안정적 정렬.
- `run()` 성공 → run.kind 전이 + lastResult 갱신 + selectIsExperimental 검증 (heuristic-experimental 케이스 mock).
- `run()` 두 번 연속 호출 → 첫 호출은 commit 되지 않고 (모듈-레벨 controller 가 두 번째로 갱신됨), 두 번째 결과만 run 에 반영 (P5 검증).
- `cancel()` 호출 → 진행 중 호출의 controller.abort() 가 발화되어 predict 가 `'Aborted'` kind 로 reject 또는 결과 폐기, run.kind 가 idle 또는 error('Aborted') 로 정리.
- `ReactionEngineError` 의 모든 `kind` 에 대해 `mapReactionErrorToKey` 가 매핑 표 (§5.2) 와 일치.
- 모듈-레벨 `inflightReactionController` 가 state 직렬화에 노출되지 않음 (`getState()` 결과의 키 집합 검증).

### 8.3 `uiStore` (`tests/unit/stores/uiStore.test.ts`)

- `beginLoading()` / `endLoading()` 의 균형 — `endLoading` 만 5번 호출 시 count 0 미만 방지.
- `notify({ ... })` 가 id 반환, `dismissNotification(id)` 가 정확히 해당 id 만 제거.
- **큐 상한 (R7)**: `notify` 를 `NOTIFICATION_QUEUE_MAX + 10` 회 호출 → `notifications.length === NOTIFICATION_QUEUE_MAX (50)`, 보존된 항목은 **가장 최근 50개** (가장 오래된 10개가 drop-oldest 로 축출, 잔존 첫 항목 id === 11번째로 push 한 id).
- `runCompoundSearch()` 가 phase-05 의 `resolveCompoundByName` mock 호출 → AsyncState 전이.
- `setCompoundSearchQuery` 갱신 시 results 가 idle 로 초기화 안 함 (사용자가 입력하는 동안 결과 유지).
- `selectCompoundSearchResult(cid)` 가 selectedCid 만 갱신, results 보존.

### 8.4 `settingsStore` (`tests/unit/stores/settingsStore.test.ts` + `settingsStore.persist.test.ts`)

- 기본값 검증: `theme: 'system'`, `locale: 'en'` (browser locale mock 으로 'ko' 도 검증).
- `setTheme('dark')` 후 localStorage 의 `chem.settings` 키에 직렬화된 객체 존재.
- **마이그레이션 테스트** (별도 파일):
  - `localStorage` 에 v0 의 `chem.theme: '"dark"'`, `chem.locale: '"ko"'` 만 있는 상태에서 첫 호출 시 → state.theme === 'dark', state.locale === 'ko'.
  - `chem.theme` 만 있고 `chem.locale` 없으면 → locale 은 `navigator.language` 기반.
  - 손상된 v1 키 (`chem.settings: '{"theme":"banana"}'`) → DEFAULT_SETTINGS 복귀 + logger.warn 호출.
- `resetToDefaults()` 후 persist 키도 갱신.

### 8.5 selector 안정성 (`tests/unit/stores/selector-stability.test.tsx`)

- `useMoleculeStore(selectActiveMolecule)` 구독 컴포넌트 — 무관한 액션 (`uiStore.toggleAtomLabels`) 호출 시 리렌더 0회 (spy).
- `useShallow` 적용된 복합 selector 의 무관 갱신 시 리렌더 0회.
- `subscribeWithSelector` 외부 구독 unsub 동작.

### 8.6 통합 시나리오 (`tests/unit/stores/integration.test.ts`)

- "분자 추가 → 반응물 등록 → predict 실행 → 분자 삭제" 시퀀스에서 cross-store 일관성:
  - `removeMolecule(id)` 가 reactionStore.reactantIds 에서도 제거되는지.
  - 진행 중 `predict` 가 있을 때 `removeMolecule` 이 reactionStore.cancel() 을 트리거 (P1 예외 지점) — _또는_ run 결과의 stale id 처리. 본 Phase 는 후자 (제거 후 결과는 표시하되 stale 표시) 채택, integration test 가 이를 강제.

---

## 9. 리스크 및 대안

| ID  | 리스크                                                                                             | 대응                                                                                                                                                                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | persist 마이그레이션 실패 (저장된 값이 새 스키마와 불일치, 또는 사용자가 수동 편집한 localStorage) | `onRehydrateStorage` 검증 실패 시 `DEFAULT_SETTINGS` 복귀 + `logger.warn`. 사용자에게는 다음 액션 시 토스트로 알림 (Phase 11)                                                                                                                                                         |
| R2  | AbortController 누수 — 컴포넌트 언마운트 후 액션이 commit                                          | 스토어가 controller 보관 + 다음 호출 시 cancel. 사용자도 `cancel()` 명시 호출 가능                                                                                                                                                                                                    |
| R3  | 스토어 간 cross-getState 남용 — ESLint 로 완전 차단 어려움                                         | `_crossStore.ts` 모듈에만 격리 + 코드 리뷰 가이드. PR 템플릿에 "stores 간 직접 참조 여부" 체크박스 추가 (Phase 15)                                                                                                                                                                    |
| R4  | Phase 09 의 undo 본 구현이 본 Phase placeholder 와 호환 깨짐                                       | §6.4 의 `UndoableDispatcher` 인터페이스를 본 Phase 에서 동결. 변경은 Phase 09 본 구현 단계에서 본 문서 갱신 필요                                                                                                                                                                      |
| R5  | immer draft 안에서 `Map` / `Set` 사용 시 enableMapSet 필요 — 잊으면 런타임 오류                    | P3 에 따라 `Record<...>` + `ids` 배열 패턴만 사용 (Map/Set 미사용). enableMapSet 호출 안 함                                                                                                                                                                                           |
| R6  | persist 직렬화에 RDKit `Mol` 객체 등 비-직렬화 가능 값 포함 → JSON.stringify 폭발                  | `settingsStore` 외 어떤 스토어도 persist 적용 안 함. `Molecule` 은 plain object 만 담는다는 phase-03 §4.5 보장                                                                                                                                                                        |
| R7  | `notifications` 큐 무한 증가 (사용자가 dismiss 안 함)                                              | `src/stores/_shared/notifications.ts` 에 `export const NOTIFICATION_QUEUE_MAX = 50;` 정의. `notify(n)` 는 push 후 길이가 `NOTIFICATION_QUEUE_MAX` 를 초과하면 **가장 오래된 항목부터 drop-oldest** 로 잘라 정확히 `NOTIFICATION_QUEUE_MAX` 개 유지 (FIFO 축출). §8.3 #N 테스트로 검증 |
| R8  | DevTools 미들웨어가 production 번들에 포함되면 번들 부풀음                                         | `import.meta.env.DEV` 게이트 + Vite tree-shake 보장. 번들 분석은 Phase 14                                                                                                                                                                                                             |
| R9  | persist 의 `version` 충돌 — 향후 export/import (Phase 13) 가 다른 version 체계 도입                | 본 Phase 는 `version: 1` 고정. Phase 13 의 export 포맷은 별도 schemaVersion (phase-05 의 패턴) 가짐                                                                                                                                                                                   |

---

## 10. 완료 기준 (Definition of Done)

본 Phase 는 다음 모든 항목이 만족될 때 완료로 간주한다.

- [ ] `src/stores/` 의 4 스토어가 §4–§5 의 타입/액션/selector 면을 노출하며 vitest 그린.
- [ ] 텍스트 입력 (Phase 12) / 화합물 검색 (Phase 11) / 반응 (Phase 11) UI 가 본 Phase 의 액션·selector 만 사용해 도메인 호출에 도달 가능 (실제 UI 는 Phase 11/12 가 만들지만, 본 Phase 의 계약이 그것을 가능케 함을 단위 테스트로 검증).
- [ ] `chem.theme` / `chem.locale` 만 있는 v0 빌드 사용자가 새 빌드 첫 로드에서 동일 설정 유지 (마이그레이션 테스트 그린).
- [ ] 패널/뷰포트 코드에서 `@/engine/*` / `@/services/*` / `@/data/*` 직접 import 가 없음 — 모두 `@/stores` 를 거침 (ESLint 레이어 가드 통과).
- [ ] Undoable 액션 `kind` enum 9개 + `dispatchUndoable` 인터페이스 동결 (Phase 09 가 구현 인수).
- [ ] selector 안정성 테스트가 무관 갱신 시 리렌더 0회를 검증.
- [ ] persist 손상 시 `DEFAULT_SETTINGS` 복귀 + `logger.warn` 호출.
- [ ] DevTools 미들웨어가 `import.meta.env.PROD` 빌드에서 트리쉐이크되어 번들 미포함 (Phase 14 가 최종 검증, 본 Phase 는 코드상 게이트).
- [ ] `_crossStore.ts` 외 어떤 스토어 모듈도 다른 스토어의 `getState()` 를 호출하지 않음 (코드 리뷰 + grep 검증).

---

## 11. 열린 질문 (User Decision Required)

Plan 단계에서 D1–D5 + P1–P6 가 모두 확정되어 본 §11 은 **Phase 07 본 구현 이후로 미뤄진 항목** 만 보존한다.

1. **구 persist 키 (`chem.theme` / `chem.locale`) 의 삭제 시점** — 본 Phase 는 롤백 안전을 위해 유지. 안전 윈도우 (예: 7–30일) 경과 후 Phase 13 (Export/Import) 또는 Phase 15 (Polish) 에서 삭제 결정. 삭제 시 `removeItem(LEGACY_*)` 한 줄 추가로 충분.
2. **단위계 표시 i18n 키** — `°C` / `K` / `atm` / `Pa` 표기 토글의 i18n 키 명명은 Phase 11 패널 UI 구성 시 채움 (예: `panels.conditions.tempUnit.celsius`).
3. **알림 자동 dismiss 시간 기본값** — 본 Phase 는 `dismissAfterMs?: number | null` 옵션만 노출. 디폴트 (예: info=4000ms, error=null) 는 Phase 11 토스트 컴포넌트가 결정.
4. ~~**Undo 스택 용량 한도 / 스냅샷 전략**~~ — **해소됨**: Phase 09 §4.3, §6.1, D1–D3 에서 full snapshot / N=50 / 200 ms merge 로 확정 (위 §1 #4 참고).
5. **persist v2 도입** — Phase 13 의 export/import 포맷 확정 후 재검토.

---

## 12. 다음 Phase 로의 인계 (Hand-off)

| Phase                     | 본 Phase 가 인계하는 것                                                                                                                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **08 (Rendering)**        | `selectActiveMolecule` / `selectMoleculeById` 안정 selector, `selectAtomLabelsOn` / `selectBackgroundOverride` 뷰포트 옵션, `useMoleculeStore.subscribe(selector, listener)` 외부 구독 패턴 (`useFrame` 안 직접 사용 가능)  |
| **09 (Interactions)**     | `UndoableDispatcher` 인터페이스 + `UndoableActionKind` 9개 enum, `moveAtom` / `setBondOrder` / `addBond` 등 동기 편집 액션 시그니처. Phase 09 는 `phase07PlaceholderDispatcher` 를 본 구현으로 교체                         |
| **10 (UI Framework)**     | `selectActivePanel` / 패널 토글 액션, `selectIsGloballyLoading` 전역 스피너                                                                                                                                                 |
| **11 (UI Panels)**        | `notifications` 큐 + `notify` / `dismissNotification` (토스트 컴포넌트 책임), `compoundSearch` slice + `runCompoundSearch` (검색 패널), `mapReactionErrorToKey` 매핑 (반응 결과 패널), 단위계 표시 selector (`selectUnits`) |
| **12 (Text Input)**       | `addFromSmiles` / `addFromInchi` 진입점, `IngestError` 분기 표                                                                                                                                                              |
| **13 (Export/Import)**    | `selectMoleculeSnapshot(id)` (직렬화 가능 dump), persist 마이그레이션 패턴 (v1 → v2 재사용)                                                                                                                                 |
| **14 (Performance)**      | DevTools 미들웨어 게이트, selector 분포 측정 자리, `subscribeWithSelector` 기반 React-외 구독 (메인 스레드 부하 감소)                                                                                                       |
| **15 (Testing & Polish)** | persist 마이그레이션 회귀 테스트, 스토어 간 cross-action 일관성 시나리오                                                                                                                                                    |

---

_문서 버전: 0.1 (초안)_
_작성일: 2026-04-25_
