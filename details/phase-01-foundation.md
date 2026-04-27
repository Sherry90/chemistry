# Phase 01 — Foundation & Schema

> 이 문서는 `architecture.md` §13 **Phase 01** 의 상세 설계서이다. 본 문서의 검토 및 승인이 끝난 뒤에야 해당 Phase 의 실제 코드 작성이 시작된다.
>
> 본 문서는 **설계 기술**이다. 여기에 등장하는 TypeScript 선언·설정 스니펫은 구현 스케치이며, 실제 파일로 작성되는 것은 Phase 01 구현 단계(전체 상세 설계서 완료 후)에서 이루어진다.

---

## 1. 목적 (Purpose)

프로젝트 전체가 그 위에 얹힐 **기술적 토대와 공용 언어**를 마련한다. 구체적으로:

1. **스캐폴딩**: Vite + React + TypeScript + pnpm + Tailwind CSS 의 최소 빌드·개발 환경을 구성하여 "빈 앱 셸(empty shell)"이 동작하도록 한다.
2. **공용 타입/스키마 정의**: 전 레이어가 공유할 핵심 도메인·유틸 타입을 확정한다 (값/로직은 여기서 구현하지 않고, 후속 Phase 가 채운다).
3. **레이어 경계 강제 장치**: `architecture.md` §4.1 의 의존 규칙을 ESLint / TS Project References 로 강제한다.
4. **i18n 뼈대**: `react-i18next` 초기화와 리소스 파일 골격을 마련한다.
5. **품질 게이트**: ESLint, Prettier, `simple-git-hooks`, GitHub Actions CI 기본 파이프라인을 세운다.
6. **라이선스·기여 규범 결정**: `LICENSE`, `README.md`(최소), (선택) `CONTRIBUTING.md` 를 확정한다.

이 Phase 가 끝나면 다음이 성립한다:
- `pnpm install && pnpm dev` 로 빈 React 앱이 뜬다.
- `pnpm typecheck && pnpm lint && pnpm test` 가 모두 성공한다 (테스트는 연기 가능한 smoke 1건만).
- PR 을 열면 CI 가 위 3개 검사를 수행한다.
- 모든 후속 Phase 가 import 할 수 있는 **공용 타입** 이 `src/types/` 및 `src/chemistry/`·`src/engine/` 루트에 존재한다 (구현 없이 타입·상수만).

---

## 2. 범위 (Scope)

### 2.1 포함
- 프로젝트 스캐폴딩 (Vite, React 18+, TS strict, Tailwind, pnpm workspace 설정은 **하지 않음** — 단일 패키지)
- `tsconfig.json` 및 경로 alias (예: `@/chemistry/*`, `@/engine/*`)
- ESLint, Prettier, `eslint-plugin-import`, `import/no-cycle`, `import/no-restricted-paths` 기반 **레이어 가드** (+ `no-restricted-imports` 규칙을 **빈 패턴 슬롯으로 선언**해 두어 후속 Phase 가 규칙 병합 없이 패턴만 추가할 수 있게 한다 — §6.2)
- Git hooks: `pre-commit` (lint + format), `pre-push` (typecheck + test) — `simple-git-hooks`
- **공용 타입** 선언: `Result<T, E>`, `Brand<T, K>`, `ElementNumber`, `Theme`, `Locale`, `RenderMode`, `Condition`, `ThermoFlag`, `Atom`, `Bond`, `Molecule`, `Compound` (placeholder 필드), `ReactionRule`, `ReactionResult` (일부 필드는 `// TODO: Phase XX` 주석과 함께 연기)
- i18n 초기화 (`src/i18n/index.ts`), 리소스 파일 골격 (`ko.json`, `en.json`, `chemistry.ko.json`, `chemistry.en.json` — 키 몇 개만)
- `logger` 추상화 인터페이스 (§3.7 반영, 실 구현은 최소)
- 앱 셸 (`src/app/App.tsx`): "Chemistry Platform" 제목과 언어/테마 토글만. 3D / 패널은 placeholder
- `index.html`, `main.tsx`, Tailwind 설정 파일
- `.editorconfig`
- **CI**: `.github/workflows/ci.yml` — push/PR 시 `pnpm install` → `lint` → `typecheck` → `test` → `build`
- `LICENSE`, `README.md` (최소: 프로젝트 소개, 개발 방법 한 단락)

### 2.2 비포함 (후속 Phase 로 이관)
| 항목 | 이관 대상 |
|------|-----------|
| 118 원소 실데이터 | Phase 02 |
| RDKit.js 통합 · SMILES 파싱 | Phase 03 |
| PubChem 수집 스크립트 | Phase 04 |
| PubChem 런타임 API · IndexedDB | Phase 05 |
| 반응 엔진 | Phase 06 |
| Zustand 스토어 **구현** | Phase 07 (본 Phase 는 **타입 인터페이스만**) |
| 3D 뷰포트 실제 Scene | Phase 08 |
| 드래그/선택/애니메이션 | Phase 09 |
| 패널 레이아웃/컴포넌트 실제 구현 | Phase 10, 11 |
| Playwright E2E 시나리오 | Phase 15 |

### 2.3 명시적 비결정 (후속 결정)
- 번역 리소스의 실제 문구는 이 Phase 에서 채우지 않는다 (스켈레톤만).
- 테마(light/dark/system)의 구체적 팔레트는 Phase 10 에서 확정 (본 Phase 는 "토글이 작동"까지만).

### 2.4 Phase 01 한정 임시 저장 정책 (ThemeProvider / LocaleToggle)

`settingsStore` 는 Phase 07 에서 구현되므로 Phase 01 의 토글 컴포넌트는 **임시 저장 메커니즘**을 사용한다.

- **ThemeProvider** (`src/app/providers/ThemeProvider.tsx`):
  - React state + `localStorage` 키 `chem.theme` (값: `'light' | 'dark' | 'system'`, 기본 `'system'`)
  - `'system'` 선택 시 `window.matchMedia('(prefers-color-scheme: dark)')` 구독
  - 실제 적용: `document.documentElement.classList.toggle('dark', resolved === 'dark')` (Tailwind `darkMode: 'class'` 전제)
- **I18nProvider / LocaleToggle**:
  - `localStorage` 키 `chem.locale` (값: `'ko' | 'en'`)
  - 초기값: 저장값 > `navigator.language` 의 접두사 (`ko` / `en`) > `'en'`
- **Phase 07 마이그레이션**: settingsStore 도입 시 동일 localStorage 키를 Zustand `persist` 미들웨어가 인수한다 (키 이름 유지로 사용자 설정 보존).

---

## 3. 의존성 (Dependencies)

### 3.1 선행 Phase
없음 (이 Phase 가 루트).

### 3.2 외부 도구 및 라이브러리

**런타임 (dependencies)**
| 패키지 | 용도 | 비고 |
|--------|------|------|
| `react`, `react-dom` | UI | ^18 |
| `zustand` | 상태 관리 | 설치만, 스토어 구현은 Phase 07 |
| `react-i18next`, `i18next` | 국제화 | 초기화 포함 |
| `clsx` | 클래스 조합 유틸 | 선택적 |

**개발 (devDependencies)**
| 패키지 | 용도 |
|--------|------|
| `typescript` | TS 5.x |
| `vite`, `@vitejs/plugin-react` | 빌드/개발 서버 |
| `tailwindcss`, `postcss`, `autoprefixer` | 스타일 |
| `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin` | 린트 |
| `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y` | React/a11y |
| `eslint-plugin-import`, `eslint-import-resolver-typescript` | **레이어 가드** |
| `prettier`, `eslint-config-prettier` | 포매팅 |
| `vitest`, `@vitest/ui` | 유닛 테스트 러너 |
| `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` | 컴포넌트 테스트 (본 Phase 는 smoke 만) |
| `jsdom` | DOM 환경 |
| `simple-git-hooks` | Git 훅 (가벼움 — D3 확정안) |
| `lint-staged` | 스테이지 파일 대상 lint/format |

> **주의**: 이 표는 Phase 01 시점의 **기본 세트** 이다. 후속 Phase 는 이 문서 또는 새 details 문서에서 추가 라이브러리(예: RDKit.js, three.js) 를 근거와 함께 제안한다.

### 3.3 결정 필요 사항 (사용자 확인)

다음 사항은 이 Phase 구현 착수 전에 확정되어야 한다:

| # | 질문 | 기본안(없으면 채택) |
|---|------|---------------------|
| D1 | **라이선스** | MIT (기여/배포 자유도 최대) |
| D2 | **Node 버전** | 20 LTS (`.nvmrc` 에 고정) |
| D3 | **Git 훅 매니저** | `simple-git-hooks` (가벼움) |
| D4 | **Vitest 환경** | `jsdom` (React 컴포넌트 smoke 가능) |
| D5 | **CI 매트릭스** | Node 20 단일 (OS: `ubuntu-latest`) |
| D6 | **Path alias 접두사** | `@/...` (예: `@/chemistry/...`) |

본 문서 승인 시 위 기본안을 채택한 것으로 간주하며, 변경을 원하시면 검토 피드백에서 지정해 주십시오.

---

## 4. 데이터 모델 / 타입

본 Phase 에서 확정하는 **공용 타입**은 후속 Phase 에서 채워질 값·로직의 **계약**이 된다. 필드가 확정되지 않은 부분은 `// TODO: Phase XX — 설명` 주석과 함께 `readonly` placeholder 로 둔다.

### 4.1 유틸리티 타입 (`src/types/result.ts`, `src/types/brand.ts`)

```ts
// src/types/result.ts
export type Result<T, E = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

```ts
// src/types/brand.ts
// Opaque branded types for domain identity.
declare const __brand: unique symbol;
export type Brand<T, K extends string> = T & { readonly [__brand]: K };
```

### 4.2 도메인 타입 (Placeholder 수준)

각 타입은 **구조만** 정의하고, 필드 계산/검증 로직은 후속 Phase 가 담당한다.

```ts
// src/chemistry/elements/types.ts
import type { Brand } from '@/types/brand';

/** 원자 번호 1..118 */
export type ElementNumber = Brand<number, 'ElementNumber'>;

export interface Element {
  readonly number: ElementNumber;
  readonly symbol: string;             // e.g., "H", "He"
  readonly nameKo: string;             // e.g., "수소"
  readonly nameEn: string;             // e.g., "Hydrogen"
  readonly atomicMass: number;         // u
  readonly electronegativity: number | null; // Pauling, 비활성 기체 등은 null
  readonly electronConfig: string;     // e.g., "1s1" (Phase 02 에서 Condensed/Full 로 분리)
  readonly cpkColorHex: `#${string}`;  // e.g., "#FFFFFF"
  readonly covalentRadiusPm: number;
  readonly vdwRadiusPm: number | null;
  // TODO: Phase 02 — 다음 필드들로 확정 확장한다 (현재는 플레이스홀더 수준):
  //   • electronConfig 단일 필드를 `electronConfigCondensed` / `electronConfigFull` 로 **대체**
  //   • 분류: `period: 1..7`, `group: number | null`, `block: 's'|'p'|'d'|'f'`, `category: ElementCategory`
  //   • 상태·물성: `standardState`, `meltingPointK: number | null`, `boilingPointK: number | null`, `densityGPerCm3: number | null`
  //   • 에너지: `firstIonizationEnergyEV: number | null`, `electronAffinityEV: number | null` (1차 이온화만 Phase 02 범위; 2차 이상은 비목표)
  //   • 존재/방사성: `occurrence: Occurrence`, `isRadioactive: boolean`
  //   • 대표 동위원소: `primaryIsotope: IsotopeSummary` (mass number, exact mass, 존재비, 반감기 등)
  //   • 메타: `yearDiscovered: number | null`
  // 전체 필드 확정 스키마는 `details/phase-02-element-data.md` §4.1 참조.
  // 주의: 현 Phase 01 의 `electronConfig` 단일 필드는 Phase 02 에서 제거되며, 본 Phase 의 placeholder 값만 의미를 가진다.
}
```

```ts
// src/chemistry/bonds/types.ts
export type BondOrder = 1 | 2 | 3 | 'aromatic';

export interface Bond {
  readonly aAtomId: number; // index into Molecule.atoms
  readonly bAtomId: number;
  readonly order: BondOrder;
  // TODO: Phase 03 — 기본 결합 길이/각은 RDKit embed 결과에서 파생
}
```

```ts
// src/chemistry/compounds/types.ts
import type { Vec3 } from '@/types/geometry';

export interface Atom {
  readonly elementNumber: ElementNumber;
  readonly position: Vec3;        // Å
  readonly formalCharge: number;  // 정수 (일반적으로 -4..+8, 전이금속·합성 원소 고산화수 포함)
  readonly implicitHCount: number; // RDKit 이 채움 (Phase 03)
  // TODO: Phase 03 — 원자 단위 입체 태그(R/S 등, 표시만)는 Molecule.stereo 로 이동
  // TODO: Phase 03+ — isotope 필드(명시적 동위원소 라벨)는 표시/내보내기 요구가 발생할 때 `isotope: number | null` 로 확장 (기본값은 null). 현재는 canonicalSmiles/InChI 문자열에만 보존.
}

export interface Molecule {
  readonly id: string;                // uuid
  readonly atoms: ReadonlyArray<Atom>;
  readonly bonds: ReadonlyArray<Bond>;
  readonly totalCharge: number;       // 이온 지원 (architecture §1.3)
  // TODO: Phase 03 — canonicalSmiles, inchi, inchiKey, stereo(StereoAnnotations)
  // TODO: Phase 03 — spinMultiplicity: number | null (architecture §5.1 "스핀 다중도(선택)").
  //   RDKit `GetNumRadicalElectrons()` 에서 파생 (다중도 = 2S+1, S = 홀전자수/2).
  //   라디칼이 없으면 1 (singlet). 반응 엔진/렌더는 이 필드를 읽지 않으며, MoleculeInfo 패널 표시 전용.
}

export interface Compound {
  readonly cid: number | null;        // PubChem CID, 자체 생성물은 null
  readonly name: { readonly ko: string | null; readonly en: string };
  readonly molecularFormula: string;  // e.g., "H2O"
  readonly molecularWeight: number;
  readonly smiles: string;
  readonly inchi: string | null;
  readonly defaultMolecule: Molecule | null; // 3D 좌표 포함
  // TODO: Phase 04 — 물성(녹는점 등), 존재 조건
}
```

```ts
// src/chemistry/reactions/types.ts
export interface Condition {
  readonly temperatureK: number;  // Kelvin 내부 표준
  readonly pressureAtm: number;
  readonly pH: number | null;     // 액상 반응에만 유효
}

export type ThermoFlag = 'exothermic' | 'endothermic' | 'unknown';

export interface ReactionRule {
  readonly id: string;
  readonly smarts: string;                    // Reaction SMARTS
  readonly conditionRange: Partial<{
    readonly temperatureK: readonly [number, number];
    readonly pressureAtm: readonly [number, number];
    readonly pH: readonly [number, number];
  }>;
  readonly thermo: ThermoFlag;
  readonly source: string;                    // 출처 (참고문헌/DB 식별자)
  // TODO: Phase 06 — 신뢰도/우선순위
}

export type ReactionPredictionKind = 'rule-based' | 'heuristic-experimental';

export interface ReactionResult {
  readonly products: ReadonlyArray<Molecule>;
  readonly kind: ReactionPredictionKind;
  readonly appliedRuleId: string | null;      // rule-based 일 때
  readonly thermo: ThermoFlag;
  readonly notes: string | null;              // 사용자 안내용
}
```

### 4.3 UI/설정 타입 (`src/types/ui.ts`, `src/types/settings.ts`)

```ts
// src/types/settings.ts
export type Locale = 'ko' | 'en';
export type Theme = 'light' | 'dark' | 'system';
export type RenderMode = 'ball-and-stick'; // 확장 가능: | 'space-filling' | 'wireframe'
export type TemperatureUnit = 'K' | 'C';
export type PressureUnit = 'atm' | 'Pa';
```

```ts
// src/types/geometry.ts
export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}
```

### 4.4 로거 인터페이스 (§3.7 반영)

```ts
// src/utils/logger/types.ts
export type LogLevel = 'off' | 'error' | 'warn' | 'info' | 'debug';

export interface Logger {
  error(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  debug(msg: string, meta?: Record<string, unknown>): void;
}
```

구현은 `createConsoleLogger(level: LogLevel): Logger` 한 개만 제공 (개발/프로덕션 공용, 레벨만 빌드타임 상수로 다름).

---

## 5. 퍼블릭 API / 인터페이스

### 5.1 i18n (`src/i18n/index.ts`)

```ts
// 개념적 시그니처 (실 구현은 Phase 01 구현 단계)
export function initI18n(initialLocale: Locale): Promise<void>;
export function setLocale(locale: Locale): Promise<void>;
export function getLocale(): Locale;

// 네임스페이스
// - 'common' (공용 UI 문자열)
// - 'chemistry' (화학 용어 사전)
```

> **`initialLocale` 결정 책임**: Phase 01 에서는 **`I18nProvider`** 가 §2.4 에 정의된 규칙 (`localStorage['chem.locale']` > `navigator.language` 접두사 > `'en'`) 으로 초기값을 계산해 `initI18n(locale)` 에 전달한다. `initI18n` 자체는 입력받은 로케일을 **그대로 사용**하고 다른 소스를 참조하지 않는다 — 저장소/브라우저 감지 로직은 Provider 에 국한되며, Phase 07 에서 `settingsStore.locale` 이 생기면 Provider 가 동일 위치에서 "저장된 스토어 상태 → `localStorage` fallback" 으로 소스만 교체된다. `initI18n` 시그니처는 바뀌지 않는다.

리소스 디렉터리 구조:
```
src/i18n/
├── index.ts
├── resources/
│   ├── ko/
│   │   ├── common.json
│   │   └── chemistry.json
│   └── en/
│       ├── common.json
│       └── chemistry.json
```

초기 키 예시 (실제 문구는 Phase 10/11/15 에서 확장):
```json
// en/common.json
{
  "app.title": "Chemistry Simulation Platform",
  "app.loading": "Loading…",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "theme.system": "System",
  "locale.ko": "한국어",
  "locale.en": "English"
}
```
```json
// ko/common.json
{
  "app.title": "화학 시뮬레이션 플랫폼",
  "app.loading": "불러오는 중…",
  "theme.light": "밝은 테마",
  "theme.dark": "어두운 테마",
  "theme.system": "시스템 설정",
  "locale.ko": "한국어",
  "locale.en": "English"
}
```

> 두 리소스는 **동일한 키 세트**를 가져야 한다 (§8.1 smoke test 전제). 키 커버리지 불일치 감지는 Phase 15 에서 자동화.

### 5.2 앱 셸 (`src/app/App.tsx`)

```tsx
// 의사코드
function App() {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <ThemeProvider>
          <AppShell>
            {/* Phase 10+ 에서 패널 슬롯 채움 */}
            <div role="main">
              <h1>{t('app.title')}</h1>
              <LocaleToggle />
              <ThemeToggle />
              {/* TODO: Phase 08+ — Viewport */}
              {/* TODO: Phase 11  — Panels */}
            </div>
          </AppShell>
        </ThemeProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
```

> Provider 순서는 `architecture.md` §3.7 "최상위 `ErrorBoundary`" 규정을 따른다. `ErrorBoundary` 는 가장 바깥에 두어 하위 Provider 초기화 실패(i18n 리소스 로드 실패, `matchMedia` 예외 등)까지 포착한다. `ErrorBoundary` 자체는 번역이 필요 없는 **정적 fallback UI** (영문 + 재시도 버튼) 를 사용한다 — i18n 이 부팅 실패한 상황에서 안전하게 동작해야 하기 때문이다.

### 5.3 로거

```ts
// src/utils/logger/index.ts
export function createConsoleLogger(level: LogLevel): Logger;

/**
 * 빌드타임 환경에 의해 결정되는 단일 상수 레벨.
 * - 개발 (`import.meta.env.DEV === true`): 'debug' — 모든 로그 노출.
 * - 프로덕션 (`vite build` 산출물): 'warn' — error/warn 만 노출, info/debug 억제.
 *
 * (architecture.md §3.7: "런타임 게이트는 하나의 상수 레벨로 필터링", "프로덕션 기본 `warn`, 개발 기본 `debug`".)
 *
 * 빌드타임 상수이므로 production 빌드에서 dead-code-elimination 가능 — debug 호출 자체는 남으나
 * 분기 본문이 비실행 (런타임 비용 0 에 근접). 외부 로깅 서비스 전송은 비목표.
 */
export const LOG_LEVEL: LogLevel = import.meta.env.DEV ? 'debug' : 'warn';

/** 앱 전역 기본 인스턴스 — 후속 phase 가 `import { logger } from '@/utils/logger'` 로만 사용. */
export const logger: Logger = createConsoleLogger(LOG_LEVEL);
```

> **빌드타임 결정 근거**: `import.meta.env.DEV` 는 Vite 가 빌드 시 정적 치환하므로 production 번들에는 `LOG_LEVEL` 이 `'warn'` 리터럴로 인라인된다. 후속 phase 는 `LOG_LEVEL` 을 직접 변경하지 않는다 (테스트는 `createConsoleLogger(level)` 로 별도 인스턴스 생성).

### 5.4 공개 API barrel export 표

후속 phase 가 import 할 공개 표면. **각 디렉터리의 `index.ts` 만이 외부 import 의 진입점** 이며, 형제 파일 직접 import 는 ESLint `no-restricted-paths` 패턴으로 차단 (§6.2).

| 모듈 경로 (import 측) | barrel 위치 | re-export 항목 |
|-----------------------|-------------|----------------|
| `@/utils/logger` | `src/utils/logger/index.ts` | `LogLevel`, `Logger`, `createConsoleLogger`, `LOG_LEVEL`, `logger` |
| `@/utils/result` | `src/utils/result/index.ts` | `Result`, `ok`, `err`, `isOk`, `isErr`, `mapResult`, `flatMapResult` |
| `@/i18n` | `src/i18n/index.ts` | `Locale`, `initI18n`, `setLocale`, `getLocale`, `I18nProvider`, `useTranslation` (re-export from react-i18next) |
| `@/types` | `src/types/index.ts` | `Vec3`, `Brand`, `Compound` (placeholder), `Element` (placeholder) 등 §4 의 공용 타입 |
| `@/chemistry/elements` | `src/chemistry/elements/index.ts` | (Phase 02 가 채움 — 본 Phase 는 빈 barrel) |
| `@/engine/rdkit` | `src/engine/rdkit/index.ts` | (Phase 03 가 채움) |
| `@/stores` | `src/stores/index.ts` | (Phase 07 가 채움) |
| `@/viewport` | `src/viewport/index.ts` | (Phase 08 가 채움) |

본 Phase 가 직접 채우는 barrel: `@/utils/logger`, `@/utils/result`, `@/i18n`, `@/types`. 나머지는 빈 `index.ts` 만 두어 후속 phase 가 채워 간다 (placeholder 단계에서 외부 import 는 컴파일만 통과하고 사용 시 의미 없음).

---

## 6. 핵심 로직 / 전략

### 6.1 스캐폴딩 순서 (구현 착수 시 실행 순)

1. `pnpm init` → `package.json` 초안
2. Vite + React + TS 의존성 설치, `vite.config.ts` 생성
3. `tsconfig.json` 구성 (§6.4 참조)
4. Tailwind 설치·초기화 (`tailwind.config.ts`, `postcss.config.js`, `src/index.css`)
5. 디렉터리 구조 생성 (빈 폴더 + `.gitkeep`)
6. 공용 타입 파일 작성 (§4)
7. i18n 초기화 (`src/i18n/index.ts` + 리소스 골격)
8. 앱 셸 (`src/app/App.tsx`, `src/main.tsx`, `index.html`)
9. ESLint/Prettier/`simple-git-hooks` 설정 (§6.2, §6.3)
10. GitHub Actions 워크플로 (`.github/workflows/ci.yml`)
11. `LICENSE`, `README.md`, `.editorconfig`, `.nvmrc`
12. smoke 테스트 1건 (`App.test.tsx` — 제목 렌더 확인)

### 6.2 레이어 경계 강제

`architecture.md` §4.1 의 의존 규칙을 **자동 검증**하기 위한 ESLint 규칙. `eslint-plugin-import` 의 `no-restricted-paths` 와 `no-cycle` 조합.

**ESLint 9 Flat Config (`eslint.config.js`)** 을 사용한다. Legacy `.eslintrc.*` 는 사용하지 않는다. 근거: `eslint-plugin-import` 및 `@typescript-eslint` 최신 버전이 flat config 를 1급 지원하며, 설정이 단일 파일로 집약되어 가독성 / 테스트 용이성이 좋다.

> Flat config 에서는 CLI `--ext` 플래그가 폐지되었다. 따라서 `package.json` 의 `lint` 스크립트는 `eslint .` 이며, 린트 대상 확장자는 각 config 객체의 `files: ['**/*.{ts,tsx}']` (및 필요 시 `'**/*.{js,jsx,cjs,mjs}'`) 로 명시한다.

설정 개념 (flat config rules 블록 내부):
```ts
'import/no-restricted-paths': ['error', {
  zones: [
    // chemistry 는 다른 레이어 참조 금지
    { target: 'src/chemistry', from: ['src/engine', 'src/services', 'src/stores', 'src/viewport', 'src/panels', 'src/components', 'src/app'] },
    // engine 은 chemistry/data 외 참조 금지
    { target: 'src/engine',    from: ['src/services', 'src/stores', 'src/viewport', 'src/panels', 'src/components', 'src/app'] },
    // data 는 chemistry/engine 만 읽기 허용 (다른 레이어는 JSON 직접 import 금지)
    { target: 'src/data',      from: ['src/services', 'src/stores', 'src/viewport', 'src/panels', 'src/components', 'src/app', 'src/io', 'src/hooks'] },
    // services 는 chemistry/engine/data 만 허용
    { target: 'src/services',  from: ['src/stores', 'src/viewport', 'src/panels', 'src/components', 'src/app'] },
    // stores 는 UI 레이어 참조 금지
    { target: 'src/stores',    from: ['src/viewport', 'src/panels', 'src/components', 'src/app'] },
    // UI 레이어 는 app 참조 금지
    { target: 'src/viewport',  from: 'src/app' },
    { target: 'src/panels',    from: 'src/app' },
    { target: 'src/components', from: 'src/app' },
    // io 는 chemistry/engine/types/utils 까지만 허용 (외부 서비스/스토어/UI 참조 금지)
    { target: 'src/io',        from: ['src/services', 'src/stores', 'src/viewport', 'src/panels', 'src/components', 'src/app', 'src/hooks'] },
  ],
}],
'import/no-cycle': ['error', { maxDepth: 10 }],

// 후속 Phase 가 공개 경계 패턴을 추가할 수 있도록 **슬롯**을 Phase 01 시점에 선언.
// Phase 03 이 RDKit · 엔진 내부 경로에 대한 패턴을, 이후 Phase 들도 동일 배열에 append.
'no-restricted-imports': ['error', { patterns: [
  // Phase 03 에서 예: { group: ['@/engine/rdkit/*', '!@/engine/rdkit'], message: '공개 경계(index) 를 통해서만 import 하세요.' }
  //                  { group: ['@rdkit/rdkit'], message: 'engine/rdkit/ 외부에서 @rdkit/rdkit 직접 import 금지.' }
]}],
```

> 규칙의 정확한 JSON 구조는 구현 시 `eslint-plugin-import` / `@typescript-eslint` 최신 문서에 맞춘다. `no-restricted-imports` 를 **빈 배열로 선행 선언**해 두는 이유: 후속 Phase(특히 Phase 03) 가 규칙 자체를 새로 추가하지 않고 `patterns` 배열에 원소만 append 하도록 하여, 린트 설정의 누적 PR 이 동일한 flat-config 섹션에 집중되고 리뷰 시 경계 변화를 한 곳에서 확인하도록 한다. `@rdkit/rdkit` 제한은 본 Phase 에서 `@rdkit/rdkit` 가 아직 의존성이 아니므로 선언만 하고 실제 패턴은 Phase 03 에서 활성화한다.

### 6.3 Git 훅 전략

`simple-git-hooks` 채택 (husky 대비 의존성·설정 단순). `lint-staged` 와 조합:
- **pre-commit**: `lint-staged` 실행 → 스테이지된 `.{ts,tsx,js,jsx,md,json}` 파일에 ESLint + Prettier 자동 적용
- **pre-push**: `pnpm typecheck && pnpm test` (실패 시 push 차단)

### 6.4 TypeScript 설정

핵심 옵션:
```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "types": ["vite/client", "vitest/globals"],
    "skipLibCheck": true
  },
  "include": ["src", "tests"]
}
```

### 6.5 CI 파이프라인 (GitHub Actions)

`.github/workflows/ci.yml` 의 개념:

```yaml
# 의사 YAML (키 이름·버전은 구현 시 확정)
name: ci
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test -- --run
      - run: pnpm build
```

### 6.6 package.json 스크립트 (계약)

```jsonc
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "format": "prettier --write .",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "prepare": "simple-git-hooks"
  }
}
```

---

## 7. 파일 / 모듈 레이아웃 (Phase 01 완료 시 존재하는 파일)

```
/
├── .editorconfig
├── .github/
│   └── workflows/
│       └── ci.yml
├── .gitignore                         # (이미 존재)
├── .nvmrc                             # 20
├── .prettierrc                        # 또는 prettier.config.js
├── .simple-git-hooks.json             # 또는 package.json 내 설정
├── LICENSE
├── README.md
├── architecture.md                    # (이미 존재)
├── details/
│   └── phase-01-foundation.md         # (본 문서)
├── index.html
├── package.json
├── pnpm-lock.yaml                     # (자동 생성)
├── postcss.config.js
├── public/
│   └── favicon.svg                    # (선택, placeholder)
├── tailwind.config.ts
├── tsconfig.json
├── vite.config.ts
├── eslint.config.js                   # ESLint 9 flat config
└── src/
    ├── app/
    │   ├── App.tsx
    │   └── providers/
    │       ├── I18nProvider.tsx
    │       └── ThemeProvider.tsx
    ├── main.tsx
    ├── index.css                      # Tailwind entry
    ├── chemistry/
    │   ├── elements/
    │   │   └── types.ts
    │   ├── compounds/
    │   │   └── types.ts
    │   ├── bonds/
    │   │   └── types.ts
    │   ├── reactions/
    │   │   └── types.ts
    │   └── thermodynamics/
    │       └── types.ts
    ├── engine/
    │   └── .gitkeep                   # Phase 03 에서 채움
    ├── data/
    │   └── .gitkeep
    ├── services/
    │   └── .gitkeep
    ├── stores/
    │   └── .gitkeep                   # Phase 07 에서 채움
    ├── viewport/
    │   └── .gitkeep
    ├── panels/
    │   └── .gitkeep
    ├── components/
    │   ├── LocaleToggle.tsx
    │   └── ThemeToggle.tsx
    ├── hooks/
    │   └── .gitkeep
    ├── utils/
    │   └── logger/
    │       ├── types.ts
    │       └── console.ts
    ├── types/
    │   ├── result.ts
    │   ├── brand.ts
    │   ├── geometry.ts
    │   ├── settings.ts
    │   └── ui.ts
    ├── i18n/
    │   ├── index.ts
    │   └── resources/
    │       ├── ko/
    │       │   ├── common.json
    │       │   └── chemistry.json
    │       └── en/
    │           ├── common.json
    │           └── chemistry.json
    └── io/
        └── .gitkeep
└── tests/
    ├── unit/
    │   └── .gitkeep
    ├── component/
    │   └── App.test.tsx                # smoke test
    └── e2e/
        └── .gitkeep
```

---

## 8. 테스트 계획

본 Phase 의 테스트 범위는 **최소**이다. 핵심 로직이 대부분 후속 Phase 에 있으므로, 여기서는 "뼈대가 무너지지 않았는지"만 보장한다.

### 8.1 Smoke 테스트 (Vitest + Testing Library)
- `tests/component/App.test.tsx`:
  - `<App />` 렌더링이 크래시 없이 완료
  - `app.title` 번역 키의 기본 값(영어)이 DOM 에 나타남
  - 언어 토글 클릭 시 한국어 번역으로 바뀜 (번역 키 `app.title` 이 ko 리소스에 존재함을 전제)

### 8.2 타입 레벨 검증 (`pnpm typecheck`)
- `Result<T, E>` 가 판별 유니온으로 동작함 (컴파일 성공을 테스트로 간주)
- 레이어 alias (`@/chemistry/...`) 가 해석됨

### 8.3 레이어 가드 검증
- **의도적 위반** 케이스 한 쌍을 `tests/unit/layer-guard.test.md` 로 문서화하고, 실제 규칙 동작은 CI의 `pnpm lint` 가 보장
- 음성 시나리오 예시 (문서화 + Phase 01 구현 시 1회 수동 확인):
  1. **하위→상위 import**: `src/chemistry/elements/types.ts` 안에 `import { useMoleculeStore } from '@/stores/moleculeStore';` 라인을 추가 → `pnpm lint` 가 `import/no-restricted-paths` 에러로 실패해야 한다 (chemistry 레이어가 stores 를 참조 금지).
  2. **순환 의존**: `src/utils/logger/index.ts` 안에 `import '@/i18n';` + `src/i18n/index.ts` 안에 `import '@/utils/logger';` 양방향 추가 → `import/no-cycle` 가 lint 에러로 잡혀야 한다.
  3. **barrel 우회**: 외부 코드에서 `import { createConsoleLogger } from '@/utils/logger/console';` 처럼 *형제 파일* 직접 import → `no-restricted-paths` 패턴 (`@/utils/logger/*` 중 `index` 가 아닌 경로) 에 의해 lint 실패. 정상 import 는 `@/utils/logger` 만 허용.
- (대안) `tests/lint/` 아래 "레이어 위반 샘플" 파일을 별도 스크립트로 lint 실행 → 실패를 기대 — Phase 15 에서 검토

### 8.4 CI 통합
- `ci.yml` 에서 `pnpm lint`, `pnpm typecheck`, `pnpm test -- --run`, `pnpm build` 네 단계가 모두 통과해야 머지 가능.

---

## 9. 리스크 및 대안

| # | 리스크 | 영향 | 완화 전략 |
|---|--------|------|-----------|
| R1 | ESLint `no-restricted-paths` 로는 **타입 전용 import** 까지 막아 과잉 차단 가능 | 중 | `allowTypeImports` 옵션 검토, 또는 TS Project References 로 구조 강제 병행 |
| R2 | Vite + Tailwind + Vitest 의 `jsdom` 환경에서 CSS 경고/오류 | 하 | `vitest.config.ts` 에서 `css: false` 로 스킵 |
| R3 | `simple-git-hooks` 가 사용자 로컬에서 동작하지 않는 경우 | 하 | README 에 `pnpm run prepare` 가이드, CI 는 독립적이므로 최후 방어선으로 기능 |
| R4 | `exactOptionalPropertyTypes` 가 엄격해 후속 Phase 초기에 마찰 | 하 | 그대로 유지 — 도메인 정확성 위해 필요. 경계 사례만 JSDoc 설명 |
| R5 | i18n 리소스가 비어있는 상태에서 key 누락 시 조용히 빈 문자열 출력 | 하 | `returnEmptyString: false`, 개발 모드에서 missing key 경고 |
| R6 | pnpm lockfile 이 환경에 따라 달라짐 | 하 | Node 20 고정 + `--frozen-lockfile` in CI |

---

## 10. 완료 기준 (Definition of Done)

다음을 **모두** 만족해야 Phase 01 완료로 간주한다.

1. 로컬에서 `pnpm install && pnpm dev` 실행 시 앱 셸이 뜨고, 제목과 두 개의 토글(언어, 테마)이 보인다.
2. `pnpm typecheck`, `pnpm lint`, `pnpm test -- --run`, `pnpm build` 모두 성공한다.
3. `.github/workflows/ci.yml` 이 push/PR 에서 위 네 단계를 실행하고, 현재 시점 main 브랜치가 녹색(green) 이다.
4. `src/chemistry/**/types.ts` 및 `src/types/*.ts` 에 §4 의 공용 타입이 존재하고, `import` 경로 alias 로 참조된다.
5. 의도적 레이어 위반(예: `src/chemistry/elements/types.ts` 가 `src/stores` 를 import) 을 넣으면 `pnpm lint` 가 실패한다 (수동 확인 후 revert).
6. `LICENSE` 가 존재하고, `README.md` 에 개발 실행 방법이 최소 1개 문단 포함된다.
7. `.nvmrc`, `.editorconfig`, `.prettierrc`, `eslint.config.js` 가 존재한다.
8. 한국어/영어 토글이 `app.title` 문자열을 실제로 다르게 표시한다.
9. 라이트/다크 테마 토글이 `<html class="dark">` (또는 Tailwind 규약에 맞는 방식) 을 실제로 변경한다 (팔레트 색상은 Phase 10 에서 개선).

---

## 11. 열린 질문 (User Decision Required)

Phase 01 구현 착수 전에 사용자의 답이 필요하다. §3.3 기본안 채택 여부를 포함한다.

1. **라이선스**: MIT 로 진행할지? 다른 라이선스 선호가 있는지? (공개 레포이므로 OSI 승인 라이선스 권장)
2. **저장소 공개/비공개**: 현재 `Sherry90/chemistry` 가 공개/비공개인지 확인 후, `README.md` 의 톤 결정
3. **프로젝트 공식 명칭**: "Chemistry Simulation Platform" 을 최종 제품명으로 사용할지, 별도 이름을 선호하는지
4. **Git 훅**: D3 로 `simple-git-hooks` 가 확정됨. 향후 훅 로직이 복잡해지면 `husky` 마이그레이션을 별도 논의 대상으로 남겨둔다.

---

## 12. 다음 Phase 로의 인계 (Hand-off)

이 Phase 가 완료되면 아래가 후속 Phase 에 전달된다:

- **전역 타입**: `ElementNumber`, `Atom`, `Bond`, `Molecule`, `Compound`, `Condition`, `ThermoFlag`, `ReactionRule`, `ReactionResult`, `Result<T,E>`, `Brand<T,K>`
- **레이어 경계**: ESLint 규칙 + alias
- **빌드/테스트 파이프라인**: `pnpm dev/build/lint/typecheck/test`
- **i18n 엔트리**: `initI18n`, 리소스 구조
- **로거**: `logger` 전역 + `createConsoleLogger`

Phase 02 (Element Data Layer) 는 `src/chemistry/elements/types.ts` 의 `Element` 타입을 실데이터로 채우는 것으로 시작한다.

---

*문서 버전: 0.1 (초안)*
*작성일: 2026-04-19*
