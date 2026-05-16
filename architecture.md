# Chemistry Simulation Platform — Architecture

> 이 문서는 프로젝트의 **뼈대(backbone)** 를 정의한다. 기술 스택, 제약, 구조, 작업 단계만을 다루며, 각 구성요소의 상세 구현 계획은 `details/phase-XX-*.md` 에서 별도로 기술한다.
>
> **전제**: 이 문서와 모든 `details/` 문서의 검토가 완료되기 전까지 단 한 줄의 코드도 작성하지 않는다.
>
> **라이선스**: 초기 개발 단계에서는 미정. Phase 01 (Foundation) 상세 설계 시 확정한다.

---

## 1. 프로젝트 개요 (Overview)

### 1.1 목적

화학 학습 및 시뮬레이션을 위한 **연구자급 시각화 도구**를 웹 기반 SPA로 제공한다. 사용자는 주기율표에서 원소를 선택하고, 분자를 3D 공간에서 직접 조작하거나 화학식(SMILES/화학식)을 입력하여 분자 구조를 생성하고, 조건(온도·압력·pH)을 설정하여 화학 반응의 결과를 확인할 수 있다.

### 1.2 대상 사용자

- 화학 분야 연구자
- 고급 학습자 (학부 고학년 ~ 대학원, 교육자)
- 화학 정보를 시각적으로 탐색·검증하려는 실무자

### 1.3 핵심 기능

1. 주기율표 및 전체 118 원소의 정보 조회
2. 수천 종 규모의 화합물 브라우저 및 런타임 검색(PubChem)
3. 분자의 3D 시각화 (반정량 정확도: 실제 결합각/길이 반영)
4. 3D 공간에서 원자 드래그로 분자 조작, 결합 생성/분리
5. SMILES / 화학식 / InChI 입력을 통한 자동 3D 구조 생성
6. 반응 시뮬레이션: 반응물 + 조건 → 생성물 예측 + 간단한 결합 변화 애니메이션 — _생성물이 작업공간(분자 컬렉션)에 적재되는 시점의 mount fade-in_ 으로 충족하며, 결합 단위 보간(create/break crossfade) 은 v1 비목표 (Phase 09 D16 후속, Phase 11 §1.5/§6.12 닫음, Phase 14+ 가 도입 결정).
7. 흡열/발열 여부 표시 (향후 ΔH 값 확장 여지)
8. 분자/세션 내보내기: PNG(스크린샷), JSON(세션), SDF(구조)
9. **편집 히스토리 (Undo / Redo)** — 원자/결합 편집, 분자 생성·삭제 등을 되돌리기/다시실행
10. **렌더 모드 토글** — Ball-and-stick 기본, 원자 라벨 표시 on/off 등 뷰포트 표시 옵션
11. 한국어/영어 UI 전환, 라이트/다크 테마 전환

### 1.4 비목표 (Non-goals)

아래 항목들은 **이 프로젝트 범위에서 명시적으로 제외**된다.

- 양자역학(QM) 계산 및 전자구조 해석
- 분자역학(MD) 시뮬레이션 (입자 힘 기반 시간 전개)
- 입체화학(stereochemistry) 결과 반영 — 표시는 하되, 반응 결과/에너지에 반영하지 않음
- 정확한 ΔH / ΔG 값 계산 — 흡/발열 **방향 플래그**만 제공
- 임의 반응에 대한 완전 자동 생성물 예측 — ML 연구 수준의 과제이므로 의도적으로 배제 (규칙 DB + 휴리스틱의 한계를 UI에서 명시)
- 단백질·거대 생체분자 전용 렌더 모드 (리본/서피스 등)
- 백엔드 서버, 사용자 계정, 클라우드 저장소

---

## 2. 기술 스택 (Tech Stack)

| 영역              | 선택                                                       | 근거                                                                |
| ----------------- | ---------------------------------------------------------- | ------------------------------------------------------------------- |
| 언어              | **TypeScript** (strict)                                    | 도메인 모델의 타입 안전성이 정확성에 직결                           |
| UI 프레임워크     | **React 18+**                                              | 생태계, R3F 통합                                                    |
| 빌드 도구         | **Vite**                                                   | 빠른 HMR, 코드 스플리팅, WASM 친화적                                |
| 패키지 매니저     | **pnpm**                                                   | 디스크 효율, 일관된 lockfile                                        |
| 상태 관리         | **Zustand**                                                | 가볍고 selector 기반, 프레임워크 비침투                             |
| 3D 렌더링         | **React Three Fiber (R3F) + three.js + @react-three/drei** | React 친화 3D, 선언적 씬 그래프                                     |
| 스타일링          | **Tailwind CSS**                                           | 빠른 UI 반복, 토큰화된 디자인                                       |
| 화학 엔진         | **RDKit.js (WebAssembly)**                                 | 업계 표준, SMILES/InChI 파싱·3D 좌표·반응 SMARTS 지원               |
| 외부 데이터       | **PubChem REST API**                                       | 공개, CORS 허용, 풍부한 화합물 DB                                   |
| 캐시              | **IndexedDB** (via `idb` 권장)                             | 런타임 조회 결과 영속 캐시                                          |
| 국제화            | **react-i18next**                                          | 한/영 전환, 용어 사전 관리                                          |
| 테스트 (유닛)     | **Vitest**                                                 | Vite 통합, 빠른 실행                                                |
| 테스트 (컴포넌트) | **@testing-library/react**                                 | 사용자 관점 검증                                                    |
| 테스트 (E2E)      | **Playwright**                                             | WebGL/3D 상호작용 검증 가능                                         |
| 스키마 검증       | **Zod**                                                    | 빌드타임/런타임 데이터 스키마 검증 (PubChem 응답, 세션 파일 import) |
| 코드 품질         | ESLint, Prettier                                           | 일관된 스타일                                                       |

**의존 설치 시점**: 위 스택은 **단계적으로 설치**한다. 초기 `package.json` 에는 Phase 01~07 에 필요한 의존(`react`, `zustand`, `@rdkit/rdkit`, `idb`, `zod`, `i18next` 등)만 존재하며, `three` / `@react-three/fiber` / `@react-three/drei` 는 Phase 08, `playwright` 는 Phase 15 착수 시 추가한다 (각 Phase §3 의존성 절에서 명시).

**주의**: 위 스택 외 라이브러리 추가는 **각 Phase 상세 설계 문서에서 근거와 함께 명시**하고 승인 후 도입한다.

---

## 3. 제약사항 및 지침 (Constraints & Guidelines)

### 3.1 범위 제약 (재확인)

1. **양자역학/분자역학 계산 없음**. 모든 3D 기하는 RDKit의 embed(ETKDG) 알고리즘 결과 또는 PubChem 3D SDF를 사용한다.
2. **반응 예측은 혼합 엔진**으로 운영한다.
   - 기본: 규칙 DB (Reaction SMARTS 기반 RDKit `RunReactants`) 매칭
   - Fallback: 원자가(valence) 기반 휴리스틱 — UI에 **"실험적 예측(experimental)"** 배지로 명시
   - 예측이 불가능한 경우 솔직히 "예측 불가"를 반환한다
3. **열역학은 방향만**. 엔티티에 `ThermoFlag: 'exothermic' | 'endothermic' | 'unknown'` 필드만 두고, ΔH 값은 향후 확장용 optional 필드로 예약한다.
4. **입체화학 정보는 파싱/표시**. R/S, cis/trans 등은 분자 정보 패널에 노출하지만, 반응 결과 판정에는 반영하지 않는다.
5. **렌더 모드는 Ball-and-stick 단일 구현으로 시작**. 단, 타입/인터페이스는 `RenderMode` 유니온으로 설계하여 다른 모드를 **중단 없이 확장**할 수 있어야 한다. 확장 후보 (도입 시점은 Phase 14+ 결정): **Space-filling**(원자별 vdW 반지름 구체), **Wireframe**(결합을 선으로), **Stick**(원자 구체 생략, 결합 실린더만), **Surface**(분자 표면 — _연구자 시각화_ 우선순위가 낮아 후순위). 초기 버전에서 다른 모드의 실제 렌더 구현은 제공하지 않는다 (토글 UI는 "준비 중" 비활성화).

### 3.2 성능 예산 (Performance Budget)

| 지표                               | 목표                           | 비고                             |
| ---------------------------------- | ------------------------------ | -------------------------------- |
| 초기 로드 (First Meaningful Paint) | **< 3초**                      | 코드 스플리팅 필수               |
| 초기 번들 (gzip)                   | **< 500 KB**                   | RDKit.js WASM은 별도 lazy        |
| RDKit lazy init                    | 첫 SMILES 입력/3D 생성 요청 시 | UI 선(先)표시 후 백그라운드 로드 |
| 화합물 번들                        | 카테고리별 청크, 필요 시 fetch | 전체 선(先)로딩 금지             |
| 3D FPS                             | 60fps @ 수백 원자 이하         | 그 이상은 LOD/instancing 적용    |
| 상호작용 응답                      | < 100ms                        | 드래그, 선택 등                  |

### 3.3 브라우저 지원

- 최신 Chromium, Firefox, Safari (최근 2개 메이저 버전)
- WebGL2 필수 (미지원 시 안내 페이지 제공)
- WebAssembly 필수

### 3.4 코딩 원칙

1. **레이어 분리**: 화학 도메인 모델(`src/chemistry`)과 엔진 계산(`src/engine`)은 React/R3F에 의존하지 않는다(프레임워크 독립성, 테스트 용이성).
2. **순수 함수 우선**: 도메인 계산은 부수효과 없이 작성한다.
3. **스토어가 유일한 부수효과 지점**: 비동기 호출·상태 변경은 Zustand 스토어에서만 일어난다.
4. **타입 엄격성**: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` 모두 활성화.
5. **정확성 우선**: 화학 도메인은 "그럴듯한" 근사보다 "명시적으로 불가능"을 반환하는 편을 택한다.
6. **불변 데이터**: 분자/결합 데이터는 읽기 전용 구조로 관리, 수정은 새 객체 생성. 스토어 내부는 immer 의 mutable draft 패턴으로 작성하되, 결과물은 항상 새 참조의 immutable 값이다 (Phase 07 §3.2).

### 3.5 접근성(Accessibility)

- 모든 주요 동작은 **키보드로 접근 가능**해야 한다 (3D 뷰포트 내 원자 선택 포함, Tab/방향키 지원).
- ARIA 레이블, 역할 적절히 부여.
- 색약(CVD) 대응: 원소 CPK 컬러에 의존하는 구분은 **라벨/패턴을 병행** 제공.
- 세부 규정 준수는 Phase 15(Polish)에서 검증한다.

### 3.6 보안 및 프라이버시

- 백엔드가 없으므로 사용자 데이터는 로컬(메모리/IndexedDB)에만 존재.
- 외부 API는 PubChem 공식 엔드포인트만 허용.
- 사용자 입력 문자열(SMILES 등)은 RDKit 파싱 단계에서 검증, 파싱 실패 시 사용자에게 원인을 표시한다.

### 3.7 에러 처리 및 로깅

- **도메인 / 엔진 레이어**: 실패는 **명시적 결과**로 반환한다. 타입 수준에서 `Result<T, E>` 패턴, 즉 `{ ok: true; value: T } | { ok: false; error: E }` 형태의 좁혀진 유니온을 사용한다 (정본 필드명은 `value` / `error` — Phase 01 §4.1 에서 단일 정의). 예외 throw는 "프로그래밍 오류(불변식 위반)" 한정.
- **서비스 레이어 (PubChem / Cache)**: 네트워크 · HTTP 상태 · 스키마 불일치를 분류해 스토어로 전달. 재시도 정책(지수 백오프 등)은 Phase 05에서 상세 설계.
- **UI 경계**: 최상위 React `ErrorBoundary`로 렌더 예외를 포착해 "오류 발생 — 새로고침" 화면을 표시. 패널별 보조 경계 도입 여부는 Phase 10에서 결정.
- **사용자 피드백**: 실패 메시지는 구체적으로 제공한다 (예: `"SMILES 파싱 실패 — 3번째 문자 근처 괄호 불일치"`). "오류가 발생했습니다" 같은 모호한 문구 금지.
- **로깅**: `logger` 추상화(Phase 01 §4.4) 는 5단계 레벨 `off | error | warn | info | debug` 를 유니온으로 정의하며, 런타임 게이트는 하나의 상수 레벨로 필터링한다. **프로덕션 기본 레벨은 `warn`** (오류/경고만 노출, info/debug 는 억제). **개발 기본 레벨은 `debug`** (모든 로그 노출). 외부 로깅 서비스 전송은 **비목표**.

### 3.8 편집 히스토리 (Undo / Redo)

- 다음 동작은 **Undoable** 로 기록한다: 원자 추가/삭제, 결합 생성/분리, 원자 이동, 화학식·SMILES 입력으로 분자 생성·교체, 분자 삭제.
- 다음은 **Undoable 에서 제외**: 반응 실행 결과(독립 이벤트), UI 상태 변경(선택, 패널 토글 등), 설정(`settingsStore`) 변경.
- 기본 단축키: `Ctrl/Cmd+Z` (Undo), `Shift+Ctrl/Cmd+Z` 또는 `Ctrl/Cmd+Y` (Redo).
- 히스토리 스택은 **capacity=50 FIFO**, **full `Molecule` snapshot per undoable action** (immer 구조적 공유로 메모리 절약), **200 ms 그룹 합치기 윈도우** (드래그 stream). 세부는 Phase 09 §6.1 / D1+D3.

### 3.9 배포 타깃 (Deployment)

- 산출물은 `vite build` 로 생성되는 **순수 정적 번들**이다 (서버 런타임/SSR 없음).
- 정적 호스팅이면 어느 곳이든 배포 가능: Vercel, Netlify, Cloudflare Pages, GitHub Pages, 사내 CDN 등.
- 구체적 호스팅 선택은 Phase 14/15에서 결정하며, 빌드 결과는 **호스팅 독립적**이어야 한다 (절대 경로 의존 금지, 루트 경로 설정 가능).

### 3.10 뷰포트 표시 기본값 (Viewport Display Defaults)

- 원자 라벨(원소 기호)은 **기본 off**, Toolbar 토글로 on/off. 호버/선택된 원자에 대해서는 기본 툴팁 표시.
- 결합 차수(단/이중/삼중/aromatic)는 **기본 실린더 다중 표현**(2중: 평행 실린더 2개, 3중: 3개). **Aromatic 결합** (Phase 09 의 `setBondOrderAromatic` 단축키 대상) 의 시각 표현은 _점선 실린더_ 또는 _내부 환 표현_ 중 Phase 08/14 가 결정 — 본 문서는 _`BondOrder` 타입 유니온 (`1 | 2 | 3 | 'aromatic'`, 숫자 차수 + aromatic 리터럴; RDKit·화학 관례 정합) 만 동결_. 차후 대체 _시각_ 표현은 타입 불변, 렌더러만 확장 여지.
- 배경색은 테마(라이트/다크)에 연동하되 토글 독립 오버라이드 가능.
- 카메라 기본: 등각 3/4 뷰, 선택 분자에 포커스.
- 접근성: 색약 모드 on 시 원소 라벨을 **강제 on** 하고 패턴/심볼 보조 사용 (Phase 15 상세).

---

## 4. 프로젝트 디렉터리 구조 (Project Layout)

```
/Users/pc/Documents/study/chemistry/
├── architecture.md              # 본 문서 (뼈대)
├── details/                     # Phase별 상세 설계 문서
│   ├── phase-01-foundation.md
│   ├── phase-02-element-data.md
│   └── ...
├── src/
│   ├── app/                     # 앱 엔트리, 전역 레이아웃, 라우팅(필요 시)
│   │
│   ├── chemistry/               # 순수 도메인 모델 (프레임워크 독립)
│   │   ├── elements/            # Element 타입 및 보조 함수
│   │   ├── compounds/           # Compound / Molecule 모델
│   │   ├── bonds/               # Bond 모델 및 유틸
│   │   ├── reactions/           # Reaction / Condition 모델
│   │   └── thermodynamics/      # ThermoFlag 등 확장 여지
│   │
│   ├── engine/                  # 계산 엔진 (프레임워크 독립)
│   │   ├── rdkit/               # RDKit.js lazy-init 래퍼 서비스
│   │   ├── parser/              # SMILES/InChI/formula 파싱
│   │   ├── geometry/            # 3D 좌표 생성, 결합각/길이 계산
│   │   └── reaction/            # 규칙 DB + 휴리스틱 엔진
│   │
│   ├── data/                    # 빌드타임 번들 데이터
│   │   ├── elements/            # 118 원소 정적 JSON
│   │   ├── compounds/           # 청크된 화합물 JSON (lazy import)
│   │   └── reactions/           # 반응 규칙 DB
│   │
│   ├── services/                # 외부 연동
│   │   ├── pubchem/             # REST API 클라이언트
│   │   └── cache/               # IndexedDB 캐시 어댑터
│   │
│   ├── stores/                  # Zustand 스토어 (유일한 부수효과 계층)
│   │   ├── moleculeStore.ts
│   │   ├── reactionStore.ts
│   │   ├── uiStore.ts
│   │   └── settingsStore.ts
│   │
│   ├── viewport/                # R3F 3D 뷰포트
│   │   ├── scene/               # Scene, 조명, 카메라
│   │   ├── renderers/           # Atom / Bond 렌더러
│   │   ├── interactions/        # 드래그, 선택, 핸들
│   │   └── animations/          # 결합 생성/분리 애니메이션
│   │
│   ├── panels/                  # 기능별 UI 패널
│   │   ├── PeriodicTable/
│   │   ├── CompoundBrowser/
│   │   ├── Conditions/          # 온도/압력/pH 슬라이더
│   │   ├── MoleculeInfo/
│   │   ├── ReactionResult/
│   │   └── Toolbar/             # 편리성 도구 (렌더 모드, 뷰 리셋, 스크린샷 등)
│   │
│   ├── components/              # 공통 UI 컴포넌트 (Button, Dialog 등)
│   ├── hooks/                   # 범용 React 훅
│   ├── utils/                   # 범용 유틸 (포맷, 수학 등)
│   ├── types/                   # 공용 타입 선언
│   ├── i18n/                    # 번역 리소스 (ko, en), 용어 사전
│   └── io/                      # export/import (PNG, JSON, SDF)
│
├── scripts/                     # 빌드타임 유틸
│   └── pubchem-fetch/           # PubChem 대량 수집 스크립트
│
├── tests/
│   ├── unit/                    # Vitest: 도메인/엔진
│   ├── component/               # Testing Library: 패널
│   └── e2e/                     # Playwright: 핵심 시나리오
│
├── public/                      # 정적 자산 (아이콘, 초기 로딩 UI 등)
├── package.json, pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── playwright.config.ts
└── README.md
```

### 4.1 레이어 의존성 규칙

아래 다이어그램은 **의존(import) 방향**을 나타낸다. 화살표 `A → B` 는 "A 모듈이 B 모듈을 import 한다" 는 의미이며, **모든 의존은 위에서 아래로만** 흐른다. 상위에 위치한 모듈은 하위에 위치한 모듈을 참조할 수 있으나, **하위는 상위를 참조할 수 없다**.

```
          app            (엔트리/조립)
           │
           ▼
   viewport  panels  io  components   (UI / R3F / IO 계층 — io 는 React 무관)
           │
           ▼
          stores         (Zustand — 유일한 부수효과 관리자)
           │
           ▼
         services        (PubChem 클라이언트, IndexedDB 캐시)
           │
           ▼
          engine         (RDKit 래퍼, 파서, 기하, 반응 엔진)
           │
           ▼
       chemistry  ◀──  data    (순수 도메인 모델 ◀ 정적 데이터)
```

- **상위 → 하위 import 허용, 하위 → 상위 import 금지**.
- `chemistry`, `data`, `engine` 는 **React / R3F / DOM에 의존하지 않는다** (순수 TypeScript, 브라우저 API 최소화). `services`·`io` 는 React/R3F 비의존이나 브라우저 API(IndexedDB, Blob, fetch)는 사용한다.
- `io` 는 panels 와 동격 peer 이지만 UI 레이어가 아니다. `panels/Io` 가 `@/io` 의 entry function 만 호출하고, **`@/io/*` 는 stores 스냅샷 read (`useXStore.getState()`) 및 명시적 store 액션 호출이 허용**되며 engine·viewport 는 타입 + 순수 함수만 참조한다. 세션 스키마 타입(`SessionFile` / `MoleculeSnapshot` / `AtomSnapshot` / `BondSnapshot` / `SerializedSelection`)은 io 가 아닌 **`src/chemistry/session/`** 에 정의하여 io·stores 가 순환 없이 하향 import 한다 (세부는 `details/phase-13-export-import.md` §7.2).
- UI 레이어 (`viewport`, `panels`, `components`) 는 도메인 상태에 **스토어를 거쳐서만** 접근한다.
- 동일 레이어 내 모듈 간 참조는 허용하되 **순환 의존은 금지** (ESLint `import/no-cycle` 등으로 강제).
- `data` 는 엔진·도메인이 읽는 **정적 자산 제공자** 이며 다른 레이어에 의존하지 않는다.
- §4 의 디렉터리 트리는 **예시적**이다. 각 Phase 는 `_shared/`·`ids/`·helper 하위 디렉터리를 필요 시 추가할 수 있으며, 위 레이어 의존·순환 금지 규칙만 위배하지 않으면 된다 (정확한 파일 레이아웃은 각 `phase-XX` §7).

---

## 5. 데이터 아키텍처 (Data Architecture, 고수준)

### 5.1 핵심 엔티티 (세부 스키마는 `details/phase-01`/`02`/`03` 에서 정의)

- `Element` — 원자번호, 기호, 이름(한/영), 원자량, 전기음성도, 전자배치, CPK 색상, 반지름(공유/판데르발스), 이온화에너지, 녹는점/끓는점 등
- `Compound` — CID (`CompoundId = Brand<number, 'CompoundId'>`), 식(molecular formula), SMILES, InChI, 분자량, 기본 3D 좌표(선택), 물성(존재 조건 등), 출처(`provenance: 'manifest' | 'runtime-fetch'`)
- `Atom` — 안정 ID (`AtomId = Brand<string, 'AtomId'>`), 원소 참조, 좌표, 포말 전하, 수소 수
- `Bond` — 안정 ID (`BondId = Brand<string, 'BondId'>`), 두 원자의 참조(`AtomId`로 지정 — 배열 인덱스 아님), 결합 차수(`BondOrder = 1 | 2 | 3 | 'aromatic'`), (선택) 결합 길이/각
- `Molecule` — Atom/Bond 집합, 총 전하, 스핀 다중도(선택)

> **식별 모델 (하이브리드, 동결).** 런타임 도메인 모델(`Atom`/`Bond`/`Molecule`)은 위 brand 안정 ID 를 보유한다 (편집·undo/redo·선택 직렬화가 인덱스 이동에 영향받지 않도록). 빌드타임 청크 JSON·세션 파일·SDF 등 **직렬화 형태는 컴팩트 정수 인덱스**를 사용하며, 단일 코덱(`idToIndex(molecule)` / `indexToId(...)`, Phase 01 정의)이 load/save **경계에서 결정적으로** 변환한다. ID 생성 팩토리(`createAtomId` / `createBondId` / `createMoleculeId`, `crypto.randomUUID` 기반)는 순수 chemistry 계층(`src/chemistry/compounds/ids.ts`)에 두어 stores/io/panels 가 모두 합법적으로 import 한다. 스키마 세부는 Phase 01 §4.2.

- `ReactionRule` — Reaction SMARTS 패턴, 필요 조건 범위(T/P/pH), `ThermoFlag`, 출처/신뢰도
- `Condition` — `{ temperatureK, pressureAtm, pH }`
- `ReactionResult` — 생성물 Molecule 목록, 적용된 규칙/휴리스틱, 실험적 여부 플래그

### 5.2 데이터 공급 파이프라인

1. **빌드타임 (Build-time)**
   - `scripts/pubchem-fetch/` 가 PubChem REST API에서 화합물을 배치 수집 (Rate limit: 5 req/sec 준수)
   - 필드 정규화 및 스키마 검증
   - 카테고리/자주 쓰는 순서에 따라 **청크 JSON**으로 분할하여 `src/data/compounds/`에 저장
   - 청크는 **동적 import**로 lazy load
2. **런타임 (Runtime)**
   - 번들 내 화합물 부족 시 `services/pubchem`이 PubChem API 호출
   - 결과는 IndexedDB 캐시에 저장 (차후 오프라인 조회 가능)
   - CORS: PubChem는 CORS 허용, 프록시 불요

### 5.3 청크/지연 로딩 전략

- 원소 데이터(118개, 크지 않음): 즉시 번들 (초기 화면용)
- 화합물: 카테고리(예: 무기물 기본, 유기 알케인, 알코올 등) 단위 청크 → 필요 시 동적 import
- 반응 규칙 DB: 유형별 청크 (산-염기, 산화-환원, 치환 등)
- RDKit.js WASM: 첫 사용 시점에 lazy init (진행 중 UI 인디케이터 표시)

---

## 6. 핵심 구성요소 (Core Components, 고수준)

각 구성요소의 상세 설계는 해당 Phase의 `details/` 문서에서 다룬다.

| 구성요소                   | 책임                                                                                                                                                                                                                                                           | 대응 Phase           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| **Chemistry Engine Core**  | 분자/결합/반응 도메인 모델, 원자가 계산, 불변 데이터 API                                                                                                                                                                                                       | 01, 02, 03           |
| **RDKit Service**          | RDKit.js WASM lazy init, SMILES/InChI/formula/SDF 파싱, 3D 임베드. 공통 인터페이스 `RdkitBackend` 를 노출하여 빌드타임(Phase 04 Node) 과 런타임(Phase 05 브라우저) 양쪽이 동일 시그니처 사용. Web Worker 경계 준비 (실제 분리는 Phase 14 가 측정 후 결정 — D6) | 03                   |
| **Compound Data Pipeline** | 빌드타임 PubChem 수집/정규화/청크화                                                                                                                                                                                                                            | 04                   |
| **Runtime Data Service**   | PubChem 런타임 호출, IndexedDB 캐시                                                                                                                                                                                                                            | 05                   |
| **Reaction Engine**        | 규칙 DB 매칭 + valence 휴리스틱 fallback, 조건 평가, 열역학 플래그 판정                                                                                                                                                                                        | 06                   |
| **State Stores**           | moleculeStore / reactionStore / uiStore / settingsStore                                                                                                                                                                                                        | 07                   |
| **3D Rendering Engine**    | R3F Scene, Atom/Bond 렌더러, 카메라/조명, 다중 분자 레이아웃                                                                                                                                                                                                   | 08                   |
| **Interaction System**     | 원자 드래그, 선택, 결합 생성/분리, 애니메이션                                                                                                                                                                                                                  | 09                   |
| **UI Framework**           | 앱 레이아웃, 리사이즈 패널 시스템                                                                                                                                                                                                                              | 10                   |
| **UI Panels**              | 주기율표, 화합물 검색, 조건, 분자 정보, 반응 결과, Toolbar                                                                                                                                                                                                     | 11                   |
| **Text Input Pipeline**    | SMILES/화학식 입력 → 파서 → 3D 생성                                                                                                                                                                                                                            | 12                   |
| **I/O**                    | PNG/JSON/SDF export, JSON import                                                                                                                                                                                                                               | 13                   |
| **i18n Layer**             | 한/영 리소스, 화학 용어 사전                                                                                                                                                                                                                                   | 01 (뼈대), 15 (완성) |

---

## 7. 구성요소 간 연결 (Data Flow)

### 7.1 단방향 흐름 원칙

```
 [User Input]
      │
      ▼
  ┌─────────┐                    ┌──────────────┐
  │  Panel  │ ── dispatch ──▶    │   Store      │
  │ / 3D UI │                    │  (Zustand)   │
  └─────────┘                    └──────┬───────┘
        ▲                               │
        │ subscribe (selector)          │ invoke
        │                               ▼
        │                        ┌──────────────┐
        │                        │   Engine     │
        │                        │ (pure TS)    │
        │                        └──────┬───────┘
        │                               │
        │                               │ (may call)
        │                               ▼
        │                        ┌──────────────┐
        │                        │  Services    │
        │                        │ (PubChem,    │
        │                        │  Cache)      │
        │                        └──────┬───────┘
        │                               │
        └───────────── updates ─────────┘
```

### 7.2 주요 플로우 예시

> 아래는 _예시적(illustrative)_ 데이터 흐름이다. 정확한 함수 시그니처는 각 Phase 상세 문서가 단일 정의한다. 파싱·3D 임베드·스토어 반영(commit)은 **`addFromSmiles` 액션 내부 단계**이며 별도 public 단계로 노출되지 않는다.

1. **SMILES 입력 → 3D 표시**
   `PanelInput → moleculeStore.addFromSmiles()` _(내부: `RdkitBackend.parseSmiles()` → `toMoleculeWith3D()`(= `RdkitBackend.embed`) → 스토어 commit)_ `→ viewport 리렌더`
2. **반응 실행**
   `ReactionPanel → reactionStore.run() → ReactionEngine.predict(reactants, condition) → reactionStore.setResult() → viewport 애니메이션 + ReactionResult 패널 갱신`
3. **화합물 검색 (번들 miss)**
   `CompoundBrowser → moleculeStore.load(name) → bundle lookup → (없으면) pubchem.fetch() → cache.set() → moleculeStore.commit()`

---

## 8. 상태 관리 설계 (State Management)

### 8.1 스토어 분할

| 스토어          | 책임                                                                                                                                                                                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `moleculeStore` | 현재 뷰포트에 존재하는 분자들, 편집 상태, 원자/결합 조작 API, **편집 히스토리 (Undo/Redo 스택)**                                                                                                                                                                                                         |
| `reactionStore` | 반응물 선택, 조건(T/P/pH), 실행 상태, 결과 (실험적 플래그 포함)                                                                                                                                                                                                                                          |
| `uiStore`       | 선택된 원자/결합, 활성 패널, 모달, 로딩/에러 상태, **뷰포트 표시 옵션**(원자 라벨 토글, 배경색 오버라이드 등), **전역 로딩 카운터**(`globalLoading.count`), **알림 큐**(`notifications` — 토스트 자료구조; 컴포넌트는 Phase 11), **화합물 검색 slice**(`compoundSearch`: query/mode/results/selectedCid) |
| `settingsStore` | **렌더 모드** (`ball-and-stick` 시작, 확장 가능), **언어**(`ko`/`en`), **단위계**(K↔°C, atm↔Pa), **테마**(`light`/`dark`/`system`), 색약 모드, 기타 사용자 전역 설정                                                                                                                                     |

### 8.2 규칙

- 스토어 간 **직접 참조 금지**. 공통 도메인 데이터는 `chemistry` 모듈의 순수 타입을 공유한다.
- 컴포넌트는 **selector** 로만 구독한다 (리렌더 최소화).
- 비동기 액션은 스토어에 정의하고, 중간 상태 (`loading`, `error`) 는 UI 가 관찰할 수 있도록 노출한다.
- **persist**: `settingsStore` 만 선택적 persist (`localStorage`). 다른 스토어는 세션 범위 + 명시적 export/import 로 세션 간 이동.
- **히스토리**: `moleculeStore` 내부에 Undo/Redo 스택을 두되, 공개 API 는 `undo()` / `redo()` / `canUndo` / `canRedo` 로 단순화 (세부 스냅샷 구조는 Phase 09).

---

## 9. 성능 예산 및 전략 (Performance)

### 9.1 초기 로드

- 진입 시 필요한 것: 앱 셸, 주기율표 데이터, 기본 UI 번들
- **제외(lazy)**: RDKit.js WASM, 화합물 청크, 반응 규칙 청크, 3D 뷰포트 번들
- 사전 예상 초기 번들: < 500 KB (gzip)
- 코드 스플리팅: 패널별, 뷰포트, 엔진을 각각 dynamic import

### 9.2 런타임 렌더

- three.js `InstancedMesh`로 원자 구 인스턴싱 (원자 수에 비례한 드로우콜 억제)
- 결합은 공용 실린더 지오메트리 재사용
- frustum culling 활용 (R3F 기본)
- **LOD**: 원자 수 임계치 초과 시 구 해상도 저감, 결합을 선으로 치환하는 모드 제공(Phase 14)
- 애니메이션은 `requestAnimationFrame` 중심, 불필요한 React 리렌더 방지(Zustand selector + R3F `useFrame`)

### 9.3 화학 엔진

- RDKit 호출은 **동일 스레드 blocking** 가능성 있음 → 긴 작업은 Web Worker로 이동 검토 (Phase 03 상세)
- 캐시: 동일 SMILES에 대한 파싱/임베드 결과 메모화

---

## 10. 테스트 전략 (Testing Strategy)

원칙: **모든 함수를 테스트하지 않는다. 핵심 로직과 핵심 동작만 테스트한다.**

### 10.1 유닛 테스트 (Vitest)

- `chemistry/` 순수 도메인 함수 (원자가, 전하 합계 등)
- `engine/parser` 의 대표 SMILES 케이스, 실패 메시지
- `engine/geometry` 의 결합각/길이 계산 정확성 (대표 분자로 검증)
- `engine/reaction` 의 규칙 매칭, 조건 평가, 휴리스틱 fallback
- 반응 결과 검증: 대표 반응(예: 중화, 에스테르화)에 대한 **골든 테스트(goldens)**

### 10.2 컴포넌트 테스트 (Testing Library)

- 주기율표 패널: 원소 선택 → 스토어 연동
- 화합물 검색 패널: 입력 → 결과 목록 (mock)
- 조건 패널: 슬라이더 변경 → 상태 반영
- 반응 결과 패널: 실험적 배지 표시 검증

### 10.3 E2E 테스트 (Playwright)

핵심 시나리오만 선별:

1. SMILES 입력 → 3D 분자 생성 → 캔버스 픽셀 존재 확인
2. 주기율표 원소 선택 → 정보 패널 표시
3. 반응 설정(반응물 + 조건) → 실행 → 결과 패널 노출 (애니메이션 비활성 옵션 활용)
4. PNG 내보내기 다운로드 검증
5. i18n 스위치: 한/영 전환

### 10.4 정확성(Correctness) 검증 장치

- 화학 도메인 특성상, **회귀 방지**를 위한 골든 fixture DB(`tests/fixtures/`) 유지
- 반응 엔진은 **알려진 반응 케이스 모음**으로 지속 검증
- CI에서 유닛/컴포넌트 테스트는 필수, E2E는 주요 PR/릴리스 시

---

## 11. 국제화 (i18n)

- 라이브러리: `react-i18next`
- 리소스: `src/i18n/ko.json`, `src/i18n/en.json`
- **화학 용어 사전**: 원소명, 작용기, 반응 유형을 별도 네임스페이스로 관리 (`chemistry.ko.json`, `chemistry.en.json`)
- 숫자/단위 포맷은 `Intl` API 사용, 단위계는 `settingsStore` 기반 토글
- 초기 언어 결정: 브라우저 언어 → 설정 저장값이 있으면 우선

---

## 12. 리스크 및 열린 질문 (Risks & Open Questions)

향후 Phase 진행 시 재확인이 필요한 항목:

1. **반응 예측의 근본 한계** — 본 프로젝트는 DB + 휴리스틱이지 ML 모델이 아님을 UI에서 **명시적으로 전달**해야 한다. Phase 06에서 "실험적 예측" 배지/모달 문구를 확정한다.
2. **PubChem 빌드타임 수집 범위** — "수천 종"의 기준(유기물 우선순위, 산업/교과 빈출 분자 등)을 Phase 04에서 **큐레이션 정책**으로 명문화한다.
3. **열역학 확장** — ΔH 값 도입 시 데이터 소스(NIST WebBook vs 결합에너지 근사)를 Phase 06 확장에서 결정한다.
4. **RDKit 작업의 메인 스레드 차단** — Phase 03 가 `RdkitBackend` 인터페이스 경계만 준비 (D6). 실제 Worker 이동 결정은 Phase 14 의 성능 측정 결과에 따른다.
5. **WebGL2 미지원 대응** — 안내 페이지와 최소 폴백(텍스트 정보만) 범위 정의 (Phase 10).
6. **이온/하전 분자의 3D 임베드** — **[해결 — Phase 03]** ETKDG 사전 검증 케이스(`[OH-]` / `[H3O+]` / `[Na+].[Cl-]` / `[SO4-2]`) 통과. 임베드 실패는 `IonHandlingFailed` 로 명시 반환 (phase-03 §5.4).

---

## 13. 작업 단계 (Phases)

전체 작업은 아래 **15개 Phase**로 나누어 진행한다. 각 Phase는 `details/phase-XX-*.md`에 상세 설계서를 가지며, architecture.md 승인 후 **번호 순서대로** 상세 문서 작성을 진행한다. 상세 문서 검토가 끝나야 해당 Phase의 구현을 시작한다.

> _의존 Phase 칼럼은 **직접 import 또는 retrofit 대상**인 선행 Phase 만 표기한다 (전이 의존은 생략). 정확한 의존 면은 각 `phase-XX` §3.1 선행 Phase 표 참조._

| #   | Phase 이름                            | 목적                                                                            | 주요 산출물                                                                                                                | 의존 Phase                 |
| --- | ------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| 01  | **Foundation & Schema**               | 프로젝트 스캐폴딩, 전역 타입/스키마, i18n 뼈대, 레이어 경계 설정, 라이선스 결정 | 디렉터리 골격, 공용 타입 선언, ESLint/Prettier/TS 설정, i18n 초기화, **CI(GitHub Actions) 기본 파이프라인**, 라이선스 파일 | —                          |
| 02  | **Element Data Layer**                | 118 원소 정적 데이터 및 보조 함수 정의                                          | `data/elements/*.json`, `chemistry/elements/` API                                                                          | 01                         |
| 03  | **Chemistry Engine (RDKit)**          | RDKit.js WASM lazy 래퍼, SMILES/InChI/formula 파싱, 3D 좌표 생성, 이온 지원     | `engine/rdkit/service.ts`, parser, geometry API                                                                            | 01, 02                     |
| 04  | **Compound Data Pipeline (빌드타임)** | PubChem 수집 스크립트, 정규화, 카테고리 청크                                    | `scripts/pubchem-fetch/`, `data/compounds/*.json`                                                                          | 03                         |
| 05  | **Runtime Data Layer (PubChem)**      | 런타임 PubChem 클라이언트, IndexedDB 캐시                                       | `services/pubchem`, `services/cache`                                                                                       | 03                         |
| 06  | **Reaction Engine**                   | 규칙 DB + 휴리스틱, 조건 평가, 흡/발열 판정, "실험적" 라벨                      | `engine/reaction/`, `data/reactions/`                                                                                      | 01, 02, 03, 04             |
| 07  | **State Management (Stores)**         | moleculeStore / reactionStore / uiStore / settingsStore                         | `stores/*.ts`                                                                                                              | 01, 03, 06                 |
| 08  | **3D Rendering Engine (R3F)**         | Scene, Atom/Bond 렌더러, 카메라/조명, 다중 분자 레이아웃                        | `viewport/scene/`, `viewport/renderers/`                                                                                   | 01, 02, 03, 07             |
| 09  | **3D Interaction System**             | 원자 드래그, 선택, 결합 생성/분리, 애니메이션                                   | `viewport/interactions/`, `viewport/animations/`                                                                           | 01, 03, 07, 08             |
| 10  | **UI Framework & Layout**             | 앱 레이아웃, 리사이즈 패널 시스템, 공통 컴포넌트 뼈대                           | `app/layout/`, `components/`                                                                                               | 01, 07, 08, 09             |
| 11  | **UI Panels**                         | 주기율표 / 화합물 검색 / 조건 / 분자 정보 / 반응 결과 / Toolbar(편리성 툴)      | `panels/*`                                                                                                                 | 07, 09, 10                 |
| 12  | **Text Input Pipeline**               | SMILES/화학식/InChI 입력 UI → 파싱 → 3D 생성 플로우                             | `panels/...Input`, 통합 플로우                                                                                             | 03, 07, 10, 11             |
| 13  | **Export / Import**                   | PNG(스크린샷), JSON(세션), SDF(구조) 내보내기, JSON 가져오기                    | `io/*`                                                                                                                     | 03, 07, 08, 09, 10, 11, 12 |
| 14  | **Performance Optimization**          | 초기 로드 3초 달성, 렌더 LOD, 필요 시 Web Worker 분리                           | 번들 분석 결과, LOD 구현                                                                                                   | 08, 11                     |
| 15  | **Testing & Polish**                  | E2E 시나리오, i18n 완성, 접근성 검증, 에러 경계, 최종 정리                      | Playwright 시나리오, 접근성 리포트                                                                                         | 전 Phase                   |

### 13.1 Phase 진행 규칙

1. **상세 설계 문서 작성 → 사용자 검토 → 승인 → 구현**의 순서를 엄수한다.
2. Phase 간 의존성 역행 금지. 의존 Phase가 미완이면 해당 Phase를 착수하지 않는다.
3. Phase 완료 시, 해당 Phase 문서에 정의된 **완료 기준(Definition of Done)** 을 모두 만족해야 한다.

---

## 14. 문서화 규약 (Documentation Conventions)

### 14.1 문서 구분

- **`architecture.md` (본 문서)**: 뼈대 — 원칙, 구조, 제약, Phase 목록. **상세 구현 방법 금지**.
- **`details/phase-XX-*.md`**: 각 Phase의 상세 설계서.

### 14.2 Phase 상세 문서 템플릿

각 `details/phase-XX-*.md` 는 다음 섹션을 갖는다.

1. **목적 (Purpose)** — 이 Phase가 해결하는 문제
2. **범위 (Scope)** — 포함/비포함 명시
3. **의존성 (Dependencies)** — 선행 Phase, 외부 라이브러리
4. **데이터 모델 / 타입** — TS 인터페이스, 스키마
5. **퍼블릭 API / 인터페이스** — 함수 시그니처, 스토어 액션
6. **알고리즘 / 핵심 로직** — 의사코드, 수식, 예시
7. **파일/모듈 레이아웃** — 어떤 파일이 생기는지
8. **테스트 계획** — 유닛/컴포넌트/E2E 항목
9. **리스크 및 대안** — 실패 시 대응
10. **완료 기준 (Definition of Done)**

### 14.3 파일 명명

`details/phase-{두자리}-{kebab-case}.md`
예: `details/phase-03-chemistry-engine.md`

### 14.4 용어 일관성

- 한국어 문서라도 기술 용어(SMILES, InChI, VSEPR, valence 등)는 원문 유지
- 원소명은 한국어/영어 병기 필요 시 `원소명(ko) / element name (en)` 형식

---

## 15. 승인 및 다음 단계

본 `architecture.md` 는 사용자 검토 후 다음 순서로 다음 단계로 이행한다.

1. 사용자 검토 및 피드백 반영
2. `details/phase-01-foundation.md` 작성 시작 (승인 후)
3. 이후 Phase 순차 상세 문서화 (각각 별도 검토·승인)
4. **모든 details 문서가 승인된 후에만** 실제 코드 작성 착수

---

_문서 버전: 0.1 (초안)_
_작성일: 2026-04-19_
