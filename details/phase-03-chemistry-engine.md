# Phase 03 — Chemistry Engine (RDKit)

> 이 문서는 `architecture.md` §13 **Phase 03** 의 상세 설계서이다. Phase 01(공용 타입·레이어 경계·CI), Phase 02(원소 데이터 API) 의 산출물을 전제로 한다.
>
> 본 문서는 **설계 기술**이다. RDKit.js 호출 스니펫은 인터페이스 계약을 보이기 위한 의사코드이며, 실제 구현은 모든 details 문서 승인 후 수행한다.

---

## 1. 목적 (Purpose)

화학 엔진의 심장을 만든다. RDKit.js (WebAssembly) 를 **lazy-init 래퍼 서비스**로 감싸고, 그 위에 **SMILES / InChI / 분자식(formula) 입력 → `Molecule` 도메인 객체 + 3D 좌표 산출** 파이프라인을 구축한다.

이 Phase 가 끝나면:
- 앱 어디에서든 `await ensureRdkit()` 한 번으로 RDKit 인스턴스를 얻을 수 있다 (최초 호출에만 WASM 다운로드·초기화; 이후 재사용).
- SMILES / InChI / 분자식 입력이 `Result<Molecule, ParseError>` 로 좁혀진 유니온으로 반환된다 (예외 throw 금지).
- 생성된 `Molecule` 은 `architecture.md` §3.4 의 **불변·프레임워크 독립** 원칙을 준수한다.
- 3D 좌표는 ETKDG v3 기반으로 생성되며, 이온·하전 분자 입력에 대해서도 합리적으로 동작한다 (실패 시 명시적 오류 반환).
- 입체화학 정보(R/S, E/Z) 는 파싱되어 `Atom` / `Bond` 에 태깅되지만 반응 엔진이 참조하지 않는다 (표시 전용).
- 동일 입력에 대한 파싱/임베드 결과가 메모화(memoization) 되어 반복 호출 시 즉시 반환된다.
- 긴 작업(ETKDG 임베드, 반응 적용 등)은 **필요 시** Web Worker 로 이동할 수 있는 경계가 잡혀 있다 (실제 Worker 도입은 옵션).

---

## 2. 범위 (Scope)

### 2.1 포함
- **RDKit.js lazy 로더** (`engine/rdkit/service.ts`): WASM 자산 경로, 초기화 상태 관리, 진행/에러 이벤트
- **입력 파서** (`engine/parser/`):
  - `parseSmiles(input: string): Result<ParsedMol, ParseError>`
  - `parseInchi(input: string): Result<ParsedMol, ParseError>`
  - `parseFormula(input: string): Result<FormulaComposition, ParseError>` — 중간 표현(조성 맵)만 반환. 3D 구조 생성은 별도 단계(§6.4)
  - 입력 전처리(trim, 공백 제거, 길이 제한, 문자셋 검증)
- **도메인 매퍼** (`engine/parser/toDomain.ts`): RDKit 내부 객체 → `Molecule` / `Atom` / `Bond` (Phase 01 타입) 변환
- **3D 임베드** (`engine/geometry/embed.ts`):
  - `embed3D(mol: ParsedMol, options?: EmbedOptions): Result<Molecule, EmbedError>` — ETKDG v3 + UFF/MMFF 간이 최적화(옵션)
  - 실패 시 (치환기 충돌, 비정상 결합 등) 원인 분류
- **보조 기하 계산** (`engine/geometry/metrics.ts`):
  - `bondLength(a, b)`, `bondAngle(a, b, c)`, `dihedral(a, b, c, d)` — 순수 수학, RDKit 불요
- **입체화학 추출** (`engine/parser/stereo.ts`):
  - `extractStereo(mol): StereoAnnotations` — 원자 중심 R/S, 이중결합 E/Z
- **정규화 / 출력** (`engine/rdkit/canonical.ts`):
  - `toCanonicalSmiles(mol): string`
  - `toInchi(mol): { inchi: string; inchiKey: string }`
  - `toSdfBlock(mol): string` — Phase 13 Export 에서 재사용
- **이온·하전 분자 검증** (`engine/parser/validate.ts`):
  - 사용자 formula/SMILES 의 포말 전하 합계, 홀전자 수 검증
  - `validateMolecule(mol): Result<Molecule, ValidationIssue[]>`
- **메모화 캐시** (`engine/rdkit/cache.ts`):
  - LRU 기반, 키: `{ kind: 'smiles'|'inchi'|'formula', normalized: string }`
  - 용량/수명 상수는 §6.7 에 명시
- **Web Worker 준비 훅** (`engine/rdkit/backend.ts`):
  - §6.8 의 `RdkitBackend` 인터페이스 정의 + 메인 스레드 구현. Worker 구현은 Phase 14.
- **이온/하전 분자 ETKDG 안정성 사전 검증** (구현 착수 전 선결 작업):
  - architecture.md §12-6 리스크의 구체적 검증 단계. 본 Phase 의 RDKit.js 버전이 다음 대표 케이스에 대해 ETKDG v3 임베드를 안정적으로 수행하는지 *코드 작성 전* 손으로 확인 (REPL / RDKit.js playground):
    - `[NH4+]` (4 N-H 결합, 사면체 대칭)
    - `[OH-]` (단일 fragment 음이온)
    - `[H3O+]` (양이온 + 비대칭 H 분포)
    - `[Na+].[Cl-]` (다중 fragment 이온쌍, addHs 단계 검증)
    - `[SO4-2]` (다중극성 음이온, 전하 -2)
  - 모든 케이스가 `EmbedFailed` 없이 좌표를 산출해야 한다. 만약 일부가 실패하면 아래 fallback 옵션을 §6.5 에 명문화 후 진행:
    1. fragment 별 분리 임베드 + 후처리 합성
    2. 좌표 추정용 최소 시드 변경 (기본 `EMBED_SEED_PRIMARY` 외 후보 시드 추가)
    3. 임베드 실패 케이스를 `EmbedFailed` 로 명시 반환 (사용자에게 "이온 임베드 미지원" 안내)
  - 검증 결과는 §11 열린 질문 / §9 리스크에 기록. 본 Phase 테스트 §8.2 의 이온 케이스(`[NH4+]` 등) 는 본 사전 검증의 후속 보강.

### 2.2 비포함 (후속 Phase 로 이관)
| 항목 | 이관 대상 |
|------|-----------|
| 반응 규칙 매칭 / RunReactants 활용 | Phase 06 |
| PubChem 에서 받은 SDF 파싱 통합 | Phase 05 (서비스 경계), 본 Phase 의 SDF 리더는 문자열 블록 수준까지만 |
| 3D 렌더(구/실린더 인스턴싱) | Phase 08 |
| 원자 드래그 시 재임베드 / 부분 좌표 갱신 | Phase 09 |
| 입체화학 UI 표시 | Phase 11 |
| 대용량 분자의 Web Worker 실제 이동 | Phase 14 |
| 에너지/힘장(MM) 계산 | **비목표** (architecture §1.4) |

---

## 3. 의존성 (Dependencies)

### 3.1 선행 Phase
- **Phase 01** — `Result`, `Brand`, `Atom`, `Bond`, `Molecule`, `Vec3`, logger, i18n
- **Phase 02** — `getElement(n)`, `isValidElementNumber`, `getElementBySymbol`, CPK 색/반지름 메타

### 3.2 외부 라이브러리
| 패키지 | 버전 계열 | 용도 | 라이선스 |
|--------|-----------|------|---------|
| `@rdkit/rdkit` | 최신 안정 (2024Q3+ 계열) | WASM 빌드, JS 바인딩 | BSD-3-Clause |

- 배포 자산: `RDKit_minimal.js` + `RDKit_minimal.wasm` — Vite `publicDir` 혹은 `assets` 로 복사한다(§6.2).
- 번들 크기: 대략 1.5–2 MB gzip (WASM 제외). **반드시 lazy**.
- 대안 검토 결과: OpenBabel.js(거대), Indigo(라이선스/유지보수), Kekule.js(기능 불충분) — RDKit.js 유지.

### 3.3 결정 필요 사항 (사용자 확인)

| # | 질문 | 기본안 |
|---|------|--------|
| D1 | WASM 자산 배포 방식 | `public/rdkit/` 에 `RDKit_minimal.{js,wasm}` 를 복사하고, `ensureRdkit` 가 `import.meta.env.BASE_URL` 기반 경로(서브패스 배포 대응) 로 fetch |
| D2 | 3D 임베드 기본 옵션 | ETKDG v3 + `useRandomCoords: true`, 시드 고정(재현성), `numThreads: 0` (WASM 싱글), `maxIters: 200`. MM 최적화는 기본 off (옵션으로 제공) |
| D3 | 입력 길이 제한 | SMILES 2000 자, InChI 4000 자, formula 200 자 초과 시 즉시 `InputTooLong` 오류 |
| D4 | Formula → 3D 경로 | 조성 맵 → 대표 SMILES 테이블 매핑(예: `H2O`→`O`, `CO2`→`O=C=O`) + 단순 분자만 허용. 알려지지 않은 조합은 `FormulaUnsupported` 반환 |
| D5 | 캐시 용량 | LRU 200 엔트리 기본. 메모리 상한 예상 < 10 MB |
| D6 | Web Worker 도입 시점 | Phase 03 에서는 **경계만** 준비, 실제 Worker 파일 도입은 Phase 14 의 성능 측정 결과에 따라 결정 |
| D7 | InChI 정규화 | 입력 InChI 를 RDKit 로 분자 재구성 → canonical SMILES 역산. 원본 InChI 도 보존 |

본 문서 승인 시 위 기본안 채택.

---

## 4. 데이터 모델 / 타입

Phase 01 의 `Atom`, `Bond`, `Molecule` 위에 본 Phase 에서 필요한 **추가 타입**을 정의한다. 기존 타입의 필드는 확장만 할 뿐 의미를 바꾸지 않는다.

### 4.1 파서 / 엔진 타입 (`src/engine/rdkit/types.ts`)

```ts
import type { Result } from '@/types/result';
import type { Molecule } from '@/chemistry/compounds/types';

/** 파싱 결과. 3D 좌표는 아직 미생성. */
export interface ParsedMol {
  readonly source: InputSource;         // 원본 입력 종류/문자열
  readonly canonicalSmiles: string;     // RDKit canonical
  readonly formula: string;             // 분자식 (Hill 표기)
  readonly molecularWeight: number;     // g/mol
  readonly totalCharge: number;
  readonly radicalElectrons: number;    // 홀전자 수
  readonly atoms: ReadonlyArray<ParsedAtom>;
  readonly bonds: ReadonlyArray<ParsedBond>;
  readonly stereo: StereoAnnotations;
  readonly inchi: string | null;
  readonly inchiKey: string | null;
}

export interface ParsedAtom {
  readonly index: number;               // RDKit atom index
  readonly elementNumber: number;       // ElementNumber 로 좁히기 전 raw
  readonly formalCharge: number;
  readonly isotope: number | null;      // 지정된 경우만
  readonly implicitHCount: number;      // RDKit 이 계산
  readonly aromaticFlag: boolean;
}

export interface ParsedBond {
  readonly beginAtomIdx: number;
  readonly endAtomIdx: number;
  readonly order: 1 | 2 | 3 | 'aromatic';
  readonly stereoTag: BondStereoTag;
}

/**
 * 결합 입체 태그. **CIP(E/Z) 로 정규화** 한다.
 * - 'E' / 'Z': CIP 우선순위 기반 이중결합 입체
 * - 'any': 입체가 지정되었으나 판별 불가 (wedge/dash 충돌 등)
 * - 'none': 입체 정보 없음 (단일결합, 회전 가능 결합, 또는 미지정 이중결합)
 *
 * 'cis'/'trans' 등 고전 표기는 본 타입에서 허용하지 않는다.
 * RDKit 출력(`BondStereo::STEREOE` / `STEREOZ` / `STEREOANY` / `STEREONONE`) 을
 * 위 4값으로 매핑한 뒤 저장한다. 다른 RDKit 값(`STEREOCIS`/`STEREOTRANS`)은
 * 원자 우선순위를 계산해 E/Z 로 재산출 (RDKit `findPotentialStereoBonds`).
 */
export type BondStereoTag = 'none' | 'E' | 'Z' | 'any';
export type AtomStereoTag = 'none' | 'R' | 'S' | 'unspecified';

export interface StereoAnnotations {
  readonly atomStereo: ReadonlyArray<{ atomIdx: number; tag: AtomStereoTag }>;
  readonly bondStereo: ReadonlyArray<{ bondIdx: number; tag: BondStereoTag }>;
}

export type InputKind = 'smiles' | 'inchi' | 'formula';

export interface InputSource {
  readonly kind: InputKind;
  readonly raw: string;                 // 사용자 원본
  readonly normalized: string;          // trim / 공백 제거 / 대소문자 정규화
}
```

### 4.2 3D 임베드 타입 (`src/engine/geometry/types.ts`)

```ts
export interface EmbedOptions {
  readonly seed: number;                // 재현성 (기본 EMBED_SEED_PRIMARY = 0xC0FFEE; §6.5 상수)
  readonly maxIters: number;            // 기본 200
  readonly useRandomCoords: boolean;    // 기본 true
  readonly optimize: 'none' | 'uff' | 'mmff94';  // 기본 'none'
  readonly timeoutMs: number;           // 기본 EMBED_DEFAULT_TIMEOUT_MS = 4000; §6.5 상수
}

export type EmbedErrorCode =
  | 'RdkitNotReady'
  | 'EmbedTimeout'
  | 'EmbedFailed'           // ETKDG 가 좌표를 만들지 못함
  | 'InvalidMolecule'       // 결합 수 불일치 등
  | 'IonHandlingFailed'     // 이온/라디칼 처리 실패
  | 'InternalError';

export interface EmbedError {
  readonly code: EmbedErrorCode;
  readonly message: string;             // i18n 키와 별도의 기술 메시지
  readonly details?: Record<string, unknown>;
}
```

### 4.3 파싱 오류 분류 (`src/engine/parser/errors.ts`)

```ts
export type ParseErrorCode =
  | 'InputEmpty'
  | 'InputTooLong'
  | 'SmilesSyntax'
  | 'InchiSyntax'
  | 'FormulaSyntax'
  | 'FormulaUnsupported'    // 알려진 SMILES 매핑 없음 (D4)
  | 'UnknownElement'
  | 'SanitizationFailed'    // RDKit sanitize 실패
  | 'RdkitNotReady'
  | 'InternalError';

export interface ParseError {
  readonly code: ParseErrorCode;
  readonly message: string;
  /** 1-based column 위치 (있으면) */
  readonly at?: number;
  /** RDKit 로그 원문 (디버그) */
  readonly rdkitDetail?: string;
}
```

### 4.4 검증 이슈 (`src/engine/parser/validate.ts`)

```ts
export type ValidationIssueKind =
  | 'ChargeMismatch'        // totalCharge ≠ Σ formalCharge
  | 'ValenceExceeded'       // 원소별 상한 초과 (경고)
  | 'DisconnectedFragments' // 다중 분자 단편 감지 (허용하되 notifying)
  | 'RadicalPresent';

export interface ValidationIssue {
  readonly kind: ValidationIssueKind;
  readonly atomIdx?: number;
  readonly message: string;
  readonly severity: 'info' | 'warn' | 'error';
}
```

### 4.5 `Molecule` 매핑 (Phase 01 타입 재확인)

`engine/parser/toDomain.ts` 는 `ParsedMol` + `embed3D` 결과를 Phase 01 의 `Molecule` 형태로 변환한다. 본 Phase 에서 다음 필드가 확정된다:

- `Atom.position`: Å 단위, RDKit 좌표를 그대로 사용 (좌표계: 오른손)
- `Atom.implicitHCount`: RDKit 의 `GetTotalNumHs(true)` 결과
- `Atom.formalCharge`: `ParsedAtom.formalCharge`
- `Bond.order`: `1 | 2 | 3 | 'aromatic'`
- `Molecule.totalCharge`: `ParsedMol.totalCharge`
- `Molecule.spinMultiplicity`: `2 × (ParsedMol.radicalElectrons / 2) + 1 = ParsedMol.radicalElectrons + 1`. 홀전자 수가 0 이면 1 (singlet). architecture.md §5.1 의 "스핀 다중도(선택)" 을 본 Phase 에서 확정 채움 (표시 전용, 반응 엔진 비참조).
- Phase 01 `// TODO: Phase 03` 로 남겨두었던 `canonicalSmiles`, `inchi`, `inchiKey`, `stereo`, `spinMultiplicity` 필드를 채움:

```ts
// src/chemistry/compounds/types.ts — Phase 03 확장 적용
export interface Molecule {
  readonly id: string;
  readonly atoms: ReadonlyArray<Atom>;
  readonly bonds: ReadonlyArray<Bond>;
  readonly totalCharge: number;
  readonly canonicalSmiles: string;
  readonly inchi: string | null;
  readonly inchiKey: string | null;
  readonly stereo: StereoAnnotations;   // 표시 전용
  readonly spinMultiplicity: number;    // 2S+1 (S = radicalElectrons/2). 라디칼이 없으면 1. 표시 전용
}
```

> 필드 추가는 **하위 호환**(선행 구현은 아직 없음) 이므로 Phase 01 타입 파일 수정으로 흡수한다.

#### 동위원소(isotope) 필드 정책

`ParsedAtom.isotope` 는 SMILES 의 `[13C]` / `[2H]` 같은 **명시적 동위원소 라벨**을 RDKit 로부터 보존하기 위한 필드이다. 반면 Phase 01 의 도메인 `Atom` 에는 동위원소 필드를 두지 않았다. 본 Phase 의 `toDomain.ts` 는 다음 규약으로 동작한다:

- **원칙**: 동위원소 라벨이 없거나 "기본 동위원소" (예: `[12C]`, `[1H]`) 인 경우, `Atom` 으로 변환 시 정보 손실 없이 드롭한다.
- **비기본 동위원소** (예: `[13C]`, `[2H]`, `[14C]`) 가 감지되면 `ParsedMol.atoms[*].isotope` 에 보존되지만, `Molecule.atoms` 로는 전달되지 않는다. 이 정보는 `Molecule.canonicalSmiles` / `Molecule.inchi` 내부에 문자열로 이미 기록되므로, 라운드트립(캐노니컬 출력 → 재파싱) 에서 복원 가능.
- **표시/내보내기 요구 발생 시** (예: MoleculeInfo 패널이 동위원소 라벨 배지를 그리려 할 때): Phase 01 `Atom` 에 `isotope?: number | null` 필드를 추가하고 `toDomain` 이 전달하도록 확장한다. 본 Phase 에서는 그 확장 훅을 Phase 01 타입 파일의 TODO 주석으로 남긴다.
- **반응 엔진** (Phase 06) 은 동위원소를 구분하지 않는다 (비목표).

> **확장 안전성 명시**: `Atom.isotope?: number | null` 추가는 *순수 additive* 변경이다 — 기존 `Molecule` 객체와 직렬화된 JSON (Phase 13 export 포맷, Phase 07 persist 데이터) 모두 새 필드 없이 유효 (optional 이므로 누락 시 `undefined` 로 해석). Phase 11 가 라벨 표시를 요청하면 다음 순서로 적용:
>
> 1. Phase 01 `src/types/index.ts` 의 `Atom` 인터페이스에 `readonly isotope?: number | null;` 추가 (현재 TODO 주석 → 실제 필드).
> 2. 본 Phase 의 `toDomain.ts` 에서 `parsed.atoms[i].isotope ?? null` 을 `Atom.isotope` 로 전달.
> 3. 후속 phase (Phase 11 `MoleculeInfo`, Phase 13 export) 가 필드를 읽어 표시/직렬화.
>
> Phase 04 의 청크 데이터·Phase 07 의 store snapshot 은 *재빌드/재로드 없이* 신/구 포맷 호환 (`isotope === undefined` 는 "기본 동위원소" 의미). Phase 09 의 Undo full-snapshot 메모리 영향도 무시 가능 (선택적 정수 1개 / atom).
>
> **현 Phase 작업**: Phase 01 `Atom` 인터페이스 정의 위에 다음 TODO 코멘트를 단다 — `// TODO: Phase 11 - 동위원소 라벨 표시 요구 시 'readonly isotope?: number | null;' 추가 (phase-03 §4.5 동위원소 정책)`. 이로써 후속 phase 가 변경 경로를 즉시 발견.

---

## 5. 퍼블릭 API / 인터페이스

본 Phase 의 공개 진입점은 다음 두 모듈이다. 그 외 내부 모듈은 동일 레이어(`engine/`) 내부에서만 사용한다.

### 5.1 `src/engine/rdkit/index.ts`

```ts
export interface RdkitService {
  readonly ready: boolean;
  /** WASM 로드/초기화 보장. 동시 호출은 동일 Promise 공유. */
  ensure(): Promise<void>;
  /** 디스포즈(테스트/HMR 정리용) */
  dispose(): void;
}

export function getRdkit(): RdkitService;

/** 초기화 진행 상태 구독 (UI 스피너 연결 용) */
export function onRdkitStatusChange(
  listener: (status: RdkitStatus) => void,
): () => void;

export type RdkitInitErrorCode =
  | 'ScriptLoadFailed'      // RDKit_minimal.js fetch 실패 (네트워크 / CSP / 404)
  | 'WasmInstantiateFailed' // WebAssembly.instantiate 실패
  | 'InitTimeout'           // 초기화 타임아웃
  | 'UnsupportedEnvironment'// WebAssembly 또는 WebGL2 미지원
  | 'InternalError';

export interface RdkitInitError {
  readonly code: RdkitInitErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

export type RdkitStatus =
  | { readonly phase: 'idle' }
  | { readonly phase: 'loading'; readonly progress?: number }
  | { readonly phase: 'ready' }
  | { readonly phase: 'error'; readonly error: RdkitInitError };
```

### 5.2 `src/engine/parser/index.ts`

```ts
import type { Result } from '@/types/result';
import type { Molecule } from '@/chemistry/compounds/types';
import type { ParsedMol, ParseError, InputSource } from '@/engine/rdkit/types';
import type { EmbedOptions, EmbedError } from '@/engine/geometry/types';

export function parseSmiles(input: string): Promise<Result<ParsedMol, ParseError>>;
export function parseInchi(input: string): Promise<Result<ParsedMol, ParseError>>;

export interface FormulaComposition {
  readonly entries: ReadonlyArray<{ readonly symbol: string; readonly count: number }>;
  readonly totalCharge: number;   // "NH4+" 같은 표기 허용
}
export function parseFormula(input: string): Result<FormulaComposition, ParseError>;

/** 조성 → (지원되면) ParsedMol. 지원되지 않으면 FormulaUnsupported */
export function formulaToParsedMol(
  comp: FormulaComposition,
): Promise<Result<ParsedMol, ParseError>>;

/** ParsedMol → 3D 좌표가 포함된 도메인 Molecule */
export function toMoleculeWith3D(
  parsed: ParsedMol,
  opts?: Partial<EmbedOptions>,
): Promise<Result<Molecule, EmbedError>>;

/** 원-샷 편의 함수 (대부분의 UI 플로우가 사용) */
export function smilesTo3DMolecule(
  input: string,
  opts?: Partial<EmbedOptions>,
): Promise<Result<Molecule, ParseError | EmbedError>>;
```

### 5.3 `src/engine/rdkit/canonical.ts`

```ts
export function toCanonicalSmiles(parsed: ParsedMol): string;
export function toInchi(parsed: ParsedMol): { inchi: string; inchiKey: string };
export function toSdfBlock(mol: Molecule): string;
```

### 5.4 `src/engine/geometry/metrics.ts`

```ts
import type { Atom } from '@/chemistry/compounds/types';

export function bondLength(a: Atom, b: Atom): number;              // Å
export function bondAngle(a: Atom, b: Atom, c: Atom): number;      // radians
export function dihedral(a: Atom, b: Atom, c: Atom, d: Atom): number; // radians
```

### 5.5 `src/engine/parser/validate.ts`

```ts
export function validateMolecule(mol: Molecule): Result<Molecule, ValidationIssue[]>;
```

- `severity === 'error'` 이슈가 하나라도 있으면 `Result.err` 반환
- `warn` / `info` 만 있을 때는 `Result.ok` 이되, 이슈는 별도 경로(로그 또는 스토어) 로 전달 — Phase 07 에서 흡수

---

## 6. 핵심 로직 / 전략

### 6.1 RDKit 서비스 상태 머신

```
idle ──ensure()──▶ loading ──success──▶ ready
                       │
                       └──fail──▶ error
                                    │
                                    └──ensure() 재호출──▶ loading (재시도)
```

- 동시 다중 호출 시 내부에서 단일 Promise 공유 (더블 로드 방지).
- 초기화 중간에 `dispose()` 가 호출되면 진행 Promise 를 reject, 상태를 `idle` 로 리셋. (HMR, 테스트 격리 용)
- 상태 변경은 `onRdkitStatusChange` 구독자에게 동기 브로드캐스트.

### 6.2 WASM 자산 경로

- `public/rdkit/RDKit_minimal.js`, `public/rdkit/RDKit_minimal.wasm` 배치 (빌드타임 복사).
- 로더:
  ```ts
  const base = import.meta.env.BASE_URL ?? '/';
  const scriptUrl = `${base}rdkit/RDKit_minimal.js`;
  const locateFile = (f: string) => `${base}rdkit/${f}`;
  ```
- Vite `assetsInclude` / `viteStaticCopy` 플러그인 필요 여부는 구현 단계에서 확정. 기본은 `public/` 수동 복사.

### 6.3 파싱 파이프라인 (SMILES 기준)

```
raw input
   │
   ▼
 normalize (trim, 길이·문자셋 검증)   ── 실패시 InputEmpty / InputTooLong / SmilesSyntax
   │
   ▼
 cache lookup (normalized)            ── hit 시 즉시 반환
   │ miss
   ▼
 ensureRdkit()                        ── 실패시 RdkitNotReady
   │
   ▼
 rdkit.get_mol(smiles, {...})         ── null 이면 SmilesSyntax
   │
   ▼
 sanitize + aromaticity perceive      ── 실패시 SanitizationFailed
   │
   ▼
 toParsedMol(...)                     ── 원자/결합/전하/입체 추출
   │
   ▼
 cache.set(...)
   │
   ▼
 Result.ok(ParsedMol)
```

- 모든 단계에서 **예외를 포착**하여 `ParseError` 로 변환. 상위로 throw 하지 않는다.

### 6.4 Formula 처리 전략 (D4 기반)

- `parseFormula` 는 `(Symbol)(count)?` 반복 + 선택적 부호(`+`, `-`, `n+`, `n-`) 파서
- 반환 `FormulaComposition` 은 **순수 집계**. 이 시점에 분자 구조 정보 없음.
- `formulaToParsedMol` 은 아래 단계로 동작:
  1. 조성 맵이 내장 매핑 테이블(`src/engine/parser/formula-map.ts`)에 존재? → 대응 SMILES 로 `parseSmiles` 재호출
  2. 미존재 → `FormulaUnsupported`. 사용자에게 "분자식으로는 구조를 결정할 수 없습니다. SMILES 를 입력하거나 PubChem 검색을 사용하세요" 메시지(i18n)
**초기 매핑 테이블 (`formula-map.ts` 에 고정 수록, Phase 03 완료 시점의 최소 보장 세트)**

> 표의 **Key (Hill)** 열이 실제 테이블 키이며, 입력은 아래 정규화 규칙에 의해 이 키로 환산된 뒤 조회된다. **통상 표기** 열은 가독성 보조(테이블 주석)이며 코드 키로 사용하지 않는다.

| Key (Hill) | 통상 표기 | SMILES | 비고 |
|------------|----------|--------|------|
| `H2` | `H2` | `[H][H]` | 수소 분자 |
| `O2` | `O2` | `O=O` | 산소 분자 |
| `N2` | `N2` | `N#N` | 질소 분자 |
| `F2` | `F2` | `FF` |  |
| `Cl2` | `Cl2` | `ClCl` |  |
| `Br2` | `Br2` | `BrBr` |  |
| `I2` | `I2` | `II` |  |
| `H2O` | `H2O` | `O` | 물 |
| `H2O2` | `H2O2` | `OO` | 과산화수소 |
| `FH` | `HF` | `F` | 플루오르화 수소 |
| `ClH` | `HCl` | `Cl` | 염화 수소 |
| `BrH` | `HBr` | `Br` | 브롬화 수소 |
| `HI` | `HI` | `I` |  |
| `H3N` | `NH3` | `N` | 암모니아 |
| `H4N+` | `NH4+` | `[NH4+]` | 암모늄 이온 (전하 +1) |
| `CH4` | `CH4` | `C` | 메탄 |
| `CO` | `CO` | `[C-]#[O+]` | 일산화탄소 (공식 전하 표기) |
| `CO2` | `CO2` | `O=C=O` | 이산화탄소 |
| `O2S` | `SO2` | `O=S=O` | 이산화 황 |
| `O3S` | `SO3` | `O=S(=O)=O` | 삼산화 황 |
| `NO` | `NO` | `[N]=O` | 일산화 질소 (라디칼) |
| `NO2` | `NO2` | `[N+](=O)[O-]` | 이산화 질소 (중성, 라디칼) |
| `N2O` | `N2O` | `N#[N+][O-]` | 아산화 질소 |
| `H2S` | `H2S` | `S` | 황화 수소 |
| `H2O4S` | `H2SO4` | `OS(=O)(=O)O` | 황산 |
| `HNO3` | `HNO3` | `O[N+](=O)[O-]` | 질산 |
| `H3O4P` | `H3PO4` | `OP(=O)(O)O` | 인산 |
| `ClHO4` | `HClO4` | `OCl(=O)(=O)=O` | 과염소산 |
| `CH2O3` | `H2CO3` | `OC(=O)O` | 탄산 |
| `HNaO` | `NaOH` | `[Na+].[OH-]` | 수산화 소듐 |
| `HKO` | `KOH` | `[K+].[OH-]` | 수산화 칼륨 |
| `CaH2O2` | `Ca(OH)2` | `[Ca+2].[OH-].[OH-]` | 수산화 칼슘 |
| `ClNa` | `NaCl` | `[Na+].[Cl-]` | 염화 소듐 |
| `ClK` | `KCl` | `[K+].[Cl-]` | 염화 칼륨 |
| `CHNaO3` | `NaHCO3` | `[Na+].OC(=O)[O-]` | 탄산수소소듐 (베이킹소다) |
| `CNa2O3` | `Na2CO3` | `[Na+].[Na+].[O-]C(=O)[O-]` | 탄산 소듐 |
| `CH4O` | `CH3OH` | `CO` | 메탄올 (기본 이성질체) |
| `C2H6O` | `C2H5OH` | `CCO` | 에탄올 (기본 이성질체; 다이메틸에테르 `COC` 아님) |
| `C2H6` | `C2H6` | `CC` | 에탄 |
| `C2H4` | `C2H4` | `C=C` | 에틸렌 |
| `C2H2` | `C2H2` | `C#C` | 아세틸렌 |
| `C3H8` | `C3H8` | `CCC` | 프로판 |
| `C6H6` | `C6H6` | `c1ccccc1` | 벤젠 |
| `C2H4O2` | `CH3COOH` | `CC(=O)O` | 아세트산 (기본 이성질체; 포름산메틸 아님) |
| `C2H4O` | `CH3CHO` | `CC=O` | 아세트알데하이드 (기본 이성질체; 에틸렌옥사이드 `C1CO1` 아님) |

- **조회 키 정규화 (Hill)**: `FormulaComposition.entries` 배열을 다음 규칙으로 직렬화한다.
  1. **탄소(C)** 가 포함되면: `C` 먼저, `H` 가 있으면 바로 다음, 그 외 원소는 **기호의 알파벳 순** (기호 단위로 문자열 비교; `Ca`, `Cl` 는 `C` 로 시작하지만 `C` 자체가 선행되므로 그 뒤에 배치). 예: `CHNaO3`.
  2. **탄소가 없으면**: 모든 원소를 **기호의 알파벳 순** (수소 `H` 포함). 예: `FH`, `ClH`, `H3N`, `HNaO`, `CaH2O2`.
  3. 각 원소 뒤에 **수량 접미사** (1 은 생략). 예: `H2`, `O3`.
  4. **전하 접미사**: 순전하가 0이 아니면 마지막에 `+N` 또는 `-N` (N=1 이면 숫자 생략). 예: `H4N+`, `O4S-2`.
- **비교 예시** — 입력 `"OH2"` → 정규화 `"H2O"` → 맵 히트. 입력 `"HF"` → 정규화 `"FH"` → 맵 히트. 입력 `"NaOH"` → 정규화 `"HNaO"` → 맵 히트.
- **전하 파싱**: `"NH4+"`, `"SO4-2"` (또는 `"SO4 2-"`) 등에서 `parseFormula` 가 전하를 추출해 `FormulaComposition.totalCharge` 로 분리. 전하가 있는 테이블 키는 접미사를 포함(`H4N+`).
- **이성질체 모호성**: 동일 Hill 키를 갖는 복수 구조(예: `C2H6O` 는 에탄올/다이메틸에테르; `C2H4O` 는 아세트알데하이드/에틸렌옥사이드; `C2H4O2` 는 아세트산/포름산메틸) 는 테이블이 **가장 대표적인 이성질체 하나**를 돌려준다. 사용자가 다른 이성질체를 원하면 SMILES 로 직접 입력하도록 안내(i18n 메시지). 본 제약은 §11 열린 질문의 "Formula → 3D 매핑 범위" 항목에 포함.
- **미스 시 동작**: 이 테이블에 없는 조성은 `FormulaUnsupported` 반환. 확장은 Phase 04 의 Compound Data Pipeline 이 PubChem 상위 히트 기준으로 **빌드타임에 자동 보강**하는 경로를 제공 (별도 파일 `formula-map.generated.ts` 로 병합).

### 6.5 3D 임베드 (ETKDG)

**상수 정의** (`src/engine/geometry/types.ts` 또는 `src/engine/geometry/constants.ts`):
```ts
/** 1차 시드 — 결정성 기준값. Phase 04 빌드 스크립트가 동일 값을 import 하여 데이터 재현성 확보. */
export const EMBED_SEED_PRIMARY = 0xC0FFEE; // = 12648430

/** 1차 실패 후 추가 시도 횟수 (랜덤 시드). */
export const EMBED_MAX_RETRIES = 2;

/** 단일 임베드 호출 타임아웃. RDKit 동기 호출이라 실제 중단은 다음 tick 에서. */
export const EMBED_DEFAULT_TIMEOUT_MS = 4000;
```

> **결정성 보장**: `EMBED_SEED_PRIMARY` 는 Phase 04 의 빌드 스크립트(`scripts/pubchem-fetch/normalize.ts` → `embed3D({ seed: EMBED_SEED_PRIMARY })`) 가 동일 모듈에서 import 한다. 두 곳이 동일 상수를 참조하므로, 같은 SMILES + 같은 RDKit 버전 → 항상 동일 좌표.

- 호출: `rdkit.get_mol(smiles)` → `mol.addHs()` → `EmbedMolecule(params)` → (옵션) `UFFOptimizeMolecule` / `MMFFOptimizeMolecule`
- 좌표 정렬: 분자 **기하 중심(centroid, 모든 원자 위치의 단순 평균)** 을 원점으로 이동. 중원소 편향을 피하고 시각 중심을 렌더 원점에 맞춰 뷰포트 카메라 기본값(architecture §3.10)과 정합. 질량 중심은 MoleculeInfo 패널 표시용 보조 계산으로 별도 제공(Phase 11).
- 타임아웃: `timeoutMs` 내 미완료 시 강제 중단 (Promise race). RDKit 은 동기 호출이므로 실제로는 **다음 tick 에 체크**하는 한계 존재 → Web Worker 경계 마련 (§6.8)
- 실패 재시도:
  - 1차 시드로 실패 → 2차 `useRandomCoords: true` 랜덤 시드로 재시도
  - 2차도 실패 → `EmbedFailed` 반환
- 이온 처리:
  - `addHs` 전 `formalCharge` 보존 확인
  - `Chem.Cleanup()` 경로가 없으면 직접 `SanitizeMol` 옵션 조정

### 6.6 입체화학 추출

- RDKit `GetChiralTag`, `GetStereo` 를 사용하여 원자/결합 단위 태깅
- **반응 엔진이 stereo 를 읽지 않도록** `engine/reaction/` 쪽 타입 인터페이스에서 `stereo` 를 의도적으로 제외 (Phase 06 에서 확인)
- 출력은 Phase 11 의 MoleculeInfo 패널이 소비

### 6.7 캐시 설계

```ts
// src/engine/rdkit/cache.ts
interface CacheEntry {
  readonly key: string;        // `${kind}:${normalized}`
  readonly value: ParsedMol;   // 또는 Molecule (3D 포함은 별도 키스페이스)
  readonly bytes: number;      // 대략치(디버그)
  readonly lastHitAt: number;
}

const MAX_ENTRIES = 200;
```

- 키스페이스:
  - `parse:smiles:<normalized>` → `ParsedMol`
  - `parse:inchi:<normalized>` → `ParsedMol`
  - `embed:<parsedMolHash>:<seed>:<optimize>` → `Molecule`
- 퇴거 정책: LRU
- `dispose()` 호출 시 전체 플러시 (테스트 / HMR)
- **프로덕션 persist 안 함** — 세션 메모리 한정

### 6.8 RdkitBackend 인터페이스 (환경 추상화 + Web Worker 경계 준비)

**목적**: RDKit 호출의 *환경 추상화 계층*. 단일 인터페이스로 (a) 브라우저 메인 스레드, (b) Node 빌드타임 스크립트, (c) (Phase 14) Web Worker 세 환경을 동일 시그니처로 호출 가능하게 한다. **Phase 04** (빌드타임 PubChem 수집/검증), **Phase 05** (런타임 PubChem 응답 정규화), **Phase 14** (Worker 분리) 가 모두 이 인터페이스에 의존한다.

**위치**: `src/engine/rdkit/backend.ts` (인터페이스), `src/engine/rdkit/main-thread-backend.ts` (브라우저 구현). `src/engine/rdkit/index.ts` 에서 `RdkitBackend` 타입과 `createMainThreadRdkitBackend()` 팩토리를 re-export.

**인터페이스**:

```ts
// src/engine/rdkit/backend.ts
export interface RdkitBackend {
  /** SMILES 문자열을 파싱하여 ParsedMol 반환. canonical SMILES 산출 전 단계. */
  parseSmiles(input: string): Promise<Result<ParsedMol, ParseError>>;

  /** InChI 문자열을 파싱하여 ParsedMol 반환. */
  parseInchi(input: string): Promise<Result<ParsedMol, ParseError>>;

  /** SDF / Molblock 문자열을 파싱하여 ParsedMol 반환 (3D 좌표 포함 가능).
   *  PubChem 3D SDF 응답을 직접 소비할 때 사용 (Phase 04 빌드타임, Phase 05 런타임 공통). */
  parseSdfBlock(sdf: string): Promise<Result<ParsedMol, ParseError>>;

  /** ParsedMol → Molecule (3D 좌표 포함). */
  embed(parsed: ParsedMol, opts: EmbedOptions): Promise<Result<Molecule, EmbedError>>;

  /** ParsedMol → canonical 표현. SMILES 는 입체 정보 보존, InChIKey 는 표준 14-10-1 형식. */
  toCanonical(parsed: ParsedMol): Promise<{ smiles: string; inchi: string; inchiKey: string }>;
}
```

**구현 매핑**:

| 환경 | 구현 | 위치 | 추가 시점 |
|------|------|------|----------|
| 브라우저 메인 스레드 | `createMainThreadRdkitBackend(getRdkit)` | `src/engine/rdkit/main-thread-backend.ts` | **본 Phase 03** |
| Node 빌드타임 | `createNodeRdkitBackend()` | `scripts/pubchem-fetch/pubchem/rdkit-node.ts` | Phase 04 |
| Web Worker | `createWorkerRdkitBackend()` | `src/engine/rdkit/worker-backend.ts` | Phase 14 |

**규칙**:
- 본 인터페이스의 모든 메서드는 `Promise` 반환 (Worker 구현이 자연스러우려면 비동기 통일이 필요).
- 메인 스레드 구현은 내부에서 RDKit 동기 호출을 감싸므로 동기 작업이지만, 시그니처는 비동기로 통일.
- 상위 레이어 (스토어 / phase-04 빌드 스크립트 / phase-05 normalize) 는 **인터페이스만** 호출 → Worker 도입 시 호출부 수정 0.
- `runReactants` (반응 SMARTS 매칭) 는 본 인터페이스에 **포함하지 않는다** — Phase 06 가 별도 모듈 (`src/engine/rdkit/reactions.ts`) 로 추가하며, `RdkitBackend` 와는 *병렬 boundary* (phase-06 §5.7).
- 본 Phase 의 순수 변환 모듈 (`engine/parser/toDomain`, `engine/parser/stereo`, `engine/parser/normalize`, `engine/parser/formula`, `engine/rdkit/canonical`) 는 RDKit 인스턴스에 직접 결합하지 않고, `RdkitBackend` 를 인자로 받아 동작 가능한 형태로 구현한다 (Phase 04 의 Node 구현이 동일 변환 로직을 재사용할 수 있도록).

**테스트 mock**: `tests/unit/engine/rdkit/mock-backend.ts` 에 `createMockRdkitBackend(stubs)` 헬퍼 제공. Phase 04/05 의 normalize 단독 테스트가 RDKit WASM 의존 없이 실행 가능 (phase-05 §8 테스트 계획 참고).

### 6.9 메인 스레드 보호

- `EmbedMolecule` 가 수백 ms 넘게 걸릴 가능성이 있으므로, 호출 전 `RdkitStatus` 를 `loading`(embedding) 으로 브로드캐스트 → UI 가 스피너 노출
- 연속 요청은 큐잉(마지막 것만 유효) — Phase 07 (moleculeStore) 에서 연계. 본 Phase 는 훅만 제공.

### 6.10 로깅

- `logger.debug('rdkit.parse', { kind, normalized, result })` 수준의 디버그 로그를 핵심 경계에 삽입
- **원본 입력(`InputSource.raw`) 은 로그 메타에 포함하지 않는다**. 사용자가 SMILES 에 개인 식별 정보를 끼워 넣는 경우는 없지만, 매우 긴 입력(2000 자) 이 콘솔을 범람시키는 것을 방지하고 장래 URL / 파일 경로 등 민감 문자열이 entry point 로 추가될 때의 일반 정책을 선점한다. `normalized` 는 길이 제한을 통과한 상태이고 파이프라인 디버깅에 충분하므로 로그에 포함한다. 에러 시 필요한 `raw` 스니펫은 **앞 60자 + 길이** 형태(`{ rawPreview, rawLength }`) 로 축약해 `ParseError.rdkitDetail` 에만 담는다.
- 프로덕션 기본 레벨 `warn` → `debug` 출력 없음, 오류만 기록 (architecture §3.7)
- RDKit 자체 로그는 `setLogLevel('critical')` 로 축소 (옵션 확인 후 구현)

---

## 7. 파일 / 모듈 레이아웃

```
src/engine/
├── rdkit/
│   ├── index.ts               # getRdkit, onRdkitStatusChange, RdkitBackend, createMainThreadRdkitBackend, 타입 re-export
│   ├── service.ts             # lazy loader, 상태 머신, dispose
│   ├── assets.ts              # WASM 경로/가용성 체크
│   ├── cache.ts               # LRU
│   ├── canonical.ts           # toCanonicalSmiles, toInchi, toSdfBlock (순수 변환, RdkitBackend 주입형)
│   ├── backend.ts             # RdkitBackend 인터페이스 정의 (§6.8)
│   ├── main-thread-backend.ts # 브라우저 메인 스레드 구현 (createMainThreadRdkitBackend)
│   └── types.ts               # ParsedMol, InputSource, RdkitStatus 등
├── parser/
│   ├── index.ts               # parseSmiles / parseInchi / parseFormula / smilesTo3DMolecule
│   ├── normalize.ts           # 입력 정규화
│   ├── smiles.ts              # SMILES 전용 경로
│   ├── inchi.ts               # InChI 전용 경로
│   ├── formula.ts             # 분자식 파서 + formula-map
│   ├── formula-map.ts         # 조성→SMILES 매핑 테이블
│   ├── stereo.ts              # 입체화학 추출
│   ├── toDomain.ts            # ParsedMol → Molecule (3D 포함) 매퍼
│   ├── validate.ts            # validateMolecule
│   └── errors.ts              # ParseError, ValidationIssue
└── geometry/
    ├── index.ts
    ├── types.ts               # EmbedOptions, EmbedError
    ├── embed.ts               # embed3D
    └── metrics.ts             # bondLength/Angle/dihedral
```

### 7.1 레이어 가드
- `engine/` 는 `chemistry/`, `data/`, `types/`, `utils/` 만 import 허용 (Phase 01 ESLint 규칙과 일치)
- `@rdkit/rdkit` import 는 **오직 `src/engine/rdkit/` 내부에서만** 허용 → 다른 레이어가 RDKit 을 직접 호출하는 것 방지. ESLint `no-restricted-imports` 패턴으로 강제.

### 7.2 공개 경계
- 외부(상위) 레이어가 접촉하는 심볼은 §7 의 공개 모듈 경로(`@/engine/rdkit`, `@/engine/parser`, `@/engine/geometry`) 만이며, 각 서브디렉터리의 `index.ts` 에서 재export 된 심볼로 제한한다.
- 위 3개 경로의 **형제 파일**(`service.ts`, `cache.ts`, `smiles.ts` 등) 을 외부 레이어가 직접 import 하는 것을 ESLint `no-restricted-imports` 패턴으로 차단한다 (패턴: `@/engine/rdkit/*`, `@/engine/parser/*`, `@/engine/geometry/*` 중 `index` 가 아닌 경로 참조 금지). `internal/` 서브폴더 관례는 도입하지 않는다 — 공개/비공개 구분은 "index.ts 재export 여부" 로 일원화한다.

---

## 8. 테스트 계획

### 8.1 유닛 — 파서 (Vitest)

`tests/unit/engine/parser/`:
1. `parseSmiles('CCO')` → 에탄올: 원자 3, C-C 결합, C-O 결합, H 수 자동 채움
2. `parseSmiles('c1ccccc1')` → 벤젠: aromatic 결합 6
3. `parseSmiles('[Na+].[Cl-]')` → 이온쌍: totalCharge 0, 두 fragment, `DisconnectedFragments` warning
4. `parseSmiles('[NH4+]')` → totalCharge +1, N formalCharge +1
5. `parseSmiles('')` → `InputEmpty`
6. 길이 2001 의 SMILES → `InputTooLong`
7. `parseSmiles('C(C')` → `SmilesSyntax` (괄호 불일치)
8. `parseInchi('InChI=1S/H2O/h1H2')` → 물 분자
9. `parseFormula('H2O')` → `entries: [{symbol:'H',count:2},{symbol:'O',count:1}]`, `totalCharge: 0`
10. `parseFormula('NH4+')` → `entries: [{symbol:'N',count:1},{symbol:'H',count:4}]`, `totalCharge: +1`
11. `parseFormula('Xx2')` → `UnknownElement`
12. `formulaToParsedMol({ entries: [{symbol:'C',count:6},{symbol:'H',count:6}], totalCharge: 0 })` — 정규화 키 `"C6H6"` 는 매핑 테이블에 존재하므로 벤젠(`c1ccccc1`) 으로 성공 (테이블에 **없는** 조성 예시는 `{ C:10, H:22 }` → `"C10H22"` → `FormulaUnsupported`)

### 8.2 유닛 — 3D 임베드

`tests/unit/engine/geometry/`:
1. 물(H2O): embed 후 `bondAngle(H-O-H)` 가 100°–110° 범위
2. 메탄(CH4): 4개 C-H 결합 각도 사중점 근사 (σ < 5°)
3. 벤젠: 평면성 검증 (모든 원자의 z 좌표 분산 < 0.1 Å)
4. CO2: 선형성 (O-C-O 각 177°–180°)
5. 이온(`[NH4+]`): embed 성공, 결합 4개, N-H 대칭
6. 타임아웃: 인위적으로 `timeoutMs: 1` 지정 시 `EmbedTimeout`
7. 재현성: 동일 seed 로 두 번 embed → 원자 좌표 RMSD < 1e-6

### 8.3 유닛 — 메트릭스

`tests/unit/engine/metrics.test.ts`:
- 고정 좌표 기반으로 `bondLength`, `bondAngle`, `dihedral` 값 수학적 검증

### 8.4 유닛 — Canonical / SDF

- 동일 분자의 여러 SMILES 표기(`CCO`, `OCC`)가 동일 canonical 생성
- `toSdfBlock` 출력 형식이 RFC 표준 SDF 헤더 / 원자·결합 블록을 가짐
- InChI 키가 **14-10-1** 세그먼트 형식 (하이픈 포함 총 27자): `XXXXXXXXXXXXXX-XXXXXXXXFX-X` — 정규식 `/^[A-Z]{14}-[A-Z]{10}-[A-Z]$/`

### 8.5 유닛 — 캐시

- 동일 SMILES 연속 호출 시 2회차 호출은 RDKit 을 호출하지 않음 (스파이)
- LRU: 201개 엔트리 삽입 시 가장 오래된 1개 증발
- `dispose()` 후 캐시 비어있음

### 8.6 통합 — 서비스 상태

- 최초 `parseSmiles` 호출이 `ensureRdkit` 를 트리거함을 관찰
- 병렬 10개 `parseSmiles` 호출이 RDKit 초기화를 **단 1회** 수행
- `RdkitStatus` 이벤트 순서: `idle → loading → ready`

### 8.7 회귀 골든 (goldens)

`tests/fixtures/engine-goldens/` 에 대표 분자 15종의 `ParsedMol` / 임베드 좌표 스냅샷 저장. 파서/임베드 동작 변동을 감지.

### 8.8 E2E (Phase 15 연계)

- 본 Phase 는 E2E 를 직접 정의하지 않음
- Phase 12 (Text Input Pipeline) 의 "SMILES 입력 → 3D 생성" E2E 가 본 Phase 동작을 간접 검증

---

## 9. 리스크 및 대안

| # | 리스크 | 영향 | 완화 |
|---|--------|------|------|
| R1 | RDKit WASM 로드 실패 (네트워크, CSP) | 중 | `RdkitStatus.error` 로 노출 + 재시도 버튼. CSP 가이드 README 에 명시 |
| R2 | ETKDG 가 특정 분자에서 수렴 실패 | 중 | 2차 랜덤 시드 재시도, 그래도 실패면 `EmbedFailed` 반환 (숨기지 않음) |
| R3 | 이온/라디칼의 addHs 가 예기치 않게 전하 변경 | 중 | 임베드 전후 `totalCharge` 불변 assertion, 어긋나면 `IonHandlingFailed` |
| R4 | 메인 스레드 차단 체감 지연 | 중 | §6.8 의 `RdkitBackend` 인터페이스로 Worker 이동 경로 확보 |
| R5 | Formula → SMILES 매핑의 커버리지 한계 | 중 | D4 기본안대로 **지원되지 않음** 을 명시. Phase 04 와 협업하여 빈출 매핑 확장 |
| R6 | RDKit 버전업에 따른 API 변경 | 하 | `engine/rdkit/` 내부에 버전 고정 및 얇은 래퍼 경계. 외부 레이어에는 변경이 전파되지 않음 |
| R7 | `ParsedMol` 과 `Molecule` 의 중복 정보로 인한 동기화 오류 | 하 | `toDomain.ts` 가 단일 변환 지점. 직접 생성 금지 ESLint 규칙 검토 |
| R8 | 테스트에서 WASM 로드 시간으로 Vitest 타임아웃 | 하 | 테스트 환경 `timeout` 상향, `ensureRdkit` 를 setup-file 에서 선로드 |

---

## 10. 완료 기준 (Definition of Done)

1. `pnpm typecheck && pnpm lint && pnpm test -- --run` 가 모두 통과 (본 Phase 유닛 테스트 포함).
2. `parseSmiles('CCO')`, `parseSmiles('[Na+].[Cl-]')`, `parseInchi('InChI=1S/H2O/h1H2')`, `parseFormula('H2O')` 모두 `Result.ok` 반환.
3. `smilesTo3DMolecule('O')` 반환값의 `atoms.length === 3` (O + 2H), 결합 각이 100°–110°.
4. 동일 입력에 대한 2회차 호출이 RDKit 초기화 없이(캐시) 반환됨을 스파이로 확인.
5. `RdkitStatus` 이벤트 트레이스가 정상(`idle → loading → ready`) 이며, 에러 케이스에서 `error` 로 전이.
6. RDKit WASM 이 **초기 번들**에 포함되지 않음 (번들 분석기로 확인) — lazy chunk 로만 존재.
7. `engine/rdkit/` 외부에서 `@rdkit/rdkit` import 시 `pnpm lint` 실패 (의도적 위반 한 번 수동 확인).
8. `engine/parser` 공개 API 가 예외를 throw 하지 않음 (타입과 테스트로 보장).
9. 골든 스냅샷(§8.7) 15개 모두 생성·통과.
10. Phase 01 의 `Molecule` 타입에 `canonicalSmiles`, `inchi`, `inchiKey`, `stereo` 필드가 반영되고, 모든 테스트가 통과.

---

## 11. 열린 질문 (User Decision Required)

1. §3.3 D1–D7 기본안 수용 여부.
2. **Formula → 3D 매핑 범위**: 초기 20여 종으로 제한하는 기본안이 수용 가능한지? 아니면 Phase 04 이전에도 더 풍부한 커버리지가 필요한지.
3. **MM 최적화 옵션**: 기본 off 로 두고 Toolbar 에 "정밀 임베드" 토글을 Phase 11 에서 추가하는 방안 vs. 본 Phase 에서 기본 on.
4. **이온 처리 정책**: `DisconnectedFragments` (예: `[Na+].[Cl-]`) 를 "단일 Molecule (다중 단편)" 로 취급하는 기본안에 이견이 있는지, 아니면 "복수 Molecule" 로 분리해 moleculeStore 에 각각 등록할지.
5. **입체화학 타깃 수준**: R/S, E/Z 만으로 충분한지, 축회전이나 나선(axial/helical) 까지 표시할지 (기본안: R/S + E/Z 만).

---

## 12. 다음 Phase 로의 인계 (Hand-off)

- **Phase 04 (Compound Data Pipeline)**: 본 Phase §6.8 의 `RdkitBackend` 인터페이스를 따르는 Node 환경 구현 (`createNodeRdkitBackend()`) 을 추가한다. 빌드 스크립트는 `parseSmiles` / `parseSdfBlock` / `embed` / `toCanonical` 을 백엔드 주입 방식으로 호출하여 PubChem 수집물의 SMILES 유효성과 임베드 가능성을 사전 검증한다.
- **Phase 05 (Runtime Data Layer)**: 브라우저 환경에서 본 Phase 의 `createMainThreadRdkitBackend(getRdkit)` 를 주입받아 PubChem 응답을 `Compound` 로 정규화. `parseSdfBlock` 으로 PubChem 3D SDF 직접 소비, `parseSmiles + toCanonical` 로 canonical SMILES 재산출. (phase-05 §11 Q1 — `parseSdfBlock` 의 인터페이스 승격 — 은 본 §6.8 갱신으로 해소됨.)
- **Phase 06 (Reaction Engine)**: RDKit 의 `RunReactants` 및 반응 SMARTS 매칭에 본 서비스의 `getRdkit()` 인스턴스를 공유. Reaction 엔진은 `engine/reaction/` 아래에서 별도 래퍼를 갖되, WASM 초기화 경로는 동일 서비스.
- **Phase 07 (Stores)**: moleculeStore 가 `smilesTo3DMolecule` 을 호출. 비동기 상태/에러는 스토어 상태로 흡수.
- **Phase 08 (Rendering)**: `Molecule.atoms[].position` 을 그대로 R3F Atom 렌더러가 소비. CPK 색·반지름은 Phase 02 API 에서 조회.
- **Phase 11 (Panels)**: MoleculeInfo 패널이 `ParsedMol.stereo`, `inchi`, `molecularWeight` 등을 표시.
- **Phase 13 (Export)**: `toSdfBlock` 을 재사용.
- **Phase 14 (Performance)**: `RdkitBackend` 인터페이스 뒤에 Web Worker 구현을 꽂을 수 있음.

---

*문서 버전: 0.1 (초안)*
*작성일: 2026-04-19*
