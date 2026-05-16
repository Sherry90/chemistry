# Phase 10 — UI Framework & Layout

> 본 문서는 `architecture.md` §13 의 Phase 10 상세 설계서다. 코드 작성은 모든 details 문서의 검토가 끝난 뒤에만 시작한다.
>
> **선행 문서**: `architecture.md` (특히 §1.3 ⑪, §3.2 성능 예산, §3.4 ⑥, §3.5 접근성, §3.7 에러 처리·ErrorBoundary, §3.10 뷰포트 표시 기본값, §4.1 레이어, §6 핵심 구성요소, §8 상태 관리, §13 의존 Phase 칼럼 정의, §66 라이브러리 추가 절차, §12 #5 WebGL2), `details/phase-01-foundation.md`, `details/phase-07-state-management.md`, `details/phase-08-rendering.md`, `details/phase-09-interactions.md`. (Phase 02–06 은 본 Phase 가 직접 import 하지 않으나 도메인 타입의 출처로 인용.)

---

## 1. 목적 (Purpose)

본 Phase 는 다음을 완성한다.

1. **AppLayout 프레임** — 상단 가로 Toolbar 슬롯 + 좌측 Viewport + 우측 docked 사이드 패널의 단일 레이아웃을 `react-resizable-panels` 로 구현. 사이드패널은 마우스 + 키보드 리사이즈 가능, ModalHost 와 ToastContainer 와 LoadingOverlay 를 portal 로 동거.
2. **Phase 08 `<Viewport>` lazy chunk 마운트 위치** 확정 (phase-08 D7 약속의 닫음). `React.lazy(() => import('@/viewport'))` + `<Suspense fallback={<LoadingOverlay variant="viewport"/>}>` + `apiRef` forward.
3. **WebGL2 미지원 fallback 페이지** UI 확정 (`architecture.md` §12 #5, phase-08 §2.2 약속의 닫음).
4. **패널별 보조 ErrorBoundary 도입 여부** 결정 (`architecture.md` §3.7 약속의 닫음). 결론: **`<PanelErrorBoundary>` 한 단계 추가** — Toolbar / Sidepanel / Modal / Viewport 슬롯별 격리. fallback UI 는 _해당 영역만_ 차지.
5. **Phase 09 단축키 install/cleanup 통합** (phase-09 §12 a/b/c 인계의 닫음). `installAppShortcuts()` 가 `installGlobalUndoShortcuts()` 를 호출하고 cleanup 함수를 반환, `<AppLayout>` 의 `useEffect` 에서 mount/unmount 라이프사이클에 결합.
6. **테마 구체적 팔레트 토큰** 확정 (phase-01 §60, §717 약속의 닫음). CSS 변수 시스템으로 light/dark/cvd 모드 비파괴 확장 가능.
7. **공통 UI primitives 뼈대** — Radix UI primitives 위에 Tailwind 디자인 토큰 + i18n 라벨 prop 을 얹은 13 종 (`Button` / `IconButton` / `Tooltip` / `Dialog` / `Tabs` / `Slider` / `Switch` / `Spinner` / `Input` / `Popover` / `Separator` / `Label` / `VisuallyHidden`).
8. **PanelRegistry** — Phase 11 의 패널 (PeriodicTable / CompoundBrowser / Conditions / MoleculeInfo / ReactionResult — Toolbar 는 직접 주입 결정으로 미등록) 이 `registerPanel(def)` 한 번 호출만으로 SidePanelHost / ModalHost 의 자동 슬롯 마운트 가능.

본 Phase 는 `architecture.md` §12 의 열린 질문 중 **#5 WebGL2 미지원 대응** 을 닫는다. **#1 (반응 예측 한계 UI 문구)**, **#2 (큐레이션 정책)**, **#3 (ΔH 데이터 소스)** 는 본 Phase 영역 외.

---

## 2. 범위 (Scope)

### 2.1 포함

#### 레이아웃 / 슬롯

- **`<AppLayout/>`** — 최상위 레이아웃 컨테이너. 상단 Toolbar 슬롯 (높이 56 px 고정) + 좌측 Viewport + 우측 docked 사이드 패널의 가로 `PanelGroup`. ModalHost / ToastContainer / LoadingOverlay 를 portal 로 동거.
- **`<ToolbarSlot/>`** — Toolbar 가로 컨테이너. 자식은 Phase 11 가 주입 (Toolbar 의 실제 버튼 / 단축키 도움말 표시 / 렌더 모드 토글 등).
- **`<SidePanelHost/>`** — `uiStore.panels.active` selector 구독 → `PanelRegistry` 에서 정의 조회 → `React.lazy` 로 패널 컴포넌트 마운트. mode='docked' 만 처리 (mode='modal' 은 ModalHost 로).
- **`<ModalHost/>`** — `uiStore.panels.is{PeriodicTable,CompoundBrowser,ReactionResult}Open` 등 독립 토글 플래그 별 Radix `<Dialog>` 마운트. open/onOpenChange 가 store action 과 양방향 바인딩.
- **`<ViewportHost/>`** — Phase 08 `<Viewport>` lazy chunk 의 마운트 위치. WebGL2 가드 + Suspense fallback + ViewportApi forward.
- **`<WebGL2FallbackPage/>`** — `detectWebGL2().ok=false` 시 표시할 전체 화면 안내. i18n 키 `app.webgl2Unsupported.{title,reason,suggestion,docsLink}`.
- **`<ToastContainer/>`** — `uiStore.notifications` 큐 구독, 화면 하단-우측 위치 plain wrapper (live region 역할 없음 — 중첩 방지). 발화는 per-item `<ToastItem>` (Phase 11 §6.7) 이 단독 소유. 토스트 외양은 Phase 11.
- **`<LoadingOverlay variant/>`** — `variant: 'app' | 'viewport' | 'panel'`. 'app' 은 `uiStore.globalLoading.count > 0` 자동 구독, 'viewport' / 'panel' 은 `<Suspense fallback>` 용도.

#### ErrorBoundary

- **`<AppErrorBoundary/>`** — Phase 01 의 최상위 `<ErrorBoundary>` 를 본 Phase 가 retrofit 으로 _교체_ (Phase 01 §5.2 의 placeholder ErrorBoundary 와 동일 위치). fallback UI 는 i18n 부팅 실패 안전을 위해 _정적 영문 fallback_ 유지하되 디자인 토큰 (CSS 변수) 적용.
- **`<PanelErrorBoundary panelKey/>`** — 슬롯별 보조 ErrorBoundary. fallback UI 는 _해당 영역만_ 차지하는 인라인 메시지 + `Retry` 버튼 (시도 한도 3회). Phase 09 §12 b 인계 정합 — _런타임 예외_ 만 포착, 도메인 실패는 Result 패턴으로 stores 에 반영됨.

#### 단축키 / 부트스트랩

- **`installAppShortcuts(opts): () => void`** — Phase 09 `installGlobalUndoShortcuts()` 호출 + cleanup 등록. `<AppLayout>` 마운트 시 `useEffect` 에서 호출, return 값을 cleanup 으로 등록 (P6 정합).
- **`useWebGL2Detection()`** — `detectWebGL2()` 1 회 호출 + `useMemo` 캐시.
- **`useUndoableDispatcher()`** — Phase 09 의 `createUndoStack()` 결과를 React 컨텍스트로 노출하여 `<AppLayout>` 와 Phase 11 Toolbar 가 동일 dispatcher 참조.

#### PanelRegistry

- **`registerPanel(def: PanelDefinition): void`** — Phase 11 가 부팅 시 한 번 호출.
- **`getPanelRegistry(): PanelRegistry`** — 디버깅 / SSR / 테스트 용. (실 마운트는 React 측에서 `usePanelDefinition(key)` 로.)
- **`usePanelDefinition(key: PanelKey): PanelDefinition | undefined`** — SidePanelHost / ModalHost 가 사용.

#### 공통 컴포넌트 primitives (`@/components`)

13 종 — Radix UI 위에 Tailwind class + 디자인 토큰 + i18n 라벨 prop 을 얹은 단일 패턴 (§6.11). 모든 컴포넌트는 `forwardRef` 로 ref 전달.

| 컴포넌트                                                                      | Radix 의존                        | 주 사용처 (Phase 11+)                                                    |
| ----------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------ |
| `Button`                                                                      | `@radix-ui/react-slot` (asChild)  | Toolbar / Conditions / Dialog 액션                                       |
| `IconButton`                                                                  | (Button 위)                       | Toolbar / Tooltip 동반                                                   |
| `Tooltip`                                                                     | `@radix-ui/react-tooltip`         | Toolbar 단축키 도움말                                                    |
| `Dialog` (`Root` / `Trigger` / `Content` / `Title` / `Description` / `Close`) | `@radix-ui/react-dialog`          | PeriodicTable / CompoundBrowser / ReactionResult / SMILES Input / Export |
| `Tabs` (`Root` / `List` / `Trigger` / `Content`)                              | `@radix-ui/react-tabs`            | ReactionResult (적용 규칙 ↔ 휴리스틱) / MoleculeInfo                     |
| `Slider`                                                                      | `@radix-ui/react-slider`          | Conditions (T/P/pH)                                                      |
| `Switch`                                                                      | `@radix-ui/react-switch`          | Toolbar (라벨 토글, CVD 모드, 라이트/다크)                               |
| `Spinner`                                                                     | (자체)                            | LoadingOverlay 내부 + Button loading                                     |
| `Input`                                                                       | (자체, native `<input>` + 토큰)   | SMILES / 검색 / 단위 입력                                                |
| `Popover` (`Root` / `Trigger` / `Content`)                                    | `@radix-ui/react-popover`         | Toolbar 도움말 / 단축키 시트                                             |
| `Separator`                                                                   | `@radix-ui/react-separator`       | Toolbar / 패널 헤더                                                      |
| `Label`                                                                       | `@radix-ui/react-label`           | Conditions / 입력 폼                                                     |
| `VisuallyHidden`                                                              | `@radix-ui/react-visually-hidden` | 스크린 리더 전용 텍스트                                                  |

#### 테마 토큰 시스템

- `src/app/layout/styles/theme.css` — CSS 변수 `--bg-canvas` / `--bg-panel` / `--bg-panel-elevated` / `--fg-primary` / `--fg-muted` / `--border` / `--accent` / `--accent-fg` / `--error` / `--warn` / `--success` 정의.
- `:root` (light) / `.dark` / `.cvd` 셀렉터 별 변수 재정의. `.cvd` 는 자리만 마련 (Phase 15 가 색약 안전 팔레트 채움 — D9).
- `tailwind.config.ts` retrofit — `theme.extend.colors` 가 CSS 변수 참조 (`'bg-canvas': 'var(--bg-canvas)'` 등). 토큰 변경은 CSS 변수 변경만으로 가능.

### 2.2 비포함

| 항목                                                                                                      | 인계 Phase                                                     |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 패널의 _내용물_ (PeriodicTable / CompoundBrowser / Conditions / MoleculeInfo / ReactionResult 의 실제 UI) | 11                                                             |
| Toolbar 의 _실제 버튼_ (Undo/Redo, frame, captureBlob, 라벨 토글, 렌더 모드, 테마, 언어)                  | 11                                                             |
| 토스트 _외양_ (`<ToastItem>` 의 색/아이콘/dismiss UX)                                                     | 11                                                             |
| SMILES / 화학식 / InChI 입력 컴포넌트 + 파싱 플로우                                                       | 12                                                             |
| Export / Import 다이얼로그 (PNG / JSON / SDF)                                                             | 13                                                             |
| `LoadingOverlay` 의 진행률 표시 (RDKit WASM 다운로드 progress 등)                                         | 14 (Web Worker 도입 시 결정)                                   |
| **a11y axe 자동 검증** + CVD 모드 실 팔레트 + 모든 i18n 문구 완성                                         | 15                                                             |
| 모바일/태블릿 반응형 (브레이크포인트 / 터치 인터랙션)                                                     | **비목표** (`architecture.md` desktop-first; §2.3 비결정 명시) |

### 2.3 명시적 비결정 / 후속 결정 영역

| 영역                                                      | 사유                                                                                                    | 결정 시점                            |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 모바일 브레이크포인트 / 반응형                            | desktop-first 에 따라 본 Phase 비대상. 1024 px 미만 진입 시 안내 텍스트만 표시 (R5)                     | Phase 14+ 가 사용자 요구 강도에 따라 |
| 사이드패널 폭 미세 튜닝 (D6 의 320/240/600 px)            | Phase 11 패널 콘텐츠 (PeriodicTable 18×7, CompoundBrowser 검색) 실측 후 조정 가능                       | Phase 11                             |
| ToastContainer 정확한 위치 (D7 의 right-4 bottom-4)       | 토스트 외양 (높이, dismiss UX) 결정 시 동시 확정                                                        | Phase 11                             |
| 아이콘 라이브러리 (D10 의 `lucide-react` 잠정)            | `@radix-ui/react-icons` 와 비교 — bundle 영향 + 화학 분야 아이콘 다양성                                 | §11 #1 (사용자 확정)                 |
| `LoadingOverlay` 진행률 표시                              | RDKit WASM 다운로드 progress event 를 `engine/rdkit/service.ts` 가 노출할지 결정 후                     | Phase 14                             |
| `<AppErrorBoundary>` fallback UI 의 디자인 토큰 적용 정도 | i18n 부팅 실패 안전을 위해 정적 영문 fallback 유지가 _제약_ — 본 Phase 는 토큰만 적용, Phase 15 가 검증 | Phase 15                             |

---

## 3. 의존성 (Dependencies)

### 3.1 선행 Phase (직접 import / retrofit 대상)

| Phase                 | 본 Phase 가 사용하는 것                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **01 (Foundation)**   | `<ErrorBoundary>` (retrofit), `<I18nProvider>`, `<ThemeProvider>`, `<AppShell>` placeholder (retrofit → `<AppLayout/>`), `Logger` (`logger.error` for boundary), `Brand<T,K>` (PanelKey 등), `Result<T,E>` (참조만), i18n 네임스페이스 `common` (Toast / Dialog / Tooltip 라벨). `tailwind.config.ts` retrofit (theme.extend.colors → CSS 변수).                                                                                                                                                                                                                                                                              |
| **07 (Stores)**       | `useUiStore` / `useSettingsStore`, selector: `selectActivePanel` (phase-07 §5.3), `selectNotifications`, `selectIsGloballyLoading` (count>0 derive), `selectTheme`, `selectLocale`, `selectIsCvdOn`, `selectAtomLabelsOn`, `selectBackgroundOverride`. action: `actions.dismissNotification`, `actions.setActivePanel`, `actions.togglePeriodicTable(open?)` / `actions.toggleCompoundBrowser(open?)` / `actions.toggleReactionResult(open?)` (phase-07 §5.3 — close 동작은 `toggleX(false)`). Notification 타입 (phase-07 §4.4). PanelKey 유니온. UndoableDispatcher 인터페이스 (Phase 09 가 `createUndoStack()` 으로 채움). |
| **08 (Rendering)**    | `<Viewport apiRef fallback className />` (default lazy export), `ViewportApi` (frameActive / frameAll / resetCamera / captureBlob / getRenderer / canUndo / canRedo / createBondFromSelection — phase-09 retrofit 포함), `detectWebGL2(): WebGLDetectResult`, `WebGLDetectResult` 타입.                                                                                                                                                                                                                                                                                                                                       |
| **09 (Interactions)** | `KEY_MAP`, `KeyBinding`, `KeyActionId`, `installGlobalUndoShortcuts(opts): () => void`, `describeKey(binding: KeyBinding): string` (Toolbar 인계용 — 본 Phase 는 미사용), `createUndoStack(opts): UndoableDispatcher` (본 Phase 의 `useUndoableDispatcher` 가 호출), `useUndoStack()` (Phase 11 Toolbar 가 사용 — 본 Phase 는 인계만).                                                                                                                                                                                                                                                                                        |

본 Phase 는 `chemistry` / `engine` / `services` / `data` 를 **직접 import 하지 않는다** (P1 — `architecture.md` §4.1 다이어그램의 _위에서 아래_ 만 허용; 본 Phase 는 stores 와 viewport/panels/components 사이에 위치).

### 3.2 외부 라이브러리 (architecture §66 신규 도입 절차)

본 Phase 가 `architecture.md` §2 Tech Stack 에 **추가** 도입하는 라이브러리 4 종. 각 항목은 _용도 / 번들 영향 / 대안 비교_ 를 명시한다.

| 라이브러리                                                                                    | 버전  | 용도                                                                  | gzip 추정                                           | 대안 비교 / 거절 사유                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react-resizable-panels`                                                                      | ^2.x  | 사이드패널 가로 리사이즈 + 키보드 nav (좌/우 키 = 1% 이동) + collapse | **~6 KB**                                           | (a) 자체 구현 — 드래그 + ARIA `aria-orientation` + 키보드 + collapse 회복 비용 ↑ → 거절. (b) `react-split-pane` — 유지보수 정체, ARIA 부족 → 거절.                                                                                                            |
| `@radix-ui/react-{dialog,tooltip,tabs,slider,switch,popover,separator,label,visually-hidden}` | ^1.x  | UI primitives — focus trap, ARIA, 키보드 nav 무료                     | **합계 ~30–50 KB** (사용 primitive 단위 개별 chunk) | (a) `@headlessui/react` — primitive 커버리지 ↓ (Slider / Tabs 부재) → 거절. (b) 자체 구현 — `architecture.md` §3.5 의 ARIA / 포커스 트랩 / 키보드 nav 보장 비용 ↑ → 거절. (c) `react-aria` (Adobe) — primitive 마다 hook + 컴포넌트 분리, 학습 곡선 ↑ → 거절. |
| `@radix-ui/react-slot`                                                                        | ^1.x  | `<Button asChild>` 컴포지션                                           | **~1 KB**                                           | Radix 표준 패턴 — 대안 없음.                                                                                                                                                                                                                                  |
| `lucide-react`                                                                                | ^0.4x | 아이콘 (D10 잠정)                                                     | tree-shakeable, 사용 아이콘만 — 아이콘당 ~0.5 KB    | (a) `@radix-ui/react-icons` — 300+ 아이콘으로 화학 / 분자 / 결합 아이콘 부족 → D10 잠정 거절 (사용자 확정 §11 #1). (b) 자체 SVG — 유지비용 ↑ → 거절.                                                                                                          |

**번들 예산 정합** — `architecture.md` §3.2 의 `< 500 KB gzip` 초기 번들 예산 검증:

- `react-resizable-panels` 는 `<AppLayout>` 직속이므로 _초기 chunk_ 포함 → +6 KB
- Radix primitive 는 사용처가 _패널/모달_ 이므로 **panels/\* lazy chunk 에 자연 분리** (Phase 14 번들 분석에서 검증)
- `lucide-react` 는 사용 아이콘만 tree-shake → Toolbar 에 사용된 ~10–15 개 아이콘 = ~5–10 KB
- `@radix-ui/react-slot` 은 Button 직속이므로 초기 chunk → +1 KB

**예상 초기 번들 영향: +12 KB gzip 이내** (Phase 14 가 실측으로 검증).

본 Phase 는 외부 라이브러리 외에 _Tailwind utility 클래스 머지_ 를 위한 자체 의존이 필요:
| 라이브러리 | 용도 | gzip | 비고 |
|---|---|---|---|
| `clsx` | 조건부 className 결합 | <1 KB | de-facto 표준 |
| `tailwind-merge` | conflicting Tailwind class 해소 (예: `'p-4 p-6'` → `'p-6'`) | ~7 KB | shadcn/ui 표준 패턴 |

총 7 종 신규 (`react-resizable-panels` / 9 개 Radix primitive package / `@radix-ui/react-slot` / `lucide-react` / `clsx` / `tailwind-merge`).

### 3.3 결정 사항

#### 선결정 사항 (P-table — 선행 Phase / architecture 가 이미 동결)

| ID      | 내용                                                                                                                                                                                                                                      | 출처                                   |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **P1**  | 레이어 가드 — 본 Phase 는 `src/app/layout/`, `src/components/` 만 추가. `viewport/`, `engine/`, `services/`, `chemistry/`, `data/` 를 _직접_ import 하지 않는다 (stores 만 통과)                                                          | `architecture.md` §4.1                 |
| **P2**  | `<Viewport>` 단일 마운트 위치는 본 Phase                                                                                                                                                                                                  | phase-08 D7                            |
| **P3**  | 최상위 `<ErrorBoundary>` 는 Phase 01 가 이미 장착 — 본 Phase 는 _분할만_ 추가하고 최상위 인스턴스는 _retrofit 으로 fallback UI 만_ 갱신                                                                                                   | `architecture.md` §3.7, phase-01 §5.2  |
| **P4**  | Phase 09 `KEY_MAP` import 의무. 본 Phase 와 Phase 11 의 패널 단축키는 우선순위 4 영역 (phase-09 §4.5)                                                                                                                                     | phase-09 §12 a                         |
| **P5**  | 도메인 실패는 Result 패턴; `<ErrorBoundary>` 는 _런타임 예외_ 만 포착 (예: raycast NaN, undefined property access)                                                                                                                        | `architecture.md` §3.7, phase-09 §12 b |
| **P6**  | `installGlobalUndoShortcuts()` 의 cleanup 함수를 본 Phase 의 `<AppLayout>` unmount 시 호출 의무                                                                                                                                           | phase-09 §12 c                         |
| **P7**  | 테마 토글 (`<html class="dark">`) 작동은 Phase 01 가 완료 — 본 Phase 는 _팔레트 토큰_ 만 확정                                                                                                                                             | phase-01 §60 / §717                    |
| **P8**  | `persist` 미들웨어는 `settingsStore` 만 (phase-07 §4.5) — 본 Phase 는 `localStorage` 직접 쓰지 않는다                                                                                                                                     | phase-07 §4.5                          |
| **P9**  | `uiStore.notifications` 큐 자료구조 (`Notification` 타입, push/dismiss 액션, 큐 길이 상한 50) 는 Phase 07 D4 가 확정 — 본 Phase 의 ToastContainer 는 _큐 구독 + 위치 plain wrapper_ 만 (live region 은 per-item ToastItem 소유, Phase 11) | phase-07 D4 / §4.4                     |
| **P10** | `uiStore.panels.active: PanelKey \| null` + 독립 토글 플래그 (`is{PeriodicTable,CompoundBrowser,ReactionResult}Open`) 의 의미 분기 — Phase 07 가 확정. 본 Phase 는 selector 로만 구독                                                     | phase-07 §4.4                          |
| **P11** | `architecture.md` §3.10 뷰포트 표시 기본값 (atom 라벨 off, hover 툴팁 on, 등각 3/4 카메라, 결합 차수 다중 실린더) 은 Phase 08 가 구현 — 본 Phase 는 _Toolbar 슬롯_ 만 제공, 토글 UI 는 Phase 11                                           | `architecture.md` §3.10, phase-08      |

#### 본 Phase 결정 (D-table)

| ID      | 질문                                     | 확정 답                                                                                                                                                                                                                                                                                                                                       | 본문 영향              |
| ------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **D1**  | 레이아웃 토폴로지                        | 상단 가로 Toolbar (높이 56 px) + 좌측 Viewport + 우측 docked 사이드 패널. ModalHost / ToastContainer / LoadingOverlay 는 portal                                                                                                                                                                                                               | §6.1, §6.3, §6.8, §6.9 |
| **D2**  | 리사이즈 라이브러리                      | `react-resizable-panels` (`<PanelGroup direction="horizontal">` + `<Panel>` + `<PanelResizeHandle>`)                                                                                                                                                                                                                                          | §3.2, §6.1             |
| **D3**  | 공통 컴포넌트 primitive 출처             | Radix UI primitives (headless) 위에 Tailwind 디자인 토큰 + i18n 라벨 prop 을 얹는 단일 패턴                                                                                                                                                                                                                                                   | §3.2, §6.11            |
| **D4**  | 패널별 ErrorBoundary 깊이                | **`<PanelErrorBoundary panelKey/>` 한 단계 추가**. Toolbar / Sidepanel / Modal / Viewport 슬롯별 격리. fallback UI = 영역만 차지하는 인라인 메시지 + Retry 버튼. 시도 한도 = 3 회 (R3)                                                                                                                                                        | §6.5, §10              |
| **D5**  | WebGL2 fallback 페이지 구조              | `<WebGL2FallbackPage result/>` 가 전체 화면 안내. textual 정보 (브라우저 업데이트 권장 + WebGL2 활성화 가이드 링크). i18n 키 `app.webgl2Unsupported.{title,reason,suggestion,docsLink}`. 사이드패널은 작동 (PeriodicTable 정적 정보 등) — Viewport 만 비활성                                                                                  | §6.10                  |
| **D6**  | 사이드패널 폭 기본/최소/최대             | 320 / 240 / 600 px. PanelGroup 의 percentage 기반이므로 viewport width = 1280 가정 시 25 / 18.75 / 46.9 % 로 매핑. Phase 11 후 미세 튜닝 가능 (§11 #2)                                                                                                                                                                                        | §6.1                   |
| **D7**  | ToastContainer 위치 + a11y               | `right-4 bottom-4` 고정 (Tailwind class). 컨테이너는 **plain wrapper (live region 역할 없음)** — 발화는 per-item `<ToastItem>` (Phase 11 §6.7) 이 `role="alert"\|"status"` + `aria-live` 로 단독 소유 (중첩 live region 금지). `pointer-events-none` 컨테이너 + 자식 토스트만 `pointer-events-auto`. 큐 길이 상한 50 은 Phase 07 가 보장 (P9) | §6.8, D7               |
| **D8**  | 전역 단축키 mount 위치                   | `<AppLayout>` 의 `useEffect` 에서 `installAppShortcuts({ dispatcher })` 호출, return cleanup 을 useEffect cleanup 에 등록. dispatcher 는 `useUndoableDispatcher()` (React 컨텍스트)                                                                                                                                                           | §6.6                   |
| **D9**  | 테마 토큰 시스템                         | CSS 변수 (`src/app/layout/styles/theme.css`) — `:root` (light) / `.dark` / `.cvd` 셀렉터. `tailwind.config.ts` 의 `theme.extend.colors` 가 변수 참조. CVD 모드 (Phase 15) 는 변수 재정의로 비파괴 추가                                                                                                                                        | §6.7                   |
| **D10** | 아이콘 라이브러리                        | `lucide-react` (잠정 — 사용자 확정 §11 #1). 화학/분자 아이콘 다양성 우위, tree-shakeable, MIT 라이선스                                                                                                                                                                                                                                        | §3.2, §11 #1           |
| **D11** | `<Viewport>` Suspense fallback           | `<LoadingOverlay variant="viewport">` (RDKit WASM + 3D 번들 로드 진행 중 인디케이터)                                                                                                                                                                                                                                                          | §6.4                   |
| **D12** | ModalHost Esc 처리 / Phase 09 Esc 충돌   | Radix `<Dialog>` 가 portal + focus trap + Esc 자체 관리. Modal 열림 시 Esc 가 Dialog 에 captured (Radix 표준) — Phase 09 의 `Esc=clearSelection` 은 _Viewport-focused_ 이벤트라 자연 분리 (phase-09 P3)                                                                                                                                       | §6.3                   |
| **D13** | Toolbar / Sidepanel / Modal children API | composition 패턴. 본 Phase 는 _슬롯 컴포넌트_ 만 제공, Phase 11 가 자식 element 를 props 또는 `registerPanel` 로 주입                                                                                                                                                                                                                         | §5.1, §5.4             |
| **D14** | PanelRegistry 도입 여부                  | **도입**. Phase 11 의 패널이 `registerPanel(def)` 한 번 호출만으로 자동 슬롯 마운트 (phase-11 P2/D1 결과 5 개 등록 — Toolbar 는 직접 주입). `PanelDefinition` 인터페이스 본 Phase 가 정의                                                                                                                                                     | §4.1, §5.2             |
| **D15** | `<AppErrorBoundary>` fallback i18n       | **정적 영문 + 디자인 토큰**. i18n 부팅 실패 시 안전 (Phase 01 §389 정합). 본 Phase 는 _디자인 토큰 적용_ 만, 텍스트는 영문 정적 유지                                                                                                                                                                                                          | §6.5, §11 #6           |
| **D16** | `<LoadingOverlay variant>` 의 ARIA       | 모든 variant `aria-busy="true"` + `<VisuallyHidden>` 으로 "로딩 중" 텍스트. variant='app' 만 `role="alert"` 으로 스크린 리더 즉시 안내                                                                                                                                                                                                        | §6.9                   |
| **D17** | dispatcher 컨텍스트 위치                 | `<AppLayout>` 내부에서 `createUndoStack()` 1 회 호출 후 React 컨텍스트로 노출. Phase 11 Toolbar 의 `useUndoStack()` 도 같은 컨텍스트를 통해 접근                                                                                                                                                                                              | §6.6                   |

---

## 4. 데이터 모델 / 타입

### 4.1 PanelDefinition (`src/app/layout/panels/types.ts`)

```ts
import type { PanelKey } from '@/stores/uiStore';

export type PanelMode = 'docked' | 'modal';

/**
 * Phase 11 의 각 패널이 부팅 시 등록하는 정의.
 *
 * - `key`: uiStore.panels.active 또는 uiStore.panels.is*Open 토글에 매핑.
 * - `mode='docked'`: SidePanelHost 가 active=key 일 때 마운트.
 * - `mode='modal'`: ModalHost 가 isXxxOpen=true 일 때 Radix Dialog 로 마운트.
 * - `i18nTitleKey`: common.json 의 키 (예: 'panels.periodicTable.title').
 * - `load`: React.lazy 호환 동적 import (`() => import('@/panels/PeriodicTable')`).
 */
export interface PanelDefinition {
  readonly key: PanelKey;
  readonly mode: PanelMode;
  readonly i18nTitleKey: string;
  readonly load: () => Promise<{ default: React.ComponentType }>;
}

export type PanelRegistryMap = Readonly<Partial<Record<PanelKey, PanelDefinition>>>;
```

`Partial<Record<...>>` 인 이유: 등록될 패널 집합 (phase-11 결정상 5 개) 을 _모두_ 등록한다고 가정하지 않는다 — 일부 패널은 본 Phase 구현 검증 단계에서 미등록 상태일 수 있다 (테스트 / mock). `'toolbar'` PanelKey 는 phase-11 P2 의 직접 주입 결정으로 영구 미등록.

### 4.2 AppLayout props (`src/app/layout/AppLayout.tsx`)

```ts
import type { ViewportApi } from '@/viewport';

export interface AppLayoutProps {
  /**
   * Toolbar 내용. Phase 11 가 <ToolbarBar /> 등을 주입.
   * 미지정 시 ToolbarSlot 은 빈 컨테이너 (높이만 유지).
   */
  readonly toolbar?: React.ReactNode;

  /**
   * Viewport 의 imperative API ref. Toolbar 의 frame/reset/captureBlob 버튼이
   * 호출. Phase 11 ToolbarBar 가 동일 ref 를 useRef 로 생성하여 본 prop 과
   * Toolbar 양쪽에 forward.
   */
  readonly viewportApiRef?: React.Ref<ViewportApi>;
}
```

### 4.3 WebGL2FallbackPage props (`src/app/layout/WebGL2FallbackPage.tsx`)

```ts
import type { WebGLDetectResult } from '@/viewport';

export interface WebGL2FallbackPageProps {
  readonly result: WebGLDetectResult; // ok=false 만 의미 있음
}
```

### 4.4 ErrorBoundary fallback props

```ts
// src/app/layout/AppErrorBoundary.tsx
export interface AppErrorFallbackProps {
  readonly error: Error;
  readonly reset: () => void; // 페이지 새로고침 권장 — 정적 영문 fallback (D15)
}

// src/app/layout/PanelErrorBoundary.tsx
import type { PanelKey } from '@/stores/uiStore';

export interface PanelErrorFallbackProps {
  readonly error: Error;
  readonly reset: () => void;
  readonly attemptCount: number; // 0 시작, Retry 마다 +1, 3 도달 시 Retry 비활성 (D4)
  readonly panelKey?: PanelKey; // 어느 슬롯에서 발생했는지 (i18n 라벨 + logger.error 메타)
  readonly slotName: 'toolbar' | 'sidepanel' | 'modal' | 'viewport'; // panelKey 가 없을 때 fallback
}
```

### 4.5 LoadingOverlay props

```ts
export type LoadingOverlayVariant = 'app' | 'viewport' | 'panel';

export interface LoadingOverlayProps {
  readonly variant: LoadingOverlayVariant;
  /** variant='app' 외에는 외부에서 명시 표시. variant='app' 은 globalLoading 자동 구독. */
  readonly visible?: boolean;
  /** ARIA aria-label override. 미지정 시 i18n 키 사용. */
  readonly labelKey?: string;
}
```

### 4.6 InstallAppShortcutsOpts

```ts
import type { UndoableDispatcher } from '@/stores/_shared/undo';

export interface InstallAppShortcutsOpts {
  readonly dispatcher: UndoableDispatcher;
}
```

### 4.7 공통 컴포넌트 props (선택 발췌)

#### Button

```ts
import type { Slot } from '@radix-ui/react-slot';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly loading?: boolean;
  readonly iconStart?: React.ReactNode;
  readonly iconEnd?: React.ReactNode;
  readonly asChild?: boolean; // Radix Slot 컴포지션
  readonly type?: 'button' | 'submit' | 'reset'; // 기본 'button'
}
```

#### Dialog

```ts
export interface DialogRootProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly children: React.ReactNode;
}

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly i18nTitleKey: string;
  readonly i18nDescriptionKey?: string; // a11y aria-describedby
  readonly size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}
```

다른 primitives (Tooltip / Tabs / Slider / Switch / Spinner / Input / Popover / Separator / Label / VisuallyHidden) 는 동일한 _Radix props 좁힌 + 디자인 토큰_ 패턴이므로 본 §4 에서는 발췌만. 전체 시그니처는 구현 시 컴포넌트 파일에 JSDoc 으로.

---

## 5. 퍼블릭 API / 인터페이스

### 5.1 `@/app/layout` barrel (`src/app/layout/index.ts`)

```ts
// 컴포넌트
export { default as AppLayout } from './AppLayout';
export { ToolbarSlot } from './ToolbarSlot';
export { SidePanelHost } from './SidePanelHost';
export { ModalHost } from './ModalHost';
export { ViewportHost } from './ViewportHost';
export { ToastContainer } from './ToastContainer';
export { LoadingOverlay } from './LoadingOverlay';
export { WebGL2FallbackPage } from './WebGL2FallbackPage';
export { AppErrorBoundary } from './AppErrorBoundary';
export { PanelErrorBoundary } from './PanelErrorBoundary';

// PanelRegistry API
export { registerPanel, getPanelRegistry, usePanelDefinition } from './panels/PanelRegistry';
export type { PanelDefinition, PanelMode, PanelRegistryMap } from './panels/types';

// 단축키
export { installAppShortcuts } from './shortcuts/installAppShortcuts';
export type { InstallAppShortcutsOpts } from './shortcuts/installAppShortcuts';

// dispatcher 컨텍스트 (Phase 11 Toolbar 가 사용)
export { UndoableDispatcherProvider, useUndoableDispatcher } from './hooks/useUndoableDispatcher';

// 타입
export type { AppLayoutProps } from './AppLayout';
export type { WebGL2FallbackPageProps } from './WebGL2FallbackPage';
export type { AppErrorFallbackProps } from './AppErrorBoundary';
export type { PanelErrorFallbackProps } from './PanelErrorBoundary';
export type { LoadingOverlayProps, LoadingOverlayVariant } from './LoadingOverlay';
```

미노출:

- `hooks/useWebGL2Detection.ts`, `hooks/useInstallAppShortcuts.ts` — `<AppLayout>` 내부 전용
- `_shared/` (없음 — `_shared/classNames.ts` 는 `@/components/_shared/classNames.ts` 만)
- `panels/PanelRegistry` 내부 mutable state
- `styles/theme.css` (Vite 가 import → 부수 효과만)

### 5.2 PanelRegistry (`src/app/layout/panels/PanelRegistry.ts`)

```ts
import type { PanelKey } from '@/stores/uiStore';
import type { PanelDefinition, PanelRegistryMap } from './types';
import { logger } from '@/utils/logger';

const registry: Record<string, PanelDefinition> = {};

/**
 * Phase 11 의 각 패널이 부팅 (e.g. src/panels/index.ts) 시 호출.
 * 동일 key 중복 등록 시 logger.warn + 마지막 등록 우선 (테스트 / dev 가능성).
 */
export function registerPanel(def: PanelDefinition): void {
  if (registry[def.key]) {
    logger.warn('panel-registry.duplicate', {
      key: def.key,
      previous: registry[def.key]!.i18nTitleKey,
      next: def.i18nTitleKey,
    });
  }
  registry[def.key] = def;
}

export function getPanelRegistry(): PanelRegistryMap {
  return Object.freeze({ ...registry });
}

/**
 * SidePanelHost / ModalHost 가 사용. registry 가 mutable 이지만 *부팅 시점 1 회*
 * 채워진 후 변하지 않음을 가정 — useSyncExternalStore 미사용.
 */
export function usePanelDefinition(key: PanelKey | null): PanelDefinition | undefined {
  if (key == null) return undefined;
  return registry[key];
}
```

### 5.3 `installAppShortcuts` (`src/app/layout/shortcuts/installAppShortcuts.ts`)

```ts
import { installGlobalUndoShortcuts } from '@/viewport/interactions/shortcuts';
import type { UndoableDispatcher } from '@/stores/_shared/undo';

export interface InstallAppShortcutsOpts {
  readonly dispatcher: UndoableDispatcher;
}

/**
 * Phase 09 의 installGlobalUndoShortcuts() 를 호출하고 cleanup 함수를 반환.
 * 미래 확장: 다른 전역 단축키 (예: Cmd+/ = 도움말 시트, Cmd+K = 명령 팔레트) 는
 * 본 함수가 동일한 cleanup-aggregator 패턴으로 흡수.
 *
 * 단축키 충돌 회피: Phase 09 의 KEY_MAP 이 우선순위 1–3 (전역 + Viewport-focused)
 * 을 차지. 본 Phase 는 추가 등록 없음. Phase 11 가 우선순위 4 (panel-focused)
 * 에 등록할 때 KEY_MAP 을 import 하여 키 중복 검사 (phase-09 §4.5 / §12 a 인계).
 */
export function installAppShortcuts({ dispatcher }: InstallAppShortcutsOpts): () => void {
  const undoCleanup = installGlobalUndoShortcuts({ dispatcher });

  return () => {
    undoCleanup();
  };
}
```

### 5.4 `@/components` barrel (`src/components/index.ts`)

```ts
// Primitives
export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { IconButton } from './IconButton';
export type { IconButtonProps } from './IconButton';

export { Tooltip, TooltipProvider } from './Tooltip';
export type { TooltipProps } from './Tooltip';

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from './Dialog';
export type { DialogRootProps, DialogContentProps } from './Dialog';

export { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';
export type { TabsProps, TabsTriggerProps } from './Tabs';

export { Slider } from './Slider';
export type { SliderProps } from './Slider';

export { Switch } from './Switch';
export type { SwitchProps } from './Switch';

export { Spinner } from './Spinner';
export type { SpinnerProps, SpinnerSize } from './Spinner';

export { Input } from './Input';
export type { InputProps } from './Input';

export { Popover, PopoverTrigger, PopoverContent } from './Popover';
export type { PopoverContentProps } from './Popover';

export { Separator } from './Separator';
export { Label } from './Label';
export { VisuallyHidden } from './VisuallyHidden';

// 유틸 — 미노출. 내부 _shared/classNames 만 사용.
```

`_shared/classNames.ts` 는 `@/components` barrel 에 _미노출_. 외부에서 cn 이 필요하면 `@/utils/cn` (Phase 01 의 utils 영역) 에 별도 노출 검토 — 본 Phase 는 doing 안 함 (현재 `@/utils` 에 동일 함수 없으면 Phase 11 가 결정).

### 5.5 `useUndoableDispatcher` 컨텍스트

```ts
// src/app/layout/hooks/useUndoableDispatcher.ts

import type { UndoableDispatcher } from '@/stores/_shared/undo';

const Ctx = React.createContext<UndoableDispatcher | null>(null);

export function UndoableDispatcherProvider({
  dispatcher,
  children,
}: {
  dispatcher: UndoableDispatcher;
  children: React.ReactNode;
}): JSX.Element;

export function useUndoableDispatcher(): UndoableDispatcher;
// null 반환 시 throw — 본 Phase 의 <AppLayout> 가 항상 Provider 마운트 보장.
```

`<AppLayout>` 가 1 회 `createUndoStack()` 호출 → `<UndoableDispatcherProvider dispatcher>` 로 감싼다 (D17). Phase 11 Toolbar 의 `useUndoStack()` (Phase 09 §5.3 권장) 도 본 컨텍스트의 dispatcher 를 통해 동일 인스턴스 참조.

---

## 6. 핵심 로직 / 전략

### 6.1 AppLayout 구성

```tsx
// src/app/layout/AppLayout.tsx (요약 — 실제는 더 길다)

import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { ToolbarSlot } from './ToolbarSlot';
import { SidePanelHost } from './SidePanelHost';
import { ModalHost } from './ModalHost';
import { ViewportHost } from './ViewportHost';
import { ToastContainer } from './ToastContainer';
import { LoadingOverlay } from './LoadingOverlay';
import { PanelErrorBoundary } from './PanelErrorBoundary';
import { UndoableDispatcherProvider } from './hooks/useUndoableDispatcher';
import { useInstallAppShortcuts } from './hooks/useInstallAppShortcuts';
import { createUndoStack } from '@/stores/_shared/undo';
import type { AppLayoutProps } from './types';

export default function AppLayout({ toolbar, viewportApiRef }: AppLayoutProps) {
  // D17: 1 회 createUndoStack 후 컨텍스트로 노출
  const dispatcher = React.useMemo(() => createUndoStack({ capacity: 50, mergeWindowMs: 200 }), []);

  return (
    <UndoableDispatcherProvider dispatcher={dispatcher}>
      <AppLayoutInner toolbar={toolbar} viewportApiRef={viewportApiRef} />
    </UndoableDispatcherProvider>
  );
}

function AppLayoutInner({ toolbar, viewportApiRef }: AppLayoutProps) {
  // D8 / P6: install + cleanup
  useInstallAppShortcuts();

  return (
    <div className="flex h-screen flex-col bg-bg-canvas text-fg-primary">
      <PanelErrorBoundary slotName="toolbar">
        <ToolbarSlot>{toolbar}</ToolbarSlot>
      </PanelErrorBoundary>
      <PanelGroup direction="horizontal" className="flex-1 overflow-hidden">
        <Panel defaultSize={75} minSize={40}>
          <PanelErrorBoundary slotName="viewport">
            <ViewportHost apiRef={viewportApiRef} />
          </PanelErrorBoundary>
        </Panel>
        <PanelResizeHandle className="w-1 bg-border hover:bg-accent transition-colors" />
        <Panel defaultSize={25} minSize={15} maxSize={45}>
          <PanelErrorBoundary slotName="sidepanel">
            <SidePanelHost />
          </PanelErrorBoundary>
        </Panel>
      </PanelGroup>
      {/* portal 자식 — flex 영향 없음 */}
      <PanelErrorBoundary slotName="modal">
        <ModalHost />
      </PanelErrorBoundary>
      <ToastContainer />
      <LoadingOverlay variant="app" />
    </div>
  );
}
```

D6 의 320/240/600 px 매핑: PanelGroup 의 percentage 기반이므로 `defaultSize={25}` / `minSize={15}` / `maxSize={45}` 로 _대략_ 매핑. viewport width 1280 px 가정 시 25% = 320 px, 15% = 192 px, 45% = 576 px → 240 / 600 px 와 약간 차이. **px 정확 보장** 이 필요하면 `useResizeObserver` + viewport width 측정 후 percentage 동적 변환 — Phase 11 패널 콘텐츠 측정 후 결정 (§11 #2).

### 6.2 SidePanelHost

```tsx
// src/app/layout/SidePanelHost.tsx

import { useUiStore, selectActivePanel } from '@/stores/uiStore';
import { usePanelDefinition } from './panels/PanelRegistry';
import { LoadingOverlay } from './LoadingOverlay';
import { useTranslation } from 'react-i18next';

export function SidePanelHost() {
  const activeKey = useUiStore(selectActivePanel);
  const definition = usePanelDefinition(activeKey);
  const { t } = useTranslation('common');

  if (!definition || definition.mode !== 'docked') {
    return <EmptySidepanel />;
  }

  // key 가 변할 때 새 lazy 컴포넌트
  const LazyPanel = React.useMemo(() => React.lazy(definition.load), [definition.key]);

  return (
    <aside className="flex h-full flex-col bg-bg-panel border-l border-border">
      <header className="flex items-center justify-between border-b border-border px-4 h-12">
        <h2 className="text-sm font-medium text-fg-primary">{t(definition.i18nTitleKey)}</h2>
        {/* close 버튼은 Phase 11 가 자체 패널 헤더에서 처리할 수도 있음 */}
      </header>
      <div className="flex-1 overflow-auto">
        <React.Suspense fallback={<LoadingOverlay variant="panel" visible />}>
          <LazyPanel />
        </React.Suspense>
      </div>
    </aside>
  );
}

function EmptySidepanel() {
  const { t } = useTranslation('common');
  return (
    <aside className="flex h-full items-center justify-center bg-bg-panel border-l border-border">
      <p className="text-sm text-fg-muted">{t('panels.empty.hint')}</p>
    </aside>
  );
}
```

### 6.3 ModalHost

```tsx
// src/app/layout/ModalHost.tsx

import { Dialog, DialogContent } from '@/components';
import { useUiStore } from '@/stores/uiStore';
import { getPanelRegistry } from './panels/PanelRegistry';

export function ModalHost() {
  const isPeriodicTableOpen = useUiStore((s) => s.panels.isPeriodicTableOpen);
  const isCompoundBrowserOpen = useUiStore((s) => s.panels.isCompoundBrowserOpen);
  const isReactionResultOpen = useUiStore((s) => s.panels.isReactionResultOpen);
  // phase-07 §5.3: action 은 s.actions.* 네임스페이스. close 는 toggleX(false) 호출.
  const togglePeriodicTable = useUiStore((s) => s.actions.togglePeriodicTable);
  const toggleCompoundBrowser = useUiStore((s) => s.actions.toggleCompoundBrowser);
  const toggleReactionResult = useUiStore((s) => s.actions.toggleReactionResult);

  return (
    <>
      <ModalSlot
        panelKey="periodic-table"
        open={isPeriodicTableOpen}
        onOpenChange={(o) => !o && togglePeriodicTable(false)}
      />
      <ModalSlot
        panelKey="compound-browser"
        open={isCompoundBrowserOpen}
        onOpenChange={(o) => !o && toggleCompoundBrowser(false)}
      />
      <ModalSlot
        panelKey="reaction-result"
        open={isReactionResultOpen}
        onOpenChange={(o) => !o && toggleReactionResult(false)}
      />
    </>
  );
}

function ModalSlot({ panelKey, open, onOpenChange }: { ... }) {
  const def = getPanelRegistry()[panelKey];
  if (!def || def.mode !== 'modal') return null;
  const LazyPanel = React.useMemo(() => React.lazy(def.load), [def.key]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent i18nTitleKey={def.i18nTitleKey} size="lg">
        <React.Suspense fallback={<LoadingOverlay variant="panel" visible />}>
          <LazyPanel />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
}
```

D12: Esc / 외부 클릭 / 닫기 버튼은 모두 Radix Dialog 가 처리. Phase 09 의 `Esc=clearSelection` 은 _Viewport-focused 합성 이벤트_ (phase-09 P3 의 β 스코프 vs α 스코프) 라 자연 분리 — Modal 열림 시 focus trap 이 viewport 외부에 있으므로 `useViewportShortcuts` 가 호출 안 됨.

### 6.4 ViewportHost

```tsx
// src/app/layout/ViewportHost.tsx

import { useWebGL2Detection } from './hooks/useWebGL2Detection';
import { WebGL2FallbackPage } from './WebGL2FallbackPage';
import { LoadingOverlay } from './LoadingOverlay';
import type { ViewportApi } from '@/viewport';

const Viewport = React.lazy(() => import('@/viewport')); // P2: 본 Phase 가 단일 마운트

interface ViewportHostProps {
  readonly apiRef?: React.Ref<ViewportApi>;
}

export function ViewportHost({ apiRef }: ViewportHostProps) {
  const detection = useWebGL2Detection();

  // D5: WebGL2 미지원 시 viewport chunk 자체를 lazy load 하지 않음 (불필요한 다운로드 회피)
  if (!detection.ok) {
    return <WebGL2FallbackPage result={detection} />;
  }

  return (
    <React.Suspense fallback={<LoadingOverlay variant="viewport" visible />}>
      <Viewport
        apiRef={apiRef}
        fallback={<WebGL2FallbackPage result={detection} />}
        className="h-full w-full"
      />
    </React.Suspense>
  );
}
```

D11 + D5 핵심: `<Viewport>` 자체에도 phase-08 §5.1 의 fallback prop 이 있어 _런타임 컨텍스트 손실_ (예: WebGL 컨텍스트 lost) 시 fallback 노출. 본 Phase 의 `useWebGL2Detection` 은 _부팅 1 회 가드_ — 두 단계 가드가 중복 안전망.

### 6.5 ErrorBoundary 분할

```tsx
// src/app/layout/PanelErrorBoundary.tsx

import { logger } from '@/utils/logger';
import type { PanelKey } from '@/stores/uiStore';

interface PanelErrorBoundaryProps {
  readonly children: React.ReactNode;
  readonly slotName: 'toolbar' | 'sidepanel' | 'modal' | 'viewport';
  readonly panelKey?: PanelKey;
}

interface State {
  readonly error: Error | null;
  readonly attemptCount: number;
}

const MAX_ATTEMPTS = 3; // D4 / R3

export class PanelErrorBoundary extends React.Component<PanelErrorBoundaryProps, State> {
  state: State = { error: null, attemptCount: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    logger.error('panel-boundary.caught', {
      slotName: this.props.slotName,
      panelKey: this.props.panelKey,
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  reset = (): void => {
    if (this.state.attemptCount >= MAX_ATTEMPTS) return;
    this.setState((s) => ({ error: null, attemptCount: s.attemptCount + 1 }));
  };

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <PanelErrorFallback
          error={this.state.error}
          reset={this.reset}
          attemptCount={this.state.attemptCount}
          slotName={this.props.slotName}
          panelKey={this.props.panelKey}
        />
      );
    }
    return this.props.children;
  }
}
```

`<AppErrorBoundary>` 는 Phase 01 의 `<ErrorBoundary>` 를 본 Phase 가 _교체_ — fallback UI 가 디자인 토큰 (Tailwind class) 을 적용하되, **텍스트는 정적 영문 유지** (D15 / phase-01 §389 — i18n 부팅 실패 안전).

```tsx
// src/app/layout/AppErrorBoundary.tsx
function AppErrorFallback({ error, reset }: AppErrorFallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-canvas text-fg-primary">
      <div className="max-w-md p-6 rounded-md border border-border bg-bg-panel">
        <h1 className="text-lg font-semibold text-error">Application error</h1>
        <p className="mt-2 text-sm text-fg-muted">
          An unexpected error occurred. Please reload the page.
        </p>
        <pre className="mt-4 text-xs text-fg-muted overflow-auto max-h-32">{error.message}</pre>
        <button type="button" onClick={() => window.location.reload()} className="mt-4 ...">
          Reload
        </button>
      </div>
    </div>
  );
}
```

P5 정합 — 본 boundary 들은 _런타임 예외_ (예: 의도치 않은 throw, raycast NaN, undefined property access) 만 포착. 도메인 실패 (Phase 03/06 의 `EmbedFailed` / `ParseError` 등) 는 stores 의 Result 패턴으로 흘러가 패널이 정상 UI 로 표시한다.

### 6.6 단축키 install / cleanup (P6)

```tsx
// src/app/layout/hooks/useInstallAppShortcuts.ts

import { useUndoableDispatcher } from './useUndoableDispatcher';
import { installAppShortcuts } from '../shortcuts/installAppShortcuts';

export function useInstallAppShortcuts(): void {
  const dispatcher = useUndoableDispatcher();

  React.useEffect(() => {
    const cleanup = installAppShortcuts({ dispatcher });
    return cleanup;
  }, [dispatcher]);
}
```

P6 / phase-09 §12 c 정합: `installAppShortcuts` 가 `() => void` 반환, useEffect cleanup 으로 등록. unmount 시 `installGlobalUndoShortcuts` cleanup 도 호출되어 window listener 누수 0.

dispatcher 가 컨텍스트로 안정 (D17) 이므로 deps 변화 0, useEffect 는 mount/unmount 시점 1회 만 실행.

### 6.7 테마 적용 + 팔레트 토큰

```css
/* src/app/layout/styles/theme.css */

:root {
  /* Light (기본) */
  --bg-canvas: 248 250 252; /* slate-50 */
  --bg-panel: 255 255 255;
  --bg-panel-elevated: 241 245 249; /* slate-100 */
  --fg-primary: 15 23 42; /* slate-900 */
  --fg-muted: 100 116 139; /* slate-500 */
  --border: 226 232 240; /* slate-200 */
  --accent: 59 130 246; /* blue-500 */
  --accent-fg: 255 255 255;
  --error: 220 38 38; /* red-600 */
  --warn: 245 158 11; /* amber-500 */
  --success: 22 163 74; /* green-600 */
}

.dark {
  --bg-canvas: 15 23 42; /* slate-900 */
  --bg-panel: 30 41 59; /* slate-800 */
  --bg-panel-elevated: 51 65 85; /* slate-700 */
  --fg-primary: 241 245 249;
  --fg-muted: 148 163 184;
  --border: 51 65 85;
  --accent: 96 165 250; /* blue-400 */
  --accent-fg: 15 23 42;
  --error: 239 68 68;
  --warn: 251 191 36;
  --success: 74 222 128;
}

.cvd {
  /* Phase 15 가 색약 안전 팔레트로 채움. 본 Phase 는 자리만 마련. */
  /* 예시 (잠정): blue-yellow safe palette */
  --accent: 29 78 216; /* blue-700 */
  --error: 234 88 12; /* orange-600 — red 보다 명도/색조 분리 */
  --warn: 250 204 21; /* yellow-400 */
  --success: 22 78 99; /* cyan-900 — green 대체 */
}
```

CSS 변수는 RGB 토큰 (alpha 보존을 위해 `r g b` space-separated). Tailwind 의 `<color> / <opacity>` 표기법을 위해.

```ts
// tailwind.config.ts (Phase 01 retrofit)
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class', // <html class="dark">
  theme: {
    extend: {
      colors: {
        'bg-canvas': 'rgb(var(--bg-canvas) / <alpha-value>)',
        'bg-panel': 'rgb(var(--bg-panel) / <alpha-value>)',
        'bg-panel-elevated': 'rgb(var(--bg-panel-elevated) / <alpha-value>)',
        'fg-primary': 'rgb(var(--fg-primary) / <alpha-value>)',
        'fg-muted': 'rgb(var(--fg-muted) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          fg: 'rgb(var(--accent-fg) / <alpha-value>)',
        },
        error: 'rgb(var(--error) / <alpha-value>)',
        warn: 'rgb(var(--warn) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

P7 정합: 테마 토글 (`<html class="dark">`) 작동은 Phase 01 가 완료. 본 Phase 는 CSS 변수 + tailwind config 만 추가 — _동일 토글이 즉시 새 팔레트 반영_ (재마운트 / 재계산 없음).

### 6.8 ToastContainer

```tsx
// src/app/layout/ToastContainer.tsx

import { useUiStore, selectNotifications } from '@/stores/uiStore';

export function ToastContainer() {
  const notifications = useUiStore(selectNotifications);

  // 외곽 컨테이너는 **plain wrapper** — live region 역할을 부여하지 않는다.
  // (중첩 live region 방지: 발화 책임은 per-item <ToastItem>/<ToastSlot> 이 단독 소유.
  //  Phase 11 ToastItem 이 level 에 따라 role="alert"(error/warn) | "status"(info/success)
  //  + 적절한 aria-live 를 자기 요소에 부여한다 — phase-11 §6.7.)
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2">
      {notifications.map((n) => (
        <ToastSlot key={n.id} notification={n} />
      ))}
    </div>
  );
}

/**
 * 본 Phase 는 위치 + a11y 컨테이너 만. <ToastSlot> 의 외양은 Phase 11 의
 * <ToastItem> 으로 교체될 *placeholder*. 지금은 minimal pointer-events-auto
 * + dismiss 버튼.
 */
function ToastSlot({ notification }: { notification: Notification }) {
  // Phase 11 가 본 컴포넌트 자체를 import 해 외양을 풍부화하거나,
  // ToastContainer 의 children 패턴으로 교체.
  const dismiss = useUiStore((s) => s.dismissNotification);
  return (
    <div className="pointer-events-auto rounded-md bg-bg-panel-elevated border border-border p-3 text-sm shadow-md">
      <span className="text-fg-primary">{notification.messageKey}</span>
      <button onClick={() => dismiss(notification.id)} className="ml-2 text-fg-muted">
        ×
      </button>
    </div>
  );
}
```

D7 정합. 큐 길이 상한 50 (P9, phase-07 R7) 은 store 가 강제 — 본 컨테이너는 _모든_ 항목 렌더하지만 현실적으로 50 이하.

### 6.9 LoadingOverlay

```tsx
// src/app/layout/LoadingOverlay.tsx

import { useUiStore, selectIsGloballyLoading } from '@/stores/uiStore';
import { Spinner } from '@/components';
import { VisuallyHidden } from '@/components';
import { useTranslation } from 'react-i18next';

const LABEL_KEYS: Record<LoadingOverlayVariant, string> = {
  app: 'common.loading.app',
  viewport: 'common.loading.viewport',
  panel: 'common.loading.panel',
};

export function LoadingOverlay({ variant, visible, labelKey }: LoadingOverlayProps) {
  const autoVisible = useUiStore(selectIsGloballyLoading); // variant='app' 만 사용
  const isVisible = variant === 'app' ? (visible ?? autoVisible) : (visible ?? false);

  const { t } = useTranslation('common');
  const label = t(labelKey ?? LABEL_KEYS[variant]);

  if (!isVisible) return null;

  // D16: variant 별 ARIA
  const role = variant === 'app' ? 'alert' : undefined;

  return (
    <div
      role={role}
      aria-busy="true"
      className={cn(
        variant === 'app'
          ? 'fixed inset-0 z-40 flex items-center justify-center bg-bg-canvas/80'
          : 'absolute inset-0 flex items-center justify-center bg-bg-panel/60',
      )}
    >
      <Spinner size="lg" />
      <VisuallyHidden>{label}</VisuallyHidden>
    </div>
  );
}
```

`selectIsGloballyLoading = (s: UiStoreState) => s.globalLoading.count > 0` — phase-07 §5.4 가 노출하지 않으면 본 Phase 가 inline derive (`useUiStore(s => s.globalLoading.count > 0)`).

### 6.10 WebGL2 미지원 분기 (D5)

```tsx
// src/app/layout/WebGL2FallbackPage.tsx

import { useTranslation } from 'react-i18next';
import type { WebGLDetectResult } from '@/viewport';

export function WebGL2FallbackPage({ result }: WebGL2FallbackPageProps) {
  const { t } = useTranslation('common');

  // result.ok=false 가정. 사용자에게 *원인 + 권장 행동* 명시.
  return (
    <div
      role="region"
      aria-label={t('app.webgl2Unsupported.title')}
      className="flex h-full flex-col items-center justify-center bg-bg-canvas p-8"
    >
      <div className="max-w-lg text-center">
        <h1 className="text-2xl font-semibold text-fg-primary">
          {t('app.webgl2Unsupported.title')}
        </h1>
        <p className="mt-4 text-base text-fg-muted">{t('app.webgl2Unsupported.reason')}</p>
        <p className="mt-2 text-sm text-fg-muted">{t('app.webgl2Unsupported.suggestion')}</p>
        <a
          href={t('app.webgl2Unsupported.docsLink')}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-block text-accent hover:underline"
        >
          {t('app.webgl2Unsupported.docsLinkLabel')}
        </a>
      </div>
    </div>
  );
}
```

본 Phase 는 i18n _키_ 만 정의. 실제 한·영 문구 채움은 Phase 15 (phase-15 가 axe 검증 + 모든 i18n 완성).

D5 정합: 사이드패널은 `<AppLayout>` 의 외부에 있으므로 본 페이지가 viewport 영역에만 표시되어 _PeriodicTable 등 정적 정보 패널은 작동 가능_. 만약 부팅 시점에 `useWebGL2Detection().ok=false` 라면 ViewportHost 가 자체적으로 본 페이지를 표시 — sidepanel 은 정상 마운트.

### 6.11 Radix primitive 래핑 패턴

모든 primitive 는 동일한 시그니처 패턴:

```tsx
// src/components/Button.tsx (대표 예시)

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority'; // optional — 본 Phase 미도입 결정 시 inline
import { cn } from './_shared/classNames';
import { Spinner } from './Spinner';

const buttonStyles = (variant: ButtonVariant, size: ButtonSize): string => {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:pointer-events-none';
  const variantClass = {
    primary: 'bg-accent text-accent-fg hover:bg-accent/90',
    secondary: 'bg-bg-panel-elevated text-fg-primary border border-border hover:bg-bg-panel',
    ghost: 'text-fg-primary hover:bg-bg-panel-elevated',
    danger: 'bg-error text-white hover:bg-error/90',
  }[variant];
  const sizeClass = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
  }[size];
  return cn(base, variantClass, sizeClass);
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading,
    iconStart,
    iconEnd,
    asChild,
    className,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : type}
      className={cn(buttonStyles(variant, size), className)}
      aria-busy={loading || undefined}
      disabled={loading || disabled}
      {...props}
    >
      {loading ? <Spinner size="sm" /> : iconStart}
      {children}
      {iconEnd}
    </Comp>
  );
});
```

다른 primitives 는 동일 패턴:

- (a) Radix `Root` / `Trigger` / `Content` 등을 `forwardRef` 로 wrap
- (b) Tailwind `cn()` 머지로 디자인 토큰 적용
- (c) i18n 라벨 prop (필요 시 `i18nXxxKey` — Tooltip / Dialog title 등)
- (d) ARIA 는 Radix 기본 보존 (재정의 금지)

본 Phase 는 `class-variance-authority` 같은 variant 헬퍼를 _도입하지 않는다_ — 단순 inline switch 로 충분. Phase 14 가 `cva` 도입 효과 (번들 / DX) 를 측정 후 결정.

---

## 7. 파일/모듈 레이아웃

```
src/app/
├── App.tsx                              ⟵ Phase 01 retrofit: <AppShell> 자리에 <AppLayout/>
├── layout/
│   ├── index.ts                         (barrel — §5.1)
│   ├── AppLayout.tsx                    (default export)
│   ├── ToolbarSlot.tsx
│   ├── SidePanelHost.tsx
│   ├── ModalHost.tsx
│   ├── ViewportHost.tsx
│   ├── ToastContainer.tsx
│   ├── LoadingOverlay.tsx
│   ├── WebGL2FallbackPage.tsx
│   ├── AppErrorBoundary.tsx             ⟵ Phase 01 retrofit: 디자인 토큰 적용
│   ├── PanelErrorBoundary.tsx
│   ├── shortcuts/
│   │   └── installAppShortcuts.ts       (§5.3)
│   ├── panels/
│   │   ├── PanelRegistry.ts             (registerPanel + 빈 레지스트리)
│   │   └── types.ts                     (PanelDefinition 등)
│   ├── hooks/
│   │   ├── useInstallAppShortcuts.ts    (mount/unmount install + cleanup)
│   │   ├── useWebGL2Detection.ts        (1회 호출 + memo)
│   │   └── useUndoableDispatcher.ts     (컨텍스트 + Provider)
│   └── styles/
│       └── theme.css                    (CSS 변수 light/dark/cvd)

src/components/
├── index.ts                             (barrel — §5.4)
├── Button.tsx
├── IconButton.tsx
├── Tooltip.tsx
├── Dialog.tsx                           (Root + Trigger + Content + Title + Description + Close 한 파일)
├── Tabs.tsx                             (Root + List + Trigger + Content)
├── Slider.tsx
├── Switch.tsx
├── Spinner.tsx
├── Input.tsx
├── Popover.tsx                          (Root + Trigger + Content)
├── Separator.tsx
├── Label.tsx
├── VisuallyHidden.tsx
└── _shared/
    └── classNames.ts                    (cn = clsx + tailwind-merge)

⟵ Phase 01 retrofit
├── tailwind.config.ts                   (theme.extend.colors → CSS 변수)
└── src/index.css                        (theme.css import 추가)
```

### 7.1 노출 경계

`@/app/layout` 가 외부에 노출:

- **컴포넌트** — AppLayout (default), ToolbarSlot, SidePanelHost, ModalHost, ViewportHost, ToastContainer, LoadingOverlay, WebGL2FallbackPage, AppErrorBoundary, PanelErrorBoundary
- **PanelRegistry API** — registerPanel, getPanelRegistry, usePanelDefinition
- **Shortcuts** — installAppShortcuts
- **Context** — UndoableDispatcherProvider, useUndoableDispatcher
- **타입** — AppLayoutProps, PanelDefinition, PanelMode, PanelRegistryMap, AppErrorFallbackProps, PanelErrorFallbackProps, LoadingOverlayProps, LoadingOverlayVariant, WebGL2FallbackPageProps, InstallAppShortcutsOpts

`@/app/layout` 가 _미노출_:

- `hooks/useInstallAppShortcuts`, `hooks/useWebGL2Detection` — 내부 전용
- `panels/PanelRegistry` 의 mutable `registry` 변수
- `styles/theme.css` — `src/index.css` 가 import (부수효과)

`@/components` 가 외부에 노출:

- 모든 primitive 와 그 props 타입
- `_shared/classNames.ts` 는 미노출 (외부에서 cn 필요 시 별도 `@/utils/cn` 도입 검토 — Phase 11 결정)

### 7.2 ESLint 가드

`.eslintrc` (Phase 01 의 가드에 _추가_):

```js
{
  // 본 Phase 가 추가하는 규칙
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        // 본 Phase 의 내부 helper 직접 import 금지
        { group: ['@/app/layout/hooks/*', '@/app/layout/panels/PanelRegistry'], message: 'Use @/app/layout barrel.' },
        { group: ['@/components/_shared/*'], message: 'Use @/components barrel.' },
      ],
    }],
  },
}
```

또한 P1 강제: `@/app/layout/**` 와 `@/components/**` 가 `@/engine`, `@/services`, `@/data`, `@/chemistry`, `@/viewport/**` _내부_ 를 직접 import 하지 못한다 (`@/viewport` barrel 의 default export 제외). architecture.md §4.1 가드 ESLint 규칙은 Phase 01 가 이미 강제 — 본 Phase 는 정합만.

---

## 8. 테스트 계획

원칙: `architecture.md` §10 — 모든 함수를 테스트하지 않고 _핵심 로직과 핵심 동작_ 만.

본 Phase 의 핵심 동작:

- (a) AppLayout mount/unmount 의 install/cleanup 정확성
- (b) SidePanelHost 의 active 변경 + lazy load + Suspense fallback
- (c) ModalHost 의 토글 플래그 ↔ Dialog open 양방향 바인딩 + Esc 닫기
- (d) PanelErrorBoundary 의 슬롯 격리 + Retry 한도
- (e) ToastContainer 의 ARIA live region 갱신
- (f) WebGL2FallbackPage 의 result.ok=false 분기
- (g) 테마 토글 → CSS 변수 즉시 반영
- (h) Radix primitive 래퍼의 ARIA / 포커스 / 키보드 회귀

### 8.1 유닛 (Vitest)

`tests/unit/app/layout/`:

| ID  | 대상                             | 검증                                                                                                    |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| U1  | `installAppShortcuts`            | `installGlobalUndoShortcuts` mock → 본 함수 호출 시 mock 호출, 반환된 cleanup 호출 시 mock cleanup 호출 |
| U2  | `registerPanel` 중복 등록        | logger.warn 1회 + 마지막 등록 우선                                                                      |
| U3  | `useWebGL2Detection`             | `detectWebGL2` mock → 첫 호출 결과를 memo, 재마운트 시 1회만 호출                                       |
| U4  | `cn` 유틸 (`_shared/classNames`) | clsx 조건 + tailwind-merge 충돌 해소 (`'p-4 p-6'` → `'p-6'`)                                            |

### 8.2 컴포넌트 (Testing Library)

`tests/component/app/layout/`:

| ID  | 대상                          | 검증                                                                                                                                                      |
| --- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | `<AppLayout>` mount           | ToolbarSlot / Sidepanel / Viewport / Modal / Toast / Loading 모두 마운트 (mocked Phase 11 패널)                                                           |
| C2  | `<AppLayout>` unmount         | `installGlobalUndoShortcuts` cleanup spy 호출 (P6 검증)                                                                                                   |
| C3  | `<SidePanelHost>` active 변경 | `uiStore.panels.active='periodic-table'` set 시 PanelRegistry 의 dummy 패널 lazy load + 마운트. mode='modal' 인 정의는 무시                               |
| C4  | `<SidePanelHost>` Suspense    | lazy 가 pending 일 때 `<LoadingOverlay variant="panel">` 표시                                                                                             |
| C5  | `<ModalHost>` 토글            | `uiStore.panels.isPeriodicTableOpen=true` 시 Radix Dialog 열림 (data-state="open"). Esc 누르면 store action `actions.togglePeriodicTable(false)` 호출     |
| C6  | `<PanelErrorBoundary>` 격리   | dummy 자식 throw 시 fallback 표시, 다른 슬롯 (`<ToolbarSlot>`) 정상                                                                                       |
| C7  | `<PanelErrorBoundary>` Retry  | Retry 클릭 → 자식 재마운트. 3회 후 Retry 버튼 disabled (D4)                                                                                               |
| C8  | `<ToastContainer>`            | `notify({ messageKey, level })` 호출 시 div 자식 추가, ARIA `role="status"` + `aria-live="polite"`                                                        |
| C9  | `<WebGL2FallbackPage>`        | result.ok=false 시 i18n 키 노출 (`app.webgl2Unsupported.title` 등 — react-i18next mock)                                                                   |
| C10 | `<LoadingOverlay variant>`    | variant='app': `globalLoading.count > 0` → 표시 + role="alert". variant='viewport': visible prop 으로만 제어                                              |
| C11 | 테마 토글                     | `settingsStore.setTheme('dark')` → `<html class="dark">` 반영 → background-color computed value 변경 (Phase 01 가 toggle 작동, 본 Phase 는 CSS 변수 검증) |

### 8.3 Primitive 회귀 테스트

`tests/component/components/` — 각 primitive:

| ID  | 대상    | 검증                                                                                                          |
| --- | ------- | ------------------------------------------------------------------------------------------------------------- |
| P1  | Button  | variant/size/loading/disabled 조합 → 클래스 적용. asChild → Slot 동작. loading 시 aria-busy="true" + disabled |
| P2  | Dialog  | open/close + focus trap (열림 시 trigger 외 focus 이동, 닫힘 시 trigger 복원). Esc 닫기                       |
| P3  | Tooltip | hover 200ms 후 표시 (timer mock), `role="tooltip"`. delayDuration default 700ms 라면 props 로 200 지정        |
| P4  | Tabs    | aria-selected 토글, ←/→ 키 nav. role="tab" / role="tabpanel"                                                  |
| P5  | Slider  | role="slider", aria-valuenow / valuemin / valuemax. ←/→/PgUp/PgDn 키 step                                     |
| P6  | Switch  | aria-checked 토글. Space/Enter 토글                                                                           |
| P7  | Spinner | role="progressbar" 또는 `<VisuallyHidden>` 라벨 (Radix 표준 미사용 — 본 Phase 자체)                           |
| P8  | Input   | label 연결 (htmlFor), aria-invalid 지원, aria-describedby (에러 메시지)                                       |
| P9  | Popover | open 시 portal, focus 이동, Esc / 외부 클릭 닫기                                                              |

axe 자동 검증은 Phase 15 — 본 Phase 는 ARIA 속성 _존재 + 값_ 만 회귀.

### 8.4 E2E (Playwright)

`tests/e2e/`:

| ID  | 시나리오                       | 검증                                                                                                                                                                       |
| --- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | 사이드패널 마우스 리사이즈     | resize handle 드래그 후 Viewport 가 정상 동작 (캔버스 픽셀 보존, R3F resize event 발생)                                                                                    |
| E2  | 사이드패널 키보드 리사이즈     | Tab → resize handle 포커스 → ←/→ 키로 1% 단위 리사이즈 (`react-resizable-panels` 표준 동작)                                                                                |
| E3  | 패널 active 변경 + 단축키 회귀 | Phase 11 패널 mock 등록 후 `setActivePanel('periodic-table')` → 패널 마운트. Cmd+Z 가 viewport-focus 시 undo 호출, sidepanel input focus 시 호출 안 됨 (phase-09 §4.5 D10) |
| E4  | WebGL2 미지원 모킹             | `WebGLRenderingContext` mock 으로 detect 실패 → fallback 페이지 표시. sidepanel 정상 마운트 (PeriodicTable mock)                                                           |
| E5  | 라이트↔다크 테마 토글          | Toolbar 의 테마 Switch (Phase 11) mock 으로 클릭 → `<html class="dark">` 토글 → `getComputedStyle(document.body).backgroundColor` 변경 검증                                |
| E6  | Modal 열림/닫힘 + focus 복원   | PeriodicTable 모달 mock 열기 → Tab 으로 내부 nav → Esc → trigger 버튼 focus 복원                                                                                           |

---

## 9. 리스크 및 대안

| ID      | 시나리오                                                                   | 영향                                                         | 대응                                                                                                                                                                              |
| ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1**  | Radix primitive 추가 import 가 < 500 KB 예산 위협                          | 초기 로드 < 3 s 미달                                         | 사용 primitive 단위 lazy chunk (Vite 자동 — 패널 코드 분할이면 자연 분리). Phase 14 번들 분석에서 dist/assets/\*.js gzip 크기 측정. 위반 시 panels 로 lazy 강제                   |
| **R2**  | `react-resizable-panels` 키보드 접근성 한계                                | a11y 통과 실패 (Phase 15)                                    | 라이브러리 자체 ARIA `aria-orientation` + `role="separator"` 보유. 부족 시 wrapper div 에 `aria-valuenow` 추가. Phase 15 axe 검증                                                 |
| **R3**  | `<PanelErrorBoundary>` fallback 자체가 throw → 무한 루프                   | 페이지 freeze                                                | fallback UI 는 _정적 구조 + Tailwind class_ 만 (i18n 의존 X 가능). 시도 한도 3 회 (D4) — 초과 시 Retry 버튼 disabled. AppErrorBoundary 가 더 위에서 포착                          |
| **R4**  | CVD 모드 도입 시 토큰 재정의 충돌                                          | 색약 안전 팔레트 미작동                                      | D9 의 CSS 변수 시스템 — `.cvd` 셀렉터에서 변수 _덮어쓰기_. tailwind config 변경 불요 (Phase 15 가 채움)                                                                           |
| **R5**  | 모바일 / 작은 화면 (< 1024 px) 진입 사용자                                 | 사용 불가                                                    | desktop-first 정합 — `<AppLayout>` 외부에 `useMediaQuery('min-width: 1024px')` 가드 → 미달 시 안내 텍스트만 표시. 비결정 §2.3 명시                                                |
| **R6**  | Phase 11 패널 lazy load 실패 (네트워크/번들 오류)                          | 패널 영구 로드 안 됨                                         | `<PanelErrorBoundary>` + `<Suspense>` 조합 — Suspense fallback 무한 표시 시 Boundary 가 throw 잡고 Retry. notify 토스트 발화 (Phase 11)                                           |
| **R7**  | 단축키 cleanup 누락                                                        | window listener 누수 → 메모리 누수 + 다중 mount 시 중복 발화 | `installAppShortcuts` 시그니처가 cleanup 함수 _반환_ 강제. C2 단위 테스트에서 spy 검증. P6 정합                                                                                   |
| **R8**  | Radix Dialog focus trap 이 viewport canvas 와 충돌                         | 모달 닫힘 후 viewport Tab nav 불가                           | Radix 표준 — Dialog 닫힘 시 focus 가 trigger 로 복원. canvas focus 는 viewport 자체 click 으로 회복. Phase 15 검증                                                                |
| **R9**  | `uiStore.panels.active` (단일 docked) + 독립 토글 (modal) 혼재 → 동시 열림 | UX 혼란                                                      | Phase 07 액션이 한쪽만 변경 (개별 액션 — `setActivePanel` vs `openPeriodicTable`). 본 Phase 는 selector 만 사용. 동시 표시 자체는 디자인 의도 — docked 는 _지속_, modal 은 _일시_ |
| **R10** | `react-resizable-panels` strict-mode 호환성                                | 개발 모드 이중 마운트 경고 / 동작 이상                       | 라이브러리 v2.x 는 strict 호환. 본 Phase 의 컴포넌트 테스트가 `<React.StrictMode>` 활성                                                                                           |
| **R11** | `<html class="dark">` 토글이 React 외부 mutation — SSR 불일치              | hydration mismatch                                           | 본 프로젝트는 SSR 무관 (vite SPA — architecture §3.9). useLayoutEffect 로 첫 paint 전 적용. Phase 01 가 이미 처리                                                                 |
| **R12** | dispatcher 가 컨텍스트 외부에서 호출                                       | runtime null reference                                       | `useUndoableDispatcher` 가 null 시 throw — 명시 에러 (`AppLayout 외부에서 사용 금지`). Phase 11 Toolbar 가 컨텍스트 트리 내부임을 강제                                            |
| **R13** | 테마 토큰 변경이 Tailwind JIT 와 동기화 안 됨                              | 새 토큰 클래스 미생성                                        | `tailwind.config.ts` 의 `colors` 가 _변수_ 참조 — JIT 가 Tailwind utility 만 생성하면 됨. CSS 변수 값 변경은 런타임. 토큰 _이름_ 추가 시는 config 갱신 + dev server restart 필요  |

---

## 10. 완료 기준 (Definition of Done)

### 10.1 기능 / 동작

- [ ] `<AppLayout>` 가 ToolbarSlot / Sidepanel / Viewport / Modal / Toast / Loading 슬롯을 모두 마운트 (C1)
- [ ] `<AppLayout>` unmount 시 `installGlobalUndoShortcuts` cleanup 호출 (P6 / C2)
- [ ] `react-resizable-panels` 사이드패널 마우스 + 키보드 리사이즈 동작 (E1, E2)
- [ ] Phase 08 `<Viewport>` lazy 마운트 + Suspense fallback (`<LoadingOverlay variant="viewport">`) 정상 표시 (D11, C4)
- [ ] WebGL2 미지원 시 `<WebGL2FallbackPage>` 전체 화면 표시. sidepanel 정상 마운트 (D5 / E4)
- [ ] Phase 09 `KEY_MAP` import 후 패널 단축키와 충돌 없음 (P4 — 본 Phase 가 키 _추가_ 안 하지만 우선순위 4 영역 가이드 강제). Phase 11 가 추가 시 KEY_MAP 검사 (E3)
- [ ] `<PanelErrorBoundary>` 가 한 슬롯 throw 시 _해당 슬롯만_ fallback (다른 슬롯 정상) (C6)
- [ ] `<PanelErrorBoundary>` Retry 시 reset, 3회 초과 시 Retry 비활성 (D4 / C7)
- [ ] `settingsStore.theme` 토글이 light↔dark 팔레트를 즉시 반영 (CSS 변수) (C11 / E5)
- [ ] `uiStore.notifications` push → `<ToastContainer>` ARIA live region 갱신 (D7 / C8)
- [ ] `uiStore.globalLoading.count > 0` → `<LoadingOverlay variant="app">` 표시 (D16 / C10)

### 10.2 컴포넌트 primitives

- [ ] 모든 13 primitive 가 ARIA / 포커스 트랩 / 키보드 nav 회귀 통과 (P1–P9)
- [ ] Button asChild → Radix Slot 컴포지션 동작
- [ ] Dialog focus trap + Esc 닫기 + trigger 복원 (E6)

### 10.3 PanelRegistry

- [ ] Phase 11 가 `registerPanel(def)` 한 번 호출만으로 SidePanelHost / ModalHost 자동 슬롯 마운트 (D14 / C3, C5)
- [ ] 동일 key 중복 등록 시 logger.warn (U2)

### 10.4 라이브러리 / 빌드

- [ ] 신규 라이브러리 7 종 (`react-resizable-panels`, `@radix-ui/react-{dialog,tooltip,tabs,slider,switch,popover,separator,label,visually-hidden}`, `@radix-ui/react-slot`, `lucide-react`, `clsx`, `tailwind-merge`) `package.json` 에 추가, 본 문서 §3.2 근거 일치
- [ ] `tailwind.config.ts` retrofit (theme.extend.colors → CSS 변수)
- [ ] `src/index.css` 가 `theme.css` import
- [ ] ESLint 가드 (§7.2) 통과

### 10.5 소급 수정

- [ ] Phase 01 `<AppShell>` placeholder 가 `<AppLayout>` 으로 교체 (App.tsx retrofit)
- [ ] Phase 01 `<ErrorBoundary>` 가 본 Phase 의 `<AppErrorBoundary>` 로 교체 (D15 — 정적 영문 fallback + 디자인 토큰)
- [ ] `tailwind.config.ts` 에 본 Phase 의 색상 토큰 추가
- [ ] _본 Phase 가 retrofit 외 stores / viewport / interactions 에 손대지 않음_ 검증 (P10–P11)

### 10.6 인계 가능성

- [ ] Phase 11 가 본 Phase 의 barrel 에서 `AppLayout` / 모든 primitives / `registerPanel` / `useUndoableDispatcher` 만 import 하면 모든 패널 구현 가능 (§12 인계 정합)

---

## 11. 열린 질문 (User Decision Required)

본 Phase 가 D-table 로 잠정 결정했으나 사용자 확정 또는 후속 Phase 결정이 필요한 항목:

1. **아이콘 라이브러리 (D10)** — `lucide-react` (5,000+ 아이콘, 화학/분자 다양성 우위, ~5–10 KB tree-shake) vs `@radix-ui/react-icons` (300+ 아이콘, 작고 단순, Radix 표준 동반자, ~3–5 KB). **잠정 답: lucide-react**. 사용자가 _Radix 일관성_ 을 선호하면 후자로 변경 가능.
2. **사이드패널 폭 D6** — 320 / 240 / 600 px 잠정. Phase 11 패널 콘텐츠 (PeriodicTable 18×7 격자 너비, CompoundBrowser 검색 + 결과 리스트 너비) 측정 후 미세 튜닝. 측정 결과가 D6 의 max=600 px 를 _초과_ 하면 max 만 700 px 로 갱신 가능 (소규모).
3. **ToastContainer 위치 D7** — `right-4 bottom-4` 잠정. Phase 11 토스트 외양 (높이, dismiss UX) 결정 시 동시 확정. 우상단 (top-4 right-4) 도 후보.
4. **PanelErrorBoundary Retry 한도 R3** — 3 회 잠정. 사용자가 _더 짧은_ 한도 (1 회) 또는 _없음_ 을 선호하면 변경.
5. **Toolbar 높이 D1** — 56 px 잠정. Phase 11 의 Toolbar 콘텐츠 (Undo/Redo + frame + 라벨 토글 + 렌더 모드 + 테마 + 언어 + 검색 트리거) 가 56 px 안에 _수평으로_ 적합한지 검증 필요. 부족 시 64 px 또는 이중 행.
6. **`<AppErrorBoundary>` fallback UI 의 디자인 토큰 적용 정도 (D15)** — 정적 영문 텍스트 _유지_ 가 제약. 디자인 토큰을 어디까지 적용할지 (예: 색상만 vs 색상 + spacing + border-radius) 본 Phase 잠정 = _전체 토큰 적용_. Phase 15 가 axe + i18n 부팅 실패 시뮬레이션으로 검증.
7. **`class-variance-authority` 도입 여부** — 본 Phase 미도입 결정 (단순 inline switch 충분). Phase 11 가 _반복적인 variant_ 패턴을 다수 추가하면 (예: Button variant 외에 Card / Badge / Alert variant 가 추가) Phase 14 가 도입 결정.

---

## 12. 다음 Phase 로의 인계 (Hand-off)

| Phase                        | 본 Phase 가 인계하는 것                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **11 (UI Panels)**           | (a) **`registerPanel(def)`** API + `PanelDefinition` 타입 — **5 개 패널** (PeriodicTable / CompoundBrowser / Conditions / MoleculeInfo / ReactionResult) 이 부팅 (e.g. `src/panels/index.ts`) 시 한 번씩 호출. mode='docked' 또는 'modal' 명시. Toolbar 는 등록 _안 함_ — phase-11 P2/D1 가 `<AppLayout toolbar={<ToolbarBar/>}>` 직접 주입으로 결정. `'toolbar'` PanelKey 는 예약 미사용 (phase-12+ 가 다른 용도로 활용 가능). (b) **`@/components` barrel 의 13 primitives** — Conditions = `<Slider>` + `<Label>`, CompoundBrowser = `<Input>` + `<Popover>` + `<Spinner>`, ReactionResult = `<Tabs>` + `<Dialog>`, MoleculeInfo = `<Tabs>` + `<Tooltip>`, Toolbar = `<Button>` + `<IconButton>` + `<Switch>` + `<Tooltip>` + `<Separator>`. (c) **`<ToolbarSlot>` children** — Phase 11 의 `<ToolbarBar>` 가 `viewportApiRef` 를 useRef 로 생성, `<AppLayout viewportApiRef toolbar={<ToolbarBar apiRef={ref}/>}>` 로 동일 ref 양쪽 forward. ToolbarBar 가 `apiRef.current?.frameActive()` / `resetCamera()` / `captureBlob()` / `canUndo()` / `canRedo()` / `createBondFromSelection()` 호출 (phase-09 §12 b 정합). (d) **`useUndoableDispatcher()` 컨텍스트** — Toolbar 가 본 컨텍스트로 `<AppLayout>` 의 dispatcher 인스턴스를 참조 (D17 정합). 표시 갱신 (Undo/Redo 버튼 활성/비활성 토글) 은 phase-09 의 `useUndoStack()` selector 훅이 별도 책임 — dispatcher 자체와 selector 는 다른 hook 이지만 동일 store 상태를 가리킨다. (e) **ToastContainer 슬롯** — Phase 11 가 `<ToastItem>` 외양 풍부화. 본 Phase 의 placeholder ToastSlot 을 _교체_ 하거나, ToastContainer 자체를 상속해 children 패턴으로. (f) **`describeKey(binding)`** (phase-09 §5.2 의 시그니처 그대로 — KeyBinding 객체 자체를 인자로) → Toolbar 의 `<Tooltip>` 도움말 텍스트. (g) **우선순위 4 영역 패널 단축키 추가 시 `KEY_MAP` 충돌 검사 의무** — 패널이 자체 `<input>` 안에서 키 등록 시 phase-09 §4.5 표 준수. (h) **`uiStore.panels.is*Open` 액션** — Phase 11 가 PeriodicTable / CompoundBrowser / ReactionResult 등 modal 의 외부 trigger (예: Toolbar 버튼) 가 store action 호출. ModalHost 가 자동으로 Dialog 마운트. (i) **`<LoadingOverlay variant="panel">`** — Phase 11 패널 내부에서 자체 비동기 작업 (예: PubChem 검색) 시 하이드라이션. 또는 패널이 자체 `<Spinner>` 사용. |
| **12 (Text Input Pipeline)** | (a) **`<Dialog>`** — SMILES / 화학식 / InChI 입력 모달. (b) **`<Input>`** + `<Spinner>` — 파싱 진행 표시. (c) Esc 닫기 / 포커스 복원은 Radix 표준. (d) **`<PanelErrorBoundary slotName="modal">`** 가 파싱 런타임 예외 포착 (P5 — 도메인 실패는 Result 패턴이라 Boundary 미사용, 입력 컴포넌트가 자체 inline error UI). (e) **isTextInputTarget 가드** (phase-09 §12) — Phase 12 의 입력은 native `<input>` / `<textarea>` 또는 Radix 가 native 마크업 사용 → Cmd+Z 가 input 안에서 자연 통과 (phase-09 D10).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **13 (Export / Import)**     | (a) **`<Dialog>`** — Export 옵션 모달 (PNG / JSON / SDF 선택 + 옵션). 가져오기 모달 (파일 선택 + JSON 검증 결과). (b) **`<LoadingOverlay variant="app">`** — export/import 진행 중 (큰 SDF / 다중 분자 PNG 캡처 시 1+ 초). `globalLoading.count` 증감 액션 사용 (phase-07 §5.4). (c) Phase 13 가 importJson 후 `dispatcher.clear()` 호출 — 본 Phase 의 `useUndoableDispatcher().clear()` 사용 (phase-09 §12 d 인계 정합).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **14 (Performance)**         | (a) **Radix primitive lazy chunk 분리 검증** — bundle analyzer 로 `panels/*` 청크에 Radix 가 자연 포함되는지 확인 (R1). (b) **`react-resizable-panels` 의 useFrame / 리렌더 비용 측정** — 사이드패널 collapse 시 R3F resize event throttle 필요 여부. (c) **모바일 반응형 도입 결정** (§2.3 / R5). (d) **Web Worker 분리 (RDKit)** 시 `<LoadingOverlay variant>` 에 진행률 표시 추가 (phase-03 D6 후속). (e) `cva` 도입 효과 측정 (§11 #7). (f) 사이드패널 폭 px 정확 보장이 필요하면 `useResizeObserver` + percentage 동적 변환 (D6).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **15 (Polish)**              | (a) **a11y axe 자동 검증 통과** — 모든 Radix primitive + AppLayout + WebGL2FallbackPage. (b) **CVD 모드 토큰 채움** — D9 의 `.cvd` 셀렉터에 색약 안전 팔레트 (지금은 잠정 값). settingsStore.cvdMode 토글이 `<html class="cvd">` 적용. CPK 색상 라벨 강제 on (architecture §3.5). (c) **WebGL2 fallback 페이지 i18n 문구 완성** (`app.webgl2Unsupported.*` — 한·영). (d) **AppErrorBoundary fallback UI 정적 영문 검증** — i18n 부팅 실패 시뮬레이션 (D15 / R3). (e) **키보드 회귀** — PanelGroup resize handle / Dialog focus trap / Tabs keyboard nav / Slider step. (f) `<html lang>` 가 `settingsStore.locale` 과 동기 (architecture §11).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

### 12.1 소급 수정 — Phase 01

- `src/app/App.tsx`: `<AppShell>` placeholder → `<AppLayout/>` 마운트
- `<ErrorBoundary>` (Phase 01 정적) → `<AppErrorBoundary>` (본 Phase 가 디자인 토큰 적용한 버전, 정적 영문 fallback 유지)
- `tailwind.config.ts`: `theme.extend.colors` 에 본 Phase 의 토큰 추가 (CSS 변수 참조)
- `src/index.css`: `theme.css` import 추가

본 변경은 **본 Phase 구현 PR 의 첫 커밋** 으로 들어간다 (phase-08 D1 retrofit 패턴과 동일).

### 12.2 소급 수정 — Phase 07 / 08 / 09

- **변경 없음**. uiStore selector / settingsStore selector / `<Viewport>` API / `KEY_MAP` / `installGlobalUndoShortcuts` 모두 본 Phase 가 _소비만_ 하고 손대지 않는다.

---

_문서 버전: 0.1 (초안)_
_작성일: 2026-04-27_
