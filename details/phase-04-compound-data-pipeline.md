# Phase 04 — Compound Data Pipeline (빌드타임)

> 이 문서는 `architecture.md` §13 **Phase 04** 의 상세 설계서이다. Phase 01(공용 타입·레이어 경계·CI), Phase 02(원소 데이터 API), Phase 03(RDKit 서비스·파서·임베드) 의 산출물을 전제로 한다.
>
> 본 문서는 **설계 기술**이다. 실제 PubChem 호출·JSON 작성·청크화는 모든 details 승인 후 수행한다.

---

## 1. 목적 (Purpose)

화합물 브라우저(Phase 11) 와 검색·자동완성 UX 가 소비할 **수천 종 규모의 화합물 정적 데이터셋** 을 빌드타임에 구축한다. `scripts/pubchem-fetch/` 가 PubChem PUG REST 에서 큐레이팅된 CID 목록을 수집·정규화·검증하고, 카테고리별 **청크 JSON** 으로 분할하여 `src/data/compounds/` 에 커밋한다. 런타임에는 작은 **매니페스트 하나**가 초기 번들에 포함되고, 실제 화합물 상세(3D 좌표 포함) 는 **동적 import** 로 카테고리 청크에서 지연 로드된다.

이 Phase 가 끝나면:
- 큐레이션 정책(`architecture.md` §12.2) 이 명문화된다 — **"수천 종"** 의 정의, 카테고리 분류, 카테고리별 목표 개수.
- 모든 화합물의 SMILES 가 Phase 03 `parseSmiles` 로 파싱되고, 모든 3D 좌표가 Phase 03 `embed3D` 또는 **PubChem 3D SDF** 중 하나의 결정적 경로로 확보된다.
- 초기 번들은 < 500 KB gzip 예산(architecture §3.2) 을 유지한다 (매니페스트는 eagerly 번들, 청크는 lazy).
- 런타임 레이어(Phase 05·07·11)가 매니페스트 조회·청크 로더 공개 API 를 통해서만 화합물에 접근한다 (JSON 직접 import 금지).
- Phase 03 의 `formula-map.ts` 수동 매핑을 보강하는 `formula-map.generated.ts` 가 자동 생성된다 (수동 엔트리가 항상 우선).
- Phase 01 `Compound` 타입의 `// TODO: Phase 04 — 물성, 존재 조건` 이 채워진다.
- 스크립트는 **재현 가능하고 재개 가능**하다 (로컬 `.cache/` 원시 응답 + diff 리포트 + 사람이 커밋).

---

## 2. 범위 (Scope)

### 2.1 포함

- **큐레이션 정책** (`scripts/pubchem-fetch/seeds/`) — 사람이 편집하는 카테고리별 시드 파일. 각 엔트리는 PubChem CID 또는 이름 + 우선순위.
- **수집 스크립트** (`scripts/pubchem-fetch/`):
  - PubChem PUG REST 클라이언트 (rate limit: 5 req/s, 안전여유 적용)
  - 로컬 응답 캐시 (`.cache/pubchem/`) — 재실행 시 네트워크 생략
  - 속성·SDF 배치 수집 (`/compound/cid/{cid}/property/...`, `/compound/cid/{cid}/SDF?record_type=3d`)
  - 지수 백오프 재시도 (429/503 한정)
- **정규화** (`scripts/pubchem-fetch/normalize.ts` 는 `src/engine/pubchem/normalize.ts` 의 thin wrapper):
  - PubChem 응답 → Phase 01 `Compound` (§4.1 확장판)
  - 필드 결측 정책 (`null` 허용 범위, 실패 시 스킵 또는 에러)
  - **공용 모듈 강제**: 본 Phase 의 빌드 스크립트와 phase-05 런타임 normalize 가 *동일* `src/engine/pubchem/normalize.ts` 를 import 한다 (phase-05 §6.8 D1). 양쪽이 `NORMALIZE_SCHEMA_VERSION` 상수를 공유하므로 한쪽만 bump 되어 데이터-캐시 정합성이 깨질 위험이 없다.
- **한국어 명칭 보강** (`scripts/pubchem-fetch/ko-names/`):
  - 대한화학회 권장 명칭 테이블(수동 큐레이션) + 시드 파일 오버라이드
  - 미커버 항목은 `nameKo: null` + 경고 리포트
- **검증 파이프라인** (`scripts/pubchem-fetch/validate.ts`):
  - 모든 SMILES 를 Phase 03 `parseSmiles` 로 파싱 시도
  - PubChem 3D SDF 가 없는 경우 Phase 03 `embed3D` (고정 시드) 로 생성
  - 임베드 실패 시 화합물 드롭 + 리포트
- **청크화** (`scripts/pubchem-fetch/chunk.ts`):
  - 카테고리별 청크 파일 생성 (`src/data/compounds/chunks/{category}.json`)
  - 청크 내 엔트리는 CID 오름차순
  - 크기 상한 초과 시 카테고리 하위 샤드(`chunks/{category}.001.json`, `chunks/{category}.002.json`) 로 분할
- **매니페스트 생성** (`scripts/pubchem-fetch/manifest.ts`):
  - `src/data/compounds/manifest.json` — 전체 화합물의 **경량 인덱스** (name/formula/cid/chunkId/priority)
  - 런타임에서 eagerly 번들 (검색/자동완성 용)
- **런타임 로더 API** (`src/data/compounds/index.ts`):
  - `getCompoundManifest()` — 동기, 매니페스트 전체 반환
  - `loadCompoundChunk(chunkId)` — 동적 import, `Promise<Compound[]>`
  - `findCompoundByCid(cid)` — 매니페스트 히트 → 해당 청크 로드 → 찾아서 반환 (캐시)
- **`formula-map.generated.ts` 자동 생성** (Phase 03 §6.4 인계):
  - 빈출 화합물(우선순위 높은 것) 의 Hill 키 → SMILES 매핑을 자동 추출
  - **수동 `formula-map.ts` 와 충돌 시 수동이 우선** (§6.8 에서 상세)
- **메타/리포트** (`src/data/compounds/compounds.meta.json`):
  - 수집 일시, PubChem API 버전, 총 개수, 카테고리별 개수, 드롭된 엔트리 요약
  - 직전 리포지토리 커밋 대비 diff 요약(Script 실행 시 stdout)

### 2.2 비포함 (다른 Phase / 비목표)

| 항목 | 이관 대상 |
|------|-----------|
| **런타임 PubChem 호출** | Phase 05 (Runtime Data Layer) |
| **IndexedDB 캐시** | Phase 05 |₩
| 화합물 **검색 UI** / 자동완성 | Phase 11 (CompoundBrowser 패널) |
| 반응 규칙 DB 구축 | Phase 06 (`data/reactions/`) |
| 화합물 **편집 플로우** (moleculeStore) | Phase 07 |
| 3D **렌더링** | Phase 08 |
| 화합물 입체 이성질체 다 변형 수집 | 비목표 — 대표 이성질체 1개만 (Phase 03 §6.4 정책과 일치) |
| 화합물 **Export/Import** 포맷 | Phase 13 |
| PubChem **대용량** (> 10000 종) 수집 | 비목표 — Phase 04 는 수천 종 |

---

## 3. 의존성 (Dependencies)

### 3.1 선행 Phase

- **Phase 01** — `Compound`, `Molecule`, `Atom`, `Bond` (필드 `aAtomId/bAtomId`), `Result`, logger
- **Phase 02** — `isValidElementNumber`, `getElement`, `getElementBySymbol` (원소 검증)
- **Phase 03** — 다음 **순수 변환 유틸리티** 와 **정규화/검증 로직** 을 재사용한다. 브라우저 전용 `getRdkit()` 은 Node 스크립트에서 호출하지 않는다 (§6.4 참조).
  - `engine/parser/normalize.ts` — 입력 정규화·길이/문자셋 검증
  - `engine/parser/toDomain.ts` — RDKit 객체 → `Molecule` 매핑
  - `engine/parser/stereo.ts` — 입체 정보 추출
  - `engine/parser/formula.ts` — Hill 키 정규화 (formula-map.generated 생성 시)
  - `engine/rdkit/canonical.ts` — canonical SMILES / InChI 출력 (RDKit 인스턴스 주입 전제)
  - `engine/geometry/embed.ts` — ETKDG 임베드 루틴 (RDKit 인스턴스 주입 전제)
  - `engine/geometry/metrics.ts` — 결합 길이/각 (순수 수학, RDKit 불요)
  - Phase 03 §6.8 `RdkitBackend` 인터페이스 — Node 구현을 본 Phase 가 추가한다

### 3.2 외부 데이터/라이브러리

| 소스/라이브러리 | 용도 | 라이선스/정책 |
|----------------|------|---------------|
| **PubChem PUG REST** (`https://pubchem.ncbi.nlm.nih.gov/rest/pug/`) | 화합물 속성·SDF·이름→CID | 퍼블릭, 비상업 제한 없음, **5 req/s 제한** 준수 |
| **대한화학회 원소·화합물 한글 표기 지침** | 한국어 화합물명 큐레이션 | 공인 용어 인용 |
| **`@rdkit/rdkit`** (Phase 03 과 동일 버전 고정) | Node 환경에서 RDKit WASM 직접 로드 — SMILES 파싱·ETKDG 임베드·SDF 리더 | BSD-3-Clause |
| Node 내장 `fetch` (Node 20+) | HTTP 클라이언트 (추가 라이브러리 불요) | — |
| **`zod`** (빌드타임 전용) | PubChem 응답 스키마 검증 (R1 완화책의 필수 구성요소) | MIT |

> **주의**: PubChem 원문 응답을 리포지토리에 커밋하지 않는다. `.cache/pubchem/` 은 `.gitignore` 로 제외. 가공물만 커밋.

### 3.3 결정 필요 사항 (사용자 확인)

| # | 질문 | 기본안 |
|---|------|--------|
| D1 | **목표 화합물 수** | 초기 **2500종** (± 300). 추후 큐레이션 확장 시 상한 5000 |
| D2 | **청크 크기 상한** | 압축 전 **150 KB** / 청크. 카테고리가 이를 초과하면 샤드 분할 (`{category}.{NNN}.json`) |
| D3 | **카테고리 분류** (§4.2) | 14 카테고리 (inorganic-common / salts-and-ions / acids-and-bases / alkanes / alkenes-alkynes / alcohols / carboxylic-acids-esters / aldehydes-ketones / amines-amides / aromatics / heterocycles / biomolecules-basic / pharma-illustrative / everyday-compounds) |
| D4 | **한국어 명칭 소스** | 수동 큐레이션 테이블(`ko-names/curated.tsv`) 우선 → 시드 파일 내 `nameKo` 오버라이드 → 미커버 시 `null` + 빌드 경고 |
| D5 | **3D 좌표 소스 우선순위** | **1순위: PubChem 3D SDF** (있으면), **2순위: Phase 03 `embed3D` 고정 시드**. 동일 청크에 두 소스 혼재 가능. 엔트리에 `coordinateSource: 'pubchem-3d' \| 'rdkit-etkdg'` 기록 |
| D6 | **매니페스트 번들 전략** | **eagerly 번들** (예상 < 80 KB gzip). 만약 초기 번들 예산 초과 감지 시 Phase 14 에서 매니페스트도 lazy 전환 (경계는 타입으로 준비) |
| D7 | **Rate limit 안전여유** | **4 req/s** (공식 5 req/s 에 20% 여유). 버스트 버킷 5, 평균 4 req/s |
| D8 | **이온/염의 표현** | PubChem 의 단일 CID + disconnected SMILES (`[Na+].[Cl-]`) 를 **단일 `Compound` 엔트리**로 유지 (Phase 03 `DisconnectedFragments` warning 정책과 정합) |
| D9 | **드롭 정책** | SMILES 파싱 실패 또는 임베드 실패(2회 재시도 후) 시 **해당 화합물 드롭 + 리포트**. 시드 파일에 남기지만 `data/compounds/` 에 미수록 |

본 문서 승인 시 기본안 채택.

---

## 4. 데이터 모델

### 4.1 확장된 `Compound` 타입 (Phase 01 TODO 수용)

Phase 01 `Compound` 의 `// TODO: Phase 04 — 물성, 존재 조건` 자리를 확정한다. Architecture §5.1 이 언급한 "물성(존재 조건 등)" 은 본 Phase 에서 `CompoundProperties` 로 구체화된다 — 녹는점·끓는점·밀도는 "물성", `standardState` 와 `waterSolubility` 는 "존재 조건" (어떤 상태/용매에서 존재하는가) 에 대응한다.

```ts
// src/chemistry/compounds/types.ts  (Phase 04 확장 부분)

export type PhysicalState = 'solid' | 'liquid' | 'gas' | 'aqueous' | 'unknown';

export type CoordinateSource = 'pubchem-3d' | 'rdkit-etkdg';

export interface CompoundProperties {
  /** 녹는점 K. 화합물 기준 1 atm */
  readonly meltingPointK: number | null;
  /** 끓는점 K. 화합물 기준 1 atm */
  readonly boilingPointK: number | null;
  /** 밀도 g/cm^3. 고체/액체는 STP, 기체는 0°C 1 atm */
  readonly densityGPerCm3: number | null;
  /** STP 표준 상태 */
  readonly standardState: PhysicalState;
  /** 물 용해도 정성 플래그 — PubChem XLogP/용해도 주석에서 파생.
   * 정확한 수치(g/L, log S) 는 비목표. `unknown` 이 가장 흔하다. */
  readonly waterSolubility: 'insoluble' | 'slightly' | 'soluble' | 'miscible' | 'unknown';
  /** XLogP3 (PubChem 제공 시) — 소수성 지표, 반응 엔진 비참조 */
  readonly logP: number | null;
}

/** Phase 01 의 Compound 에 이 필드들을 추가한다. 기존 필드는 유지. */
export interface Compound {
  readonly cid: number | null;                      // Phase 01
  readonly name: { readonly ko: string | null; readonly en: string }; // Phase 01
  readonly molecularFormula: string;                // Phase 01 (Hill 표기)
  readonly molecularWeight: number;                 // Phase 01
  /** Phase 01 의 `smiles: string` 을 **RDKit canonical SMILES (입체화학 보존)** 로 의미 확정.
   * PubChem 의 `CanonicalSMILES` 가 아니라 `IsomericSMILES` 를 입력으로 받아 Phase 03
   * `toCanonicalSmiles` 를 거친 결과. R/S·E/Z 정보가 SMILES 문자열에 보존된다. */
  readonly smiles: string;                          // Phase 01
  /** PubChem 응답의 `InChI` 필드를 **우선 사용**. 응답 누락(드물게 발생) 시 phase-03
   * `toInchi(parsedMol)` 로 역산하여 채운다. 두 경로 모두 동일 RDKit 버전이므로 phase-05
   * 런타임이 같은 SMILES → toInchi 했을 때와 byte-identical. */
  readonly inchi: string | null;                    // Phase 01
  readonly defaultMolecule: Molecule | null;        // Phase 01 (3D 좌표 포함)

  // Phase 04 추가
  /** PubChem 응답의 `InChIKey` 필드를 **우선 사용**. 응답 누락 시 phase-03 `toInchi(parsedMol).inchiKey`
   * 로 역산. SMILES↔InChI 정규화 경로의 *동치성* 보장이 phase-05 캐시 역조회의 정합성에 직결. */
  readonly inchiKey: string | null;
  readonly iupacName: string | null;                // PubChem IUPAC Name (영문)
  readonly synonyms: ReadonlyArray<string>;         // PubChem Synonyms 최대 5개 (색인 보조)
  readonly category: CompoundCategory;              // §4.2
  readonly priority: number;                        // §4.3 — 정렬 키 (낮을수록 먼저)
  readonly properties: CompoundProperties;
  /** `defaultMolecule` 과 동기. `defaultMolecule === null` 이면 `null` (예: 사용자가 moleculeStore
   * 에서 임시 생성한 메타데이터 Compound). 본 Phase 의 청크에 커밋되는 엔트리는 D9 의 드롭 정책에
   * 의해 `defaultMolecule !== null` 이며 따라서 `coordinateSource !== null` 을 불변식으로 갖는다. */
  readonly coordinateSource: CoordinateSource | null;
}
```

> Phase 01 의 `Compound.smiles` 는 "SMILES" 로만 명시되어 있었으나, 본 Phase 는 **RDKit canonical SMILES (입체화학 보존)** 로 의미를 좁힌다. 구체적으로: PubChem 의 `IsomericSMILES` 를 입력 → Phase 03 `parseSmiles` (RDKit 인스턴스는 Node 용) → `toCanonicalSmiles` 의 결과 문자열. 이는 범위 확장이 아닌 **의미 확정**이며, 하위 호환(선행 구현 없음) 이므로 타입 파일의 주석으로 명시. PubChem `CanonicalSMILES` 는 입체 정보를 제거하므로 **입력 후보에서 제외** (§6.5).
>
> **불변식 적용 범위**: 이 "RDKit canonical, stereo-preserving" 제약은 **본 Phase 가 커밋하는 청크 엔트리에만** 성립한다. 사용자가 스토어 레이어(Phase 07) 에서 런타임에 `cid: null` / `defaultMolecule: null` 상태로 임시 구성한 `Compound` 에는 이 불변식이 아직 성립하지 않으며, 스토어는 편집이 확정될 때 Phase 03 `toCanonicalSmiles` 를 통과시켜 불변식을 복원한다 (Phase 07 책임). 즉 **타입 수준에서 강제되는 제약이 아니라 "데이터셋 레벨 불변식"**.

### 4.2 카테고리 분류 (D3 기본안)

```ts
// src/chemistry/compounds/categories.ts
export type CompoundCategory =
  | 'inorganic-common'          // H2O, CO2, NH3, O2, N2, H2O2, O3 등
  | 'salts-and-ions'            // NaCl, KCl, 자유 이온(옵션)
  | 'acids-and-bases'           // H2SO4, HNO3, NaOH, KOH, Ca(OH)2 등
  | 'alkanes'                   // C1~C20 직쇄, 주요 분지
  | 'alkenes-alkynes'           // 에텐, 에틴, 부타디엔 등
  | 'alcohols'                  // 메탄올~장쇄, 다이올, 페놀류
  | 'carboxylic-acids-esters'   // 포름산, 아세트산, 에스테르
  | 'aldehydes-ketones'         // 포름알데하이드, 아세톤 등
  | 'amines-amides'             // 메틸아민, 아닐린, 아세트아마이드
  | 'aromatics'                 // 벤젠, 톨루엔, 자일렌, 나프탈렌
  | 'heterocycles'              // 피리딘, 피롤, 퓨란, 이미다졸
  | 'biomolecules-basic'        // 글루코스, 20종 아미노산, ATP, 뉴클레오타이드 기본
  | 'pharma-illustrative'       // 아스피린, 이부프로펜, 카페인, 파라세타몰
  | 'everyday-compounds'        // 자일리톨, 바닐린, 멘톨, 시트르산
  ;
```

**카테고리별 목표 개수 (D1 합계 2500 기준)**:

| 카테고리 | 목표 | 비고 |
|----------|------|------|
| inorganic-common | 80 | 기본 산화물/수소화물/산화-환원 관련 단순 분자 |
| salts-and-ions | 120 | 주요 염 + 다원자 이온(SO4^2-, NO3- 등 대표 단편) |
| acids-and-bases | 80 | 산/알칼리/아민 염기 |
| alkanes | 150 | C1–C20 + 주요 분지 이성질체 |
| alkenes-alkynes | 150 | C2–C12 대표 이성질체 |
| alcohols | 200 | 1가/다가 알코올, 페놀 |
| carboxylic-acids-esters | 250 | 지방산, 저분자 에스테르 |
| aldehydes-ketones | 180 | |
| amines-amides | 180 | |
| aromatics | 200 | |
| heterocycles | 220 | 5/6원 헤테로고리 |
| biomolecules-basic | 300 | 아미노산 20 + 당류 + 뉴클레오사이드/타이드 일부 + 간단 지질 |
| pharma-illustrative | 200 | 교과·일상 대표 의약 분자 |
| everyday-compounds | 190 | 식품·향신료·일상 화학 |
| **합계** | **2500** | ± 300 허용 |

> 카테고리 목표 개수는 **상한이 아니라 큐레이션 예산**이다. 시드 파일의 실제 개수가 목표를 ±20% 초과/미달하면 스크립트가 경고를 출력하지만 실패하지는 않는다.

### 4.3 Priority 정책

- `priority: number` — 정수. **낮을수록 먼저** (0 이 최우선).
- 할당 규칙:
  - **0–99**: 교과 핵심(H2O, CO2, NaCl, CH4, 에탄올, 벤젠, 글루코스, 아세트산, …) — 시드 파일에 수동 지정
  - **100–999**: 카테고리별 빈출 (시드 파일 `priority` 필드)
  - **1000+**: 그 외 (시드 파일에 없으면 기본 `category_index × 1000 + cid % 1000`)
- 런타임 CompoundBrowser(Phase 11) 의 기본 정렬 키.

### 4.4 청크 파일 스키마

**`src/data/compounds/chunks/{category}.json`** 또는 샤드 분할 시 `chunks/{category}.{NNN}.json`. 매니페스트의 `chunk` / `chunks[]` 값은 `chunks/` 접두사 **없는** 파일명만 보관 (런타임 로더가 접두사를 붙인다).

```json
[
  {
    "cid": 962,
    "name": { "ko": "물", "en": "Water" },
    "iupacName": "oxidane",
    "synonyms": ["water", "dihydrogen oxide"],
    "molecularFormula": "H2O",
    "molecularWeight": 18.015,
    "smiles": "O",
    "inchi": "InChI=1S/H2O/h1H2",
    "inchiKey": "XLYOFNOQVPJJNP-UHFFFAOYSA-N",
    "category": "inorganic-common",
    "priority": 0,
    "properties": {
      "meltingPointK": 273.15,
      "boilingPointK": 373.15,
      "densityGPerCm3": 0.997,
      "standardState": "liquid",
      "waterSolubility": "miscible",
      "logP": -1.38
    },
    "coordinateSource": "pubchem-3d",
    "defaultMolecule": {
      "id": "cid:962",
      "atoms": [
        { "elementNumber": 8, "position": [0.0, 0.0, 0.0], "formalCharge": 0, "implicitHCount": 2 },
        { "elementNumber": 1, "position": [0.757, 0.586, 0.0], "formalCharge": 0, "implicitHCount": 0 },
        { "elementNumber": 1, "position": [-0.757, 0.586, 0.0], "formalCharge": 0, "implicitHCount": 0 }
      ],
      "bonds": [
        { "aAtomId": 0, "bAtomId": 1, "order": 1 },
        { "aAtomId": 0, "bAtomId": 2, "order": 1 }
      ],
      "totalCharge": 0,
      "canonicalSmiles": "O",
      "inchi": "InChI=1S/H2O/h1H2",
      "inchiKey": "XLYOFNOQVPJJNP-UHFFFAOYSA-N",
      "stereo": { "atomStereo": [], "bondStereo": [] },
      "spinMultiplicity": 1
    }
  }
]
```

- 엔트리는 **청크 내부에서 `cid` 오름차순** 으로 직렬화 (결정적 파일 출력). 매니페스트 정렬 키와는 독립 (매니페스트는 priority 오름차순 — §4.5).
- 본 Phase 의 커밋 데이터셋에서는 모든 엔트리가 PubChem CID 를 갖는다 (즉 `cid !== null`). Phase 01 타입은 `cid: number | null` 을 허용하나 이는 stores 레이어의 사용자 생성 Compound 를 위한 것이며, 청크 파일에는 null CID 가 기록되지 않는다.
- 좌표 단위: Å, 소수점 3자리까지 (반올림) — 파일 크기 절약, 렌더 정확도 영향 없음. `implicitHCount` 는 Phase 03 §4.5 규약에 따라 RDKit `GetTotalNumHs(true)` (explicit + implicit 합계) 를 보존 — 위 예시에서 O 원자는 `2` (이웃 H 2개 포함), H 원자는 `0`. PubChem 3D SDF 는 모든 H 를 명시적 원자로 포함하므로 explicit 이 채워지고 implicit 은 0 이 된다.
- `defaultMolecule.atoms/bonds` 의 내부 표현은 Phase 01 `Bond { aAtomId, bAtomId, order }` 및 Phase 01/03 `Molecule` 타입과 1:1.
- `defaultMolecule.id` 스키마: **`"cid:{CID}"`** 형식 (Phase 01 `id: string` 타입이 임의 문자열을 허용하므로 적합). 사용자 생성 분자의 UUID 와 구분되며, 중복 로드 시 동일 `id` 로 식별 가능.

### 4.5 매니페스트 스키마

**`src/data/compounds/manifest.json`**

```json
{
  "version": "2026-04-24T00:00:00Z",
  "totalCompounds": 2487,
  "categories": {
    "inorganic-common": { "chunks": ["inorganic-common.json"], "count": 78 },
    "alkanes":          { "chunks": ["alkanes.json"], "count": 151 },
    "biomolecules-basic": { "chunks": ["biomolecules-basic.001.json", "biomolecules-basic.002.json"], "count": 298 }
  },
  "entries": [
    {
      "cid": 962,
      "name": { "ko": "물", "en": "Water" },
      "formula": "H2O",
      "inchiKey": "XLYOFNOQVPJJNP-UHFFFAOYSA-N",
      "category": "inorganic-common",
      "chunk": "inorganic-common.json",
      "priority": 0,
      "molecularWeight": 18.015,
      "searchTokens": ["water", "물", "h2o", "dihydrogen oxide"]
    }
  ]
}
```

- `searchTokens`: 정규화된 소문자(영문)/한글 검색 토큰. CompoundBrowser(Phase 11) 가 fuzzy match 에 사용.
- `inchiKey`: Q8 기본안 "포함". `findCompoundByInchiKey` O(1) 룩업을 가능하게 한다. ~28 bytes × 2500 ≈ 70 KB 비압축, gzip ≈ 15 KB 증가.
- **`entries` 정렬 키 (안정 정렬)**: `(priority ASC, cid ASC, name.en ASC)`. 즉 priority 가 가장 낮은 것부터, 동점이면 CID 작은 순, 그다음 영문명 사전순. 결정적 매니페스트 출력을 보장한다. Phase 11 CompoundBrowser 는 추가 정렬 없이 이 순서를 기본값으로 사용.
- **`categories` 키**: `CompoundCategory` 유니온의 14개 키를 **전수 포함**. 큐레이션이 비어 있는 카테고리는 `{ "chunks": [], "count": 0 }` 로 기록 — `Record<CompoundCategory, CategoryEntry>` 타입과 정합.
- 매니페스트 자체는 **eager 번들**(D6). 예상 크기: 2500 엔트리 × 평균 ~140 bytes (inchiKey 포함) ≈ 350 KB 비압축, gzip 75–95 KB.

### 4.6 메타 파일

**`src/data/compounds/compounds.meta.json`**

```json
{
  "collectedAt": "2026-04-24T09:00:00Z",
  "pubchemApiVersion": "PUG REST",
  "rdkitVersion": "<from @rdkit/rdkit package.json at collection time>",
  "normalizeSchemaVersion": 1,
  "embedSeed": 12648430,
  "totals": {
    "requestedCids": 2500,
    "successful": 2487,
    "droppedParse": 5,
    "droppedEmbed": 8
  },
  "dropped": [
    { "cid": 123456, "reason": "SmilesSyntax", "detail": "..." },
    { "cid": 789012, "reason": "EmbedFailed", "detail": "ETKDG 3 retries failed (primary + 2 random seeds)" }
  ],
  "seedFiles": [
    { "path": "seeds/inorganic-common.tsv", "entries": 80 }
  ],
  "koNameCoverage": { "total": 2487, "withKo": 1840, "withoutKo": 647 }
}
```

### 4.7 시드 파일 포맷

**`scripts/pubchem-fetch/seeds/{category}.tsv`** — 탭 구분 값, 사람이 편집.

```tsv
# priority	cid	nameEn	nameKo	note
0	962	Water	물
0	280	Carbon dioxide	이산화탄소
1	222	Ammonia	암모니아
2	784	Hydrogen peroxide	과산화수소
```

- **필수 컬럼**: `priority`, 그리고 `cid` **또는** `nameEn` 중 하나 이상.
- `cid` 가 있으면 직접 조회; 없고 `nameEn` 만 있으면 `/compound/name/{name}/cids/JSON` 으로 CID 해소 후 저장.
- `nameKo` 가 있으면 수동 큐레이션 명칭으로 간주 (D4 의 2순위).
- `note` 는 큐레이터 메모 (스크립트는 무시).
- **주석**: `#` 시작 라인은 무시.

### 4.8 `formula-map.generated.ts` 스키마

Phase 03 §6.4 의 인계. 자동 생성 파일.

```ts
// src/engine/parser/formula-map.generated.ts  (자동 생성, 사람 편집 금지)
// Generated by scripts/pubchem-fetch at 2026-04-24T09:00:00Z
// DO NOT EDIT MANUALLY

export const FORMULA_MAP_GENERATED: ReadonlyMap<string, { smiles: string; cid: number; priority: number }> =
  new Map([
    // Hill key -> representative SMILES from the highest-priority compound sharing this formula
    ['C6H12O6', { smiles: 'OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O', cid: 5793, priority: 20 }],
    ['C2H4O2',  { smiles: 'CC(=O)O', cid: 176, priority: 5 }],
    // ...
  ]);
```

- 병합 순서: **수동 `formula-map.ts` 가 항상 우선** (§6.8).
- **생성 규칙 (결정적)**: 같은 Hill 키를 공유하는 후보들 중 **`(priority ASC, cid ASC)`** 로 정렬한 *첫 번째* 1개를 선택. 즉 priority 가 가장 낮은 것을 먼저, priority 동률이면 CID 가 가장 작은 것. **동일 빌드 입력 (시드 + 캐시) → 항상 동일 출력** 을 보장한다 (§10 #11 byte-identical 재현성과 일관). `name.en` 등 다른 키는 결정에 영향을 주지 않는다 (cid 가 이미 unique 해 tie-break 가 종결되므로). 향후 추가 정렬 키는 본 §4.8 + §6.8 동시 갱신 필요.

---

## 5. 퍼블릭 API / 인터페이스

`src/data/compounds/index.ts` 가 유일한 공개 진입점. JSON 파일 직접 import 는 **ESLint `no-restricted-paths`** 로 차단. `data/compounds/index.ts` 의 공개 API 를 호출할 수 있는 레이어는 **`services/*`, `stores/*`, `panels/*`, `viewport/*`, `app/*`** 에 한정. **`chemistry/*` 레이어는 `data/compounds` 를 import 할 수 없다** (architecture §4.1 의 `chemistry ◀── data` 방향 규칙: data 가 chemistry 의 타입을 참조하는 관계이며 역방향은 금지). 따라서 도메인 레이어는 `Compound` 타입만 정의하고, 실제 화합물 데이터 소비는 서비스/스토어 이상에서만.

### 5.1 매니페스트 조회

```ts
// src/data/compounds/index.ts
import type { Compound } from '@/chemistry/compounds/types';
import type { CompoundCategory } from '@/chemistry/compounds/categories';

export interface ManifestEntry {
  /** 본 Phase 가 커밋하는 엔트리는 항상 PubChem CID 를 가진다 (§4.4 불변식). */
  readonly cid: number;
  readonly name: { readonly ko: string | null; readonly en: string };
  readonly formula: string;
  readonly inchiKey: string;            // InChIKey — findCompoundByInchiKey 룩업 용
  readonly category: CompoundCategory;
  readonly chunk: string;               // 청크 파일명 (경로 접두사 없음)
  readonly priority: number;
  readonly molecularWeight: number;
  readonly searchTokens: ReadonlyArray<string>;
}

export interface CategoryEntry {
  readonly chunks: ReadonlyArray<string>;
  readonly count: number;
}

export interface CompoundManifest {
  readonly version: string;             // ISO 8601
  readonly totalCompounds: number;
  /** 매니페스트 생성 시 **CompoundCategory 유니온의 14개 키를 전수 포함**한다. 큐레이션이
   * 비어 있는 카테고리는 `{ chunks: [], count: 0 }` 로 기록. 따라서 전체 키 접근이 항상
   * 안전하며(`noUncheckedIndexedAccess` 하에서도), 런타임 UI 는 모든 카테고리를 나열할 수 있다. */
  readonly categories: Readonly<Record<CompoundCategory, CategoryEntry>>;
  readonly entries: ReadonlyArray<ManifestEntry>;
}

export function getCompoundManifest(): CompoundManifest;
```

### 5.2 청크 로더

```ts
/**
 * 청크를 동적 import 로 로드. 동일 chunk 재호출은 메모화된 Promise 공유.
 * 반환 배열은 읽기 전용, CID 오름차순.
 */
export function loadCompoundChunk(chunk: string): Promise<ReadonlyArray<Compound>>;

/**
 * 카테고리 전체 로드 (카테고리 내 모든 청크의 평탄한 배열).
 */
export function loadCategory(category: CompoundCategory): Promise<ReadonlyArray<Compound>>;

/**
 * CID 로 단일 화합물 조회. 매니페스트 룩업 O(1) → 청크 로드 (메모화) → 해당 엔트리.
 * 매니페스트에 없으면 `null`. (런타임 PubChem fetch 는 Phase 05 책임)
 */
export function findCompoundByCid(cid: number): Promise<Compound | null>;

/**
 * InChIKey 로 조회. 매니페스트 `entries[*].inchiKey` 의 역인덱스를 메모화해 O(1) 조회 →
 * 해당 청크 로드 (메모화) → 엔트리 반환.
 */
export function findCompoundByInchiKey(inchiKey: string): Promise<Compound | null>;
```

### 5.3 검색 지원 (순수 함수)

매니페스트를 주어진 쿼리로 필터링. 실 UI(Phase 11) 는 이 함수 위에 자동완성을 구축.

```ts
export interface CompoundSearchOptions {
  readonly query: string;                          // trimmed
  readonly categories?: ReadonlyArray<CompoundCategory>;
  readonly limit?: number;                         // 기본 20
}

export function searchCompoundManifest(
  opts: CompoundSearchOptions,
): ReadonlyArray<ManifestEntry>;
```

- **엣지 케이스**: 쿼리가 어떤 토큰과도 매칭되지 않으면 빈 배열을 반환한다. `opts.categories` 가 `undefined` 또는 빈 배열이면 **모든 카테고리 허용** 과 동일하게 처리 (사용자가 카테고리 필터를 의도적으로 제거한 상태). `query` 가 빈 문자열이면 `priority` 오름차순 상위 `limit` 개를 반환 (CompoundBrowser 초기 표시).
- 매칭 규칙: `searchTokens` 의 소문자/한글 정규화 비교, 접두어·부분일치 모두 허용, `priority` 오름차순 정렬.
- **매칭 알고리즘 (안정 정렬 기준)**:
  1. 쿼리 정규화: 소문자화 + NFC + 좌우 공백 제거. 숫자/알파벳/한글 외 문자는 공백으로 치환.
  2. 각 엔트리의 `searchTokens` 에 대해 아래 점수 중 최댓값을 엔트리 점수로 채택:
     - 완전 일치(`token === query`): **100**
     - 토큰 접두 일치(`token.startsWith(query)`): **60**
     - 쿼리 접두 일치(`query.startsWith(token)` 이면서 token 길이 ≥ 2): **40** — 사용자가 토큰보다 긴 문자열을 치는 경우(예: "wate" → "water" 토큰에서 +40 대신, 반대 방향은 이쪽)
     - 부분 포함(`token.includes(query)`): **20**
     - 그 외: 후보에서 제외
  3. **최종 정렬 키(안정 정렬)**: `(-점수, priority, cid, enName)`. 동점 시 `priority` 낮은 쪽, 그다음 `cid` 낮은 쪽, 마지막으로 영문명 사전순. 결정적 출력 보장.
  4. `limit` 적용 (기본 20). 카테고리 필터는 점수 계산 이전에 적용.
- **유니코드**: 한글은 NFC 정규화만 하고 자모 분해/분리 검색은 지원하지 않는다 (비목표 — Phase 11 에서 필요 시 확장). 초성 검색("ㅁ" → "물") 은 본 Phase 에서 제공하지 않음.

---

## 6. 핵심 로직 / 전략

### 6.1 스크립트 실행 흐름

```
[seeds/*.tsv]
     │
     ▼
 loadSeeds()                       ── TSV 파싱, cid/name 해소, 중복 제거
     │
     ▼
 resolveNameToCid()                ── nameEn only 엔트리 → PubChem 이름 조회
     │  (rate-limited)
     ▼
 fetchProperties(cid[])            ── 배치 API: /property/CanonicalSMILES,...,XLogP,MolecularFormula,IUPACName
     │
     ▼
 fetchSynonyms(cid[])              ── /synonyms/JSON (상위 5개만 보존)
     │
     ▼
 fetchPubchem3DSDF(cid[])          ── /SDF?record_type=3d, 404 는 빈 값
     │
     ▼
 normalize()                       ── PubChem → Compound (properties 매핑)
     │
     ▼
 validateAndEmbed()                ── Phase 03 parseSmiles + (PubChem 3D ?? embed3D)
     │  (병렬도 제한, 메모리 상한 고려)
     ▼
 applyKoreanNames()                ── ko-names/curated.tsv + seed 오버라이드 → name.ko
     │
     ▼
 assignPriorityAndCategory()       ── 시드 파일 기준 + 기본 규칙
     │
     ▼
 chunkByCategory()                 ── §6.6 청크/샤드 분할
     │
     ▼
 writeOutputs()                    ── compounds/*.json, manifest.json, compounds.meta.json,
     │                                formula-map.generated.ts
     ▼
 reportDiff()                      ── 이전 커밋과의 diff 요약 stdout
```

- 실행: `pnpm run fetch-compounds` (또는 `tsx scripts/pubchem-fetch/index.ts`).
- 모든 단계는 **멱등**하다. 실패 시점에 `.cache/pubchem/` 상태를 보존하고 재실행 시 이어 진행.
- 스크립트는 **파일을 덮어쓰기만** 한다. **자동 커밋 금지** — 커밋 판단은 사람 (Phase 02 패턴 재활용).

### 6.2 Rate limit 준수 (D7)

- 토큰 버킷: 용량 5, 리필 4 tokens/sec. 평균 4 req/s, 버스트 5.
- 큐잉: 각 PubChem 호출은 버킷 토큰 1개 소비. 토큰 없으면 대기.
- 429/503 응답: 지수 백오프(1s, 2s, 4s, 8s, max 16s) 재시도 3회. 그래도 실패면 `.cache/` 미저장 + 다음 엔트리로 진행 (스킵 카운트 증가).
- 로컬 캐시 히트는 버킷을 소비하지 않는다 (순수 로컬 I/O).

### 6.3 PubChem 엔드포인트 계약

| 용도 | 엔드포인트 | 응답 |
|------|-----------|------|
| 이름 → CID | `GET /compound/name/{name}/cids/JSON` | `{ IdentifierList: { CID: number[] } }` |
| 속성 배치 | `GET /compound/cid/{cids}/property/MolecularFormula,MolecularWeight,CanonicalSMILES,IsomericSMILES,InChI,InChIKey,IUPACName,XLogP,Complexity/JSON` | `{ PropertyTable: { Properties: [...] } }` |
| 동의어 | `GET /compound/cid/{cid}/synonyms/JSON` | `{ InformationList: { Information: [{ Synonym: string[] }] } }` |
| 3D SDF | `GET /compound/cid/{cid}/SDF?record_type=3d` | `text/plain` SDF 블록 (없으면 404) |
| 2D SDF (fallback 정보용) | `GET /compound/cid/{cid}/SDF?record_type=2d` | 필요 시 보조 |
| 물성(녹는점 등) | `GET /compound/cid/{cid}/JSON` (PUG View 가 아닌 PUG REST) → Section 파싱은 복잡 | **비목표** — Phase 04 는 REST `/property` 에서 제공하는 XLogP/Complexity 까지만. 녹는점/끓는점/밀도/상태/용해도는 **수동 큐레이션 파일** (`scripts/pubchem-fetch/physical/curated.tsv`) 에서 보강 |

> 녹는점/끓는점 등 "물성(`CompoundProperties.meltingPointK` 등)" 은 PubChem REST 의 단일 속성으로 제공되지 않는다. 본 Phase 는 **수동 큐레이션 TSV** 를 1차 소스로 삼고, 미커버 항목은 `null` 로 둔다. 향후 PUG View Section 파서 추가는 확장 여지 (§11 열린 질문).

### 6.4 Node 환경의 RDKit 초기화 및 Phase 03 재사용 경계

Phase 03 의 `getRdkit()` 은 브라우저 경로(`import.meta.env.BASE_URL` 기반 WASM fetch) 를 사용한다 (Phase 03 §6.2). Node 빌드타임 스크립트는 이를 직접 호출할 수 없다. 본 Phase 는 다음 전략을 택한다.

1. **Node 전용 RDKit 로더** (`scripts/pubchem-fetch/pubchem/rdkit-node.ts`):
   - `@rdkit/rdkit` 의 `loadRdkitModule()` 를 Node 환경에서 직접 호출해 RDKit 인스턴스 획득.
   - 동일 인스턴스를 단일 프로세스 내에서 재사용 (lazy init, 실패 시 프로세스 종료 + 명시적 에러).
2. **Phase 03 `RdkitBackend` 인터페이스 (§6.8) 의 Node 구현** 을 본 Phase 가 추가:
   - `createNodeRdkitBackend(): RdkitBackend` 팩토리 — Phase 03 §6.8 의 5개 필수 메서드 (`parseSmiles`, `parseInchi`, `parseSdfBlock`, `embed`, `toCanonical`) 를 Node RDKit 위에서 실현.
   - Phase 03 의 **순수 변환 모듈** (`engine/parser/toDomain`, `engine/parser/stereo`, `engine/parser/normalize`, `engine/parser/formula`, `engine/rdkit/canonical` 의 순수 함수) 는 Phase 03 §6.8 의 명문화된 규약에 따라 RDKit 인스턴스에 강결합되지 않으며, `RdkitBackend` 를 인자로 받아 동작한다. 본 Phase 의 Node 백엔드는 그 형태를 그대로 활용한다.
3. **스크립트 호출 경로**:
   - `validateAndEmbed(comp, backend)` 는 `backend.parseSmiles()` / `backend.embed()` / `backend.parseSdfBlock()` 를 호출한다 (Phase 03 의 브라우저 전용 함수는 호출하지 않는다).
   - 이는 브라우저 전용 경로를 스크립트가 건드리지 않도록 하는 방어선.
4. **SDF 파싱** (Phase 03 §6.8 인터페이스의 `parseSdfBlock` 활용):
   - `parseSdfBlock(sdf: string): Promise<Result<ParsedMol, ParseError>>` 는 Phase 03 §6.8 인터페이스의 **필수 메서드**. 본 Phase 의 Node 백엔드는 RDKit.js 의 SDF/Molblock 수용 API 위에 이를 구현한다 (구현 단계에서 `get_mol(molblock)` 자동 감지 경로 또는 별도 molblock 전용 함수 중 현 버전에서 동작하는 쪽의 정확한 시그니처를 확인 — 본 설계는 API 존재에만 의존하며 구체 서명은 구현 PR 에서 확정). 판별 입력은 문자열 내 개행과 `M  END` 토큰의 유무.
   - 파싱 결과 → Phase 03 `toDomain` 으로 `Molecule` 변환. 좌표는 SDF 가 제공한 값을 그대로 사용, 별도 `embed` 불필요.
5. **브라우저 런타임 영향 없음**:
   - `scripts/` 는 Vite 번들에 포함되지 않으므로 Node 전용 초기화 코드가 브라우저 번들에 누출될 위험은 없다 (architecture §4 의 레이어 경계, §7.1 의 스크립트 독립성).

이 경계가 정해진 뒤에야 아래 §6.5 의 "SMILES / 3D 결정성" 이 성립한다.

### 6.5 SMILES / 3D 결정성

- **SMILES 입력 소스 — 반드시 `IsomericSMILES`**: PubChem `CanonicalSMILES` 는 **입체화학(R/S, E/Z) 정보를 제거** 하므로 입력으로 사용하면 안 된다. 본 Phase 는 `IsomericSMILES` 를 1차 소스로 채택한다. 이 선택은 architecture §3.1(4) "입체화학 정보는 파싱/표시" 및 Phase 03 §4.1 `StereoAnnotations` 와 정합. 글루코스의 4개 입체중심·키랄 의약 분자·E/Z 알켄이 보존된다.
- **SMILES 정규화 파이프라인**: `IsomericSMILES` → Phase 03 `parseSmiles` → `toCanonicalSmiles` 로 **RDKit 캐노니컬** 재산출. PubChem 의 캐노니컬 규약은 RDKit 과 토큰 순서가 다를 수 있으므로 저장 SMILES 는 RDKit canonical 로 통일. RDKit `toCanonicalSmiles` 는 **입력에 입체 정보가 있을 때 이를 보존**하므로 정규화 후에도 R/S·E/Z 유지.
- **InChI / InChIKey 정규화 파이프라인**: PubChem 응답의 `InChI` / `InChIKey` 필드를 **우선 사용**. 두 필드 중 하나라도 누락되면 (드물게 발생) phase-03 `toInchi(parsedMol)` 로 역산하여 양쪽 모두 채운다. 빌드타임과 런타임이 동일 RDKit 버전 (`compounds.meta.json.rdkitVersion`) 을 공유하므로, phase-05 가 동일 CID 를 PubChem 에서 다시 받아 정규화해도 *byte-identical* InChIKey 가 산출된다 (캐시 역조회 정합성의 핵심). RDKit 버전 업그레이드 시 InChIKey 가 변할 수 있으나, 이는 `rdkitVersion` 갱신 + 데이터 재수집을 강제하는 PR 단위 변화로 흡수.
- **`CanonicalSMILES` 용도**: 참고용으로만 `.cache/` 에 보관 (디버그 시 PubChem 스트립 비교). `Compound.smiles` 에는 저장하지 않는다.
- **`IsomericSMILES` 미제공 화합물**: 극히 드물지만 PubChem 응답에서 `IsomericSMILES` 가 비어 있으면 `CanonicalSMILES` 로 폴백. 이 경우 `stereo` 는 빈 배열이 된다. 폴백 발생 엔트리의 CID 목록은 `compounds.meta.json.smilesFallbacks: number[]` 에 기록 (리포트용). `Compound` 엔티티 자체에는 폴백 플래그를 추가하지 않는다 (도메인 타입 오염 방지).
- **3D 좌표 소스 (D5)**:
  1. PubChem 3D SDF 가 있으면: SDF 블록을 `backend.parseSdfBlock(sdf)` (phase-03 §6.8) 로 파싱 → `toDomain` → `Molecule`. `coordinateSource: 'pubchem-3d'`.
  2. 없으면: `embed3D(parsedMol, { seed: EMBED_SEED_PRIMARY })` (phase-03 §6.5 의 상수 import). `coordinateSource: 'rdkit-etkdg'`.
  3. **재임베드 정책 (D9 상세화)**:
     - **시도 1**: `seed = EMBED_SEED_PRIMARY` (= `0xC0FFEE`, phase-03 §6.5).
     - **시도 2**: 1차 실패 시 `seed = crypto.getRandomValues(new Uint32Array(1))[0]` (랜덤). `useRandomCoords: true` 로 ETKDG 재초기화.
     - **시도 3**: 2차 실패 시 동일 방식으로 새 랜덤 시드 1회 더.
     - 3회 모두 `EmbedFailed` → **해당 화합물 드롭** + `compounds.meta.json.dropped[]` 에 `{ cid, reason: 'EmbedFailed', detail: 'ETKDG 3 retries failed (primary + 2 random seeds)' }` 기록. 시드 파일에서는 제거하지 않음 (재시도 가능성 보존).
     - **결정성 영향**: 1차 실패가 발생하면 2~3차의 랜덤 시드는 매 실행마다 다르므로 *최종 좌표가 RDKit 버전 내에서도 비결정적* 일 수 있다. 이 경우 §10 #11 의 byte-identical 보장은 "실패 → 드롭" 분기에 한정 (드롭 사실은 결정적이나 실패 시점의 좌표는 저장 안 함). 1차 성공 케이스는 항상 결정적.
- **좌표 결정성 검증**: 동일 입력에 대해 스크립트를 두 번 돌리면 `defaultMolecule.atoms[].position` 의 RMSD < 1e-6.

### 6.6 청크/샤드 분할 (D2)

```
카테고리 수집물 ── priority 오름차순 정렬 ─▶ 직렬화 크기 계산 ─▶
   ├── 150 KB 이하 → 단일 파일 `{category}.json`
   └── 초과 → 순서대로 누적, 150 KB 마다 샤드 경계
       (결정성: 카테고리 내 `cid` 오름차순 + priority tie-break)
```

- 샤드 파일명: 3자리 zero-padded 인덱스. `alkanes.001.json`, `alkanes.002.json`.
- **샤드 분할 기준은 priority 가 아닌 cid 오름차순** — priority 로 정렬하면 시드 편집 시 샤드 경계가 요동친다. 매니페스트 정렬은 priority 사용.
- 매니페스트 `categories[category].chunks` 는 샤드 파일명의 오름차순 배열.

### 6.7 한국어 명칭 보강 (D4)

- **`scripts/pubchem-fetch/ko-names/curated.tsv`**:

  ```tsv
  # inchiKey	nameKo
  XLYOFNOQVPJJNP-UHFFFAOYSA-N	물
  KXDHJXZQYMFZSD-UHFFFAOYSA-N	암모니아
  ```

- 키는 **InChIKey** (SMILES 대신, 정규화 안정성). 스크립트가 InChIKey 를 받아 curated 테이블과 머지.
- 시드 파일의 `nameKo` 가 존재하면 **시드 > curated > null** 우선순위.
- **커버리지 리포트**: `compounds.meta.json` 의 `koNameCoverage` 로 표기.
- UI(Phase 11) 는 `name.ko == null` 이면 영문명으로 폴백 + "한국어명 미등록" 안내 tooltip 표시 (Phase 11 책임).

### 6.8 `formula-map.generated.ts` 병합 (Phase 03 인계)

- **생성 대상**: 매니페스트의 모든 엔트리를 `molecularFormula` 로 그룹화 → 그룹 내 `priority` 가 가장 낮은 1개 선택 → Hill 키(§Phase 03 §6.4 정규화) → SMILES 매핑.
- **수동 `formula-map.ts` 와의 병합 규칙**:
  - Phase 03 는 `parseFormula` 에서 **수동 테이블을 먼저** 조회하고, miss 시 `formula-map.generated.ts` 를 조회하도록 변경한다 (Phase 03 §6.4 확장, Phase 04 가 수정 제안).
  - 수동 테이블에 이미 있는 키는 **자동 생성 파일에 포함되지 않는다** (중복 무효화로 유지보수 부담 감소).
  - 자동 생성 파일에서 제외된 키 목록은 `compounds.meta.json.formulaMapSkipped` 에 기록.
- **충돌 감지**: 수동 테이블의 SMILES 와 자동 생성 대표 SMILES 가 다르면 (이성질체 차이) 스크립트가 **경고** 출력. 사람이 수동 테이블 유지 또는 교체 판단.
- **파일 헤더**: "DO NOT EDIT MANUALLY" + 생성 시각 + 커밋 해시 (가능할 때).

### 6.9 런타임 로더 구현 (`src/data/compounds/index.ts`)

`import.meta.glob` 기반으로 각 청크를 빌드타임에 lazy chunk 로 코드 스플리팅. 동적 import 의 가변 경로(`/* @vite-ignore */`) 를 피하고 번들 분석기에서 lazy 판정이 명확함.

```ts
import manifestJson from './manifest.json';  // eager

let manifestCache: CompoundManifest | null = null;
const chunkCache = new Map<string, Promise<ReadonlyArray<Compound>>>();

// 빌드 타임에 번들러가 청크 후보를 모두 인식. 각 파일은 lazy load.
const chunkLoaders = import.meta.glob<{ default: ReadonlyArray<Compound> }>(
  './chunks/*.json',
);
const loaderByChunk = new Map(
  Object.entries(chunkLoaders).map(([path, loader]) => {
    const name = path.replace('./chunks/', '');
    return [name, loader] as const;
  }),
);

export function getCompoundManifest(): CompoundManifest {
  if (!manifestCache) manifestCache = Object.freeze(manifestJson) as CompoundManifest;
  return manifestCache;
}

export function loadCompoundChunk(chunk: string): Promise<ReadonlyArray<Compound>> {
  let p = chunkCache.get(chunk);
  if (!p) {
    const loader = loaderByChunk.get(chunk);
    if (!loader) return Promise.reject(new Error(`Unknown chunk: ${chunk}`));
    p = loader().then((m) => m.default);
    chunkCache.set(chunk, p);
  }
  return p;
}
```

- 테스트에서는 `resetCompoundCache()` 비공개 훅(테스트 export) 으로 `chunkCache` 를 비운다.

### 6.10 Phase 01 타입 파일 수정

- `src/chemistry/compounds/types.ts` 에 `// TODO: Phase 04` 주석을 제거하고 §4.1 필드를 추가.
- `CompoundCategory`, `CompoundProperties`, `CoordinateSource`, `PhysicalState` 를 새 파일 `src/chemistry/compounds/categories.ts` 로 분리.
- Phase 01 타입 파일 수정은 본 Phase 구현 단계의 첫 커밋으로 처리 (다른 Phase 의존성에 영향 없음).

### 6.11 로깅

- 스크립트는 Node 환경이므로 Phase 01 `logger` 대신 **스크립트 전용 reporter** (`scripts/pubchem-fetch/report.ts`) 사용. stdout 가독성 우선.
- 리포트 내용: 진행 카운트, 스킵/재시도, 캐시 히트율, 드롭 목록, 소요 시간, 다음 수동 검토 항목.
- **개인 식별 정보 없음** — 화학 데이터 특성상 민감 문자열 부재. 쿼리명(`nameEn`) 은 로그에 포함.

---

## 7. 파일 / 모듈 레이아웃

```
src/
├── chemistry/
│   └── compounds/
│       ├── types.ts              # Phase 01 확장: Compound + properties
│       └── categories.ts         # CompoundCategory, CompoundProperties 등 (신규)
├── data/
│   └── compounds/
│       ├── index.ts              # 런타임 로더 공개 API
│       ├── manifest.json         # 전체 매니페스트 (eager)
│       ├── compounds.meta.json   # 수집 메타
│       └── chunks/
│           ├── inorganic-common.json
│           ├── alkanes.json
│           ├── biomolecules-basic.001.json
│           ├── biomolecules-basic.002.json
│           └── ... (카테고리별, 필요 시 샤드)
└── engine/
    └── parser/
        └── formula-map.generated.ts  # 자동 생성 (Phase 03 소비)

scripts/
└── pubchem-fetch/
    ├── index.ts                      # CLI 엔트리
    ├── config.ts                     # 상수 (rate limit, 청크 크기, 시드 루트)
    ├── seeds/                        # 사람이 편집하는 시드 파일
    │   ├── inorganic-common.tsv
    │   ├── alkanes.tsv
    │   └── ...
    ├── ko-names/
    │   └── curated.tsv               # InChIKey → 한국어명
    ├── physical/
    │   └── curated.tsv               # InChIKey → {mp, bp, density, state, solubility}
    ├── pubchem/
    │   ├── client.ts                 # rate-limited HTTP 클라이언트
    │   ├── endpoints.ts              # URL 빌더
    │   └── cache.ts                  # .cache/ 파일시스템 캐시
    ├── normalize.ts                  # PubChem → Compound
    ├── validate.ts                   # parseSmiles / embed3D 통합
    ├── chunk.ts                      # 청크/샤드 분할
    ├── manifest.ts                   # manifest.json 생성
    ├── formula-map.ts                # formula-map.generated.ts 생성
    ├── report.ts                     # stdout 리포트
    └── __fixtures__/                 # 테스트용 샘플 응답
        └── pubchem-responses/
```

### 7.1 레이어 가드

- `src/data/compounds/` 의 JSON 은 **`src/data/compounds/index.ts` 외부에서 직접 import 금지** (ESLint `no-restricted-paths`).
- 허용되는 외부 소비자: `src/services/*` (Phase 05), `src/stores/*` (Phase 07), `src/panels/*` (Phase 11), `src/viewport/*`, `src/app/*`.
- **`chemistry/*` 레이어는 `data/compounds` 를 import 할 수 없다** — architecture §4.1 의 `chemistry ◀── data` 방향 규칙. 도메인 레이어는 `Compound` 타입만 정의하고, 화합물 데이터 소비는 서비스/스토어 이상에서.
- `data/compounds/index.ts` 가 `@/chemistry/compounds/types` 에서 `Compound` 타입을 import 하는 것은 정상 (data → chemistry 방향).
- `scripts/` 는 `src/` 의 일부 모듈(`engine/parser`, `engine/geometry`, `chemistry/*`) 을 import 할 수 있으나, 역방향은 금지.

### 7.2 공개 경계

- 외부 레이어가 사용하는 심볼은 `@/data/compounds` 의 `index.ts` 재export 에 한정.
- `chunks/*.json`, `manifest.json` 에 대한 직접 경로 import 는 금지 패턴.

---

## 8. 테스트 계획

### 8.1 유닛 — 스크립트 모듈 (Vitest)

`tests/unit/scripts/pubchem-fetch/`:

1. **Rate limit 토큰 버킷**: 6개 연속 요청 시 5번째까지 즉시, 6번째는 ~250ms 대기 (fake timers).
2. **429 재시도**: 첫 호출 429 → 1s 대기 → 재시도 200. 호출 횟수 스파이.
3. **이름 → CID 해소**: mock response 로 `water` → 962.
4. **정규화**: PubChem 속성 + SDF → `Compound` 매핑의 대표 케이스 3종 (물, 벤젠, NaCl).
5. **청크 분할**: 200KB 가상 카테고리 → 150KB 상한 기준 2개 샤드로 분리됨. 파일명·순서 검증.
6. **시드 파서**: TSV 주석/빈 줄/중복 CID/nameEn-only 엔트리 처리.
7. **한국어명 머지**: curated + seed 오버라이드 + 폴백.

### 8.2 유닛 — 런타임 로더

`tests/unit/data/compounds/loader.test.ts`:

1. `getCompoundManifest()` 가 매니페스트 JSON 과 구조적 일치.
2. `loadCompoundChunk('alkanes.json')` 2회 호출 시 dynamic import 가 1회만 (스파이).
3. `findCompoundByCid(962)` → Water 반환, `findCompoundByCid(-1)` → null.
4. `searchCompoundManifest({ query: 'wat', limit: 5 })` 에 Water 가 포함.
5. `searchCompoundManifest({ query: '물' })` 한글 매칭.

### 8.3 통합 — 파이프라인 스냅샷

`tests/unit/scripts/pubchem-fetch/e2e.test.ts` (mock PubChem 전체 응답 고정):
- 5종 화합물의 시드 → 매니페스트/청크 2개/메타 파일이 예상 바이트별 일치 (스냅샷).

### 8.4 데이터 무결성 (CI)

`tests/unit/data/compounds/integrity.test.ts` — **실제 생성된 `manifest.json` / `chunks/*.json` 에 대해**:

1. 매니페스트 `totalCompounds === 합계(categories[*].count) === 합계(entries 의 개수)`.
2. 매니페스트 `entries[*].chunk` 가 해당 카테고리 `chunks` 배열에 포함.
3. 모든 청크 파일명이 매니페스트 `categories[*].chunks` 배열 중 정확히 하나에 등장.
4. `src/data/compounds/chunks/` 디렉터리의 실제 파일 목록이 `categories[*].chunks` 의 union 과 완전 일치 (고아 파일·누락 파일 금지).
5. 각 청크 엔트리의 `cid` 가 오름차순.
6. 각 청크 엔트리의 `category` 가 파일명(카테고리) 과 일치.
7. 모든 엔트리의 `smiles` 가 Phase 03 `parseSmiles` 로 `Result.ok` 반환 (CI 에서 RDKit 로드 후 샘플 200개 스팟체크 — 전수 검증은 E2E 과중, 본 샘플링은 확정적 시드 기반).
8. `defaultMolecule.atoms[].elementNumber` 가 `isValidElementNumber` 통과.
9. `formula-map.generated.ts` 의 어떤 키도 수동 `formula-map.ts` 와 중복되지 않음.
10. 매니페스트 `version` ISO 8601 형식.

### 8.5 번들 분석 (E2E / 빌드 검증)

`tests/build/compounds-bundle.test.ts` (Playwright 외 빌드 결과물 검사):

1. `pnpm build` 후 `dist/assets/` 에서 `compounds/chunks/*.json` 이 **별도 번들 청크**로 존재 (lazy chunk 해시 파일).
2. 초기 번들(`index-*.js`) 에 청크 원문 바이트가 포함되지 않음 (grep check).
3. 매니페스트는 초기 번들 또는 작은 eager chunk 에 존재.

### 8.6 레이어 가드 검증

- `data/compounds/chunks/` 를 `index.ts` 외부에서 import 하면 `pnpm lint` 실패 (수동 1회 확인).
- `chemistry/compounds/` 안에서 `data/compounds` 를 import 시 lint 실패.

---

## 9. 리스크 및 대안

| # | 리스크 | 영향 | 완화 |
|---|--------|------|------|
| R1 | PubChem API 응답 스키마 변경 | 중 | `zod` 스키마로 빌드타임 검증. 실패 시 명시적 에러 + 스크립트 실패(커밋 차단) |
| R2 | Rate limit 초과로 429 반복 | 중 | D7 의 4 req/s 여유 + 지수 백오프 3회. 실패 엔트리는 `.cache/` 스킵하고 계속 진행, 종료 리포트에 포함 |
| R3 | PubChem 3D SDF 미제공 화합물 비율이 예상보다 높음 | 중 | Phase 03 `embed3D` 로 대체. 대부분의 교과 화합물은 3D 제공됨을 샘플 체크 (Phase 04 착수 시 20–50종 사전 조사) |
| R4 | ETKDG 임베드 실패 (이온/라디칼/거대 분자) | 중 | 2회 재시도 → 드롭 + 리포트. 큐레이터가 시드에서 제거하거나 PubChem 3D 보유 CID 로 교체 |
| R5 | 한국어명 커버리지 저조 | 중 | D4 기본안 수용: `null` 허용 + UI 폴백. 커버리지 목표 초기 60% → 향후 수동 보강 |
| R6 | `formula-map.generated.ts` 가 Phase 03 의 수동 이성질체 선택을 뒤흔들 위험 | 중 | 수동 우선 병합 규칙 (§6.8). 자동 생성에서 수동 키 제외, 충돌 감지 시 경고 |
| R7 | 청크 크기 상한 150 KB 가 일부 카테고리에서 과도하게 많은 샤드를 만듦 | 하 | Phase 14 성능 계측 후 조정. 본 Phase 는 보수적 상한 유지 |
| R8 | CID 가 시간이 지나며 PubChem 에서 병합/제거될 가능성 | 하 | 수집 시 CID → IUPAC 역검증. 삭제된 CID 는 리포트 후 다음 시드 편집 반영 |
| R9 | 동일 Hill 키의 이성질체 다수(예: 당류) 로 인한 `formula-map.generated.ts` 대표 선택의 비직관성 | 중 | 수동 `formula-map.ts` 에서 대표를 먼저 고정. 자동 생성이 이를 덮어쓰지 않음 |
| R10 | 수집된 캐노니컬 SMILES 와 기존 Phase 03 기대값이 RDKit 버전 차이로 달라짐 | 중 | `compounds.meta.json` 의 `rdkitVersion` 기록. 버전 업그레이드 시 재생성 + 골든 갱신 PR |
| R11 | 시드 파일의 실수로 같은 CID 가 여러 카테고리에 등장 | 하 | 스크립트 초기 단계에서 중복 탐지 → 실패 (한 CID = 한 카테고리) |
| R12 | 매니페스트가 예상보다 커서 초기 번들 예산 초과 | 하 | 빌드 후 gzip 크기 측정 테스트(§8.5). D6 fallback 경로로 lazy 전환 |

---

## 10. 완료 기준 (Definition of Done)

1. `pnpm typecheck && pnpm lint && pnpm test -- --run` 전부 통과.
2. `scripts/pubchem-fetch/` 실행으로 아래 산출물이 결정적으로 생성됨:
   - `src/data/compounds/manifest.json`
   - `src/data/compounds/chunks/*.json` (카테고리별 ≥ 1 청크)
   - `src/data/compounds/compounds.meta.json`
   - `src/engine/parser/formula-map.generated.ts`
3. 매니페스트 `totalCompounds` 가 **D1 목표(2500 ± 300) 범위** 이내.
4. **카테고리 수 = D3 의 14** 이고 `categories` 키가 `CompoundCategory` 유니온과 정확히 일치.
5. 모든 청크 엔트리의 `category` 가 파일명과 일치하고, CID 오름차순이며, 고아 청크·누락 청크 없음 (§8.4 통합 테스트 통과).
6. **SMILES 라운드트립 검증 (CI 기본: 샘플링)**: 결정적 시드 기반 샘플 **200개의 `smiles`** 가 Phase 03 `parseSmiles` 로 `Result.ok`; 그중 **샘플 20개**가 `embed3D` 성공 및 좌표 재현성(RMSD < 1e-6) 확인. 전수 검증 여부는 §11 Q7 에서 결정하며, 본 기본안은 "샘플링 채택". 기본안이 변경되면 본 항목도 "전수 2487개 모두 `parseSmiles` 통과" 로 갱신.
7. **한국어명 커버리지** ≥ 60% (초기 목표). `compounds.meta.json.koNameCoverage` 로 기록.
8. `formula-map.generated.ts` 가 존재하며 수동 `formula-map.ts` 의 어떤 키와도 중복되지 않음 (§8.4 #9 통과).
9. `pnpm build` 결과에서 `compounds/chunks/*.json` 이 **별도 lazy chunk** 로 분리되며 초기 번들(gzip) 예산 500 KB 를 초과하지 않음 (§8.5 통과).
10. `data/compounds/chunks/` 를 `data/compounds/index.ts` 외부에서 import 할 경우 `pnpm lint` 실패 (수동 1회 확인).
11. 동일 시드·동일 캐시로 스크립트를 두 번 실행 시 **모든 산출 파일 byte-identical** — 단, `compounds.meta.json` 의 **`collectedAt` 필드는 비교에서 제외** (실행 시각 불가피 변화). `dropped[*].detail` 은 **동일 RDKit 인스턴스/버전 내에서 결정적** 이지만, RDKit 패키지 업그레이드 시에는 변동을 허용한다 (버전 변경은 수집 재실행이 예상되는 지점). 재현성 스크립트(`scripts/pubchem-fetch/verify-determinism.ts`) 가 `collectedAt` 을 마스킹한 후 diff. 그 외 모든 출력 파일(매니페스트·청크·`formula-map.generated.ts`) 은 정확히 byte-identical.
12. 스크립트가 PubChem API 호출 없이(`--offline` 플래그로 캐시만 사용) 기존 산출물을 재생성 가능.
13. **Schema 동기 검증**: 빌드 산출물(`compounds.meta.json.normalizeSchemaVersion`) 의 값이 빌드 시점 `src/engine/pubchem/normalize.ts` 의 `NORMALIZE_SCHEMA_VERSION` 상수와 정확히 일치한다. CI step `scripts/check-schema-version.ts` 가 (a) 빌드 스크립트가 실제로 *공용* `src/engine/pubchem/normalize.ts` 를 import 하는지 (`scripts/pubchem-fetch/normalize.ts` 가 thin wrapper 임을 정적 검증), (b) 매니페스트 메타와 상수 값이 일치하는지 검증한다. 한쪽만 bump 되면 CI 실패. 이 검증은 phase-05 §10 (DoD) 의 schemaVersion-guard 와 짝을 이룬다.

---

## 11. 열린 질문 (User Decision Required)

1. §3.3 D1–D9 기본안 수용 여부 — 특히 D1 목표 수(2500), D2 청크 상한(150 KB), D5 3D 소스 우선순위.
2. **카테고리 분류 (D3)**: 14개 카테고리 기본안에 추가/분할이 필요한지. 예:
   - `organometallic-basic` 별도 카테고리 신설?
   - `polymers-monomers-basic` 별도?
   - `radicals-reactive-intermediates` 별도 (반응 엔진 Phase 06 와 연계 시)?
3. **물성 수집 범위**: `CompoundProperties` 의 5개 필드(mp, bp, density, state, solubility, logP) 가 충분한지, 또는 **산해리상수(pKa)** / **증기압** 등을 초기부터 포함해야 하는지.
4. **매니페스트 검색 토큰의 CAS 번호/약칭 포함**: 자주 쓰이는 약어(e.g., "DMSO", "THF", "EDTA") 를 `searchTokens` 에 수동 보강할지. 기본안: 시드 파일의 `synonyms` 열을 옵션으로 추가.
5. **한국어명 커버리지 목표**: 초기 60% 기본안이 적절한지, 또는 "수동 큐레이션 완료까지 Phase 04 를 닫지 않음" 의 기준을 채택할지.
6. **CI 에서 PubChem 실호출 테스트 여부**: 기본안은 모두 **mock 기반**. 월 1회 cron 으로 실호출 스모크 테스트를 돌릴지 여부(네트워크 불안정 리스크 vs 스키마 변경 조기 감지).
7. **샘플 SMILES/임베드 전수 검증**: DoD #6 샘플 200/20 대신 **전수 검증** 을 CI 에서 수행할지. 전수 시 CI 소요 약 3–5분 증가 예상. 기본안: 샘플링.
8. **매니페스트에 InChIKey 포함**: `findCompoundByInchiKey` 를 O(1) 로 만들려면 매니페스트 엔트리에 `inchiKey` 추가 필요 (크기 + ~28 bytes × 2500 ≈ 70 KB 비압축, gzip ~15 KB 증가). 기본안: 포함.
9. **Phase 03 확장 — `parseFormula` 의 2단 룩업**: §6.8 에서 제안한 "수동 먼저 → generated fallback" 으로 Phase 03 구현에 작은 수정이 필요. 이 변경을 Phase 04 구현 시 함께 수행할지, Phase 03 재개정 PR 로 분리할지. (※ `RdkitBackend` Node 구현·`parseSdfBlock` 메서드는 본 Phase 가 추가하지만, **인터페이스 자체는 phase-03 §6.8 의 필수 메서드로 정식 명문화** 되어 있으므로 별도 인터페이스 변경 PR 은 필요하지 않다.)

---

## 12. 다음 Phase 로의 인계 (Hand-off)

- **Phase 05 (Runtime Data Layer)**:
  - `getCompoundManifest()` / `loadCompoundChunk()` 를 래핑하여 `services/compounds` 서비스로 노출할 수 있다 (또는 stores 에서 직접 사용).
  - 매니페스트 miss 시 **런타임 PubChem fetch** + IndexedDB 캐시는 Phase 05 가 구축. 본 Phase 의 로더 API 와 동일한 `Compound` 타입을 반환.
  - 본 Phase 의 `.cache/pubchem/` 과 Phase 05 의 IndexedDB 캐시는 **독립** — 네이밍 충돌 없음.
- **Phase 06 (Reaction Engine)**:
  - 반응 규칙이 참조하는 반응물/생성물 구조를 본 Phase 매니페스트에서 해소 (이름 또는 CID 기반).
  - Reaction SMARTS 적용 결과의 `Compound` 화는 Phase 06 내부에서 수행하며, 본 Phase 의 데이터셋은 **입력 후보 풀** 로만 사용.
- **Phase 07 (Stores)**:
  - `moleculeStore.loadCompound(cid)` / `loadCompoundByName(query)` 액션이 `findCompoundByCid` / `searchCompoundManifest` 를 호출.
- **Phase 08 (Rendering)**:
  - `Compound.defaultMolecule.atoms[].position` 을 그대로 소비. `coordinateSource` 는 표시/디버그 용도.
- **Phase 11 (Panels — CompoundBrowser)**:
  - 매니페스트의 `priority` 오름차순이 기본 정렬.
  - `searchTokens` 기반 자동완성.
  - `name.ko == null` 시 영문명 폴백 + tooltip.
- **Phase 13 (Export)**:
  - `toSdfBlock(compound.defaultMolecule)` (Phase 03) 으로 SDF 내보내기.
- **Phase 14 (Performance)**:
  - 매니페스트가 초기 번들 예산을 압박하면 lazy 전환. 청크 분할 크기 상한도 재조정.
- **Phase 03 (소급 수정)**:
  - `parseFormula` 의 룩업 순서에 `formula-map.generated.ts` 추가 (수동 테이블 fallback). Phase 04 구현 PR 에 포함하거나 독립 PR.

---

*문서 버전: 0.1 (초안)*
*작성일: 2026-04-23*
