# Phase 02 — Element Data Layer

> 이 문서는 `architecture.md` §13 **Phase 02** 의 상세 설계서이다. Phase 01 의 모든 산출물(공용 타입, 레이어 경계, CI)을 전제로 한다.
>
> 본 문서 역시 **설계 기술**이며, 실제 데이터 수집·JSON 작성·유틸 함수 구현은 전체 details 승인 후 수행한다.

---

## 1. 목적 (Purpose)

주기율표 전체 **118 원소**의 정적 데이터를 신뢰 가능한 출처로부터 확정하고, `chemistry/elements/` 모듈에서 이를 안전하게 조회·필터링할 수 있는 **순수 도메인 API** 를 제공한다.

이 Phase 가 끝나면:
- 118 원소의 모든 필드가 단일 소스 오브 트루스(`src/data/elements/elements.json`) 에 존재한다.
- 데이터 무결성(cardinality, uniqueness, 순서, 값의 합리 범위)이 테스트로 보장된다.
- 다른 레이어는 원소 정보를 **오직** `@/chemistry/elements` 공개 API 로만 조회한다 (JSON 직접 import 금지).
- 한국어/영어 원소명이 `i18n/resources/*/chemistry.json` 에 채워진다.
- 주기율표 패널(Phase 11)이 쓸 수 있는 분류/그룹 조회 함수가 준비된다.

---

## 2. 범위 (Scope)

### 2.1 포함
- **원소 핵심 필드** (Phase 01 `Element` 타입 확장): 원자번호, 기호, 이름(ko/en), 원자량, 전기음성도, 전자배치, CPK 색상, 공유·판데르발스 반지름
- **물성 필드**: 제1 이온화에너지, 전자친화도, 녹는점/끓는점, 밀도(STP), 표준 상태(고/액/기)
- **분류 필드**: 주기(period 1–7), 족(group 1–18 또는 null), 블록(s/p/d/f), 카테고리(alkali metal, alkaline earth, transition metal, post-transition metal, metalloid, reactive nonmetal, noble gas, lanthanide, actinide, unknown)
- **메타**: 자연 존재 여부(primordial / from_decay / synthetic), 발견 연도(optional), 방사성 여부
- **동위원소**: 기본 안정 동위원소 1개(질량수/자연 존재비)만 요약 수록. 전체 동위원소 테이블은 **이 Phase 범위 밖**(향후 확장)
- **데이터 수집 스크립트**: `scripts/fetch-periodic-table/` — 결과를 수동 검토 후 `src/data/elements/elements.json` 에 커밋
- **공개 API** (`src/chemistry/elements/index.ts`): 조회/필터/검증 함수 세트
- **i18n 용어 사전 채움**: `chemistry.{ko,en}.json` 의 `element.*` 네임스페이스

### 2.2 비포함 (후속 Phase 로 이관)
| 항목 | 이관 대상 |
|------|-----------|
| 동위원소 전체 테이블 (질량·반감기·존재비) | 향후 확장 (별도 Phase 혹은 Phase 04 와 연동) |
| 원소 간 반응 규칙 | Phase 06 |
| 원자 반경의 이온·특수 상태 변형 | Phase 03/06 (필요 시) |
| 3D 렌더 용 머티리얼 세팅 | Phase 08 |
| 주기율표 **UI** | Phase 11 |
| 핵물리/방사성 상세(반감기, 붕괴 모드) | 비목표 |

---

## 3. 의존성 (Dependencies)

### 3.1 선행 Phase
- **Phase 01** — `Element` 타입, `ElementNumber` Brand, i18n 뼈대, 레이어 경계

### 3.2 외부 데이터 출처 (수집 단계 참조)

복수 소스를 교차검증한다. **소스는 수집 스크립트 실행 시점에만 사용**되며, 런타임에는 번들된 JSON 만 사용한다.

| 소스 | 용도 | 라이선스 |
|------|------|---------|
| **NIST Atomic Weights and Isotopic Compositions** | 원자량 (IUPAC 2021 이후) | 미국 정부 저작물 → 공공 자산 |
| **PubChem PUG REST `/periodictable/JSON`** | 기초 원소 정보 통합 조회 | 퍼블릭, 사용 조건 비상업 제한 없음 |
| **IUPAC Recommendations** | 원소명/기호 공식 명칭 | 공공 인용 가능 |
| **CPK 색상 표** (Jmol/PyMOL 규약) | CPK 컬러 | 오픈 규약 |
| **대한화학회 원소 한글 이름** | 한국어 표준 명칭 | 공인 용어 사용 (인용) |

> **주의**: 원본 소스 원문/대량 사본을 리포지토리에 포함하지 않는다. 수집된 **가공물**(정규화 JSON)만 커밋하며, 각 필드 출처는 `elements.meta.json` 에 요약 기록한다.

### 3.3 결정 필요 사항 (사용자 확인)

| # | 질문 | 기본안 |
|---|------|--------|
| D1 | 동위원소 표현 수준 | **대표 안정 동위원소 1개만** 요약 (질량수·존재비). 방사성 합성 원소는 가장 긴 반감기 동위원소로 표기 |
| D2 | 방사성 합성 원소의 녹는점/끓는점 | 실험값 있으면 기록, 없으면 `null`. "예측값"은 별도 필드로 구분 (`predictedMeltingPointK` 등) |
| D3 | 한국어 원소명 규범 | **대한화학회 권장 표기** (예: 네온, 나트륨→소듐 최신 표기는 "소듐"과 "나트륨" 중 선택) — 제안: **"소듐"/"포타슘"** 등 **최신 IUPAC 한글 명칭** 채택 |
| D4 | 전기음성도 척도 | Pauling scale 1종만 제공 (null 허용). 다른 척도(Allred-Rochow, Mulliken 등)는 확장 여지 |
| D5 | 카테고리 분류 체계 | IUPAC/위키 표준 10종: alkali-metal, alkaline-earth-metal, transition-metal, post-transition-metal, metalloid, reactive-nonmetal, noble-gas, lanthanide, actinide, unknown |
| D6 | `block` 분류 경계 | **IUPAC 2021 권고** 채택: f-block = Ce(58)–Lu(71) + Th(90)–Lr(103) — **La(57), Ac(89)는 d-block**. 따라서 `getElementsByBlock('f').length === 28`. 이 규약을 `category` 와 독립적으로 적용 (La/Ac 는 `category: 'lanthanide' / 'actinide'` 유지하되 `block: 'd'`) |

본 문서 승인 시 기본안 채택으로 간주한다.

---

## 4. 데이터 모델

### 4.1 확장된 `Element` 타입

Phase 01 의 스케치를 실데이터 수록에 맞게 확장한다.

```ts
// src/chemistry/elements/types.ts (확장판)
import type { Brand } from '@/types/brand';

export type ElementNumber = Brand<number, 'ElementNumber'>; // 1..118

export type Block = 's' | 'p' | 'd' | 'f';

export type ElementCategory =
  | 'alkali-metal'
  | 'alkaline-earth-metal'
  | 'transition-metal'
  | 'post-transition-metal'
  | 'metalloid'
  | 'reactive-nonmetal'
  | 'noble-gas'
  | 'lanthanide'
  | 'actinide'
  | 'unknown';

export type StandardState = 'solid' | 'liquid' | 'gas' | 'unknown';

export type Occurrence = 'primordial' | 'from-decay' | 'synthetic';

export interface IsotopeSummary {
  readonly massNumber: number;        // A
  readonly exactMass: number;         // u (핵 실험값 또는 인용)
  readonly abundance: number | null;  // 0..1, 합성 원소는 null
  readonly halfLifeSeconds: number | null; // 안정 동위원소는 null
}

export interface Element {
  // 식별
  readonly number: ElementNumber;
  readonly symbol: string;            // "H", "He", ..., "Og"

  // 명칭 (i18n 은 리소스에서 참조, 여기는 정규 표기 저장)
  readonly nameEn: string;            // 영문 IUPAC 정식 명칭
  readonly nameKo: string;            // 한글 정식 명칭 (대한화학회 권장)

  // 질량/전자
  readonly atomicMass: number;        // 표준 원자량 (u)
  readonly electronConfigCondensed: string; // 예: "[Ne] 3s1" (noble-gas 축약형)
  readonly electronConfigFull: string;      // 예: "1s2 2s2 2p6 3s1" (완전 전개형)

  // 전기/에너지
  readonly electronegativity: number | null;   // Pauling
  readonly firstIonizationEnergyEV: number | null;
  readonly electronAffinityEV: number | null;

  // 반지름
  readonly covalentRadiusPm: number;
  readonly vdwRadiusPm: number | null;

  // 주기/족/블록/분류
  readonly period: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly group: number | null;      // 1..18, 란타넘·악티늄족은 null
  readonly block: Block;
  readonly category: ElementCategory;

  // 상태·물성
  readonly standardState: StandardState;
  readonly meltingPointK: number | null;
  readonly boilingPointK: number | null;
  readonly densityGPerCm3: number | null; // 고체/액체는 STP, 기체는 0°C 1 atm

  // 자연 존재/방사성
  readonly occurrence: Occurrence;
  readonly isRadioactive: boolean;

  // 대표 동위원소 (요약)
  readonly primaryIsotope: IsotopeSummary;

  // 시각
  readonly cpkColorHex: `#${string}`;

  // 메타
  readonly yearDiscovered: number | null;  // 합성/발견 연도
}
```

### 4.2 데이터 파일 형식

**`src/data/elements/elements.json`** — 118 항목 배열, 원자번호 오름차순.
```json
[
  {
    "number": 1,
    "symbol": "H",
    "nameEn": "Hydrogen",
    "nameKo": "수소",
    "atomicMass": 1.008,
    "electronConfigCondensed": "1s1",
    "electronConfigFull": "1s1",
    "electronegativity": 2.20,
    "firstIonizationEnergyEV": 13.598,
    "electronAffinityEV": 0.754,
    "covalentRadiusPm": 31,
    "vdwRadiusPm": 120,
    "period": 1,
    "group": 1,
    "block": "s",
    "category": "reactive-nonmetal",
    "standardState": "gas",
    "meltingPointK": 13.99,
    "boilingPointK": 20.271,
    "densityGPerCm3": 0.00008988,
    "occurrence": "primordial",
    "isRadioactive": false,
    "primaryIsotope": {
      "massNumber": 1,
      "exactMass": 1.00782503207,
      "abundance": 0.999885,
      "halfLifeSeconds": null
    },
    "cpkColorHex": "#FFFFFF",
    "yearDiscovered": 1766
  }
]
```

**`src/data/elements/elements.meta.json`** — 소스 인용 및 갱신 이력 요약.
```json
{
  "sources": {
    "atomicMass": "IUPAC 2021 standard atomic weights (via NIST)",
    "electronegativity": "Pauling scale (CRC Handbook)",
    "ionizationEnergy": "NIST Atomic Spectra Database",
    "radii": "Cordero et al. 2008 (covalent), Bondi 1964 / Alvarez 2013 (vdW)",
    "cpkColors": "Jmol/PyMOL CPK convention"
  },
  "sourceVersions": {
    "atomicWeights": "IUPAC-2021",
    "electronegativity": "CRC-103rd",
    "ionizationEnergy": "NIST-ASD-2023",
    "covalentRadii": "Cordero-2008",
    "vdwRadii": "Alvarez-2013"
  },
  "fetchedAt": "YYYY-MM-DDThh:mm:ssZ",
  "collector": "scripts/fetch-periodic-table"
}
```

> **`sourceVersions` 의 용도**: 외부 표준 개정 (예: IUPAC 원자량 2021→2024, NIST ASD 갱신) 을 *명시적으로* 추적. 수집 스크립트는 자신이 사용한 소스 버전을 이 필드에 기록하며, CI 또는 정기 점검 워크플로 (Phase 15) 가 최신 표준 버전과 비교해 *재수집 권장* 알림을 띄울 수 있다. 실제 재수집 시 골든 데이터 변경은 PR 로 명시적 검토.

### 4.3 i18n 리소스 확장

```json
// src/i18n/resources/ko/chemistry.json (발췌)
{
  "element": {
    "1":  { "name": "수소",   "symbol": "H"  },
    "2":  { "name": "헬륨",   "symbol": "He" },
    "11": { "name": "소듐",   "symbol": "Na" },
    "19": { "name": "포타슘", "symbol": "K"  }
  },
  "category": {
    "alkali-metal": "알칼리 금속",
    "alkaline-earth-metal": "알칼리 토금속",
    "transition-metal": "전이 금속",
    "post-transition-metal": "전이 후 금속",
    "metalloid": "준금속",
    "reactive-nonmetal": "반응성 비금속",
    "noble-gas": "비활성 기체",
    "lanthanide": "란타넘족",
    "actinide": "악티늄족",
    "unknown": "미분류"
  },
  "block": { "s": "s 블록", "p": "p 블록", "d": "d 블록", "f": "f 블록" },
  "standardState": { "solid": "고체", "liquid": "액체", "gas": "기체", "unknown": "알 수 없음" }
}
```

영어 리소스(`en/chemistry.json`)도 동일 키 구조로 작성.

---

## 5. 퍼블릭 API / 인터페이스

`src/chemistry/elements/index.ts` 가 유일한 공개 진입점. JSON 파일은 외부 레이어에서 **직접 import 금지** (레이어 가드 위반).

### 5.1 조회 함수

```ts
export function getElement(n: ElementNumber): Element;
export function getElementUnsafe(n: number): Element | undefined;

export function getElementBySymbol(symbol: string): Element | undefined;
/** 대소문자 민감. 첫 글자 대문자, 두 글자 원소의 두 번째는 소문자 요구 */

export function getAllElements(): readonly Element[];
/** 원자번호 오름차순 readonly 배열 */
```

### 5.2 필터/분류 함수

```ts
export function getElementsByPeriod(period: 1|2|3|4|5|6|7): readonly Element[];
export function getElementsByGroup(group: number): readonly Element[]; // 1..18
export function getElementsByBlock(block: Block): readonly Element[];
export function getElementsByCategory(c: ElementCategory): readonly Element[];
```

> **D6 의 La/Ac 동시 소속**: `block` 과 `category` 는 *독립 축* 이다. La(57) 과 Ac(89) 는 `block: 'd'` 이면서 `category: 'lanthanide'` / `'actinide'` 이므로 다음 호출이 모두 La 를 포함한다:
> - `getElementsByBlock('d')` → Sc, Y, **La**, **Ac**, 그리고 표준 d-block 36개 = **총 40개**
> - `getElementsByCategory('lanthanide')` → La + Ce..Lu = **총 15개** (D6 의 IUPAC 2021 권고: f-block 14개 + La 1개)
> - `getElementsByBlock('f')` → Ce..Lu(14) + Th..Lr(14) = **총 28개**, La/Ac 미포함
>
> Phase 11 주기율표 필터 UI 는 두 축의 교집합이 비어 있지 않음을 시각적으로 표현해야 한다 (예: La 는 d-block 행과 lanthanide 그룹 모두에 강조).

### 5.3 검증/유틸

```ts
export function isValidElementNumber(n: number): n is ElementNumber;
/** 1..118 정수 확인 후 브랜드 부여 */

export function elementSymbolOf(n: ElementNumber): string;
export function elementNameOf(n: ElementNumber, locale: 'ko' | 'en'): string;
/** 내부에서 i18n 키 `element.{n}.name` 을 읽어 반환. 폴백: nameEn */
```

### 5.4 주기율표 레이아웃 지원 (UI 용)

주기율표 UI(Phase 11)가 그리드 배치에 사용하는 순수 계산 함수. DOM 의존 없음.

```ts
export interface PeriodicTableCell {
  readonly element: Element;
  readonly row: number;       // standard: 1..9, extended: 1..7
  readonly column: number;    // standard: 1..18, extended: 1..32
}

export function getPeriodicTableLayout(
  mode?: 'standard' | 'extended'   // default 'standard'
): readonly PeriodicTableCell[];
```

**레이아웃 규칙 (`standard` 모드, 위키백과/IUPAC 2021 관행)**

| row | column 범위 | 원소 (원자번호) |
|-----|-------------|----------------|
| 1 | 1, 18 | H(1), He(2) |
| 2 | 1–2, 13–18 | Li(3)–Ne(10) |
| 3 | 1–2, 13–18 | Na(11)–Ar(18) |
| 4 | 1–18 | K(19)–Kr(36) |
| 5 | 1–18 | Rb(37)–Xe(54) |
| 6 | 1–3, 4–18 | Cs(55), Ba(56), **La(57)**, Hf(72)–Rn(86) — La–Lu 는 별도 행(row 8, column 3–17)에 표기 |
| 7 | 1–3, 4–18 | Fr(87), Ra(88), **Ac(89)**, Rf(104)–Og(118) — Ac–Lr 는 별도 행(row 9, column 3–17)에 표기 |
| 8 | 3–17 | La(57)–Lu(71) (란타넘족 분리 행) |
| 9 | 3–17 | Ac(89)–Lr(103) (악티늄족 분리 행) |

- `standard` 모드의 총 row 수: **9** (`1..9`). 원자 번호 La, Ac 는 row 6/7 의 column 3 에 "자리 표시자" 를 두지 않고 row 8/9 의 좌측 끝 셀에 위치시킨다 (겹침 방지).
- `extended` 모드(32-컬럼)는 La–Lu / Ac–Lr 를 row 6/7 안에 인라인으로 배치하며, 총 row 수 **7**.
- 어떤 셀도 `(row, column)` 쌍이 중복되지 않는다 (테스트 §8.3 로 검증).

---

## 6. 핵심 로직 / 전략

### 6.1 수집 스크립트 (`scripts/fetch-periodic-table/`)

- 실행 환경: Node 20 (ts-node 또는 tsx)
- 절차:
  1. PubChem PUG REST 호출 → 기초 세트 획득
  2. NIST / 기타 공공 데이터에서 누락 필드 보강
  3. CPK 색상/한글명 테이블 병합
  4. Phase 01 `Element` 스키마로 정규화
  5. `elements.json` + `elements.meta.json` 파일 출력
  6. 변경 diff 요약을 stdout 에 보고 (수동 검토용)
- **자동 머지 금지**: 스크립트는 파일을 덮어쓰기만 하고, 커밋 여부는 사람이 판단

### 6.2 로드 전략 (런타임)

- `elements.json` 은 작은 크기(수백 KB 이내 예상)이므로 **즉시 번들**에 포함.
- 최초 import 시점에 `Map<ElementNumber, Element>` 로 인덱싱하여 O(1) 조회 제공.
- 불변: `readonly` + `Object.freeze`(개발 모드에서만 강제, 프로덕션은 타입에 의존).

### 6.3 무결성 보장

- **타입 가드 기반 로드**: JSON 을 읽는 진입 모듈에서 모든 항목을 `Element` 로 좁히는 파서 통과. 실패 시 build-time 에러 (Vitest의 `import` 테스트로 CI 에서 감지).
- 경량 검증 함수 `validateElementsPayload(raw: unknown): Result<readonly Element[], string[]>` 를 둔다.

### 6.4 대표 동위원소 선정 규칙

- 안정 동위원소가 있는 원소: **자연 존재비 최대** 동위원소
- 안정 동위원소가 없는 원소(Tc, Pm, 모든 악티늄족 이후 및 합성 원소): **반감기 최대** 동위원소
- 선정 결과는 `primaryIsotope` 에 저장

---

## 7. 파일 / 모듈 레이아웃 (Phase 02 완료 시)

```
src/
├── chemistry/
│   └── elements/
│       ├── index.ts              # 공개 API 재export
│       ├── types.ts              # (Phase 01 에서 생성됨, 본 Phase 에서 확장)
│       ├── registry.ts           # Map 인덱스, getElement 등
│       ├── filters.ts            # by period/group/block/category
│       ├── layout.ts             # getPeriodicTableLayout
│       ├── validation.ts         # validateElementsPayload
│       └── naming.ts             # elementNameOf (i18n 래퍼)
├── data/
│   └── elements/
│       ├── elements.json         # 118 항목
│       └── elements.meta.json    # 소스/수집 메타
└── i18n/
    └── resources/
        ├── ko/chemistry.json     # 118 한글명 + 카테고리/블록/상태
        └── en/chemistry.json     # 118 영문명 + 카테고리/블록/상태

scripts/
└── fetch-periodic-table/
    ├── index.ts                  # 엔트리
    ├── sources/
    │   ├── pubchem.ts
    │   ├── nist.ts
    │   ├── cpk.ts
    │   └── korean-names.ts
    └── normalize.ts              # 필드 결합 + 스키마 정규화
```

`src/chemistry/elements/index.ts` 이외의 경로로 `data/elements/` JSON 을 import 하는 것은 **ESLint 규칙으로 차단**한다 (Phase 01 의 `no-restricted-paths` zones 에 `data/elements` 접근 허용을 `chemistry/elements` 로 한정).

---

## 8. 테스트 계획

### 8.1 데이터 무결성 (Vitest)

`tests/unit/elements/integrity.test.ts`:
- 정확히 118 항목 존재
- `number` 가 1..118 중복 없음, 오름차순
- `symbol` 모두 유일
- 각 필드 타입/범위 검증:
  - `atomicMass > 0`
  - `period ∈ [1,7]`, `group ∈ [1,18] | null`
  - `block ∈ {s,p,d,f}`, `category ∈ ElementCategory`
  - `cpkColorHex` 정규식 `#[0-9A-F]{6}`
  - `primaryIsotope.massNumber ≥ number` (양성자 수 이상)
  - `occurrence === 'synthetic'` 인 모든 원소: `isRadioactive === true` (자연 존재 여부가 합성인 원소는 모두 방사성으로 간주)
  - 역으로 `occurrence === 'synthetic'` 판정은 원자번호가 아닌 **자연 시료의 검출 가능성** 기준으로 데이터셋에서 정한다 (일반적으로 Tc(43), Pm(61), Np(93) 이후 대부분이 해당 — 정확한 목록은 `elements.json` 자체가 권위)
  - `meltingPointK ≤ boilingPointK` (둘 다 존재할 때)

### 8.2 샘플 정확성 골든 (Vitest)

`tests/unit/elements/goldens.test.ts` — 교차검증 가능한 대표 원소 10개 내외의 핵심 필드를 하드코딩된 기대값과 비교 (예: H, C, O, Fe, Au, U, Og). 외부 데이터 실수로 인한 회귀를 차단.

### 8.3 공개 API (Vitest)

`tests/unit/elements/api.test.ts`:
- `getElement(ElementNumber)` 가 정확한 원소 반환
- `getElementBySymbol('H')` vs `getElementBySymbol('h')` 동작 (대문자 규약 유효)
- `getElementsByPeriod(2)` 길이 = 8
- `getElementsByBlock('f')` 길이 **= 28** (D6 기본안: La/Ac 는 d-block, Ce–Lu 14 + Th–Lr 14)
- `getElementsByBlock('d')` 길이 = 40 (Sc, Y, La, Ac 포함)
- `getPeriodicTableLayout()` — 어떤 셀도 좌표가 겹치지 않음

### 8.4 i18n 커버리지

`tests/unit/elements/i18n-coverage.test.ts`:
- `element.1.name` … `element.118.name` 이 `ko` 및 `en` 리소스 모두에 존재
- `symbol` 이 데이터와 일치

### 8.5 레이어 가드 검증
- `data/elements/elements.json` 을 `chemistry/elements` 외부에서 import 시 ESLint 실패 확인 (수동 1회)

---

## 9. 리스크 및 대안

| # | 리스크 | 영향 | 완화 |
|---|--------|------|------|
| R1 | 공공 소스 간 수치 불일치 (예: 원자량 개정) | 중 | `meta.json` 에 소스·수집 일자 기록, 골든 테스트로 회귀 감지 |
| R2 | 합성 원소(특히 113+)의 데이터 부재/추정값 혼입 | 중 | 추정값은 `null` 로 두거나 별도 `predicted*` 필드로 분리. 초기 범위는 `null` 허용 |
| R3 | 한글명 표기 논쟁 (나트륨 vs 소듐 등) | 하 | D3 기본안(최신 IUPAC 권장 명칭) 명시. `nameKoAlt` 같은 별칭 필드는 향후 i18n 확장으로 연기 |
| R4 | `elements.json` 비대화로 초기 번들 영향 | 하 | 예상 크기 < 200 KB 비압축. 필요 시 gzip 번들만으로 충분 |
| R5 | JSON 을 타입 없이 import 시 `unknown` 처리 | 하 | `validateElementsPayload` 진입 파서 + tsconfig `resolveJsonModule` 조합 |
| R6 | 주기율표 레이아웃(란타넘족 위치)의 시각적 관례 차이 | 하 | `getPeriodicTableLayout('standard')` 를 위키백과 표준 배치로 고정. 확장 모드는 선택 사항 |

---

## 10. 완료 기준 (Definition of Done)

1. `src/data/elements/elements.json` 에 정확히 118 항목이 존재하고, §8.1 무결성 테스트가 전부 통과.
2. `src/chemistry/elements/index.ts` 가 §5 의 모든 공개 API 를 export.
3. `getElement`, `getElementsByPeriod/Group/Block/Category`, `getPeriodicTableLayout` 모든 함수에 대해 유닛 테스트 존재 및 통과.
4. `src/i18n/resources/{ko,en}/chemistry.json` 에 118 원소명과 분류 용어가 채워져 있고, i18n 커버리지 테스트 통과.
5. `data/elements` 하위 JSON 을 `chemistry/elements` 외부에서 import 하려 하면 `pnpm lint` 가 실패 (수동 확인 1회).
6. `scripts/fetch-periodic-table` 로 데이터 재수집 시, 현재 `elements.json` 과 의미적으로 동일한(정렬 후 deep-equal) 결과가 얻어짐. 단, 외부 DB 갱신에 따른 합리적 변동은 golden 수정으로 반영.
7. `elements.meta.json` 에 소스 인용과 수집 일시가 기록됨.
8. **D6 규약 검증**: `getElementsByBlock('f').length === 28` 이며, La(57)/Ac(89) 의 `block === 'd'` 및 `category ∈ {'lanthanide','actinide'}` 임이 유닛 테스트로 확인됨. **추가 교차 검증**: `getElementsByBlock('d').length === 40` (Sc, Y, La, Ac 포함) 이고, `getElementsByCategory('lanthanide').length === 15` (La 포함, Ce–Lu 14 + La 1) — La/Ac 가 두 필터 모두에 *동시 존재* 함이 의도적임을 테스트가 명시.
9. `getPeriodicTableLayout('standard')` 의 row 범위가 1..9 이고, La–Lu 는 row 8 / Ac–Lr 는 row 9 의 column 3..17 에 배치됨이 테스트로 확인됨.
10. **한국어 명칭 100% 커버리지**: 118개 원소 모두 `nameKo` 가 비어 있지 않은 string (대한화학회 권장 표기 기준). `nameKo === null` 또는 `nameKo === ""` 인 엔트리 0개 — `pnpm test -- elements/coverage` 로 검증. `scripts/fetch-periodic-table/ko-names/curated.tsv` 가 single source of truth 이며, Phase 04 가 PubChem 한글명을 가져오더라도 본 Phase 의 curated 테이블이 우선한다 (Phase 04 의 화합물 한글명과는 무관).

---

## 11. 열린 질문 (User Decision Required)

1. §3.3 D1~D6 기본안 수용 여부 (특히 D6 의 f-block 경계 규약은 UI 레이아웃과 연동되므로 명시적 확인 필요).
2. ~~**D3 원소 한국어 명칭**~~ — **해소됨**: §10 (DoD) #10 이 "대한화학회 권장 표기 기준 (= 최신 IUPAC 권장 표기, 예: 소듐/포타슘) 으로 118개 100% 커버" 를 강제. 전통 표기("나트륨" / "칼륨") 가 필요한 경우는 `nameKoLegacy?: string` 필드 추가로 별도 처리 (Phase 11 표시 토글 시점에 결정, 본 Phase 비포함).
3. **주기율표 레이아웃**: 초기 버전에서 `standard` (18-컬럼, 란타넘·악티늄 분리) 만 제공. `extended` (32-컬럼) 도 초기 지원을 원하시는지?
4. **합성 원소의 추정값**: 녹는점/끓는점 등 실험값이 없는 합성 원소에 대해 `null` 로 두는 것이 충분한지, 아니면 `predicted*` 예측값을 함께 수록하기를 원하는지?

---

## 12. 다음 Phase 로의 인계 (Hand-off)

- `@/chemistry/elements` 가 노출하는 조회/분류 함수: Phase 03(RDKit 래퍼가 분자 파싱 시 `Element` 메타 조회), Phase 06(반응 엔진의 valence·전기음성도 참조), Phase 08(Atom 렌더러의 CPK 색/반지름), Phase 11(주기율표 UI) 이 직접 소비.
- `elements.json` 은 **다른 레이어에서 직접 참조 금지**. 누군가 우회 import 를 시도하면 ESLint 가 실패.
- Phase 04 (Compound Pipeline) 는 화합물의 원자 목록을 검증할 때 `isValidElementNumber` 및 `getElement` 를 사용.

---

*문서 버전: 0.1 (초안)*
*작성일: 2026-04-19*
