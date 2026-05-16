# Phase 06 — Reaction Engine

> 본 문서는 `architecture.md` §13 의 Phase 06 상세 설계서다. 코드 작성은 모든 details 문서의 검토가 끝난 뒤에만 시작한다.
>
> **선행 문서**: `architecture.md` (특히 §1.4, §3.1-2, §3.4, §3.7, §5.1, §6, §11, §12), `details/phase-01-foundation.md`, `details/phase-02-element-data.md`, `details/phase-03-chemistry-engine.md`, `details/phase-04-compound-data-pipeline.md`, `details/phase-05-runtime-data-layer.md`.

---

## 1. 목적 (Purpose)

화학 반응을 **반응물(Molecule[]) + 조건(Condition) → 생성물(Molecule[]) + 메타데이터** 로 변환하는 단일 진입점을 제공한다. 본 Phase 의 핵심 약속은 다음 세 가지다.

1. **혼합 엔진** — 1차로 Reaction SMARTS 규칙 DB 매칭(`RDKit.RunReactants`), 2차로 원자가·전기음성도 기반 휴리스틱, 둘 다 실패 시 명시적 "예측 불가" 를 반환한다 (architecture §3.1-2).
2. **정직한 실패** — 모든 외부 노출 API 는 `Result<T, E>` 패턴으로 실패 사유를 좁혀진 유니온으로 노출한다. 도메인/엔진 레이어는 예외를 throw 하지 않는다 (architecture §3.7).
3. **순수 TypeScript** — `chemistry`/`engine`/`data` 계층에서 끝난다. UI(Phase 11)·스토어(Phase 07)·Worker 실제 구현(Phase 14) 은 본 문서가 못박는 퍼블릭 API 만 호출/포장한다.

본 Phase 는 architecture §12 의 열린 질문 중 (1) "실험적 예측" 배지 문구와 (3) ΔH 데이터 소스 결정을 닫는다.

---

## 2. 범위 (Scope)

### 2.1 포함

- **반응 규칙 DB**: SMARTS 패턴, 카테고리, 조건 범위, ThermoFlag, 우선순위/신뢰도 정보를 담은 `ReactionRule` 확장 타입과 매니페스트/청크 데이터 자산.
- **규칙 매칭 엔진**: RDKit `RunReactants` 래퍼, 후보 규칙 prefilter, 매칭 시도 루프, 생성물 ParsedMol → Molecule 임베드.
- **조건 평가**: T/P/pH 범위 매칭 순수 함수.
- **휴리스틱 fallback (본 구현)**: 원자가 충족 검사 + 전기음성도 차이 기반 결합 변경 후보 평가. 결과는 항상 `'heuristic-experimental'`, `confidence: 'low'`. (사용자 결정 U4)
- **ThermoFlag 판정**: 매칭 규칙 → 휴리스틱 → `'unknown'` 우선순위.
- **시드(TSV) → 청크(JSON) 빌드 스크립트**: `scripts/reactions-build/`. 시드의 `source` / `license` 컬럼 강제 검증. 화이트리스트 외 라이선스 차단.
- **"실험적" 라벨 i18n 키 정의**: `common.json` 의 `reaction.*` 네임스페이스 한·영 초안 문구.
- **Web Worker 경계 인터페이스**: `ReactionBackend` 정의만. 실제 Worker 구현은 Phase 14.
- **결과 캐시**: `(canonical SMILES tuple, rounded condition, rulesetVersion)` LRU.

### 2.2 비포함 (다른 Phase / 비목표)

- UI 컴포넌트 (Phase 11) — ReactionResult 패널·"experimental" 배지 컴포넌트.
- 스토어 노출 (Phase 07) — `reactionStore.run()` 등.
- Worker 실제 구현 (Phase 14) — `ReactionBackend` 의 Worker 측 호스팅, RdkitBackend 와의 공존 디자인.
- **ΔH 정량 계산** — `enthalpyKjPerMol` 등 정량값 필드 도입 안 함 (architecture §1.4 비목표 + 사용자 결정 U3 확정). `ThermoFlag` 의 방향 플래그만 유지. NIST/결합에너지 도입은 architecture §12-3 의 후속 결정으로 유지 (§12 hand-off 참조).
- **입체화학 결과 반영** — R/S, cis/trans 는 표시만, 반응 결과 판정/생성물 입체에 반영 안 함 (architecture §3.1-4).
- **임의 반응 ML 예측** — architecture §1.4 비목표.
- **반응 좌표 보존 모드** — 생성물 3D 좌표는 항상 ETKDG 재임베드 (P1). atom map 기반 좌표 승계 모드는 Phase 14+ 검토.
- **확장 규칙 셋 (Core / Extended)** — 사용자 결정 U1 확정으로 v1 은 Minimal (~10건). Core/Extended 확장은 별도 작업.

---

## 3. 의존성 (Dependencies)

### 3.1 선행 Phase

| Phase                  | 본 Phase 가 사용하는 자산                                                                                                                                                                                                                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 (Foundation)        | `Result<T, E>`, `Condition`, `ThermoFlag`, `ReactionRule` (확장 대상), `ReactionResult`, `ReactionPredictionKind`, `Molecule`/`Atom`/`Bond`, `Logger`, i18n 네임스페이스 분리(common vs chemistry)                                                                                                                         |
| 02 (Element Data)      | `getElement(n).electronegativity` (휴리스틱 결합 극성용), `elementSymbolOf`                                                                                                                                                                                                                                                |
| 03 (Chemistry Engine)  | `getRdkit()` / `ensure()` / `RdkitStatus` 공유, `parseSmiles`, `toCanonicalSmiles`, `toMoleculeWith3D`, `smilesTo3DMolecule`, `validateMolecule`, `ParsedMol` / `EmbedError` / `ParseError`, `RdkitInitError`. `RunReactants` 래퍼는 본 Phase 가 `src/engine/rdkit/reactions.ts` 에 신규 추가 (phase-03 §13 hand-off 정합) |
| 04 (Compound Pipeline) | 카테고리 청크 + 매니페스트 + 시드(TSV) + `no-restricted-paths` 가드 패턴. **Node-side RDKit 로더 `scripts/pubchem-fetch/pubchem/rdkit-node.ts` 는 본 Phase 의 빌드 스크립트가 SMARTS 컴파일 검증 (§8.9) 을 위해 그대로 재사용** (별도 Node RDKit 로더 작성 금지; phase-04 §6.4 정합)                                       |

본 Phase 는 **Phase 05 의 `services/pubchem` / `services/cache` 를 직접 호출하지 않는다**. 다만 **에러 판별 유니온 shape** 은 phase-05 §4.3 의 `{ readonly kind: '<Name>'; readonly ...; readonly retryable: boolean }` 패턴을 차용해 스토어 분기 일관성을 확보한다.

### 3.2 외부 라이브러리

| 라이브러리                     | 용도                                 | 비고                                  |
| ------------------------------ | ------------------------------------ | ------------------------------------- |
| `@rdkit/rdkit` (Phase 03 도입) | `RunReactants`, Reaction 객체 컴파일 | Phase 03 인스턴스 공유, 재초기화 금지 |
| `zod` (Phase 04 도입)          | 청크 JSON / 매니페스트 스키마 검증   | 빌드 스크립트 + 런타임 양쪽           |

**신규 라이브러리 추가 없음.** architecture §2 의 "스택 외 추가는 근거와 함께 명시" 조항에 해당하지 않는다.

### 3.3 결정 필요 사항 (사용자 확인 — Plan 단계에서 모두 확정)

| ID  | 질문                           | 확정 답                                                                                            | 본문 영향                                                                                               |
| --- | ------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------- |
| U1  | 규칙 DB 초기 큐레이션 범위     | **Minimal (~10 건)**                                                                               | §4.2 의 `RuleCategory` 는 `'acid-base-neutralization'                                                   | 'esterification-hydrolysis' | 'simple-redox'` 세 카테고리만. 시드 TSV 도 ~10 행. |
| U2  | SMARTS 출처 정책               | **오픈 DB 차용 + 자체 보강** (RDKit 번들 `Reactions.txt` 등 호환 라이선스 차용 + 부족분 자체 작성) | §4.4 시드 TSV 의 `source` / `license` 컬럼 필수. 빌드 스크립트가 화이트리스트 라이선스만 통과 (§6.8 ④). |
| U3  | ΔH 데이터 소스                 | **ThermoFlag 만 유지** (정량 ΔH 필드 도입 안 함)                                                   | §4.1 의 `ReactionRule` 확장에 `enthalpyKjPerMol` 추가 안 함. §6.6 ThermoFlag 결정 로직만 유지.          |
| U4  | 휴리스틱 알고리즘 본 구현 시점 | **Phase 06 본 구현까지**                                                                           | §5.4 `tryHeuristic` 은 stub 이 아닌 실 구현. §6.7 에 의사코드 본문 포함.                                |

추가로, Plan 검토 단계에서 아키텍처/관례에 의해 자유도 없는 사항으로 판정된 **선결정 사항(P1–P8)** 은 다음과 같다 (필요 시 사용자 검토 단계에서 반박 가능).

| ID  | 결정                                                                                                                                                                                                        | 근거                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| P1  | 반응 생성물 3D 좌표는 항상 ETKDG 재임베드 (v1). 좌표 보존 모드는 Phase 14+.                                                                                                                                 | SMARTS atom map 누락/결합 재배열/혼성 변화 시 보존 좌표가 기하학적으로 무효.                                |
| P2  | 휴리스틱 fallback 인터페이스 + 본 구현 모두 본 Phase. 인터페이스는 향후 알고리즘 교체 가능하도록 stub-호환 형태.                                                                                            | architecture §3.1-2 "혼합 엔진" 은 정책. U4 가 본 구현을 본 Phase 로 확정.                                  |
| P3  | Web Worker 경계만 정의, 구현은 Phase 14. `ReactionBackend` 는 `RdkitBackend` 의 "확장" 이 아니라 **병렬 boundary**.                                                                                         | phase-03 §6.8 동일 패턴.                                                                                    |
| P4  | `predict(input, opts?)` 시그니처 분리 — `PredictInput` 과 `PredictOptions` 별도 파라미터.                                                                                                                   | phase-05 호출 패턴 일관.                                                                                    |
| P5  | `AbortSignal` 은 규칙 시도 사이에서만 honored. RDKit `RunReactants` 동기 호출 중간 중단 불가.                                                                                                               | RDKit.js WASM 동기 호출 불가피 (phase-05 §6.4 패턴).                                                        |
| P6  | i18n 키는 `common.json` 의 `reaction.*` (UI 라벨). `chemistry.{ko,en}.json` 의 `reactions.*` 는 `RuleCategory` 표시명 (도메인 용어 사전) 전용.                                                              | phase-01 §5.1 namespace 분리 원칙.                                                                          |
| P7  | `ReactionRule` 확장 4 필드 — `priority`, `confidence`, `categories`, `version`. `productTemplateNotes` 는 `source` 와 중복이라 제거. 옵셔널은 `T \| null` (architecture §3.4 `exactOptionalPropertyTypes`). | Phase 01 TODO (`priority`+`confidence`) 만 닫고, `categories`/`version` 은 신규 추가임을 traceability 명기. |
| P8  | 결과 캐시 키에 `rulesetVersion` 포함. 청크 핫스왑 시 stale 결과 자동 무효화.                                                                                                                                | 데이터 무결성. 골든 통과·프로덕션 stale 사고 방지.                                                          |

---

## 4. 데이터 모델 / 타입

### 4.1 `ReactionRule` 확장 (Phase 01 TODO 클로즈 + 신규 필드)

Phase 01 (`src/chemistry/reactions/types.ts`, L243–254) 의 `ReactionRule` 에 다음 필드를 추가한다.

```ts
// src/chemistry/reactions/types.ts (확장본)
export type RuleConfidence = 'high' | 'medium' | 'low';

export interface ReactionRule {
  readonly id: string; // (Phase 01)
  readonly smarts: string; // (Phase 01) Reaction SMARTS
  readonly conditionRange: Partial<{
    // (Phase 01)
    readonly temperatureK: readonly [number, number];
    readonly pressureAtm: readonly [number, number];
    readonly pH: readonly [number, number];
  }>;
  readonly thermo: ThermoFlag; // (Phase 01)
  readonly source: string; // (Phase 01) 출처 (참고문헌/DB 식별자)

  // ─── 본 Phase 신규 ───
  readonly priority: number; // (Phase 01 TODO 클로즈) 0 = 최고. 동률은 id 사전순.
  readonly confidence: RuleConfidence; // (Phase 01 TODO 클로즈)
  readonly categories: ReadonlyArray<RuleCategory>; // (신규, P7) prefilter 용
  readonly version: string; // (신규, P7) 매니페스트 version 과 동일. 캐시 무효화 키 component (P8)
  readonly license: ReactionRuleLicense; // (신규, U2) 출처 라이선스 화이트리스트 enum
  readonly requiredElements: ReadonlyArray<ElementNumber>; // (신규) prefilter 가속 — 반응에 필수 원소
}
```

> **traceability 메모**: Phase 01 (`L253`) 의 `// TODO: Phase 06 — 신뢰도/우선순위` 는 `priority` + `confidence` 두 필드 추가로 닫힌다. `categories`, `version`, `license`, `requiredElements` 는 TODO 와 별개의 **신규 필드** 다.

### 4.2 `RuleCategory` 유니온 (U1 Minimal 확정)

```ts
// src/chemistry/reactions/types.ts
export type RuleCategory =
  | 'acid-base-neutralization' // 산-염기 중화
  | 'esterification-hydrolysis' // 에스테르화/가수분해
  | 'simple-redox'; // 단순 산화환원
```

추후 카테고리 확장은 Phase 06 본 구현 외 별도 작업이며, 본 유니온에 항목을 추가하면 기존 매니페스트/시드와의 호환성만 점검하면 된다.

### 4.3 라이선스 화이트리스트 (U2)

```ts
// src/chemistry/reactions/types.ts
export type ReactionRuleLicense =
  | 'Apache-2.0'
  | 'BSD-3-Clause'
  | 'BSD-2-Clause'
  | 'MIT'
  | 'CC-BY-4.0'
  | 'CC0-1.0'
  | 'in-house';
```

빌드 스크립트(`scripts/reactions-build/validate.ts`) 가 시드 TSV 의 `license` 컬럼이 위 enum 안에 있는지 강제 검증. `in-house` 는 자체 작성 항목용. architecture L7 의 "프로젝트 라이선스 미정" 결정과 모순되지 않도록, **본 Phase 가 채용한 라이선스는 모두 호환 가능한 카피레프트-약함/허용 라이선스로 한정**한다 (Phase 01 라이선스 결정 시 본 화이트리스트와 합치 검증 필요 — §10 DoD). **우발 차단 방지 계약**: Phase 01 이 카피레프트(GPL 계열) 프로젝트 라이선스를 선택하면, 화이트리스트에서 비호환 항목을 가지치기하고(`CC-BY-SA` 등 share-alike 충돌 항목 우선 제거) 해당 시드 규칙을 `in-house` 재작성 또는 드롭한다 — 이 가지치기는 데이터 재빌드 PR 로 흡수하며 Phase 06 코드/타입은 불변(enum 멤버 축소만).

### 4.4 시드(curated TSV) 포맷

`scripts/reactions-build/seeds/{category}.tsv` 는 다음 컬럼을 갖는다 (탭 구분, 첫 행 헤더, `#` 시작 행은 주석).

```
id  smarts  categories  thermo  priority  confidence  source  license  condition_t_min  condition_t_max  condition_p_min  condition_p_max  condition_ph_min  condition_ph_max  required_elements  notes_ko  notes_en
```

| 컬럼                    | 타입/값                            | 비고                                    |
| ----------------------- | ---------------------------------- | --------------------------------------- |
| `id`                    | `string` (kebab-case)              | 전역 유일                               |
| `smarts`                | `string`                           | RDKit 컴파일 가능해야 함 (§8.9 CI 검증) |
| `categories`            | `string` (`,` 구분)                | `RuleCategory` 유니온 값들              |
| `thermo`                | `exothermic\|endothermic\|unknown` |                                         |
| `priority`              | `int`                              | 0 이 최고                               |
| `confidence`            | `high\|medium\|low`                |                                         |
| `source`                | `string`                           | 필수. 빈 값 금지. URL 또는 인용 식별자. |
| `license`               | `ReactionRuleLicense`              | 필수. 화이트리스트만                    |
| `condition_*_min/max`   | `number` 또는 빈칸                 | 빈칸이면 해당 차원 무관                 |
| `required_elements`     | `string` (`,` 구분, 원소 기호)     | 빈 값 가능                              |
| `notes_ko` / `notes_en` | `string` 또는 빈 값                | 사용자 안내용 한·영 메모                |

빈 컬럼은 `\t\t` (연속 탭) 로 표현. 빌드 스크립트가 모든 행을 zod 스키마로 검증 후 청크 JSON 생성.

### 4.5 청크 / 매니페스트 스키마

#### 청크 (`src/data/reactions/chunks/{category}.json`)

```ts
// src/data/reactions/types.ts
export interface ReactionChunkFile {
  readonly version: string; // ISO8601 build timestamp
  readonly category: RuleCategory;
  readonly rules: ReadonlyArray<ReactionRule>;
}
```

쓰기 시 `rules` 는 `priority` 오름차순 → `id` 사전순으로 정렬해 결정성 확보 (Phase 04 §6.6 패턴).

#### 매니페스트 (`src/data/reactions/manifest.json`)

```ts
export interface ReactionManifest {
  readonly version: string; // 빌드 시각 (모든 청크와 동일해야 함)
  readonly totalRules: number;
  readonly licenseSummary: ReadonlyArray<{
    readonly license: ReactionRuleLicense;
    readonly count: number;
    readonly attributionUrl: string | null; // 표기 의무 라이선스만
  }>;
  readonly categories: Readonly<
    Record<
      RuleCategory,
      {
        readonly chunk: string; // 'acid-base-neutralization.json'
        readonly count: number;
        readonly priorityRange: readonly [number, number];
        readonly requiredElementsUnion: ReadonlyArray<ElementNumber>; // prefilter 가속
      }
    >
  >;
  readonly entries: ReadonlyArray<ReactionManifestEntry>; // 매니페스트만으로 prefilter 가능
}

export interface ReactionManifestEntry {
  readonly id: string;
  readonly category: RuleCategory;
  readonly priority: number;
  readonly confidence: RuleConfidence;
  readonly thermo: ThermoFlag;
  readonly requiresPh: boolean; // condition.pH 필요 여부 사전 계산
  readonly requiredElements: ReadonlyArray<ElementNumber>;
  readonly chunk: string;
}
```

Phase 04 매니페스트와 동일하게 모든 `RuleCategory` 키가 `categories` 에 존재해야 한다 (빈 카테고리도 `count: 0, requiredElementsUnion: []`). `noUncheckedIndexedAccess` 안전성 확보.

> **`ReactionManifestEntry` 와 `CompoundManifestEntry` 의 관계**: 두 타입은 _별개 타입_ 이며 서로 import 하지 않는다. 공통 필드처럼 보이는 항목 (`priority`, `category`, `version`) 은 _의미가 다르다_:
>
> - `priority`: 본 Phase 는 _시도 순서_ (낮을수록 먼저 매칭 시도). phase-04 는 _UI 정렬_ (낮을수록 먼저 표시).
> - `category`: 본 Phase 는 `RuleCategory` (`'acid-base'` 등 반응 분류). phase-04 는 `CompoundCategory` (`'inorganic-common'` 등 화합물 분류).
> - `version`: 본 Phase 는 `ReactionManifest.version` (반응 데이터셋 빌드 시각). phase-04 는 `compounds.meta.json.collectedAt` (화합물 데이터셋 수집 시각). 서로 비교/교환되지 않는다.
>
> 두 매니페스트가 구조적 일관성을 갖는 것은 _의도된 패턴 일치_ 이며 (eager 인덱스 + lazy 청크), 코드 수준에서 공유 타입 추출은 비목표 (의미 분리가 더 중요).

### 4.6 엔진 입출력 타입 (P4 적용)

```ts
// src/engine/reaction/types.ts
import type { Molecule } from '@/chemistry/compounds/types';
import type {
  Condition,
  ReactionResult,
  ReactionPredictionKind,
} from '@/chemistry/reactions/types';
import type { Result } from '@/types/result';
import type { RdkitInitError, EmbedError } from '@/engine/rdkit/types';

export interface PredictInput {
  readonly reactants: ReadonlyArray<Molecule>;
  readonly condition: Condition;
}

export interface PredictOptions {
  readonly signal?: AbortSignal; // optional (phase-05 호환). P5 제약: 규칙 시도 사이에서만 honored
  readonly force?: boolean; // 캐시 무시
}

export type PredictOutput = Result<ReactionResult, ReactionEngineError>;
```

> **`ReactionResult` / `ReactionPredictionKind` 는 Phase 01 `src/chemistry/reactions/types.ts` §4.2 가 단일 정의 site** 이며, 본 Phase 는 **재정의하지 않고 그대로 소비/반환**한다. 구현자가 참조할 수 있도록 정본 형태를 그대로 옮기면 (Phase 01 과 byte-identical 유지 — 한쪽 변경 시 양쪽 동시 갱신):
>
> ```ts
> export type ReactionPredictionKind = 'rule-based' | 'heuristic-experimental';
> export interface ReactionResult {
>   readonly products: ReadonlyArray<Molecule>;
>   readonly kind: ReactionPredictionKind;
>   readonly appliedRuleId: string | null; // rule-based 일 때 적용 규칙 id
>   readonly thermo: ThermoFlag;
>   readonly confidence: number; // 0..1 — rule-based: 규칙 confidence 매핑(§4.x), heuristic: 휴리스틱 점수
>   readonly notes: string | null; // **i18n 키** (해석된 문자열 아님 — 엔진은 UI 비의존, arch §3.4)
> }
> ```
>
> `appliedRuleId` 만 노출되며 규칙의 `source`/메타데이터는 `ReactionResult` 에 포함하지 않는다 (UI 가 필요 시 별도 매니페스트 조회 — Phase 11 §11 참조, v1 비표시).
>
> **`confidence` 산정** (`ReactionResult.confidence: number` 0..1): rule-based 는 규칙의 `RuleConfidence` enum 을 `ruleConfidenceToScore` 로 사상, heuristic 은 고정 상수 `HEURISTIC_CONFIDENCE` 를 쓴다 (`src/engine/reaction/confidence.ts`):
>
> ```ts
> export const HEURISTIC_CONFIDENCE = 0.25;
> export function ruleConfidenceToScore(c: RuleConfidence): number {
>   return c === 'high' ? 0.95 : c === 'medium' ? 0.7 : 0.4;
> }
> ```

### 4.7 `ReactionEngineError` 판별 유니온 (phase-05 §4.3 shape 차용)

```ts
// src/engine/reaction/types.ts
export type ReactionEngineError =
  | { readonly kind: 'RdkitNotReady'; readonly retryable: true }
  | { readonly kind: 'RdkitInitFailed'; readonly cause: RdkitInitError; readonly retryable: false }
  | {
      readonly kind: 'NoMatchingRule';
      readonly triedRuleIds: ReadonlyArray<string>;
      readonly retryable: false;
    }
  | {
      readonly kind: 'HeuristicAbstained';
      readonly reason: HeuristicAbstainReason;
      readonly retryable: false;
    }
  | {
      readonly kind: 'ConditionOutOfRange';
      readonly nearestRuleIds: ReadonlyArray<string>;
      readonly retryable: false;
    }
  | {
      readonly kind: 'InvalidReactant';
      readonly issues: ReadonlyArray<string>;
      readonly retryable: false;
    }
  | {
      readonly kind: 'RunReactantsFailed';
      readonly ruleId: string;
      readonly rdkitMessage: string;
      readonly retryable: false;
    }
  | {
      readonly kind: 'EmbedFailed';
      readonly ruleId: string | null;
      readonly cause: EmbedError;
      readonly retryable: true;
    }
  | { readonly kind: 'Aborted'; readonly retryable: false }
  | { readonly kind: 'Internal'; readonly detail: string; readonly retryable: false };

export type HeuristicAbstainReason =
  | 'no-candidate-pair'
  | 'too-many-bond-changes'
  | 'embed-failed'
  | 'electronegativity-data-missing';

export type HeuristicError =
  | { readonly kind: 'HeuristicAbstained'; readonly reason: HeuristicAbstainReason }
  | { readonly kind: 'EmbedFailed'; readonly cause: EmbedError }
  | { readonly kind: 'Internal'; readonly detail: string };
```

`retryable` 의 기준:

- `true` = 동일 입력으로 재시도하면 결과가 바뀔 수 있는 경우 (RDKit init 진행 중, ETKDG 재시도로 성공 가능 등).
- `false` = 입력 자체가 바뀌어야 결과가 바뀌는 경우.

### 4.8 "experimental" 배지 정책 + i18n 키 초안 (P6)

`ReactionResult.kind === 'heuristic-experimental'` 일 때만 UI 가 배지를 부착한다. i18n 키는 다음과 같이 분리 (P6).

```jsonc
// src/i18n/resources/ko/common.json (발췌)
{
  "reaction": {
    "experimentalBadge": "실험적 예측",
    "experimentalDisclaimer": "이 결과는 규칙 DB 가 아닌 휴리스틱(원자가·전기음성도 추정)으로 도출되었습니다. 실제 반응 결과와 다를 수 있습니다.",
    "noMatchingRule": "이 조건과 반응물 조합에 일치하는 규칙이 없습니다.",
    "conditionOutOfRange": "조건이 규칙 적용 범위 밖입니다.",
    "abstained": "휴리스틱 엔진이 결과를 추정하지 못했습니다.",
    "rdkitNotReady": "화학 엔진이 아직 준비되지 않았습니다.",
    "embedFailed": "생성물의 3D 구조를 만들지 못했습니다.",
  },
}
```

```jsonc
// src/i18n/resources/en/common.json (발췌)
{
  "reaction": {
    "experimentalBadge": "Experimental prediction",
    "experimentalDisclaimer": "This result was produced by a heuristic engine (valence + electronegativity estimate), not the curated rule DB. It may not match real-world outcomes.",
    "noMatchingRule": "No rule matches the given reactants and conditions.",
    "conditionOutOfRange": "Conditions fall outside the applicable rule ranges.",
    "abstained": "The heuristic engine could not produce a result.",
    "rdkitNotReady": "The chemistry engine is still loading.",
    "embedFailed": "Failed to generate 3D coordinates for the products.",
  },
}
```

```jsonc
// src/i18n/resources/ko/chemistry.json (발췌, RuleCategory 표시명 — P6)
{
  "reactions": {
    "categoryNames": {
      "acid-base-neutralization": "산-염기 중화",
      "esterification-hydrolysis": "에스테르화/가수분해",
      "simple-redox": "단순 산화환원",
    },
  },
}
```

```jsonc
// src/i18n/resources/en/chemistry.json (발췌)
{
  "reactions": {
    "categoryNames": {
      "acid-base-neutralization": "Acid-base neutralization",
      "esterification-hydrolysis": "Esterification / hydrolysis",
      "simple-redox": "Simple redox",
    },
  },
}
```

UI 컴포넌트 구현은 Phase 11. 본 Phase 는 키와 한·영 초안 문구만 확정한다. CVD/색약 모드 시 라벨 강제 on (architecture §3.10) 도 Phase 15 에서 검증.

---

## 5. 퍼블릭 API / 인터페이스

### 5.1 `src/engine/reaction/index.ts` — 단일 진입점

```ts
import type { PredictInput, PredictOptions, PredictOutput } from './types';

export async function predict(input: PredictInput, opts?: PredictOptions): Promise<PredictOutput>;

// 외부에서 필요한 타입 재노출
export type {
  PredictInput,
  PredictOptions,
  PredictOutput,
  ReactionEngineError,
  HeuristicAbstainReason,
} from './types';
```

호출자(Phase 07 `reactionStore.run()`) 는 이 파일만 import 한다 (§7.2 공개 경계).

### 5.2 `src/engine/reaction/rules.ts` — 매니페스트 / 청크 로더 호환 헬퍼

```ts
// RuleSearchOptions 는 chemistry 계층에 정의 — data 가 합법적으로 import 가능 (arch §4.1).
import type {
  ReactionRule,
  RuleCategory,
  ReactionManifestEntry,
  RuleSearchOptions,
} from '@/chemistry/reactions/types';

// (`RuleSearchOptions` 정의 위치: src/chemistry/reactions/types.ts)
// export interface RuleSearchOptions {
//   readonly categories?: ReadonlyArray<RuleCategory>;
//   readonly requiresPh?: boolean | null;        // null = 무관
//   readonly minPriority?: number;
//   readonly requiredElementsSubsetOf?: ReadonlyArray<ElementNumber>;
// }

export function searchManifestEntries(
  opts: RuleSearchOptions,
): ReadonlyArray<ReactionManifestEntry>;
export function loadRulesByIds(ids: ReadonlyArray<string>): Promise<ReadonlyArray<ReactionRule>>;

// 후보 prefilter — 매니페스트만 보고 `RunReactants` 시도 후보를 좁힌다.
export function prefilterCandidates(
  reactants: ReadonlyArray<Molecule>,
  condition: Condition,
): ReadonlyArray<ReactionManifestEntry>;
```

`prefilterCandidates` 의 정렬 순서: `priority` 오름차순 → `id` 사전순. `predict` 가 이 순서대로 시도한다.

### 5.3 `src/engine/reaction/conditions.ts` — 순수 조건 평가

```ts
import type { ReactionRule, Condition } from '@/chemistry/...';

export function matchesConditionRange(rule: ReactionRule, condition: Condition): boolean;
export function distanceFromRange(rule: ReactionRule, condition: Condition): number; // 거리 척도 — 가장 가까운 규칙 추천용
```

경계값은 **닫힌 구간** (≤, ≥). 규칙이 `pH` 범위를 요구하지만 `condition.pH === null` 인 경우 미스매치 (`false`).

### 5.4 `src/engine/reaction/heuristic.ts` — 휴리스틱 본 구현 (U4)

```ts
import type { Result } from '@/types/result';
import type { PredictInput } from './types';
import type { ReactionResult, HeuristicError } from '@/chemistry/...';

export function tryHeuristic(input: PredictInput): Promise<Result<ReactionResult, HeuristicError>>;
```

- 동기로 끝낼 수 있는 부분(원자가/전기음성도 평가)은 동기, 마지막 ETKDG 재임베드만 `await` 하므로 함수는 `Promise` 반환.
- 결과는 항상 `kind: 'heuristic-experimental'`, `confidence: 'low'`, `appliedRuleId: null`, `notes` 에 한·영 휴리스틱 사유.
- 인터페이스는 stub-호환 형태 유지 (P2) — 향후 알고리즘 교체 시 시그니처 변경 없이 가능.

### 5.5 `src/engine/rdkit/reactions.ts` — RDKit `RunReactants` 래퍼 (Phase 03 모듈 옆 신규)

```ts
import type { Result } from '@/types/result';
import type { ParsedMol } from '@/engine/rdkit/types';

export type RunReactantsError =
  | { readonly kind: 'CompileFailed'; readonly rdkitMessage: string }
  | { readonly kind: 'NoMatch' }
  | { readonly kind: 'RdkitThrew'; readonly rdkitMessage: string };

export function runReactants(
  rxnSmarts: string,
  reactants: ReadonlyArray<ParsedMol>,
): Result<ReadonlyArray<ReadonlyArray<ParsedMol>>, RunReactantsError>;

export function clearReactionCache(): void; // 테스트용
```

- Reaction 객체 SMARTS → RDKit `RxnMol` 컴파일은 LRU 캐시 (capacity 64). 동일 SMARTS 재사용 시 재컴파일 안 함.
- 매칭 실패는 `NoMatch` 정상 경로 반환 (예외 아님).
- RDKit 내부 throw 는 catch 해 `RdkitThrew` 로 분류.
- 동기 호출. `await rdkit.ensure()` 는 호출자(상위) 책임.

**레이어 근거**: `src/engine/rdkit/` 디렉터리는 architecture §4 가 "RDKit.js lazy-init 래퍼 서비스" 로 정의. phase-03 §13 hand-off (L723) 에 "Reaction 엔진은 `engine/reaction/` 아래에서 별도 래퍼를 갖되, WASM 초기화 경로는 동일 서비스" 라고 명시되어 본 파일 위치가 정합.

### 5.6 `src/data/reactions/index.ts` — 데이터 자산 공개 경계

```ts
// data 계층은 chemistry 타입만 import (engine import 금지 — arch §4.1).
import type {
  ReactionManifest,
  ReactionRule,
  RuleCategory,
  ReactionManifestEntry,
  RuleSearchOptions,
} from '@/chemistry/reactions/types';

export function getReactionManifest(): ReactionManifest;
export function loadReactionChunk(category: RuleCategory): Promise<ReadonlyArray<ReactionRule>>;
export function searchRulesManifest(opts: RuleSearchOptions): ReadonlyArray<ReactionManifestEntry>;
```

Phase 04 `src/data/compounds/index.ts` 와 동일 패턴. `RuleSearchOptions`/`ReactionManifestEntry` 는 **chemistry 계층** (`src/chemistry/reactions/types.ts`) 정의를 import 하므로 `data → engine` 역행이 없다 (arch §4.1 준수). `chunks/*.json` 직접 import 는 ESLint `no-restricted-paths` 로 차단 (§7.1).

### 5.7 Worker 경계 인터페이스 (P3, `src/engine/reaction/worker-boundary.ts`)

```ts
import type { PredictInput, PredictOptions, PredictOutput } from './types';

export interface ReactionBackend {
  predict(input: PredictInput, opts?: PredictOptions): Promise<PredictOutput>;
}
```

본 Phase 는 main-thread 구현만 제공 (`createMainThreadReactionBackend(): ReactionBackend`). Phase 14 가 Worker 구현을 추가할 때 동일 인터페이스를 구현한다. **이는 phase-03 의 `RdkitBackend` 의 확장이 아니라 병렬 boundary** 임을 본문에 못박는다 — 두 백엔드는 같은 worker 안에 공존할 _수_ 있으나, 그 코디네이션은 Phase 14 의 책임이다.

---

## 6. 핵심 로직 / 전략

### 6.1 `predict` 파이프라인 전체 흐름

```
predict(input, opts)
  │
  ├─ ① 입력 검증 (validateInput)
  │     └─ 실패 → { kind: 'InvalidReactant', issues }
  │
  ├─ ② await getRdkit().ensure()
  │     ├─ status: 'ready'  → 통과
  │     ├─ status: 'loading' (외부에서 호출 중) → await 완료 대기
  │     ├─ status: 'idle' → ensure() 가 'loading' 으로 전이
  │     └─ status: 'error' → { kind: 'RdkitInitFailed', cause }
  │
  ├─ ③ 캐시 조회 (opts.force 아닌 경우)
  │     키 = (canonicalSmilesTuple, roundedCondition, manifest.version)
  │     └─ 히트 → 즉시 반환
  │
  ├─ ④ prefilterCandidates(input.reactants, input.condition)
  │     → 매니페스트만 보고 후보 ManifestEntry 목록 생성 (priority 순)
  │     └─ 후보 0 + condition 안 맞는 가까운 규칙 있음 → { kind: 'ConditionOutOfRange', nearestRuleIds }
  │
  ├─ ⑤ 후보 순회 (각 ManifestEntry):
  │     a. signal.aborted 체크 (P5)
  │     b. loadRulesByIds([entry.id]) → ReactionRule 본체
  │     c. matchesConditionRange(rule, condition) 확인
  │     d. SMILES → ParsedMol (Phase 03 parseSmiles 캐시 활용)
  │     e. runReactants(rule.smarts, parsedMols)
  │        ├─ NoMatch  → 다음 후보
  │        ├─ CompileFailed / RdkitThrew → { kind: 'RunReactantsFailed', ... }
  │        └─ 매치 성공 → 첫 번째 product set 채택 (다중 매치 정책 §6.3)
  │     f. 각 product ParsedMol → toMoleculeWith3D
  │        └─ 임베드 실패 → { kind: 'EmbedFailed', ruleId, cause }
  │     g. ReactionResult 조립:
  │        - products: 임베드된 Molecule 들
  │        - kind: 'rule-based'
  │        - appliedRuleId: rule.id
  │        - thermo: rule.thermo
  │        - confidence: ruleConfidenceToScore(rule.confidence)  // RuleConfidence enum → 0..1 number
  │        - notes: null
  │     → 캐시 저장 + 반환
  │
  ├─ ⑥ 모든 규칙 후보 매치 실패 → tryHeuristic(input)
  │     ├─ 성공 → ReactionResult { kind: 'heuristic-experimental', confidence: HEURISTIC_CONFIDENCE (number), notes: 'reaction.experimentalDisclaimer' }
  │     │           → 캐시 저장 + 반환
  │     ├─ HeuristicAbstained → { kind: 'NoMatchingRule', triedRuleIds }
  │     │     ※ "휴리스틱이 abstain 했다" 는 사용자에게 본질적으로 "예측 불가" 와 동일 정보.
  │     │       다만 logger.warn 으로 abstain 사유 기록.
  │     ├─ EmbedFailed → { kind: 'EmbedFailed', ruleId: null, cause }
  │     └─ Internal → { kind: 'Internal', detail }
```

### 6.2 후보 규칙 prefilter

매니페스트의 `entries: ReactionManifestEntry[]` 만 보고 `RunReactants` 시도 후보를 좁힌다. 다음 조건을 모두 만족하는 항목만 통과:

1. `entry.requiresPh === true` 일 때 `condition.pH !== null`.
2. `entry.requiredElements ⊆ (입력 반응물 원소 집합)`.
3. (선택) `categories` 필터: 호출자가 명시적으로 좁힌 경우만.

정렬: `priority` 오름차순 → `id` 사전순.

**성능 메모**: U1 Minimal (~10 건) 시 prefilter 부담 무시 가능. 규칙이 수백 단위로 늘어나면 매니페스트 인덱스 (카테고리별 segregation) 로 대응. 본 Phase 는 단순 순회로 충분 — `predict` 의 typical 지연은 RDKit `RunReactants` + ETKDG 임베드가 지배적이며, 1s 이내가 목표 (architecture §3.2 의 100ms 는 interaction 응답 budget 으로 별도; reaction 실행은 진행 인디케이터를 동반하는 명시적 액션).

### 6.3 `runReactants` 래퍼 세부

- **컴파일 캐시**: `Map<string, RxnMol>` LRU (capacity 64). 키는 정규화된 SMARTS 문자열.
- **매칭 결과 표현**: `RunReactants` 가 반환하는 product set 들의 외측 배열 = 매치 횟수, 내측 배열 = 한 매치의 product 분자들. **본 Phase 는 첫 번째 product set 만 채택**한다. 다중 매치는 동일 규칙으로 가능한 모든 생성물 조합을 의미하지만, v1 의 단순성 우선.
- **atom map 보존**: 생성물 ParsedMol 의 atom 에 SMARTS atom map 번호가 보존된다. 향후 traceability 용 (예: Phase 11 에서 "이 원자는 반응물 #2 의 산소" 표시). **좌표 보존엔 사용 안 함** (P1).
- **예외 처리**: RDKit 내부 throw 는 try/catch 로 잡아 `RdkitThrew` 분류. 도메인/엔진 레이어는 throw 하지 않는다 (architecture §3.7).

### 6.4 생성물 좌표 (P1: 항상 ETKDG 재임베드)

각 product `ParsedMol` 을 Phase 03 의 `toMoleculeWith3D(parsed, opts?)` 에 넘겨 새 좌표를 생성. 임베드 실패 시 `EmbedFailed` 를 즉시 반환 (다음 후보 시도하지 않음 — 같은 SMARTS 가 다른 매치에서도 같은 임베드 문제를 반복할 가능성이 높음).

좌표 보존 모드(atom map 기반) 는 다음 사유로 v1 비포함 (P1):

- SMARTS atom map 누락 시 부분 보존 → 임베드 안 한 원자가 결합 거리 위반
- 결합 재배열 (예: 고리 열림) 시 보존 좌표가 기하학적으로 무효
- 혼성 변경 (sp²→sp³) 시 재최적화 필요

Phase 14 에서 별도 검토.

### 6.5 조건 평가 (`matchesConditionRange`)

```ts
/** 실수 비교의 부동소수점 안전 마진. T(K), P(atm) 등 실수 값에 적용. pH 는 정수 사용 시 미적용. */
const CONDITION_EPSILON = 0.01;

function matchesConditionRange(rule: ReactionRule, condition: Condition): boolean {
  const { temperatureK: tRange, pressureAtm: pRange, pH: phRange } = rule.conditionRange;
  // T, P 는 실수: ε tolerance 로 경계값 비교 (±0.01).
  if (
    tRange &&
    (condition.temperatureK < tRange[0] - CONDITION_EPSILON ||
      condition.temperatureK > tRange[1] + CONDITION_EPSILON)
  )
    return false;
  if (
    pRange &&
    (condition.pressureAtm < pRange[0] - CONDITION_EPSILON ||
      condition.pressureAtm > pRange[1] + CONDITION_EPSILON)
  )
    return false;
  if (phRange) {
    if (condition.pH === null) return false; // pH 무관 조건이면 매칭 불가
    // pH 는 본 Phase 가 0..14 정수로 노출 (Phase 07 conditionStore 결정). 정확 비교.
    if (condition.pH < phRange[0] || condition.pH > phRange[1]) return false;
  }
  return true;
}
```

> **부동소수점 비교 정책**: 실수 값 (`temperatureK`, `pressureAtm`) 은 사용자가 슬라이더로 미세 조정하거나 단위 변환 (°C→K) 시 누적 오차가 발생할 수 있어, 경계값 _정확 일치_ 가 의도와 무관하게 false 가 될 위험이 있다. `CONDITION_EPSILON = 0.01` 의 좁은 마진으로 양 끝을 살짝 넓혀 _경계값 의도_ 를 보존한다 (예: 규칙 `pressureAtm: [1.0, 1.0]` 에 사용자 입력 `0.9999999` → 통과). 정수 값 (pH) 은 단위 변환이 없고 사용자가 직접 정수 슬라이더로 조작하므로 정확 비교가 바람직 (실수로 표현된 경우 호출자가 정수로 반올림한 후 전달).

`distanceFromRange` 는 위 비교를 거리(범위 밖이면 |값-경계|, 범위 안이면 0)로 합산해 가장 가까운 규칙 ID 들을 `ConditionOutOfRange.nearestRuleIds` 에 채운다 (ε 미적용 — 거리는 실제 차이 그대로).

### 6.6 ThermoFlag 결정 (U3 — 정량 ΔH 없음)

```ts
function decideThermo(matched: ReactionRule | null, heuristic: ReactionResult | null): ThermoFlag {
  if (matched) return matched.thermo; // 1순위
  if (heuristic) return heuristic.thermo; // 2순위 (휴리스틱이 자체 추정한 값)
  return 'unknown';
}
```

휴리스틱의 자체 ThermoFlag 추정 규칙 (정량 기준 명문화 — 6.7 step 8 과 일치):

- **`'exothermic'`**: 새로 형성된 결합의 평균 `Δχ` (전기음성도 차) ≥ **1.0** (강극성 이온성 결합 형성, 다량의 결합 에너지 방출).
- **`'endothermic'`**: 깨진 결합의 평균 `Δχ` < **0.5** (비극성/약극성 결합이 끊어짐 → 새 결합 형성 에너지가 충분하지 않을 가능성). 본 v1 휴리스틱은 결합 추가/증가만 수행하지만, 그 과정에 동반되는 X-H 결합 깨짐을 endothermic 판정의 근거로 사용.
- **`'unknown'`**: 위 두 조건 모두 비충족 (`avgΔχ_formed ∈ [0.5, 1.0)` 또는 어느 한 평균이 미정의).

> **수치 근거**: Pauling 전기음성도 척도에서 `Δχ ≈ 1.0` 은 약 50% 이온성 (예: H-Cl 의 Δχ = 0.96), `Δχ < 0.5` 는 사실상 무극성 공유 결합 (예: C-H 의 Δχ = 0.35, C-S 의 Δχ = 0). 이 두 임계값이 _발열/흡열의 명확한 구분점_ 은 아니지만, "경험 화학적 직관" 의 합리적 근사이며 false positive 를 줄이는 보수적 선택 (확신이 약하면 `'unknown'` 으로 떨어진다).

위 추정은 **방향만**이며 정량값 없음. ΔH 값 도입은 architecture §12-3 의 후속 결정으로 §12 hand-off 에 보존.

### 6.7 휴리스틱 알고리즘 본 구현 (U4)

`tryHeuristic(input)` 의 의사코드:

```
tryHeuristic(input):
  1. atoms_all  ← 모든 reactant 의 atoms 평탄화 (각 원자에 reactantIdx, atomIdx 부여)
  2. for each atom a in atoms_all:
       chi(a)  ← getElement(a.elementNumber).electronegativity
       valence_filled(a) ← 현재 결합 차수 합 + a.implicitHCount + |a.formalCharge|
       valence_target(a) ← lookup(oxidation-states.ts, a.elementNumber)
       unsaturated(a)    ← valence_filled(a) < valence_target(a)
     if 어느 atom 이라도 chi 가 null → return HeuristicAbstained('electronegativity-data-missing')

  3. candidate_pairs ← []
     for each (a, b) in cross-product of unsaturated atoms (다른 reactant 사이만):
        Δχ ← |chi(a) - chi(b)|
        if Δχ ≥ 0.5:
          candidate_pairs.push({ a, b, Δχ })
     candidate_pairs.sort(by Δχ desc)

  4. if candidate_pairs.empty → return HeuristicAbstained('no-candidate-pair')

  5. selected ← candidate_pairs.take(2)        // 최대 2 개의 결합 변경 시도 (보수적)
     if selected.length > 2 → return HeuristicAbstained('too-many-bond-changes')

  6. product_parsed ← reactants 의 ParsedMol 복제본에 selected 적용:
        - selected 의 각 (a, b) 에 대한 결합 처리:
            (a, b 가 *반드시 다른 fragment* 임은 step 3 이 보장 — 동일 fragment 내 기존 결합은 건드리지 않는다)
          • 두 원자 사이에 *기존 결합이 없으면* → 새 단일결합 추가 (`order: 1`).
          • 두 원자 사이에 *기존 결합이 있으면* (단/이중결합) → 그 결합의 `order` 를 1 단계 증가
            (단→이중, 이중→삼중). a, b 가 다른 fragment 임이 보장되므로 동일 분자 내 ring 결합
            증가는 발생하지 않음. (ring 내부의 결합 증가는 본 휴리스틱 범위 외.)
          • 기존 결합이 *삼중 이상* 이면 → step 6 abort, 전체를 HeuristicAbstained('too-many-bond-changes')
            로 반환 (의미 없는 변환 회피).
        - 각 적용마다 a 의 implicitHCount, b 의 implicitHCount 각 -1 (수소 이동 가정).

  7. product_mol ← await toMoleculeWith3D(product_parsed)
     if not ok → return HeuristicAbstained('embed-failed')

  8. thermo 결정 (D-thermo, 6.6 의 정량 기준 적용):
        avgΔχ_formed  ← selected (새 결합) 의 평균 Δχ
        avgΔχ_broken  ← (해당 시) 깨진 결합의 평균 Δχ — 본 v1 휴리스틱은 결합 추가/증가만
                         수행하므로 *broken* 은 step 6 의 implicitHCount -1 에 해당하는
                         X-H 결합 깨짐을 의미 (X = a, b 원자).
        if avgΔχ_formed ≥ 1.0     → thermo = 'exothermic'   (강극성 결합 형성 우세)
        elif avgΔχ_broken < 0.5   → thermo = 'endothermic'  (비극성/약극성 결합 깨짐 우세)
        else                       → thermo = 'unknown'

  9. return ok({
       products: [product_mol.value],
       kind: 'heuristic-experimental',
       appliedRuleId: null,
       thermo,
       confidence: HEURISTIC_CONFIDENCE,            // 0..1 상수 (휴리스틱 기본 점수, §4.x)
       notes: 'reaction.experimentalDisclaimer',    // i18n **키** — 엔진은 해석하지 않음 (arch §3.4); Phase 11 이 t() 로 지역화
     })
```

세부 보강:

- **원자가 lookup**: `src/engine/reaction/oxidation-states.ts` 에 작은 정적 매핑 보유. **본 v1 이 커버하는 원소** (10종):
  ```ts
  // src/engine/reaction/oxidation-states.ts
  export const OXIDATION_STATES_V1: Readonly<Record<number, ReadonlyArray<number>>> = {
    1: [1], // H
    6: [4], // C  (sp3 기준 단순화)
    7: [3], // N
    8: [2], // O
    9: [1], // F
    15: [3, 5], // P
    16: [2, 4, 6], // S
    17: [1], // Cl
    35: [1], // Br
    53: [1], // I
  };
  ```

  - 위 10종 외 원소가 reactant 의 atoms 에 등장하면, step 2 에서 `getElement(...).electronegativity === null` 인 합성 원소만 abstain 하던 정책을 확장하여 _해당 원자가 lookup 미스_ 도 동일하게 `HeuristicAbstained('electronegativity-data-missing')` 으로 반환 (kind 명세는 동일, 메시지로 구분). 이는 false positive 를 차단하기 위한 보수적 결정.
  - 확장 (예: Na, Mg, Ca 등 alkali/alkaline earth, 전이금속) 은 Phase 06 후속 작업 또는 Phase 14 알고리즘 개선의 책임.
- **수소 이동 가정**: 본 v1 휴리스틱은 "두 원자의 미충족 valence 만큼 H 이동" 이라는 매우 단순한 모델만 다룬다. 더 복잡한 메커니즘은 Phase 14 알고리즘 개선에서.
- **결과 신뢰도**: `confidence: 'low'` 강제, `kind: 'heuristic-experimental'` 강제. UI 가 항상 experimental 배지 표시 (Phase 11).

### 6.8 결과 캐시

- 키: `${reactantsCanonicalSmilesSorted.join('|')}::${condition.temperatureK.toFixed(1)}_${condition.pressureAtm.toFixed(2)}_${condition.pH ?? 'null'}::${manifest.version}` (P8)
- 자료구조: LRU (capacity 256). Phase 03 §6.7 캐시 패턴 차용.
- 무효화: 매니페스트의 `version` 이 바뀌면 키가 자동 변경되어 자연 무효 (P8).
- `opts.force === true` 시 우회.
- 부정 결과(`NoMatchingRule` 등) 도 캐시한다 — 동일 입력이 다시 들어와도 RDKit 호출 반복 방지.

### 6.9 Web Worker 경계 (P3)

`src/engine/reaction/worker-boundary.ts` 에 `ReactionBackend` 인터페이스를 정의 (§5.7). 본 Phase 는 `createMainThreadReactionBackend()` 만 export.

본 인터페이스는 phase-03 §6.8 의 `RdkitBackend` 와 **별개의 병렬 boundary** 다. 두 백엔드가 같은 Worker 안에 공존해야 할 가능성(예: Phase 14 가 한 Worker 에 두 백엔드를 모두 호스팅)은 Phase 14 의 책임이며, 본 Phase 는 그 코디네이션을 정의하지 않는다 (§9 리스크 인계).

### 6.10 AbortSignal 처리 (P5, phase-05 §6.4 패턴)

- `predict` 진입 시 `opts?.signal?.aborted` 즉시 검사 → true 면 `{ kind: 'Aborted' }`.
- 후보 규칙 순회 시 매 iteration 시작에서 `signal.aborted` 검사.
- **RDKit `RunReactants` 동기 호출 중간에는 중단 불가** — phase-05 §6.4 의 RDKit 제약과 동일. 사용자는 한 규칙 시도 동안의 추가 지연을 감수.
- `tryHeuristic` 의 `await toMoleculeWith3D` 호출 직전에 한 번 더 `signal.aborted` 검사.

### 6.11 로깅 (architecture §3.7)

```ts
import { logger } from '@/utils/logger';

logger.debug('reaction.predict.candidates', {
  count: candidates.length,
  ids: candidates.map((c) => c.id),
});
logger.debug('reaction.predict.tryRule', { ruleId, smarts });
logger.warn('reaction.predict.heuristicEnter', { reactantsSmiles });
logger.warn('reaction.heuristic.abstain', { reason });
logger.error('reaction.runReactants.threw', { ruleId, message });
```

프로덕션 기본 레벨 `warn` (architecture §3.7) 에서는 휴리스틱 진입과 RDKit 예외만 노출. 개발 레벨 `debug` 에서는 후보·시도 로그도 보임.

### 6.12 i18n (P6)

- `src/i18n/resources/{ko,en}/common.json` 의 `reaction.*` 네임스페이스에 라벨 키 추가 (§4.8).
- `src/i18n/resources/{ko,en}/chemistry.json` 의 `reactions.categoryNames.*` 에 `RuleCategory` 표시명 추가 (§4.8).
- 본 Phase 는 키와 한·영 초안 문구만 확정. 실제 i18n 통합 검증은 Phase 15.

---

## 7. 파일 / 모듈 레이아웃

```
src/
├── chemistry/
│   └── reactions/
│       └── types.ts                      # ReactionRule 확장, RuleCategory, ReactionRuleLicense 등 (Phase 01 파일 수정)
│
├── engine/
│   ├── rdkit/
│   │   └── reactions.ts                  # 신규: runReactants 래퍼 (Phase 03 모듈 옆)
│   │
│   └── reaction/
│       ├── index.ts                      # 공개 경계: predict, 타입 재노출
│       ├── types.ts                      # PredictInput/Options/Output, ReactionEngineError, HeuristicError
│       ├── rules.ts                      # searchManifestEntries, loadRulesByIds, prefilterCandidates
│       ├── conditions.ts                 # matchesConditionRange, distanceFromRange (순수)
│       ├── heuristic.ts                  # tryHeuristic 본 구현 (U4)
│       ├── thermo.ts                     # decideThermo (순수)
│       ├── cache.ts                      # 결과 LRU 캐시
│       ├── worker-boundary.ts            # ReactionBackend 인터페이스 + main-thread impl
│       └── oxidation-states.ts           # 작은 정적 룩업 (휴리스틱용)
│
├── data/
│   └── reactions/
│       ├── index.ts                      # getReactionManifest, loadReactionChunk, searchRulesManifest (공개 경계)
│       ├── types.ts                      # ReactionManifest, ReactionManifestEntry, ReactionChunkFile
│       ├── manifest.json                 # 빌드 산출물
│       └── chunks/
│           ├── acid-base-neutralization.json
│           ├── esterification-hydrolysis.json
│           └── simple-redox.json
│
└── i18n/resources/
    ├── ko/common.json                    # (수정) reaction.* 추가
    ├── en/common.json                    # (수정) reaction.* 추가
    ├── ko/chemistry.json                 # (수정) reactions.categoryNames.* 추가
    └── en/chemistry.json                 # (수정) reactions.categoryNames.* 추가

scripts/
└── reactions-build/
    ├── index.ts                          # CLI: pnpm run build:reactions
    ├── seeds/
    │   ├── acid-base-neutralization.tsv
    │   ├── esterification-hydrolysis.tsv
    │   └── simple-redox.tsv
    ├── validate.ts                       # zod + license 화이트리스트 + SMARTS 컴파일 검증 (Phase 04 의 rdkit-node.ts 재사용)
    ├── chunk.ts                          # 카테고리별 청크 정렬·직렬화
    ├── manifest.ts                       # manifest.json 생성 (licenseSummary 자동 집계)
    └── report.ts                         # stdout 리포트 (Phase 04 패턴)

tests/
├── unit/
│   ├── chemistry/reactions/types.test.ts        # 타입 컴파일 + 기본 인스턴스
│   ├── engine/rdkit/reactions.test.ts           # runReactants 래퍼 (대표 SMARTS)
│   ├── engine/reaction/conditions.test.ts       # 경계값
│   ├── engine/reaction/rules.test.ts            # prefilter 결정성
│   ├── engine/reaction/heuristic.test.ts        # abstain / 예측 케이스
│   ├── engine/reaction/thermo.test.ts           # 우선순위
│   ├── engine/reaction/predict.test.ts          # 모든 ReactionEngineError.kind 분기
│   └── engine/reaction/cache.test.ts            # rulesetVersion 무효화
└── fixtures/
    └── reactions/
        ├── rule-based/                          # 규칙 매치 골든
        └── heuristic/                           # 휴리스틱 결과 골든 (별도 디렉터리)
```

### 7.1 레이어 가드

`eslint.config.js` 의 `import/no-restricted-paths` 규칙에 다음 추가:

```js
{
  target: './src',
  from: './src/data/reactions/chunks',
  message: 'Import reaction chunks via @/data/reactions index, not directly.',
},
{
  target: './src',
  from: './src/data/reactions/manifest.json',
  message: 'Use getReactionManifest() from @/data/reactions instead of importing manifest.json.',
},
```

(Phase 04 §7.1 와 동일 패턴.)

### 7.2 공개 경계

외부 (`src/stores/...`, Phase 11 패널 등) 가 직접 import 가능한 모듈:

- `@/engine/reaction` (단, `index.ts` 만)
- `@/data/reactions` (단, `index.ts` 만)
- `@/chemistry/reactions/types` (타입 only)

다음은 **외부 직접 import 금지** (ESLint `no-restricted-imports`):

- `@/engine/reaction/heuristic`
- `@/engine/reaction/rules`
- `@/engine/reaction/conditions`
- `@/engine/reaction/thermo`
- `@/engine/reaction/cache`
- `@/engine/rdkit/reactions` (이 wrapper 는 `engine/reaction/` 만 사용)
- `@/data/reactions/chunks/*`

---

## 8. 테스트 계획

### 8.1 유닛 — `conditions.matchesConditionRange`

- T 범위만 정의된 규칙 + condition.T 가 경계값 (== min, == max, < min, > max).
- pH 범위 정의 + condition.pH = null → false.
- 모든 범위 정의 + 한 차원만 범위 밖 → false.
- 모든 범위 미정의 → 항상 true.

### 8.2 유닛 — `engine/rdkit/reactions.runReactants`

- 대표 SMARTS: 산-염기 중화 `[OH:1].[H:2]>>[OH2:1].[*:2]` (가상). 매치 시 product set 검증.
- 비매치 reactants → `NoMatch`.
- 잘못된 SMARTS → `CompileFailed`.
- 캐시: 동일 SMARTS 두 번 컴파일 시 두 번째는 캐시 히트 (mock RDKit 으로 검증).

### 8.3 유닛 — `engine/reaction/predict`

각 `ReactionEngineError.kind` 가 적절한 시나리오에서 반환되는지 분기별로 검증:

| kind                  | 시나리오                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| `RdkitNotReady`       | (현재는 `predict` 가 자동 `ensure()` — 강제로 status 'idle' 고정 mock)                                 |
| `RdkitInitFailed`     | RDKit init mock 실패                                                                                   |
| `NoMatchingRule`      | 후보 0 + 휴리스틱 abstain                                                                              |
| `HeuristicAbstained`  | (실제로 `predict` 는 abstain 을 `NoMatchingRule` 로 변환 — 직접 노출은 `tryHeuristic` 단위 테스트에서) |
| `ConditionOutOfRange` | 후보 0 + 가까운 규칙 존재                                                                              |
| `InvalidReactant`     | 비어 있는 reactants 배열                                                                               |
| `RunReactantsFailed`  | 잘못된 SMARTS 가 매니페스트에 들어 있을 때 (mock)                                                      |
| `EmbedFailed`         | `toMoleculeWith3D` mock 실패                                                                           |
| `Aborted`             | `signal` 이 사전에 abort                                                                               |
| `Internal`            | unexpected throw catch (방어적)                                                                        |

각 에러의 `retryable` 플래그 정확성도 함께 검증.

### 8.4 유닛 — `engine/reaction/rules.prefilterCandidates`

- 매니페스트에 산-염기 1, 에스테르화 1, redox 1 인 fixture 로:
  - condition.pH 가 정의된 입력 → 산-염기만 후보.
  - condition.pH = null → 산-염기 제외.
  - reactants 가 redox 가 요구하는 원소(예: O) 미포함 → redox 제외.
- 동일 priority 의 두 규칙이 있을 때 id 사전순 결정성.

### 8.5 골든 — 알려진 반응 (architecture §10.4 정합)

`tests/fixtures/reactions/rule-based/{caseId}/` 에 입력(reactants SMILES + condition) 과 기대 출력(products SMILES, ThermoFlag) 을 JSON 으로 보관. v1 의 골든 케이스:

1. **중화**: HCl + NaOH → NaCl + H₂O (exothermic)
2. **에스테르화**: 아세트산 + 에탄올 → 아세트산에틸 + H₂O (endothermic)
3. **단순 산화환원**: H₂ + ½O₂ → H₂O (exothermic)

`predict` 결과의 `products` 의 canonical SMILES 와 `thermo` 가 fixture 와 일치해야 함.

### 8.6 유닛 — `decideThermo`

- (matched=exothermic, heuristic=null) → exothermic
- (matched=null, heuristic={thermo: endothermic}) → endothermic
- (matched=null, heuristic=null) → unknown

### 8.7 유닛 — `tryHeuristic` (U4 본 구현)

- abstain 케이스:
  - 모든 reactant 가 valence 충족 → `'no-candidate-pair'`
  - 후보가 3 개 이상 → `'too-many-bond-changes'`
  - `toMoleculeWith3D` mock 실패 → `'embed-failed'`
  - 한 reactant 의 원소 electronegativity 가 null (예: 가상 원소) → `'electronegativity-data-missing'`
- 예측 케이스:
  - H₂ + Cl₂ → 2 HCl 형태의 단순 결합 형성 시나리오 → `kind === 'heuristic-experimental'`, `confidence === 'low'`, `thermo === 'exothermic'` 또는 `'unknown'`
  - 결과 `notes` 에 i18n 디스클레이머 포함 검증

골든은 `tests/fixtures/reactions/heuristic/` 별도 디렉터리에 보관하여 회귀 시 즉시 인지.

### 8.8 통합 — RDKit lazy init

- `getRdkit()` status 가 `idle` 인 상태에서 `predict` 호출.
- `ensure()` 가 자동으로 트리거되어 `loading` → `ready` 전이 후 정상 결과 반환.
- 유닛: jsdom + Phase 03 mocking 으로 검증.

### 8.9 데이터 무결성 (CI)

빌드 스크립트(`scripts/reactions-build/`) 의 `validate.ts` 가:

1. 모든 시드 행이 zod 스키마 통과.
2. `license` 가 화이트리스트 안에 있음.
3. `source` 가 비어 있지 않음.
4. SMARTS 가 RDKit (Phase 04 의 `scripts/pubchem-fetch/pubchem/rdkit-node.ts` 재사용) 으로 컴파일 가능.
5. 모든 규칙의 `version` 이 매니페스트 `version` 과 동일.
6. 매니페스트 `licenseSummary` 가 청크의 라이선스 분포와 일치.

CI 의 `pnpm run lint:reactions` 단계에 통합.

### 8.10 캐시 — `rulesetVersion` 무효화

- 매니페스트 version v1 으로 `predict(input)` 두 번 호출 → 캐시 히트 검증.
- 매니페스트 version v2 로 변경 → 동일 input 은 캐시 미스, RDKit 재호출 검증.

### 8.11 레이어 가드 검증 (Phase 04 §8.6 패턴)

`tests/unit/engine/reaction/layer-guard.test.ts`:

- `@/data/reactions/chunks/acid-base-neutralization.json` 직접 import 시 ESLint/TS 에러 발생 검증 (정적 검사).
- `@/engine/reaction/heuristic` 외부 import 시 에러 발생.

---

## 9. 리스크 및 대안

| 리스크                                                | 영향                                                                                                                       | 대응                                                                                                                                                                                                 |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RDKit Reaction SMARTS 표현력 한계 (다단계, 촉매 명시) | 일부 반응 표현 불가                                                                                                        | 규칙 단위로 단계 분해. 비표현 반응은 휴리스틱으로 흡수되거나 `NoMatchingRule` 반환.                                                                                                                  |
| Atom map 누락 SMARTS                                  | 좌표 임베드는 P1 always-re-embed 이라 영향 없음. 단 traceability(어느 반응물 원자가 어느 생성물 원자로 갔는가) 약화        | 시드 빌드 검증에서 atom map 권장 경고 (오류 아님). 향후 Phase 11 가 atom map 시각화 시 강제로 격상 가능.                                                                                             |
| 휴리스틱 false positive                               | 사용자가 잘못된 결과를 사실로 오인                                                                                         | 항상 `confidence: 'low'` + `kind: 'heuristic-experimental'` + UI 의 experimental 배지 + 디스클레이머 강제 (Phase 11 가 책임). 골든 fixture 별도 디렉터리로 회귀 시 즉시 인지.                        |
| 규칙 수 증가 시 prefilter 부담                        | predict 지연 증가                                                                                                          | U1 Minimal 에서는 무관. 확장 시 매니페스트 인덱스(카테고리별 segregation) 도입. 한계 초과 시 Phase 14 Worker 이관.                                                                                   |
| Phase 14 와의 Worker 코디네이션                       | `ReactionBackend` 와 `RdkitBackend` 가 같은 Worker 에 공존해야 하면 두 인터페이스의 라이프사이클·메시지 라우팅 충돌 가능성 | Phase 14 가 두 인터페이스를 함께 호스팅하는 worker 모듈 설계 책임. 본 Phase 는 인터페이스 정의만, 위치는 `engine/reaction/worker-boundary.ts` (병렬 boundary).                                       |
| U2 오픈 DB 차용의 라이선스 호환·attribution 표기 누락 | 라이선스 위반 위험                                                                                                         | 빌드 스크립트가 `source`+`license` 컬럼 강제 검증. 화이트리스트 외 라이선스 차단. 매니페스트 `licenseSummary` 자동 집계로 추적성 확보. Phase 01 라이선스 결정 시 화이트리스트와 합치 검증 (§10 DoD). |
| U4 휴리스틱 본 구현의 결과 정확성 한계                | 단순 모델(원자가+전기음성도 + 수소 이동) 로는 다수 실제 반응을 잘못 추정                                                   | "정확성 우선" 원칙 (architecture §3.4-5) 에 따라 abstain 임계치를 보수적으로(최대 2 개 결합 변경) 설정. 사용자에겐 항상 experimental 배지 강제. 알고리즘 개선은 Phase 14 Hand-off.                   |

---

## 10. 완료 기준 (Definition of Done)

- [ ] U1–U4 사용자 확정사항이 §3.3 / §2.1 / §4 에 모두 반영됨.
- [ ] P1–P8 Plan 선결정사항이 §3.3 / 본문 각 절에 모두 적시됨.
- [ ] Phase 01 `ReactionRule` TODO (`// TODO: Phase 06 — 신뢰도/우선순위`) 가 §4.1 의 `priority` + `confidence` 두 필드 추가로 닫힘. `categories` / `version` / `license` / `requiredElements` 는 신규 필드임을 traceability 메모로 명기.
- [ ] 매니페스트 / 청크 / 시드(`source` + `license` 컬럼 필수) / 로더 / 엔진(`predict`) / RDKit 래퍼(`runReactants`) / Worker boundary(`ReactionBackend`) 가 모두 §4 / §5 / §7 에서 명세됨.
- [ ] 휴리스틱 본 알고리즘(U4) 이 §6.7 에 의사코드로 명세됨.
- [ ] i18n 키와 "experimental" 한·영 문구 초안이 §4.8 에 포함됨.
- [ ] 모든 퍼블릭 API 가 `Result<T, E>` 또는 `Promise<Result<T, E>>` 반환. 예외 throw 없음 (architecture §3.7).
- [ ] `ReactionEngineError` 가 phase-05 §4.3 의 `{ kind, ..., retryable }` shape 를 따름 (§4.7).
- [ ] 레이어 가드 (ESLint `no-restricted-paths` + `no-restricted-imports`) 가 §7.1 / §7.2 에서 명시됨.
- [ ] 라이선스 화이트리스트 (`ReactionRuleLicense`) 가 architecture L7 (Phase 01 미정 라이선스) 와 합치하는지 확인 항목이 §3.3 / §9 에 포함됨.
- [ ] 8.1–8.11 의 모든 테스트 항목이 §8 에 열거됨.

---

## 11. 열린 질문 (User Decision Required)

Plan 단계에서 U1–U4 가 모두 확정되어 본 §11 은 **Phase 06 본 구현 이후로 미뤄진 항목** 만 보존한다.

1. **ΔH 정량값 도입 시점·소스** (architecture §12-3 의 후속 결정) — 본 Phase 는 ThermoFlag 만 유지 (U3 확정). 차후 (a) 결합에너지 근사로 `enthalpyKjPerMol` optional 추가, (b) NIST WebBook 통합 등의 옵션을 별도 Phase 로 다룬다.
2. **규칙 셋 확장 시점 (Core / Extended)** — 본 Phase 는 Minimal (~10 건) (U1 확정). 학부 핵심 반응 커버 (Core) 또는 폭넓은 유기 반응 (Extended) 으로의 확장은 별도 작업으로 분리.
3. **Worker 실제 구현 + RdkitBackend 와의 공존 디자인** (Phase 14) — 본 Phase 는 인터페이스만 정의 (P3). Phase 14 가 두 인터페이스를 함께 호스팅하는 worker 모듈 설계 책임을 가진다.

---

## 12. 다음 Phase 로의 인계 (Hand-off)

| Phase                     | 본 Phase 가 인계하는 것                                                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **07 (Stores)**           | `predict(input, opts?)` 진입점, `ReactionEngineError.kind` 별 분기 표, "experimental" 결과의 스토어 표현 (`reactionStore` 의 `lastResult`/`isExperimental` selector)                                   |
| **11 (UI Panels)**        | ReactionResult 패널의 "experimental" 배지 컴포넌트 사양, `common.json#reaction.*` / `chemistry.json#reactions.categoryNames.*` i18n 키, 색약 모드 시 라벨 강제 on (architecture §3.10 — Phase 15 검증) |
| **14 (Performance)**      | Worker 실제 구현 + RdkitBackend / ReactionBackend 공존 디자인, 좌표 보존 모드 v2 검토 (P1 의 후속), 휴리스틱 알고리즘 성능 튜닝 (본 구현은 본 Phase, 최적화는 Phase 14)                                |
| **15 (Testing & Polish)** | 골든 fixture 확장(케이스 추가), "experimental" i18n 문구 한·영 검증, 접근성(색약/라벨/툴팁) 검증                                                                                                       |

---

_문서 버전: 0.1 (초안)_
_작성일: 2026-04-25_
