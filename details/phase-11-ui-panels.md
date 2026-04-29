# Phase 11 — UI Panels

> 본 문서는 `architecture.md` §13 의 Phase 11 상세 설계서다. 코드 작성은 모든 details 문서의 검토가 끝난 뒤에만 시작한다.
>
> **선행 문서**: `architecture.md` (특히 §1.3 ①–⑩, §3.4 ⑥ RenderMode, §3.5 접근성, §3.7 에러 처리, §3.8 Undo/Redo, §3.10 뷰포트 표시 기본값, §4.1 레이어, §6 핵심 구성요소, §8 상태 관리, §11 i18n, §12 #1 반응 예측 한계, §13 의존 Phase), `details/phase-02-element-data.md`, `details/phase-04-compound-data-pipeline.md`, `details/phase-05-runtime-data-layer.md`, `details/phase-06-reaction-engine.md`, `details/phase-07-state-management.md`, `details/phase-09-interactions.md`, `details/phase-10-ui-framework.md`. (Phase 03 / 08 은 본 Phase 가 *직접 import 하지 않으나* 결과 타입 (`Molecule` / `ViewportApi`) 의 출처로 인용.)

---

## 1. 목적 (Purpose)

본 Phase 는 다음을 완성한다.

1. **6 종 패널 본문 구현** — `panels/PeriodicTable`, `panels/CompoundBrowser`, `panels/Conditions`, `panels/MoleculeInfo`, `panels/ReactionResult`, `panels/Toolbar`. Phase 10 의 `<AppLayout>` 슬롯 + `PanelRegistry` + 13 종 primitives 위에 *실제 UI* 와 store 연결을 얹는다.
2. **PanelRegistry 등록** (phase-10 D14 약속의 닫음) — `registerAllPanels()` 부팅 진입점이 5 개 패널 (`registerPanel(def)`) 을 등록. Toolbar 는 *직접 주입* 이라 등록 제외.
3. **Toolbar 의 실제 버튼 구현** (phase-10 §2.2 인계의 닫음) — Undo/Redo, Frame Active/All, Reset Camera, Capture PNG, Create Bond, SMILES Input trigger, 라벨 토글, 렌더 모드, 배경 오버라이드, 테마, 언어, 단축키 시트.
4. **`<ToastItem>` 외양 풍부화** (phase-10 §6.8 / §12 (e) 인계의 닫음) — level (info/success/warn/error) 별 색상·아이콘·dismiss 애니메이션. phase-10 의 placeholder `<ToastSlot>` 을 교체.
5. **Q1 ReactionResult product 적재 정책 닫음** (phase-09 §11 #11 / D16 인계의 닫음) — 명시적 "작업공간에 추가" 버튼. `moleculeStore.addFromMolecule(m)` / `addFromMolecules(ms)` retrofit. 적재 시점에 phase-08 `useFadeOnMount` 가 자연스럽게 fade-in 발화 (별도 reaction-trigger crossfade 드라이버 불요 — `architecture.md` §1.3 ⑥ "결합 변화 애니메이션" 약속의 *경로* 확정).
6. **Q2 아이콘 라이브러리 확정** (phase-10 §11 #1 / D10 인계의 닫음) — `lucide-react` 확정.
7. **Q3 Toolbar 단축키 도움말 형식 닫음** (phase-09 §11 #5 인계의 닫음) — Tooltip + Popover 단축키 시트 (`<ShortcutSheet/>`).
8. **phase-09 §11 #8 닫음** — undo 후 selection 손실 안내 토스트 발화 정책 (`D-UNDO-TOAST`).
9. **phase-09 §11 #9 닫음** — 다른 분자 atom 결합 거부 i18n 문구 (`shortcuts.bondCreate.diffMolecule` 한·영 채움).
10. **phase-10 §11 #2 / #3 / #5 닫음** — 사이드패널 폭 / 토스트 위치·외양 / Toolbar 56 px 적합성 — D-table 로 잠정 결론 + §11 측정 후 후속.
11. **panel-focused 우선순위 4 단축키** (phase-09 §4.5) — 본 Phase 는 `?` 1 개만 등록 (단축키 시트 토글). 그 외 (`/` 검색 focus 등) 비추가 — Phase 14+ 후속.
12. **i18n `panels.*` 네임스페이스 채움** — 한·영 양쪽. `common.json#reaction.*` (phase-06 §4.8) 와 `shortcuts.*` (phase-09 §4.4) 는 *재사용* 만 — 새 키 정의 안 함. 한·영 문구 최종 폴리싱은 Phase 15.

본 Phase 는 `architecture.md` §12 의 열린 질문 중 **#1 (반응 예측 한계 UI 문구)** 의 ReactionResult 표면을 *조립* 으로 닫는다 (phase-06 §4.8 가 정의한 `experimentalBadge` / `experimentalDisclaimer` 키 + Tooltip + 모달 디스클레이머 표시). **#2 (큐레이션 정책)** / **#3 (ΔH)** / **#5 (WebGL2)** / **#6 (이온)** 은 본 Phase 영역 외.

---

## 2. 범위 (Scope)

### 2.1 포함

#### 패널 본문

##### `panels/PeriodicTable/`
- **`<PeriodicTablePanel/>`** — modal Dialog (PanelKey `'periodic-table'`, mode='modal'). Phase 07 §4.4 의 `panels.isPeriodicTableOpen` 토글로 열림.
- 18×7 grid + lanthanide / actinide 별도 행 (`getPeriodicTableLayout()` 결과를 CSS Grid 좌표로 매핑).
- 원소 셀: 원자번호 (작은 글자, 좌상단) + 기호 (큰 글자, 가운데) + 원자량 (작은 글자, 하단). 배경색은 `cpkColorHex`. CVD 모드 (Phase 15) 시 라벨 강제 on (`architecture.md` §3.5).
- **호버**: `<Tooltip>` (한·영 이름 + 카테고리 + 전기음성도).
- **클릭**: `<ElementInfoSheet/>` 인라인 펼침 (그리드 아래에 가로 패널). 표시 항목: 한·영 이름, 카테고리, 전기음성도, 첫 이온화에너지, 공유 반지름, 판데르발스 반지름, 녹는점/끓는점 (settingsStore.units 적용), 블록.
- **ElementInfoSheet 액션**: "이 원소로 분자 시작" 버튼 → phase-12 가 SMILES 모달로 인계 (현재는 trigger 만 — `notify({ level: 'info', messageKey: 'panels.periodicTable.startMolecule.placeholder' })`).
- **키보드**: Tab / Shift+Tab 으로 셀 nav, ←/→/↑/↓ 로 인접 셀, Enter 로 ElementInfoSheet 펼침, Esc 로 sheet 닫기 (Dialog 닫기는 Esc 두 번 또는 Radix close 버튼).

##### `panels/CompoundBrowser/`
- **`<CompoundBrowserPanel/>`** — modal Dialog (PanelKey `'compound-browser'`, mode='modal'). `panels.isCompoundBrowserOpen` 으로 열림.
- 상단: mode 토글 (`<Tabs/>`: `name | cid | formula`), `<Input/>` 검색 박스 (autoFocus), `<CategoryChips/>` (phase-04 `CompoundCategory` 의 flat list — 다중 선택 가능, 검색 필터로 적용).
- **검색 흐름**: Input onChange → `useDebouncedQuery` (300 ms) → `setCompoundSearchQuery(q)` + `setCompoundSearchMode(m)` → `runCompoundSearch()` (phase-07 §5.3 가 manifest 1차 + PubChem 2차 자동 처리).
- 좌측: `<ResultList/>` — `selectCompoundSearch().results` 의 AsyncState 4 분기 표시 (idle 빈 상태, loading Spinner, success 카드 리스트, error 메시지 + retry).
- 우측: `selectedCid` 강조 시 `<MoleculeCard compound/>` (`_shared/MoleculeCard`).
- **액션**: "작업공간에 추가" 버튼 → `moleculeStore.addFromCompound(cid)` 호출 + 결과에 따라 `notify` (성공: `'panels.compoundBrowser.addedToWorkspace'`, 실패: phase-05 `PubChemError` 분기에 따른 i18n 키).

##### `panels/Conditions/`
- **`<ConditionsPanel/>`** — docked sidepanel (PanelKey `'conditions'`, mode='docked'). `panels.active === 'conditions'` 시 마운트.
- 헤더: 제목 + "기본값으로" 버튼 (resetCondition — patchCondition 으로 default = `{ temperatureK: 298.15, pressureAtm: 1, pH: null }`).
- 본문: 3 개 슬라이더 그룹 — Temperature, Pressure, pH. 각 그룹은:
  - `<Label/>` + 현재값 (단위 토글 적용)
  - `<Slider/>` (Radix 표준 keyboard nav)
  - 단위 toggle 또는 비활성 toggle (pH 만)
  - 권장 범위 hint (선택, phase-06 ReactionRule.condition 범위 — 본 Phase v1 미포함, §11 #3)
- **단위 변환** (D-CONDITIONS-UNITS): 표시만 변환, 저장은 K/atm 고정. T: `K` (300..1000) / `°C` (27..727). P: `atm` (0.1..10) / `Pa` (10132..1013250). pH: 정수 0..14 또는 비활성 (null).
- **action**: Slider onValueChange → `patchCondition({ temperatureK: ... })`.

##### `panels/MoleculeInfo/`
- **`<MoleculeInfoPanel/>`** — docked sidepanel (PanelKey `'molecule-info'`, mode='docked').
- `selectActiveMolecule` 구독 → null 이면 빈 상태 (`'panels.moleculeInfo.empty.noActive'`).
- 헤더: 분자식 + 분자량.
- 본문: `<Tabs/>` (`overview | bonds | stereo`).
  - **overview 탭**: SMILES (mono font + copy 버튼), InChI (mono font, 줄바꿈), 분자식, 분자량, 총 전하, spin multiplicity.
  - **bonds 탭**: 결합 길이/각 표 (`selectBondMetrics(molecule)` retrofit — Molecule 자체를 인자로 받는 standalone 순수 함수 + WeakMap memoize). 각 행: atom1-atom2 (기호+인덱스), order, length (Å, 소수점 2 자리), angle (인접 결합 쌍 — 도, 소수점 1 자리).
  - **stereo 탭**: R/S atom stereo + E/Z bond stereo 표 (phase-03 §4.5 의 `stereo.atomStereo` / `bondStereo`).
- **action**: SMILES copy 버튼 → `navigator.clipboard.writeText(smiles)` + `notify({ level: 'success', messageKey: 'panels.moleculeInfo.copied' })`.

##### `panels/ReactionResult/`
- **`<ReactionResultPanel/>`** — modal Dialog (PanelKey `'reaction-result'`, mode='modal'). `panels.isReactionResultOpen` 으로 열림 — Toolbar 또는 reactionStore.run() 성공 시 자동 열기 정책은 D-table 에서 결정.
- 헤더: 제목 + `<ExperimentalBadge/>` (kind === 'heuristic-experimental' 시) + close.
- 본문: `selectRunState` 의 AsyncState 4 분기:
  - **idle**: `'panels.reactionResult.empty.idle'` ("반응을 실행하면 결과가 여기 표시됩니다.").
  - **loading**: `<Spinner/>` + `'panels.reactionResult.running'`. 본 패널 내부 `<LoadingOverlay variant="panel">` 도 가능.
  - **success**: `<Tabs/>` (`products | rule | thermo`).
  - **error**: `mapReactionErrorToKey(error)` 결과로 i18n 메시지 + Retry 버튼 (`run({ force: true })`).
- **products 탭**: 생성물 카드 리스트. 각 카드 = `<MoleculeCard molecule/>` (`_shared/MoleculeCard`) + "이 생성물 추가" 버튼. 헤더에 "생성물 전체 추가" 버튼.
- **rule 탭**:
  - `kind === 'rule-based'` → `appliedRuleId` (phase-06 §4.1 의 `ReactionRule.source` 표시 — 본 Phase 는 ID 와 source 텍스트만, version/license 는 §11 #4 후속).
  - `kind === 'heuristic-experimental'` → `<ExperimentalDisclaimer/>` (i18n `common.json#reaction.experimentalDisclaimer` — phase-06 §4.8).
- **thermo 탭**: ThermoFlag 아이콘 + 한·영 라벨 (`'panels.reactionResult.thermo.{exothermic,endothermic,unknown}'`). confidence (high/medium/low) 텍스트 + 색상 dot (CVD 모드 시 dot+패턴 — D-EXPERIMENTAL-BADGE-PLACEMENT 정합).
- **action**:
  - "이 생성물 추가": `moleculeStore.addFromMolecule(product)` + 토스트 (성공/실패) — 패널은 닫지 않음.
  - "생성물 전체 추가": `moleculeStore.addFromMolecules(products)` + 토스트.
  - Retry: `useReactionStore(s => s.actions.run({ force: true }))`.

##### `panels/Toolbar/`
- **`<ToolbarBar apiRef/>`** — 가로 컨테이너. App.tsx 가 `<AppLayout toolbar={<ToolbarBar apiRef={ref}/>}>` 로 직접 주입. `<ToolbarSlot>` (phase-10) 안에 마운트.
- 4 그룹 분할 (`<Separator orientation="vertical"/>` 로 시각 분리):
  - **편집** (`<EditGroup/>`) — Undo, Redo, 결합 생성, SMILES 입력 trigger.
  - **뷰포트** (`<ViewportGroup/>`) — Frame Active, Frame All, Reset Camera, Capture PNG.
  - **표시** (`<DisplayGroup/>`) — 원자 라벨 Switch, 렌더 모드 Popover dropdown (1 옵션 + 비활성 placeholder), 배경 오버라이드 Popover.
  - **앱** (`<AppGroup/>`) — 테마 Switch (sun/moon), 언어 토글 (KO/EN), 단축키 시트 IconButton+Popover.
- 각 IconButton 은 `<Tooltip>` 으로 라벨 + `describeKey(binding)` 결합 (D-SHORTCUT-HELP).
- 14 슬롯 + 3 Separator = 17 children. 56 px 안에 가로 정렬 적합성 검증은 §11 #1.
- **action 매핑**:
  - Undo/Redo **표시** (활성/비활성 토글): `useUndoStack(): { canUndo, canRedo }` (phase-09 §5.3 권장 (1) 의 selector 훅 — React 반응성 보장). **발화** (실제 undo/redo 실행): `useMoleculeStore(s => s.actions.undo / redo)` — phase-07 §5.1 의 store action 이 정통 경로. phase-07 §6.4 / §659–664 의 동결 약속에 따라 본 wrapper 는 내부적으로 dispatcher 를 호출하며, phase-09 가 *export 시점에* 본 dispatcher 구현으로 swap (호출자 코드 무변경). 별도 `useUndoableDispatcher()` 컨텍스트 (phase-10 D17) 는 *비-store API* (예: phase-13 importJson 의 `dispatcher.clear()`) 호출용 — Undo/Redo 자체는 store action 경로가 phase-07/09 동결. `viewportApi.canUndo()` / `canRedo()` 는 imperative 보조 (호출 시점 값 — React 자동 리렌더 안 됨).
  - Create Bond: `viewportApi.createBondFromSelection()` → false 이면 `notify({ level: 'warn', messageKey: 'shortcuts.bondCreate.diffMolecule' })`.
  - SMILES Input: 현재는 placeholder — `notify({ level: 'info', messageKey: 'panels.toolbar.smilesInput.placeholder' })`. Phase 12 가 모달 trigger 로 교체.
  - Frame Active / All / Reset: `viewportApi.frameActive()` / `frameAll()` / `resetCamera()`.
  - Capture: `await viewportApi.captureBlob({ format: 'png', dpr: 2 })` → `URL.createObjectURL` + `<a download>` 클릭 + 즉시 `revokeObjectURL`. 임시 다운로드 헬퍼 (phase-13 가 정식 export 로 교체).
  - 라벨 토글: `uiStore.toggleAtomLabels(checked)`.
  - 렌더 모드: `settingsStore.setRenderMode(mode)`. 현재 1 옵션이라 dropdown 의 다른 항목은 disabled (`'panels.toolbar.renderMode.comingSoon'` tooltip).
  - 배경: `uiStore.setBackgroundOverride('theme'|'light'|'dark')`.
  - 테마: `settingsStore.setTheme(theme === 'dark' ? 'light' : 'dark')` (system 처리는 §11 #6 후속).
  - 언어: `settingsStore.setLocale(locale === 'ko' ? 'en' : 'ko')`.
  - 단축키 시트: `<Popover>` 안에 `<ShortcutSheet/>` 마운트. KEY_MAP 그룹별 (`global` / `viewport`) 표시.

##### `panels/Toast/`
- **`<ToastItem notification/>`** — phase-10 §6.8 의 placeholder `<ToastSlot>` 을 교체.
- level → 색상 + 아이콘 매핑:
  - `info` → blue, `<Info/>`
  - `success` → green, `<CheckCircle/>`
  - `warn` → amber, `<AlertTriangle/>`
  - `error` → red, `<XCircle/>`
- 좌측 4 px 컬러 bar + 본문 + dismiss × 버튼.
- 진입: 200 ms slide-in (`translate-y-2 → translate-y-0` + opacity 0 → 1).
- 퇴장: 150 ms fade-out (opacity 1 → 0). dismissNotification 호출 후 150 ms 지연 unmount (CSS transition 이 끝난 후).
- `dismissAfterMs` 값이 있으면 useEffect timer 로 자동 dismiss. visual countdown 은 v1 미포함 (Phase 15 결정).

#### 부팅 진입점

##### `panels/index.ts`
- `registerAllPanels(): void` — App.tsx 가 `<AppLayout/>` 마운트 *전* 1 회 호출.
- 5 회 `registerPanel(def)` 호출:
  ```ts
  registerPanel({ key: 'periodic-table', mode: 'modal', i18nTitleKey: 'panels.periodicTable.title', load: () => import('./PeriodicTable') });
  registerPanel({ key: 'compound-browser', mode: 'modal', i18nTitleKey: 'panels.compoundBrowser.title', load: () => import('./CompoundBrowser') });
  registerPanel({ key: 'conditions', mode: 'docked', i18nTitleKey: 'panels.conditions.title', load: () => import('./Conditions') });
  registerPanel({ key: 'molecule-info', mode: 'docked', i18nTitleKey: 'panels.moleculeInfo.title', load: () => import('./MoleculeInfo') });
  registerPanel({ key: 'reaction-result', mode: 'modal', i18nTitleKey: 'panels.reactionResult.title', load: () => import('./ReactionResult') });
  ```
- `<ToolbarBar/>` / `<ToastItem/>` 도 barrel 로 export — App.tsx / phase-10 ToastContainer 가 직접 import.

#### i18n 리소스

- `src/i18n/resources/{ko,en}/panels.json` 신규 — `panels.*` 네임스페이스. 모든 패널 라벨 / 도움말 / 빈 상태 / 검증 오류.
- `src/i18n/resources/{ko,en}/shortcuts.json` retrofit — `shortcuts.bondCreate.diffMolecule` 한·영 문구 채움 (phase-09 §11 #9 닫음).

#### Store retrofit (phase-07)

- **moleculeStore**: `addFromMolecule(m: Molecule): MoleculeId`, `addFromMolecules(ms: ReadonlyArray<Molecule>): ReadonlyArray<MoleculeId>` — Q1 닫음.
- **moleculeStore.selectors**: `selectBondMetrics(m: Molecule | null): BondMetricsResult | null` — Molecule 자체를 인자로 받는 standalone 순수 함수. WeakMap<Molecule, BondMetricsResult> memoize. MoleculeInfo bonds 탭 사용.

#### App.tsx retrofit (phase-10 / 01)

- `registerAllPanels()` 호출 (mount 전 1 회).
- `<AppLayout toolbar={<ToolbarBar apiRef/>} viewportApiRef={apiRef}/>` 주입.

#### KEY_MAP retrofit (phase-09)

- KEY_MAP 에 `?` 단축키 추가 (D-PANEL-SHORTCUTS):
  ```ts
  { id: 'showShortcutSheet', scope: 'global', matches: e => e.key === '?',
    action: 'showShortcutSheet', i18nLabelKey: 'shortcuts.showShortcutSheet' }
  ```
- `KeyActionId` 유니온에 `'showShortcutSheet'` 추가.
- 이 단축키는 *uiStore 토글* 또는 *Popover open* 으로 발화 — Toolbar 의 ShortcutSheet Popover open prop 을 uiStore 로 끌어올림 (D-table 에서 결정).

### 2.2 비포함

| 항목 | 인계 Phase |
|---|---|
| SMILES / 화학식 / InChI 입력 모달 본체 (Toolbar 는 trigger 버튼만) | 12 |
| PNG / JSON / SDF Export 정식 다이얼로그 (Toolbar 는 PNG capture 임시 헬퍼만) | 13 |
| product 적재 시점의 *명시적 reaction-trigger crossfade 드라이버* (mount fade-in 으로 충족) | 14 (D16 후속) |
| stagger fade-in (다수 product 동시 추가 시 100 ms 간격 분산) | 14 |
| panel-focused 우선순위 4 단축키 추가 (`?` 외) | 14 |
| Conditions 자동 권장 조건 표시 (phase-06 ReactionRule.condition 범위) | 14 |
| CompoundBrowser 카테고리 트리 (현재 flat chips) | 14 |
| 사이드패널 폭 px 정확 보장 (`useResizeObserver`) | 14 |
| `class-variance-authority` 도입 (phase-10 §11 #7) | 14 |
| a11y axe 자동 검증 + CVD 모드 실 팔레트 + i18n 한·영 최종 폴리싱 | 15 |
| ReactionResult ΔH 정량값 표시 (architecture §12 #3 후속) | (별도 Phase) |
| 모바일/태블릿 반응형 | **비목표** (architecture desktop-first) |

### 2.3 명시적 비결정 / 후속 결정

| 영역 | 사유 | 결정 시점 |
|---|---|---|
| Toolbar 56 px 적합성 | 14 슬롯 + 3 Separator 가 1280 px 너비에서 가로 정렬 적합한지 실측 필요 (Q3 의 단축키 시트 IconButton 추가로 슬롯 1 증가) | §11 #1 — Phase 14 측정 또는 본 Phase 구현 시점 측정 |
| ReactionResult 자동 열기 정책 | run() 성공 시 모달 자동 open 또는 사용자가 Toolbar 의 trigger 로만 open | §11 #2 |
| ReactionResult 패널 닫기 시 result clear 여부 | reactionStore.lastResult 보존 vs clearResult() 호출 | §11 #2 |
| ShortcutSheet open 상태 store 위치 | uiStore.panels 에 `isShortcutSheetOpen` 추가 vs Popover 자체 상태 | D-table 에서 결정 |
| 단축키 도움말 그룹 분할 | KEY_MAP 의 scope ('global' / 'viewport') 별 분할 vs 액션 카테고리별 분할 | §11 #5 — 본 Phase v1 = scope 별 |
| Conditions 권장 범위 hint 표시 | phase-06 ReactionRule.condition 범위 노출 위치 | §11 #3 — 본 Phase v1 미포함 |

---

## 3. 의존성 (Dependencies)

### 3.1 선행 Phase (직접 import / retrofit 대상)

| Phase | 본 Phase 가 사용하는 것 |
|---|---|
| **02 (Element Data)** | `Element`, `getElement(n)`, `getElementsByBlock`, `getPeriodicTableLayout(): readonly PeriodicTableCell[]`, `PeriodicTableCell { element, row, column }`. **레이어 예외**: `panels/PeriodicTable` 가 `@/chemistry/elements` 직접 import (정적 데이터 + 표시 전용 — P1 의 명시적 예외). store selector 통과 의무 없음 (phase-08 가 `viewport/renderers` 에서 동일 패턴 사용). |
| **04 (Compound Data)** | `Compound`, `CompoundCategory` 유니온, `getCompoundManifest()`, `searchCompoundManifest({ query, categories?, limit? })`, `ManifestEntry`. **레이어 예외**: `panels/CompoundBrowser` 가 `@/data/compounds` 직접 import (정적 manifest + 표시 전용). PubChem 런타임 호출은 stores 통과. |
| **06 (Reaction Engine)** | *직접 import 안 함*. 모든 `ReactionResult` (`{ products, kind, appliedRuleId, thermo, confidence?, notes }`), `ReactionEngineError`, `ThermoFlag`, `RuleConfidence`, `ReactionRule` 타입은 phase-07 selector / action 결과 타입으로 흘러옴. **i18n 키 재사용**: `common.json#reaction.experimentalBadge` / `experimentalDisclaimer` (phase-06 §4.8) — 본 Phase 는 t() 호출만, 새 키 정의 안 함. |
| **05 (Runtime Data)** | *직접 import 안 함*. `PubChemError` 의 retryable 분류는 phase-07 의 `compoundSearch.results` AsyncState 의 error 분기로 노출. |
| **07 (Stores)** | 본 Phase 의 *주된 의존*. **모든 패널이 stores 만 통과해 도메인 데이터에 접근** (P1 정합).
  - **moleculeStore selector**: `selectActiveMolecule`, `selectMoleculeById`, `selectMoleculeIds`, `selectIngestState`, `selectMoleculeSnapshot`, `selectBondMetrics(m: Molecule | null)` (retrofit — standalone 순수 함수).
  - **moleculeStore action**: `addFromSmiles`, `addFromInchi`, `addFromCompound`, `setActive`, `removeMolecule`, `replace`, `moveAtom`, `setBondOrder`, `addBond`, `removeBond`, `addAtom`, `removeAtom`, `clear`, `undo`, `redo`, `addFromMolecule` (retrofit), `addFromMolecules` (retrofit).
  - **reactionStore selector**: `selectReactantIds`, `selectCondition`, `selectRunState`, `selectIsRunning`, `selectIsExperimental`, `selectThermoFlag`, `selectAppliedRuleId`, `mapReactionErrorToKey(e)`.
  - **reactionStore action**: `setCondition`, `patchCondition`, `addReactant`, `removeReactant`, `setReactants`, `clearReactants`, `run({ force? })`, `cancel`, `clearResult`.
  - **uiStore selector**: `selectActivePanel`, `selectAtomLabelsOn`, `selectBackgroundOverride`, `selectNotifications`, `selectIsGloballyLoading`, `selectCompoundSearch`.
  - **uiStore action**: `setActivePanel`, `togglePeriodicTable(open?)`, `toggleCompoundBrowser(open?)`, `toggleReactionResult(open?)`, `toggleAtomLabels(on?)`, `setBackgroundOverride(mode)`, `beginLoading`, `endLoading`, `notify(n)`, `dismissNotification(id)`, `clearNotifications`, `setCompoundSearchQuery`, `setCompoundSearchMode`, `runCompoundSearch({ signal? })`, `selectCompoundSearchResult(cid)`, `clearCompoundSearch`.
  - **settingsStore selector**: `selectTheme`, `selectLocale`, `selectRenderMode`, `selectUnits`, `selectIsCvdOn`.
  - **settingsStore action**: `setTheme`, `setLocale`, `setRenderMode`, `setTemperatureUnit`, `setPressureUnit`, `toggleCvdMode`, `resetToDefaults`.
  - **공용 타입**: `Notification`, `PanelKey`, `CompoundSearchSlice`, `AsyncState<T,E>`, `MoleculeId`. |
| **09 (Interactions)** | `KEY_MAP: ReadonlyArray<KeyBinding>`, `KeyBinding { id, scope, matches, action, i18nLabelKey }`, `KeyActionId` 유니온, `describeKey(binding): string`, `useUndoStack(): { canUndo, canRedo }`, `BondCreateFlowApi` (참조만 — Toolbar 는 `viewportApi.createBondFromSelection()` 호출). **retrofit 대상**: `KEY_MAP` 에 `?` (showShortcutSheet) 추가 + `KeyActionId` 유니온 확장. |
| **10 (UI Framework)** | `<AppLayout toolbar viewportApiRef/>`, `<ToolbarSlot>` 자식 주입, `<SidePanelHost/>`, `<ModalHost/>`, `<ToastContainer/>` (placeholder 자식 교체), `<LoadingOverlay variant>`, `<PanelErrorBoundary panelKey/>`, `registerPanel(def)`, `usePanelDefinition(key)`, `getPanelRegistry()`, `useUndoableDispatcher()`, `installAppShortcuts(opts)`. **13 primitives 전부**: `Button`, `IconButton`, `Tooltip`, `Dialog` (Root/Trigger/Content/Title/Description/Close), `Tabs` (Root/List/Trigger/Content), `Slider`, `Switch`, `Spinner`, `Input`, `Popover` (Root/Trigger/Content), `Separator`, `Label`, `VisuallyHidden`. CSS 변수 토큰 (`bg-canvas`, `bg-panel`, `bg-panel-elevated`, `fg-primary`, `fg-muted`, `border`, `accent`, `accent-fg`, `error`, `warn`, `success`). |
| **08 (Rendering)** | *직접 import 안 함*. `ViewportApi` 타입만 (`@/viewport` barrel — phase-08 §5.2 + phase-09 §5.3 retrofit 포함): `frameActive`, `frameAll`, `resetCamera`, `captureBlob({ format, dpr?, transparentBackground? }): Promise<Blob>`, `getRenderer()`, `canUndo()`, `canRedo()`, `createBondFromSelection(): boolean`. |

본 Phase 는 `engine` / `services` / `viewport/*` *내부* 를 import 하지 않는다 (P1 정합). `chemistry/elements` 와 `data/compounds` 는 *정적 데이터* 한정 예외.

### 3.2 외부 라이브러리 (architecture §66 신규 도입 절차)

본 Phase 는 phase-10 가 §3.2 에 *잠정* 등재한 `lucide-react` 를 **확정** 표명한다. **신규 라이브러리 0**.

| 라이브러리 | 버전 | 용도 | gzip | 대안 거절 |
|---|---|---|---|---|
| `lucide-react` (확정) | ^0.4x | Toolbar / 패널 헤더 아이콘. 사용 ~18 개 | tree-shake 사용 아이콘만 = ~5–10 KB | (a) `@radix-ui/react-icons` — 화학/분자 아이콘 부족 (FlaskConical / Atom / TestTube 등 부재). 사용자 Q2 확정. (b) 자체 SVG — 유지비용 ↑. |

**사용 아이콘 목록 (잠정 18 개 — 구현 시 조정 가능)**:
- 편집: `Undo2`, `Redo2`, `Link2`, `Plus`
- 뷰포트: `Maximize`, `Box`, `RotateCcw`, `Camera`
- 표시: `Tag`, `Atom`, `Palette`
- 앱: `Sun`, `Moon`, `Globe`, `Keyboard`
- 패널: `Search`, `FlaskConical`, `ChevronDown`
- 토스트: `Info`, `CheckCircle`, `AlertTriangle`, `XCircle`, `X`

(개수 22 — 일부 중복 + 본 표는 *최대* 추정. 실제 import 는 §6 에서 컴포넌트 단위로 명시.)

**번들 예산 정합** — `architecture.md` §3.2 의 `< 500 KB gzip` 검증:
- panels 는 phase-10 의 SidePanelHost / ModalHost lazy chunk 로 분리됨 (`registerPanel.load` = dynamic import).
- Toolbar 는 App.tsx 가 직접 import → 초기 chunk. lucide-react 는 Toolbar 사용 ~15 개 + Toast 4 개 = ~20 개 아이콘 = ~10 KB gzip 초기 chunk 추가.
- 패널 본문 (PeriodicTable 18×7 grid + CompoundBrowser 검색 + ReactionResult Tabs 등) 은 panels/* lazy chunk → 사용 시점 fetch.

**예상 초기 번들 영향: +10 KB gzip 이내** (Phase 14 가 실측 검증).

### 3.3 결정 사항

#### 선결정 사항 (P-table — 선행 Phase / architecture 가 이미 동결)

| ID | 내용 | 출처 |
|---|---|---|
| **P1** | 레이어 가드 — `panels/*` 는 viewport/engine/services/data/chemistry 중 **정적 데이터 (`@/data/compounds` 매니페스트, `@/chemistry/elements`) 만 직접 import** 허용. 그 외 (`engine/*`, `services/*`, `chemistry/bonds`, `chemistry/compounds` 의 derive 함수, `viewport/*` 내부) 는 store selector / action 통과. ESLint 가드는 §7.2 가 추가. | architecture §4.1 |
| **P2** | Toolbar 는 `registerPanel` 으로 *등록 안 함*. `<AppLayout toolbar={<ToolbarBar/>}>` prop 으로 직접 주입. PanelKey `'toolbar'` 값은 본 Phase 에서 **예약 미사용** — phase-12+ 가 다른 용도 (예: SMILES 입력 패널의 active 표시) 로 쓸 수 있음. | phase-10 §6.1 / phase-07 §4.4 |
| **P3** | PanelKey ↔ mode 매핑. **modal**: `'periodic-table'` / `'compound-browser'` / `'reaction-result'` (phase-07 §4.4 의 `is*Open` 토글 보유). **docked**: `'conditions'` / `'molecule-info'` (phase-07 의 `panels.active` 만으로 활성). | phase-07 §4.4 / phase-10 D14 |
| **P4** | KEY_MAP 우선순위 4 영역 추가 시 phase-09 `KEY_MAP` import 후 키 충돌 검사 의무. 본 Phase 는 `?` 1 개만 추가 — phase-09 의 기존 키 (`Tab`, `Esc`, `Del`, `B`, `1`, `2`, `3`, `A`, `F`, `R` + Cmd/Ctrl 조합) 와 충돌 없음. | phase-09 §4.5 / §12 a |
| **P5** | 도메인 실패는 Result 패턴으로 store 의 AsyncState 분기에 흘러옴. 본 Phase 의 패널은 *AsyncState 4 분기 (idle/loading/success/error) 를 UI 분기* 로 표현. `<PanelErrorBoundary>` 는 *런타임 예외* 만 포착 (예: 잘못된 ref 접근, undefined property). | architecture §3.7 / phase-10 P5 |
| **P6** | i18n 부팅 실패 안전 — `<AppErrorBoundary>` fallback 정적 영문 유지 (phase-10 D15). 본 Phase 패널은 **정상 부팅 가정** + Suspense fallback 만. 패널 내부의 `t(key)` 가 missing key 일 경우 react-i18next 기본 폴백 (key 자체 표시). | phase-10 D15 / architecture §11 |
| **P7** | `experimental` 배지 / disclaimer 의 i18n 키는 phase-06 §4.8 가 이미 `common.json#reaction.experimentalBadge` / `common.json#reaction.experimentalDisclaimer` 로 정의. 본 Phase 는 *재사용만* — `panels.json` 에 새 키 정의 안 함. | phase-06 §4.8 / architecture §12 #1 |
| **P8** | `mapReactionErrorToKey(error: ReactionEngineError): string` 가 10 가지 kind (`RdkitNotReady` / `RdkitInitFailed` / `NoMatchingRule` / `HeuristicAbstained` / `ConditionOutOfRange` / `InvalidReactant` / `RunReactantsFailed` / `EmbedFailed` / `Aborted` / `Internal`) 를 i18n 키 (`common.json#reaction.error.*`) 로 매핑. 본 Phase 의 ReactionResult 패널은 *호출만* — 새 매핑 정의 안 함. | phase-07 §5.2 |
| **P9** | `viewportApi.createBondFromSelection(): boolean` — Toolbar 의 결합 생성 버튼이 imperative 호출. 실패 (false) 시 `notify({ level: 'warn', messageKey: 'shortcuts.bondCreate.diffMolecule' })` 발화 (phase-09 §6.4.2 가 키 이름 명명, 본 Phase 가 한·영 채움). | phase-09 §4.7 / §6.4.2 |
| **P10** | RenderMode 유니온 = `'ball-and-stick'` 단일 (phase-07 §4.5). Toolbar 의 dropdown 은 1 옵션 + 다른 옵션 (e.g. 'space-filling', 'wireframe') 은 disabled placeholder + `'panels.toolbar.renderMode.comingSoon'` tooltip. architecture §3.4 ⑥ "타입은 확장 여지" 정합. | phase-07 §4.5 / architecture §3.4 |
| **P11** | `panels.active` (단일 docked) ↔ `is*Open` (개별 modal) 동시 사용 정책. 본 Phase 는 *selector 만 사용* — 두 슬롯의 의미 분기는 phase-07 가 보장 (phase-10 P10 정합). 동시 표시는 의도된 디자인 (docked = 지속, modal = 일시). | phase-07 §4.4 / phase-10 P10 |
| **P12** | 토스트 큐 길이 상한 50 — phase-07 R7 가 보장 (50 도달 시 가장 오래된 자동 dismiss). 본 Phase 의 ToastContainer 는 *모든* 항목 렌더하지만 큐 길이가 보장되어 안전. | phase-07 R7 / phase-10 P9 |

#### 본 Phase 결정 (D-table)

| ID | 질문 | 확정 답 | 본문 영향 |
|---|---|---|---|
| **D1** | 패널 ↔ mode 매핑 | P3 와 동일. `registerAllPanels()` 가 5 회 `registerPanel(def)` 호출. `panels/index.ts` 부팅 진입점 생성. | §2.1 / §6.10 |
| **D2** | Toolbar 콘텐츠 그룹 분할 | 4 그룹 (편집 / 뷰포트 / 표시 / 앱) + `<Separator orientation="vertical"/>` 로 시각 분리. 56 px (phase-10 D1) 적합 검증은 §11 #1. | §2.1 / §6.6 |
| **D3** | Toolbar 그룹 내부 슬롯 수 | 편집 4 (Undo/Redo/Bond/SMILES) + 뷰포트 4 (FrameA/FrameAll/Reset/Capture) + 표시 3 (Labels/RenderMode/Background) + 앱 4 (Theme/Locale/Shortcuts/Settings? — Settings 는 v1 미포함) = **14 슬롯 + 3 Separator = 17 children**. 1280 px viewport - 320 px sidepanel = 960 px Toolbar 가용. 14 슬롯 × 평균 40 px (icon 32 + padding 8) + 3 Separator × 16 px = ~608 px 필요 + 우측 여백. **결론: 56 px 높이에 적합**. | §6.6 / §11 #1 |
| **D-LOAD-PRODUCTS** | predict 생성물 적재 정책 (Q1 확정) | **명시적 "작업공간에 추가" 버튼**. (a) products 탭 각 카드에 "이 생성물 추가" + (b) 헤더에 "생성물 전체 추가". moleculeStore retrofit: **`addFromMolecule(m: Molecule): MoleculeId`** (단일 entry undoable, kind=`molecule.add-from-product`), **`addFromMolecules(ms: ReadonlyArray<Molecule>): ReadonlyArray<MoleculeId>`** (하나의 undoable group 으로 묶음). reactionStore 변경 없음. fade-in 은 phase-08 `useFadeOnMount` 자동 (D16 후속 약속의 *경로* 닫음 — `architecture.md` §1.3 ⑥ 충족). | §2.1 / §4.6 / §6.5 |
| **D-ICONS** | 아이콘 라이브러리 (Q2 확정) | **`lucide-react`**. §3.2 의 사용 ~22 개 아이콘. `@radix-ui/react-icons` 거절. | §3.2 / §6.6 |
| **D-SHORTCUT-HELP** | Toolbar 단축키 도움말 형식 (Q3 확정) | **Tooltip + Popover 단축키 시트**. (a) 각 IconButton 에 `<Tooltip>` 으로 `t(binding.i18nLabelKey) + ' (' + describeKey(binding) + ')'` (예: "실행 취소 (⌘Z)"). (b) Toolbar 우측 끝 `<IconButton><Keyboard/></IconButton>` → `<Popover>` 안에 `<ShortcutSheet/>` (KEY_MAP 전체를 scope 별 그룹화). | §6.6 / §6.11 |
| **D-UNDO-TOAST** | undo 후 selection 손실 안내 토스트 (phase-09 §11 #8) | **표시함**. Toolbar 의 Undo 버튼 onClick 또는 KEY_MAP `undo` 액션 발화 시점에 `notify({ level: 'info', messageKey: 'panels.toolbar.undoSelectionRestored.notice', dismissAfterMs: 3000 })`. **단, throttle**: phase-09 D3 의 200 ms 그룹 합치기 윈도우와 동일 — 연속 undo 시 1 회 토스트만 (timestamp 추적). 발화 조건: undo 직전 selection.atomIds 또는 selection.bondIds 가 비어있지 않았을 때만. | §6.6 |
| **D-BOND-DIFF-MOL-I18N** | 다른 분자 atom 결합 시도 i18n 문구 (phase-09 §11 #9) | 키 = `shortcuts.bondCreate.diffMolecule` (phase-09 §6.4.2 가 키 이름 명명). 본 Phase 가 한·영 채움. **ko**: "다른 분자의 원자끼리는 결합을 만들 수 없습니다.". **en**: "Cannot create a bond between atoms in different molecules.". | §5.4 / §6.6 |
| **D-SIDEPANEL-WIDTH** | 사이드패널 폭 (phase-10 §11 #2) | Conditions = 3 슬라이더 + 라벨, MoleculeInfo = Tabs + 표 — 둘 다 320 px 적합. **확정: phase-10 D6 의 320 / 240 / 600 % 기본값 유지**. 폭 확장 사용자 요구 시 Phase 14 가 px 정확 보장 (`useResizeObserver`). | §6.3 / §6.4 |
| **D-TOAST-VISUAL** | Toast 외양 + 위치 (phase-10 §11 #3) | **위치**: `right-4 bottom-4` (phase-10 D7 유지). **외양**: level 별 색상 + 아이콘 (info=blue Info, success=green CheckCircle, warn=amber AlertTriangle, error=red XCircle), 좌측 4 px 컬러 bar, dismiss × 버튼. 진입 200 ms slide-in (`translate-y-2 → 0` + opacity), 퇴장 150 ms fade-out (opacity 1 → 0 + 150 ms 지연 unmount). visual countdown 미포함 (Phase 15 결정). | §6.7 |
| **D-PANEL-SHORTCUTS** | panel-focused 우선순위 4 단축키 추가 여부 | **`?` 1 개만 등록** (단축키 시트 토글). KeyBinding scope='global' (phase-09 §4.5 의 우선순위 1 text-input gate 가 자동 통과 — `?` 는 일반적으로 `Shift + /` 변환 후 `e.key === '?'` 로 도착하므로 `matches: e => e.key === '?'` 로 충분). KEY_MAP 에 `{ id: 'showShortcutSheet', scope: 'global', matches: e => e.key === '?', action: 'showShortcutSheet', i18nLabelKey: 'shortcuts.showShortcutSheet' }` 추가. 그 외 (`/`, `Cmd+K` 등) 비추가. | §2.1 / §6.6 |
| **D-CONDITIONS-UNITS** | Conditions 단위 변환 정책 | 표시만 변환, 저장은 K/atm 고정 (phase-07 §4.5). T 표시: `K` (300..1000 step 5) / `°C` (27..727 step 5). P: `atm` (0.1..10 step 0.1) / `Pa` (10132..1013250 step ~5066). pH: 정수 0..14 step 1 또는 비활성 (null). 변환 헬퍼는 `panels/Conditions/units.ts` (engine 신규 의존 없음). | §4.4 / §6.3 |
| **D-COMPOUND-SEARCH-DEBOUNCE** | CompoundBrowser 검색 디바운스 ms | **300 ms**. Phase 14 측정 후 150–500 ms 조정 가능. debounce hook 은 `panels/CompoundBrowser/useDebouncedQuery.ts` (Phase 11 자체, 재사용 없음 — 단순 `setTimeout` + cleanup). | §4.5 / §6.2 |
| **D-PRIMARY-CARD-FORMAT** | CompoundPreviewCard / ProductCard 공통 형식 | **상단**: 분자식 (큰 글자) + 분자량. **중단**: SMILES (mono font, `text-xs` + 줄바꿈 가능). **하단**: 카테고리 chip (Compound 만) + properties (melting/boiling/solubility — settingsStore.units 적용). **우측 액션**: "작업공간에 추가" + (선택) "정보 닫기". 컴포넌트 = `panels/_shared/MoleculeCard.tsx`. props discriminated union: `{ compound: Compound } | { molecule: Molecule, source?: 'reaction-product' }`. | §4.2 / §6.5 |
| **D-EXPERIMENTAL-BADGE-PLACEMENT** | experimental 배지 위치 | (a) ReactionResult 패널 헤더 우측. (b) products 탭 각 카드 우상단. `<Tooltip>` hover 시 `experimentalDisclaimer` (phase-06 §4.8) 표시. **CVD 모드** (settingsStore.cvdMode === true) 시 색상 + 라벨 + `*` 마커 강제 (phase-15 가 검증). 컴포넌트 = `panels/ReactionResult/ExperimentalBadge.tsx`. | §6.5 / §6.11 |
| **D-PANELS-INDEX** | `panels/index.ts` 부팅 진입점 | `registerAllPanels(): void` 함수. `App.tsx` 가 `<AppLayout/>` 마운트 *전* 1 회 호출. phase-10 §4.1 의 PanelRegistry 가 *부팅 1 회 채워진 뒤 변하지 않는다* 는 가정 정합. 동일 key 중복 등록 시 phase-10 의 `registerPanel` 이 logger.warn (phase-10 §5.2). | §6.10 |
| **D-SHORTCUT-OPEN-STATE** | ShortcutSheet open 상태 위치 | **Popover 자체 상태** (Radix `<Popover open onOpenChange/>`) + Toolbar 컴포넌트 내부 `useState`. uiStore 추가 불필요 — single-source-of-truth 가 Popover 자체. KEY_MAP 의 `?` 액션은 *uiStore 변경 안 하고 Toolbar 내부 콜백* 으로 처리 (Toolbar 가 `useEffect` 로 KEY_MAP 의 `showShortcutSheet` 액션 listen — 단순 패턴). | §6.6 / §6.11 |
| **D-REACTION-RESULT-AUTO-OPEN** | ReactionResult 모달 자동 열기 정책 | **자동 열기 미구현 (v1)**. reactionStore.run() 성공/실패와 무관하게 모달은 *Toolbar trigger 또는 외부 액션으로만* 열림. 사용자가 결과를 *원치 않을 때* 모달 자동 열림은 invasive UX. Phase 14+ 가 "자동 열기" 옵션 (settingsStore.autoOpenReactionResult: boolean) 도입 검토. **본 Phase**: Toolbar 의 SMILES Input 옆 또는 별도 IconButton "반응 결과 보기" 추가 — Toolbar D3 의 14 슬롯 안에 1 개 추가하면 15. **결정**: D3 의 편집 그룹에 "반응 실행" + "반응 결과" 2 슬롯 추가는 *과부담* — `<MoleculeInfoPanel>` 헤더 또는 별도 Popover Action 으로 위임. **본 Phase v1**: ReactionResult 패널은 `uiStore.toggleReactionResult(true)` 액션으로만 열림. 호출자는 (a) Toolbar 의 단축키 시트 항목 또는 (b) reactionStore.run() 호출 직후 *호출자 코드가 명시적 toggle*. *Phase 12 / 13 가 ReactionsPanel 추가 시 결정*. | §11 #2 |
| **D-REACTION-RESULT-CLEAR** | ReactionResult 패널 닫기 시 result clear 여부 | **clearResult 호출 안 함** (보존). 사용자가 다시 열면 마지막 결과 그대로. clear 는 명시적 사용자 액션 ("결과 지우기" 버튼) 또는 `run()` 새 실행 시 자동. | §6.5 |
| **D-MOLECULE-CARD-COPY** | MoleculeCard 내부 SMILES copy 버튼 | **포함**. `navigator.clipboard.writeText(smiles)` + `notify` 성공/실패. clipboard API 미지원 환경 (HTTPS 외) fallback: `<textarea>` + `document.execCommand('copy')` (phase-15 검증). | §6.5 |
| **D-LOG-RUNTIME-ERRORS** | 패널 내부 런타임 예외 logging | `<PanelErrorBoundary panelKey/>` (phase-10 §6.5) 가 자동으로 `logger.error('panel-boundary.caught', ...)` 호출. 본 Phase 패널 컴포넌트는 *추가 logger 호출 안 함* — Boundary 가 책임. 도메인 실패 (Result.error) 는 패널 UI 의 error 분기로 표시 (logger 호출 안 함 — 정상 흐름). | §6 전반 |
| **D-COMPOUND-CATEGORY-DISPLAY** | CategoryChips 표현 방식 | **flat chip + 다중 선택**. phase-04 의 `CompoundCategory` 유니온 모든 값 표시. 선택 시 검색 필터에 적용 (`searchCompoundManifest({ query, categories })`). 카테고리 트리 (계층) 는 §11 #4 후속. | §6.2 |
| **D-SHORTCUT-SHEET-GROUPING** | ShortcutSheet 그룹 분할 | **scope 별** (`global` / `viewport`). 각 그룹 내부에서는 `KEY_MAP` 의 등재 순서 보존 (phase-09 §4.5 우선순위 표 순서). 액션 카테고리별 분할 (편집 / 뷰포트 / 패널) 은 §11 #5 후속. | §6.11 |

---

## 4. 데이터 모델 / 타입

본 Phase 는 새 도메인 타입을 *최소* 도입한다 (재사용 우선 정책 §3 적용 원칙 #3).

### 4.1 PanelRegistry 등록 정의 (재사용)

```ts
import type { PanelDefinition } from '@/app/layout';
// phase-10 §4.1 의 인터페이스 그대로 사용.
// {
//   readonly key: PanelKey;
//   readonly mode: 'docked' | 'modal';
//   readonly i18nTitleKey: string;
//   readonly load: () => Promise<{ default: React.ComponentType }>;
// }
```

### 4.2 MoleculeCard props (`panels/_shared/MoleculeCard.tsx`)

```ts
import type { Compound } from '@/data/compounds';
import type { Molecule } from '@/chemistry/...'; // phase-07 의 selector 결과 타입

export type MoleculeCardSource = 'compound' | 'reaction-product';

export interface MoleculeCardCommonProps {
  /** 카드 우측 액션 영역. */
  readonly actions?: {
    readonly onAddToWorkspace?: () => void;
    readonly onDismiss?: () => void;
  };
  /** "experimental" 배지 표시. ReactionResult 의 heuristic-experimental 결과만. */
  readonly badge?: 'experimental' | null;
  /** 컴팩트 모드 (높이 ↓). 검색 결과 리스트에서 사용. */
  readonly compact?: boolean;
}

export type MoleculeCardProps =
  | (MoleculeCardCommonProps & { readonly compound: Compound; readonly molecule?: never })
  | (MoleculeCardCommonProps & { readonly molecule: Molecule; readonly compound?: never; readonly source?: MoleculeCardSource });
```

discriminated union 으로 `compound` 또는 `molecule` 둘 중 하나만 받음. compound 이면 manifest entry 의 `name`/`molecularFormula`/`molecularWeight`/`category`/`properties` 표시. molecule 이면 분자식 + SMILES + 분자량 (Molecule 타입의 derive — phase-07 selector 또는 RDKit 호출 결과).

### 4.3 ToastItem props (`panels/Toast/ToastItem.tsx`)

```ts
import type { Notification } from '@/stores/uiStore';

export interface ToastItemProps {
  readonly notification: Notification;
}
```

phase-10 §6.8 의 placeholder `<ToastSlot>` 을 교체. notification.id / level / messageKey / messageParams / dismissAfterMs 만 사용 — 추가 props 없음.

### 4.4 Conditions units (`panels/Conditions/units.ts`)

```ts
/** Kelvin → Celsius. */
export function kelvinToCelsius(k: number): number {
  return k - 273.15;
}

/** Celsius → Kelvin. */
export function celsiusToKelvin(c: number): number {
  return c + 273.15;
}

/** atm → Pascal. */
export function atmToPa(a: number): number {
  return a * 101325;
}

/** Pa → atm. */
export function paToAtm(p: number): number {
  return p / 101325;
}

/** Slider step 도우미 — UnitSystem 별로 적절한 step. */
export interface ConditionRanges {
  readonly temperature: { readonly min: number; readonly max: number; readonly step: number };
  readonly pressure: { readonly min: number; readonly max: number; readonly step: number };
}

export function rangesFor(units: import('@/stores/settingsStore').UnitSystem): ConditionRanges {
  return {
    temperature: units.temperature === 'K'
      ? { min: 100, max: 1000, step: 5 }
      : { min: -173, max: 727, step: 5 },
    pressure: units.pressure === 'atm'
      ? { min: 0.1, max: 10, step: 0.1 }
      : { min: 10132, max: 1013250, step: 5066 },
  };
}
```

순수 함수 + 라운드 트립 안전 (Vitest 가 검증).

### 4.5 useDebouncedQuery (`panels/CompoundBrowser/useDebouncedQuery.ts`)

```ts
export interface UseDebouncedQueryOptions<T> {
  readonly value: T;
  readonly delayMs: number;
}

/**
 * 단순 디바운스 훅. value 변경 후 delayMs 동안 추가 변경 없으면 debounced 반환.
 * cleanup 은 unmount + value 변경 시 자동 (이전 timer clear).
 */
export function useDebouncedQuery<T>(opts: UseDebouncedQueryOptions<T>): T;
```

본 Phase 자체 hook (재사용 가능 — phase-12 가 SMILES 입력에서 동일 패턴 사용 가능).

### 4.6 moleculeStore retrofit (D-LOAD-PRODUCTS)

phase-07 §5.1 의 `MoleculeStoreActions` 에 다음 2 개 추가:

```ts
// src/stores/moleculeStore.ts (phase-11 retrofit)

export interface MoleculeStoreActions {
  // ... 기존 액션 ...

  /**
   * Phase 06 ReactionResult.products 의 단일 분자를 작업공간에 적재.
   *
   * - 단일 entry undoable (kind=`'molecule.add-from-product'`).
   * - 새 MoleculeId 생성 (crypto.randomUUID).
   * - atoms / bonds 의 stable ID 도 새로 생성 (phase-08 D1 의 `createAtomId`/`createBondId` —
   *   호출자 책임이 아니라 본 store action 이 자동 생성. ReactionResult.products 의 분자가
   *   이미 ID 를 가질 수 있으므로 *재할당* 이 안전).
   * - `setActive(newId)` 자동 호출 (활성 분자 = 방금 추가한 product).
   *
   * **fade-in**: phase-08 의 useFadeOnMount 가 mount 시점에 자연스럽게 fade-in 발화 —
   *  별도 reaction-trigger crossfade 드라이버 불요 (`architecture.md` §1.3 ⑥ 약속의 *경로* 닫음).
   */
  addFromMolecule(m: Molecule): MoleculeId;

  /**
   * 여러 분자를 *하나의 undoable group* 으로 묶어 적재.
   *
   * - phase-09 D3 의 그룹 합치기 (mergeWindowMs=200) 로 묶지 않음 — 명시적 group key 사용:
   *   `dispatchUndoable({ kind: 'molecule.add-from-product', groupKey: 'add-products-${batchId}' }, ...)`.
   * - 모든 분자를 *동시* 추가 (stagger 없음 — Phase 14 가 도입 결정 §11 #2).
   * - 마지막 추가된 분자를 active 로 setActive.
   *
   * **fade-in**: 모든 분자가 동시 mount → useFadeOnMount 가 동시 발화. 시각적 부담은
   *  R3 가 명시 (Phase 14 가 stagger 옵션 도입 결정).
   */
  addFromMolecules(ms: ReadonlyArray<Molecule>): ReadonlyArray<MoleculeId>;
}
```

### 4.7 moleculeStore selectors retrofit (selectBondMetrics)

```ts
// src/stores/moleculeStore.selectors.ts (phase-11 retrofit)

export interface BondMetric {
  readonly bondIndex: number;
  readonly atom1Index: number;
  readonly atom2Index: number;
  readonly atom1Symbol: string;       // 표시용
  readonly atom2Symbol: string;
  readonly order: BondOrder;
  readonly lengthAngstrom: number;    // 두 atom 좌표 사이 distance
}

export interface BondAngleMetric {
  readonly atom1Index: number;
  readonly atom2Index: number;        // vertex
  readonly atom3Index: number;
  readonly angleDegrees: number;
}

export interface BondMetricsResult {
  readonly lengths: ReadonlyArray<BondMetric>;
  readonly angles: ReadonlyArray<BondAngleMetric>;
}

/**
 * 활성 분자의 결합 길이/각 메트릭. MoleculeInfo.BondsTab 사용.
 *
 * **시그니처 형태**: Molecule 자체를 받음 (id 가 아님). 이유:
 *   - phase-07 §5.1 의 `Molecule` 타입에 *id 필드 없음* — 분자는 `molecules: Record<MoleculeId, Molecule>` 의 record key 로만 식별. 호출자 (BondsTab) 는 이미 `selectActiveMolecule` 로 Molecule 객체 자체를 들고 있어 id 추가 lookup 불필요.
 *   - WeakMap<Molecule, BondMetricsResult> 캐시 키로 *Molecule 참조* 가 자연. zustand+immer 의 immutable 보장 (phase-07 §3.2) → 내용 변경 시 새 참조 → WeakMap miss → 재계산.
 *
 * **memoization**: 동일 분자 (참조 동일) 입력 시 동일 결과 반환. 분자가 새 참조이면 재계산.
 *
 * **계산 정책**: bond length = `Math.hypot(...positionDiff)`. bond angle = `Math.acos(dot/...)` —
 *  panels 가 chemistry/engine 의 derive 함수를 직접 호출 안 하고 *selector 내부에서 inline*.
 *  본 함수는 *순수* 라 phase-07 의 selector 위치에 둠. zustand selector 시그니처 형태가 아닌
 *  *standalone 순수 함수* — 호출자가 `useMoleculeStore(selectActiveMolecule)` 로 Molecule 을
 *  먼저 받고, 그 결과를 본 함수에 전달.
 */
export function selectBondMetrics(m: Molecule | null): BondMetricsResult | null;
```

**구현 노트**: 분자 atoms 수 N 에 대해 bond 수 M ≤ N(N-1)/2 (실제는 ~N). bond angle 은 vertex 당 평균 2-3 개 → O(M²/N). 50 atom 분자에서 ~150 angle 계산 = 충분히 빠름.

### 4.8 KEY_MAP retrofit (phase-09)

```ts
// src/viewport/interactions/shortcuts.ts (phase-11 retrofit)

export type KeyActionId =
  | 'undo' | 'redo'
  | 'navAtomNext' | 'navAtomPrev'
  | 'clearSelection'
  | 'deleteSelection'
  | 'createBondFromSelection'
  | 'setBondOrder1' | 'setBondOrder2' | 'setBondOrder3' | 'setBondOrderAromatic'
  | 'frameActive' | 'resetCamera'
  | 'showShortcutSheet';                              // ⟵ phase-11 추가

export const KEY_MAP: ReadonlyArray<KeyBinding> = [
  // ... 기존 KEY_MAP ...

  // phase-11 추가:
  {
    id: 'showShortcutSheet',
    scope: 'global',
    matches: e => e.key === '?',
    action: 'showShortcutSheet',
    i18nLabelKey: 'shortcuts.showShortcutSheet',
  },
];
```

**`matches` 정책**: `?` 는 일반적으로 `Shift+/` 의 변환 결과로 `e.key === '?'` 로 도착 (영문 / 한글 layout 공통). 별도 `e.shiftKey` / `e.code` 조건 불요. **text-input gate**: phase-09 §4.5 의 우선순위 1 (`isTextInputTarget(target)` 가 true 이면 모든 KEY_MAP binding 의 발화 차단) 가 자동 적용 — `<input>` / `<textarea>` 안에서 native `?` 입력 우선.

### 4.9 i18n 새 네임스페이스 (`panels.json`)

상세 키 트리는 §5.4 + §6.9 에서 정의. 본 §4 는 *최상위* 만:

```ts
// src/i18n/types.ts (Phase 01 가 정의 — 본 Phase 가 namespace 추가)
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof import('./resources/en/common.json');
      chemistry: typeof import('./resources/en/chemistry.json');
      shortcuts: typeof import('./resources/en/shortcuts.json');
      panels: typeof import('./resources/en/panels.json');         // ⟵ phase-11 추가
    };
  }
}
```

---

## 5. 퍼블릭 API / 인터페이스

### 5.1 `@/panels` barrel (`src/panels/index.ts`)

```ts
// 부팅 진입점
export { registerAllPanels } from './registerAll';

// Toolbar (App.tsx 가 직접 import)
export { default as ToolbarBar } from './Toolbar/ToolbarBar';
export type { ToolbarProps } from './Toolbar/types';

// Toast (phase-10 ToastContainer 가 직접 import)
export { ToastItem } from './Toast/ToastItem';
export type { ToastItemProps } from './Toast/ToastItem';

// 패널 default export 는 *barrel 미노출* — phase-10 `registerPanel.load` 가
// dynamic import 로만 접근. 외부에서 패널 컴포넌트를 직접 마운트 금지.
```

### 5.2 `panels/registerAll.ts`

```ts
import { registerPanel } from '@/app/layout';

/**
 * 부팅 시 1 회 호출. App.tsx 가 <AppLayout/> 마운트 *전* 호출.
 *
 * **호출 순서 안전**:
 *   1. logger / i18n 초기화 (phase-01)
 *   2. registerAllPanels() ⟵ 본 함수
 *   3. ReactDOM.createRoot(...).render(<App/>)
 * 그러므로 PanelRegistry 가 채워진 상태에서 SidePanelHost / ModalHost 가 마운트.
 */
export function registerAllPanels(): void {
  registerPanel({
    key: 'periodic-table',
    mode: 'modal',
    i18nTitleKey: 'panels.periodicTable.title',
    load: () => import('./PeriodicTable'),
  });
  registerPanel({
    key: 'compound-browser',
    mode: 'modal',
    i18nTitleKey: 'panels.compoundBrowser.title',
    load: () => import('./CompoundBrowser'),
  });
  registerPanel({
    key: 'conditions',
    mode: 'docked',
    i18nTitleKey: 'panels.conditions.title',
    load: () => import('./Conditions'),
  });
  registerPanel({
    key: 'molecule-info',
    mode: 'docked',
    i18nTitleKey: 'panels.moleculeInfo.title',
    load: () => import('./MoleculeInfo'),
  });
  registerPanel({
    key: 'reaction-result',
    mode: 'modal',
    i18nTitleKey: 'panels.reactionResult.title',
    load: () => import('./ReactionResult'),
  });
}
```

### 5.3 ToolbarBar props (`panels/Toolbar/types.ts`)

```ts
import type { ViewportApi } from '@/viewport';

export interface ToolbarProps {
  /**
   * Viewport 의 imperative API ref. App.tsx 가 useRef 로 생성하여
   * <AppLayout viewportApiRef> 와 본 prop 양쪽에 동일 ref 를 forward.
   *
   * **null 가능**: viewport 가 마운트 전 / WebGL2 미지원 fallback 인 경우 ref.current = null.
   *  Toolbar 의 viewport 액션 버튼은 ref.current 가 null 이면 disabled.
   */
  readonly apiRef: React.RefObject<ViewportApi | null>;
}
```

### 5.4 i18n 키 트리 (`src/i18n/resources/{ko,en}/panels.json`)

전체 키 트리 (한·영 동일 구조):

```jsonc
// en/panels.json
{
  "periodicTable": {
    "title": "Periodic Table",
    "empty": { "hint": "Click an element to see details." },
    "element": {
      "fields": {
        "category": "Category",
        "electronegativity": "Electronegativity",
        "ionizationEnergy": "First Ionization Energy",
        "covalentRadius": "Covalent Radius",
        "vdwRadius": "Van der Waals Radius",
        "meltingPoint": "Melting Point",
        "boilingPoint": "Boiling Point",
        "block": "Block"
      },
      "startMolecule": "Start molecule with this element",
      "startMolecule.placeholder": "SMILES input pipeline coming in Phase 12."
    }
  },
  "compoundBrowser": {
    "title": "Compound Browser",
    "searchPlaceholder": "Search by name, CID, or formula",
    "mode": { "name": "Name", "cid": "CID", "formula": "Formula" },
    "empty": {
      "idle": "Enter a query to search.",
      "noResults": "No compounds matched."
    },
    "addToWorkspace": "Add to workspace",
    "addedToWorkspace": "Added to workspace.",
    "addFailed": "Failed to add: {{reason}}",
    "categoryChips": { "label": "Filter by category" }
  },
  "conditions": {
    "title": "Conditions",
    "temperatureLabel": "Temperature",
    "pressureLabel": "Pressure",
    "phLabel": "pH",
    "phDisabled": "Not applicable",
    "tempUnit": { "kelvin": "K", "celsius": "°C" },
    "pressureUnit": { "atm": "atm", "pa": "Pa" },
    "resetToDefaults": "Reset to defaults"
  },
  "moleculeInfo": {
    "title": "Molecule Info",
    "tabs": { "overview": "Overview", "bonds": "Bonds", "stereo": "Stereo" },
    "empty": { "noActive": "No active molecule." },
    "fields": {
      "smiles": "SMILES",
      "inchi": "InChI",
      "molecularFormula": "Formula",
      "molecularWeight": "Molecular Weight",
      "totalCharge": "Total Charge",
      "spinMultiplicity": "Spin Multiplicity"
    },
    "bond": { "length": "Length", "angle": "Angle", "order": "Order" },
    "stereo": {
      "atomTag": { "R": "R", "S": "S", "none": "—" },
      "bondTag": { "E": "E", "Z": "Z", "none": "—" }
    },
    "copied": "SMILES copied to clipboard.",
    "copyFailed": "Failed to copy."
  },
  "reactionResult": {
    "title": "Reaction Result",
    "tabs": { "products": "Products", "rule": "Rule", "thermo": "Thermo" },
    "empty": { "idle": "Run a reaction to see the result here." },
    "running": "Running…",
    "addProduct": "Add this product",
    "addProductsToWorkspace": "Add all products",
    "addedProducts": "Added {{count}} product(s) to workspace.",
    "thermo": { "exothermic": "Exothermic", "endothermic": "Endothermic", "unknown": "Unknown" },
    "confidence": { "high": "High", "medium": "Medium", "low": "Low" },
    "rule": { "appliedRule": "Applied rule: {{id}}", "source": "Source: {{source}}" },
    "retry": "Retry"
  },
  "toolbar": {
    "undo": "Undo",
    "redo": "Redo",
    "createBond": "Create bond",
    "smilesInput": "SMILES input",
    "smilesInput.placeholder": "Coming in Phase 12.",
    "frameActive": "Frame active",
    "frameAll": "Frame all",
    "resetCamera": "Reset camera",
    "capture": "Capture PNG",
    "labels": "Atom labels",
    "renderMode": { "ballAndStick": "Ball and stick", "comingSoon": "Coming soon" },
    "background": { "theme": "Theme", "light": "Light", "dark": "Dark" },
    "theme": "Theme",
    "language": "Language",
    "shortcuts": "Keyboard shortcuts",
    "undoSelectionRestored": { "notice": "Selection cleared after undo." }
  },
  "toast": {
    "dismiss": "Dismiss",
    "level": { "info": "Info", "success": "Success", "warn": "Warning", "error": "Error" }
  }
}
```

ko/panels.json 은 동일 구조 한국어 번역. phase-15 가 최종 폴리싱.

**기존 네임스페이스 retrofit**:
- `shortcuts.json` 에 `bondCreate.diffMolecule` 한·영 채움 (D-BOND-DIFF-MOL-I18N) 및 `showShortcutSheet` 라벨 추가:
  ```jsonc
  // en/shortcuts.json (retrofit)
  {
    // ... 기존 키 ...
    "showShortcutSheet": "Show keyboard shortcuts",
    "bondCreate": {
      "diffMolecule": "Cannot create a bond between atoms in different molecules."
    }
  }
  // ko/shortcuts.json (retrofit)
  {
    "showShortcutSheet": "단축키 시트 표시",
    "bondCreate": {
      "diffMolecule": "다른 분자의 원자끼리는 결합을 만들 수 없습니다."
    }
  }
  ```

---

## 6. 핵심 로직 / 전략

### 6.1 PeriodicTable 패널

```tsx
// panels/PeriodicTable/index.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getPeriodicTableLayout, type Element } from '@/chemistry/elements';
import { useUiStore } from '@/stores';
import { Tooltip, VisuallyHidden, Separator } from '@/components';
import { PeriodicGrid } from './PeriodicGrid';
import { ElementInfoSheet } from './ElementInfoSheet';

export default function PeriodicTablePanel() {
  const { t } = useTranslation('panels');
  const layout = getPeriodicTableLayout();
  const [selected, setSelected] = useState<Element | null>(null);
  const notify = useUiStore(s => s.actions.notify);

  return (
    <div className="flex flex-col gap-4 p-6">
      <PeriodicGrid layout={layout} onSelect={setSelected} selected={selected} />
      {selected && (
        <>
          <Separator />
          <ElementInfoSheet
            element={selected}
            onStartMolecule={() => {
              notify({ level: 'info', messageKey: 'panels.periodicTable.element.startMolecule.placeholder', dismissAfterMs: 3000 });
            }}
          />
        </>
      )}
    </div>
  );
}
```

```tsx
// panels/PeriodicTable/PeriodicGrid.tsx
import type { PeriodicTableCell, Element } from '@/chemistry/elements';
import { Tooltip } from '@/components';
import { useTranslation } from 'react-i18next';
import { useSettingsStore, selectLocale } from '@/stores';

interface Props {
  readonly layout: readonly PeriodicTableCell[];
  readonly onSelect: (e: Element) => void;
  readonly selected: Element | null;
}

export function PeriodicGrid({ layout, onSelect, selected }: Props) {
  const { t } = useTranslation('panels');
  const locale = useSettingsStore(selectLocale);

  return (
    <div
      role="grid"
      aria-label={t('periodicTable.title')}
      className="grid gap-1"
      style={{ gridTemplateColumns: 'repeat(18, minmax(0, 1fr))' }}
    >
      {layout.map(({ element, row, column }) => {
        const isSelected = selected?.number === element.number;
        const name = locale === 'ko' ? element.nameKo : element.nameEn;
        return (
          <Tooltip key={element.number} content={`${name} (Z=${element.number})`}>
            <button
              type="button"
              role="gridcell"
              aria-label={`${name}, atomic number ${element.number}`}
              aria-selected={isSelected}
              onClick={() => onSelect(element)}
              className={cn(
                'aspect-square rounded p-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                isSelected && 'ring-2 ring-accent',
              )}
              style={{
                gridRow: row,
                gridColumn: column,
                backgroundColor: element.cpkColorHex,
              }}
            >
              <div className="text-[8px] text-fg-muted">{element.number}</div>
              <div className="text-base font-bold text-fg-primary">{element.symbol}</div>
              <div className="text-[8px] text-fg-muted">{element.atomicMass.toFixed(2)}</div>
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
```

`<ElementInfoSheet/>` 는 표시 전용 (전기음성도 / 이온화에너지 / 반지름 / 녹는점/끓는점 / 블록 / 카테고리). 단위 변환은 `selectUnits` 적용 (녹는점/끓는점 K↔°C).

**a11y**: `role="grid"` + `aria-label`, 각 셀 `role="gridcell"` + `aria-label` (한·영 이름 + 원자번호). 키보드 nav 는 native `<button>` Tab + Radix Tooltip 의 keyboard focus. 화살표 키 nav 는 v1 미포함 (`<PeriodicGrid>` 자체에 keydown listener — Phase 15 추가 가능).

### 6.2 CompoundBrowser 패널

```tsx
// panels/CompoundBrowser/index.tsx
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore, selectCompoundSearch, useMoleculeStore } from '@/stores';
import { Tabs, TabsList, TabsTrigger, TabsContent, Spinner } from '@/components';
import { SearchInput } from './SearchInput';
import { CategoryChips } from './CategoryChips';
import { ResultList } from './ResultList';
import { MoleculeCard } from '../_shared/MoleculeCard';
import { useDebouncedQuery } from './useDebouncedQuery';

export default function CompoundBrowserPanel() {
  const { t } = useTranslation('panels');
  const search = useUiStore(selectCompoundSearch);
  const setQuery = useUiStore(s => s.actions.setCompoundSearchQuery);
  const setMode = useUiStore(s => s.actions.setCompoundSearchMode);
  const runSearch = useUiStore(s => s.actions.runCompoundSearch);
  const selectResult = useUiStore(s => s.actions.selectCompoundSearchResult);
  const addFromCompound = useMoleculeStore(s => s.actions.addFromCompound);
  const notify = useUiStore(s => s.actions.notify);

  const debouncedQuery = useDebouncedQuery({ value: search.query, delayMs: 300 });

  useEffect(() => {
    if (debouncedQuery.length === 0) return;
    const ac = new AbortController();
    runSearch({ signal: ac.signal });
    return () => ac.abort();
  }, [debouncedQuery, search.mode, runSearch]);

  const onAdd = async (cid: number) => {
    const result = await addFromCompound(cid);
    if (result.ok) {
      notify({ level: 'success', messageKey: 'panels.compoundBrowser.addedToWorkspace', dismissAfterMs: 2000 });
    } else {
      notify({ level: 'error', messageKey: 'panels.compoundBrowser.addFailed', messageParams: { reason: result.error.kind }, dismissAfterMs: 5000 });
    }
  };

  const selectedCompound = search.results.kind === 'success'
    ? search.results.value.find(c => c.cid === search.selectedCid) ?? null
    : null;

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <header className="flex items-center gap-4">
        <Tabs value={search.mode} onValueChange={v => setMode(v as 'name' | 'cid' | 'formula')}>
          <TabsList>
            <TabsTrigger value="name">{t('compoundBrowser.mode.name')}</TabsTrigger>
            <TabsTrigger value="cid">{t('compoundBrowser.mode.cid')}</TabsTrigger>
            <TabsTrigger value="formula">{t('compoundBrowser.mode.formula')}</TabsTrigger>
          </TabsList>
        </Tabs>
        <SearchInput value={search.query} onChange={setQuery} />
      </header>
      <CategoryChips />
      <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden">
        <ResultList
          search={search}
          onSelect={selectResult}
        />
        <div className="overflow-auto">
          {selectedCompound ? (
            <MoleculeCard
              compound={selectedCompound}
              actions={{ onAddToWorkspace: () => onAdd(selectedCompound.cid!) }}
            />
          ) : (
            <p className="text-fg-muted text-sm p-4">{t('compoundBrowser.empty.idle')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

**ResultList** 는 AsyncState 4 분기 표현:
- `idle`: 빈 상태 텍스트.
- `loading`: `<Spinner/>` + "검색 중…".
- `success`: 카드 리스트 (compact mode `<MoleculeCard compact compound={c}/>`).
- `error`: 메시지 + 재시도 버튼 (retryable=true 인 경우만).

### 6.3 Conditions 패널

```tsx
// panels/Conditions/index.tsx
import { useTranslation } from 'react-i18next';
import { useReactionStore, selectCondition, useSettingsStore, selectUnits } from '@/stores';
import { Slider, Label, Switch, Button, Separator } from '@/components';
import { kelvinToCelsius, celsiusToKelvin, atmToPa, paToAtm, rangesFor } from './units';

export default function ConditionsPanel() {
  const { t } = useTranslation('panels');
  const condition = useReactionStore(selectCondition);
  const patchCondition = useReactionStore(s => s.actions.patchCondition);
  const units = useSettingsStore(selectUnits);
  const ranges = rangesFor(units);

  const tempDisplay = units.temperature === 'K' ? condition.temperatureK : kelvinToCelsius(condition.temperatureK);
  const pressureDisplay = units.pressure === 'atm' ? condition.pressureAtm : atmToPa(condition.pressureAtm);

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg-primary">{t('conditions.title')}</h2>
        <Button variant="ghost" size="sm" onClick={() => patchCondition({ temperatureK: 298.15, pressureAtm: 1, pH: null })}>
          {t('conditions.resetToDefaults')}
        </Button>
      </div>

      {/* Temperature */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="temp-slider">{t('conditions.temperatureLabel')}</Label>
          <span className="text-sm text-fg-muted">
            {tempDisplay.toFixed(1)} {units.temperature === 'K' ? t('conditions.tempUnit.kelvin') : t('conditions.tempUnit.celsius')}
          </span>
        </div>
        <Slider
          id="temp-slider"
          min={ranges.temperature.min}
          max={ranges.temperature.max}
          step={ranges.temperature.step}
          value={[tempDisplay]}
          onValueChange={([v]) => {
            const tk = units.temperature === 'K' ? v : celsiusToKelvin(v);
            patchCondition({ temperatureK: tk });
          }}
        />
      </section>

      {/* Pressure */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="pressure-slider">{t('conditions.pressureLabel')}</Label>
          <span className="text-sm text-fg-muted">
            {pressureDisplay.toFixed(2)} {units.pressure === 'atm' ? t('conditions.pressureUnit.atm') : t('conditions.pressureUnit.pa')}
          </span>
        </div>
        <Slider
          id="pressure-slider"
          min={ranges.pressure.min}
          max={ranges.pressure.max}
          step={ranges.pressure.step}
          value={[pressureDisplay]}
          onValueChange={([v]) => {
            const pa = units.pressure === 'atm' ? v : paToAtm(v);
            patchCondition({ pressureAtm: pa });
          }}
        />
      </section>

      {/* pH */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="ph-slider">{t('conditions.phLabel')}</Label>
          <span className="text-sm text-fg-muted">
            {condition.pH == null ? t('conditions.phDisabled') : condition.pH}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={condition.pH != null}
            onCheckedChange={(checked) => patchCondition({ pH: checked ? 7 : null })}
            aria-label={t('conditions.phLabel')}
          />
          <Slider
            id="ph-slider"
            min={0}
            max={14}
            step={1}
            value={[condition.pH ?? 7]}
            disabled={condition.pH == null}
            onValueChange={([v]) => patchCondition({ pH: Math.round(v) })}
            className="flex-1"
          />
        </div>
      </section>
    </div>
  );
}
```

**a11y**: 각 Slider 가 `<Label htmlFor>` 로 라벨 연결, `aria-valuenow`/`min`/`max` 는 Radix 자동. CVD 모드 시 Slider track 색상 + 라벨 강제 (Phase 15).

### 6.4 MoleculeInfo 패널

```tsx
// panels/MoleculeInfo/index.tsx
import { useTranslation } from 'react-i18next';
import { useMoleculeStore, selectActiveMolecule } from '@/stores';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components';
import { OverviewTab } from './OverviewTab';
import { BondsTab } from './BondsTab';
import { StereoTab } from './StereoTab';

export default function MoleculeInfoPanel() {
  const { t } = useTranslation('panels');
  const active = useMoleculeStore(selectActiveMolecule);

  if (!active) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-fg-muted">{t('moleculeInfo.empty.noActive')}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <header>
        <h2 className="text-base font-semibold text-fg-primary">{active.canonicalSmiles}</h2>
      </header>
      <Tabs defaultValue="overview" className="flex flex-1 flex-col">
        <TabsList>
          <TabsTrigger value="overview">{t('moleculeInfo.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="bonds">{t('moleculeInfo.tabs.bonds')}</TabsTrigger>
          <TabsTrigger value="stereo">{t('moleculeInfo.tabs.stereo')}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="flex-1 overflow-auto">
          <OverviewTab molecule={active} />
        </TabsContent>
        <TabsContent value="bonds" className="flex-1 overflow-auto">
          <BondsTab molecule={active} />
        </TabsContent>
        <TabsContent value="stereo" className="flex-1 overflow-auto">
          <StereoTab molecule={active} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**BondsTab** 은 `selectBondMetrics(molecule)` (Molecule 자체) 로 결합 길이/각 표 표시:

```tsx
// panels/MoleculeInfo/BondsTab.tsx
import { useMemo } from 'react';
import { selectBondMetrics } from '@/stores';
import { useTranslation } from 'react-i18next';

export function BondsTab({ molecule }: { molecule: Molecule }) {
  const { t } = useTranslation('panels');
  // selectBondMetrics 는 standalone 순수 함수 (id 가 아닌 Molecule 자체를 받음).
  // 내부 WeakMap<Molecule, BondMetricsResult> 가 참조 동일성 기반 memo —
  // useMemo 는 React 리렌더 사이 안정성을 위한 보조 캐시.
  const metrics = useMemo(() => selectBondMetrics(molecule), [molecule]);

  if (!metrics) return null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <section>
        <h3 className="text-sm font-medium text-fg-primary mb-2">{t('moleculeInfo.bond.length')}</h3>
        <table className="w-full text-xs">
          <thead><tr><th>Bond</th><th>{t('moleculeInfo.bond.order')}</th><th>{t('moleculeInfo.bond.length')} (Å)</th></tr></thead>
          <tbody>
            {metrics.lengths.map((m) => (
              <tr key={m.bondIndex}>
                <td>{m.atom1Symbol}{m.atom1Index} — {m.atom2Symbol}{m.atom2Index}</td>
                <td>{m.order}</td>
                <td>{m.lengthAngstrom.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h3 className="text-sm font-medium text-fg-primary mb-2">{t('moleculeInfo.bond.angle')}</h3>
        <table className="w-full text-xs">
          <thead><tr><th>Vertex</th><th>Angle (°)</th></tr></thead>
          <tbody>
            {metrics.angles.map((a, i) => (
              <tr key={i}>
                <td>{a.atom1Index} — {a.atom2Index} — {a.atom3Index}</td>
                <td>{a.angleDegrees.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
```

`selectBondMetrics` 의 시그니처는 `(m: Molecule | null) => BondMetricsResult | null` (standalone 순수 함수, *non-curried*) — id 가 아닌 Molecule 자체를 받는다. 본 컴포넌트가 `selectActiveMolecule` 로 받은 Molecule 을 그대로 전달. 캐시는 WeakMap<Molecule, ...> + useMemo (§4.7 참조).

### 6.5 ReactionResult 패널

```tsx
// panels/ReactionResult/index.tsx
import { useTranslation } from 'react-i18next';
import { useReactionStore, selectRunState, mapReactionErrorToKey, useMoleculeStore, useUiStore } from '@/stores';
import { Tabs, TabsList, TabsTrigger, TabsContent, Button, Spinner } from '@/components';
import { ProductsTab } from './ProductsTab';
import { RuleTab } from './RuleTab';
import { ThermoTab } from './ThermoTab';
import { ExperimentalBadge } from './ExperimentalBadge';

export default function ReactionResultPanel() {
  const { t } = useTranslation('panels');
  const run = useReactionStore(selectRunState);
  const runAction = useReactionStore(s => s.actions.run);
  const addFromMolecule = useMoleculeStore(s => s.actions.addFromMolecule);
  const addFromMolecules = useMoleculeStore(s => s.actions.addFromMolecules);
  const notify = useUiStore(s => s.actions.notify);

  if (run.kind === 'idle') {
    return <p className="text-sm text-fg-muted p-6">{t('reactionResult.empty.idle')}</p>;
  }

  if (run.kind === 'loading') {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <Spinner size="lg" />
        <p className="text-sm text-fg-muted">{t('reactionResult.running')}</p>
      </div>
    );
  }

  if (run.kind === 'error') {
    const key = mapReactionErrorToKey(run.error);
    return (
      <div className="flex flex-col gap-4 p-6">
        <p className="text-sm text-error">{t(key, { ns: 'common' })}</p>
        <Button variant="secondary" size="md" onClick={() => runAction({ force: true })}>
          {t('reactionResult.retry')}
        </Button>
      </div>
    );
  }

  // success
  const result = run.value;
  const isExperimental = result.kind === 'heuristic-experimental';

  const onAddAll = () => {
    const ids = addFromMolecules(result.products);
    notify({ level: 'success', messageKey: 'panels.reactionResult.addedProducts', messageParams: { count: ids.length }, dismissAfterMs: 3000 });
  };

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-fg-primary">{t('reactionResult.title')}</h2>
          {isExperimental && <ExperimentalBadge />}
        </div>
        <Button variant="primary" size="md" onClick={onAddAll}>
          {t('reactionResult.addProductsToWorkspace')}
        </Button>
      </header>
      <Tabs defaultValue="products" className="flex flex-1 flex-col">
        <TabsList>
          <TabsTrigger value="products">{t('reactionResult.tabs.products')}</TabsTrigger>
          <TabsTrigger value="rule">{t('reactionResult.tabs.rule')}</TabsTrigger>
          <TabsTrigger value="thermo">{t('reactionResult.tabs.thermo')}</TabsTrigger>
        </TabsList>
        <TabsContent value="products" className="flex-1 overflow-auto">
          <ProductsTab
            products={result.products}
            isExperimental={isExperimental}
            onAddOne={(m) => {
              addFromMolecule(m);
              notify({ level: 'success', messageKey: 'panels.compoundBrowser.addedToWorkspace', dismissAfterMs: 2000 });
            }}
          />
        </TabsContent>
        <TabsContent value="rule" className="flex-1 overflow-auto">
          <RuleTab result={result} />
        </TabsContent>
        <TabsContent value="thermo" className="flex-1 overflow-auto">
          <ThermoTab result={result} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**ProductsTab**:

```tsx
// panels/ReactionResult/ProductsTab.tsx
import type { Molecule } from '@/chemistry/...';
import { MoleculeCard } from '../_shared/MoleculeCard';

export function ProductsTab({ products, isExperimental, onAddOne }: {
  readonly products: ReadonlyArray<Molecule>;
  readonly isExperimental: boolean;
  readonly onAddOne: (m: Molecule) => void;
}) {
  return (
    <div className="flex flex-col gap-3 p-4">
      {products.map((m, i) => (
        <MoleculeCard
          key={i}
          molecule={m}
          source="reaction-product"
          badge={isExperimental ? 'experimental' : null}
          actions={{ onAddToWorkspace: () => onAddOne(m) }}
        />
      ))}
    </div>
  );
}
```

**RuleTab**: rule-based 이면 appliedRuleId + source 표시 (rules manifest 에서 lookup — phase-04 가 noop 으로 두거나 store retrofit 필요? — D-table 외 detail 로 Phase 14 결정). heuristic-experimental 이면 `<ExperimentalDisclaimer/>` (phase-06 §4.8).

**ThermoTab**: ThermoFlag 아이콘 + 라벨 + confidence dot.

**`<ExperimentalBadge/>`**:

```tsx
// panels/ReactionResult/ExperimentalBadge.tsx
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@/components';
import { FlaskConical } from 'lucide-react';

export function ExperimentalBadge() {
  const { t } = useTranslation('common');
  return (
    <Tooltip content={t('reaction.experimentalDisclaimer')}>
      <span className="inline-flex items-center gap-1 rounded-full bg-warn/10 px-2 py-0.5 text-xs font-medium text-warn ring-1 ring-warn/30">
        <FlaskConical aria-hidden size={12} />
        {t('reaction.experimentalBadge')}
        <span aria-hidden>*</span>
      </span>
    </Tooltip>
  );
}
```

`*` 마커는 D-EXPERIMENTAL-BADGE-PLACEMENT 의 CVD 모드 강제 (Phase 15 검증).

### 6.6 Toolbar 패널

```tsx
// panels/Toolbar/ToolbarBar.tsx
import { useTranslation } from 'react-i18next';
import type { ViewportApi } from '@/viewport';
import { Separator } from '@/components';
import { EditGroup } from './EditGroup';
import { ViewportGroup } from './ViewportGroup';
import { DisplayGroup } from './DisplayGroup';
import { AppGroup } from './AppGroup';
import type { ToolbarProps } from './types';

export default function ToolbarBar({ apiRef }: ToolbarProps) {
  return (
    <div className="flex h-14 w-full items-center gap-2 border-b border-border bg-bg-panel px-4">
      <EditGroup apiRef={apiRef} />
      <Separator orientation="vertical" className="h-8" />
      <ViewportGroup apiRef={apiRef} />
      <Separator orientation="vertical" className="h-8" />
      <DisplayGroup />
      <Separator orientation="vertical" className="h-8 ml-auto" />
      <AppGroup />
    </div>
  );
}
```

**EditGroup**:

```tsx
// panels/Toolbar/EditGroup.tsx
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ViewportApi } from '@/viewport';
import { useMoleculeStore, useUiStore } from '@/stores';
import { useUndoStack, KEY_MAP, describeKey } from '@/viewport';
import { IconButton, Tooltip } from '@/components';
import { Undo2, Redo2, Link2, Plus } from 'lucide-react';

interface Props { readonly apiRef: React.RefObject<ViewportApi | null>; }

export function EditGroup({ apiRef }: Props) {
  const { t } = useTranslation('panels');
  const { canUndo, canRedo } = useUndoStack();
  const undo = useMoleculeStore(s => s.actions.undo);
  const redo = useMoleculeStore(s => s.actions.redo);
  const notify = useUiStore(s => s.actions.notify);
  const lastUndoToastTs = useRef(0);

  // D-UNDO-TOAST: 200 ms throttle
  const onUndo = () => {
    const hadSelection =
      useUiStore.getState().selection.atomIds.length > 0 ||
      useUiStore.getState().selection.bondIds.length > 0;
    undo();
    if (hadSelection && Date.now() - lastUndoToastTs.current > 200) {
      notify({ level: 'info', messageKey: 'panels.toolbar.undoSelectionRestored.notice', dismissAfterMs: 3000 });
      lastUndoToastTs.current = Date.now();
    }
  };

  const onCreateBond = () => {
    const ok = apiRef.current?.createBondFromSelection() ?? false;
    if (!ok) {
      notify({ level: 'warn', messageKey: 'shortcuts.bondCreate.diffMolecule', dismissAfterMs: 4000 });
    }
  };

  const onSmiles = () => {
    notify({ level: 'info', messageKey: 'panels.toolbar.smilesInput.placeholder', dismissAfterMs: 3000 });
  };

  return (
    <>
      <Tooltip content={`${t('toolbar.undo')} (${describeKey(KEY_MAP.find(b => b.id === 'undo')!)})`}>
        <IconButton aria-label={t('toolbar.undo')} disabled={!canUndo} onClick={onUndo}>
          <Undo2 size={18} />
        </IconButton>
      </Tooltip>
      <Tooltip content={`${t('toolbar.redo')} (${describeKey(KEY_MAP.find(b => b.id === 'redo')!)})`}>
        <IconButton aria-label={t('toolbar.redo')} disabled={!canRedo} onClick={redo}>
          <Redo2 size={18} />
        </IconButton>
      </Tooltip>
      <Tooltip content={`${t('toolbar.createBond')} (${describeKey(KEY_MAP.find(b => b.id === 'createBondFromSelection')!)})`}>
        <IconButton aria-label={t('toolbar.createBond')} onClick={onCreateBond}>
          <Link2 size={18} />
        </IconButton>
      </Tooltip>
      <Tooltip content={t('toolbar.smilesInput')}>
        <IconButton aria-label={t('toolbar.smilesInput')} onClick={onSmiles}>
          <Plus size={18} />
        </IconButton>
      </Tooltip>
    </>
  );
}
```

**ViewportGroup**:

```tsx
// panels/Toolbar/ViewportGroup.tsx
import { Maximize, Box, RotateCcw, Camera } from 'lucide-react';
// ... 동일 패턴 ...

const onCapture = async () => {
  const api = apiRef.current;
  if (!api) return;
  const blob = await api.captureBlob({ format: 'png', dpr: 2 });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chemistry-${Date.now()}.png`;
  a.click();
  URL.revokeObjectURL(url);
};
```

phase-13 가 정식 export 헬퍼로 교체.

**DisplayGroup**:

```tsx
// panels/Toolbar/DisplayGroup.tsx
import { useUiStore, selectAtomLabelsOn, useSettingsStore, selectRenderMode } from '@/stores';
import { Switch, Popover, PopoverTrigger, PopoverContent, IconButton } from '@/components';
import { Tag, Atom, Palette, ChevronDown } from 'lucide-react';

export function DisplayGroup() {
  const { t } = useTranslation('panels');
  const labelsOn = useUiStore(selectAtomLabelsOn);
  const toggleLabels = useUiStore(s => s.actions.toggleAtomLabels);
  const renderMode = useSettingsStore(selectRenderMode);
  const setRenderMode = useSettingsStore(s => s.actions.setRenderMode);

  return (
    <>
      <div className="flex items-center gap-2">
        <Switch checked={labelsOn} onCheckedChange={toggleLabels} aria-label={t('toolbar.labels')} />
        <Tag size={16} aria-hidden className="text-fg-muted" />
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <IconButton aria-label={t('toolbar.renderMode.ballAndStick')}>
            <Atom size={18} /> <ChevronDown size={12} />
          </IconButton>
        </PopoverTrigger>
        <PopoverContent>
          <div className="flex flex-col gap-1 p-2 min-w-40">
            <button
              type="button"
              onClick={() => setRenderMode('ball-and-stick')}
              className={cn('text-sm px-2 py-1 rounded text-left', renderMode === 'ball-and-stick' && 'bg-bg-panel-elevated')}
            >
              {t('toolbar.renderMode.ballAndStick')}
            </button>
            <button type="button" disabled className="text-sm px-2 py-1 rounded text-left text-fg-muted cursor-not-allowed">
              {t('toolbar.renderMode.comingSoon')}
            </button>
          </div>
        </PopoverContent>
      </Popover>
      {/* 배경 오버라이드 Popover — 동일 패턴 */}
    </>
  );
}
```

**AppGroup**:

```tsx
// panels/Toolbar/AppGroup.tsx
import { useEffect, useState } from 'react';
import { useSettingsStore, selectTheme, selectLocale } from '@/stores';
import { Sun, Moon, Globe, Keyboard } from 'lucide-react';
import { Switch, IconButton, Tooltip, Popover, PopoverTrigger, PopoverContent } from '@/components';
import { ShortcutSheet } from './ShortcutSheet';
import { KEY_MAP } from '@/viewport';

export function AppGroup() {
  const { t } = useTranslation('panels');
  const theme = useSettingsStore(selectTheme);
  const setTheme = useSettingsStore(s => s.actions.setTheme);
  const locale = useSettingsStore(selectLocale);
  const setLocale = useSettingsStore(s => s.actions.setLocale);
  const [shortcutOpen, setShortcutOpen] = useState(false);

  // D-PANEL-SHORTCUTS: ? 키 → 시트 토글
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const binding = KEY_MAP.find(b => b.id === 'showShortcutSheet');
      if (binding && binding.matches(e)) {
        // text-input gate
        const target = e.target as HTMLElement | null;
        if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;
        e.preventDefault();
        setShortcutOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <Tooltip content={t('toolbar.theme')}>
        <Switch
          checked={theme === 'dark'}
          onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
          aria-label={t('toolbar.theme')}
        />
      </Tooltip>
      <Tooltip content={t('toolbar.language')}>
        <IconButton aria-label={t('toolbar.language')} onClick={() => setLocale(locale === 'ko' ? 'en' : 'ko')}>
          <Globe size={18} />
          <span className="text-xs ml-1">{locale.toUpperCase()}</span>
        </IconButton>
      </Tooltip>
      <Popover open={shortcutOpen} onOpenChange={setShortcutOpen}>
        <PopoverTrigger asChild>
          <Tooltip content={`${t('toolbar.shortcuts')} (?)`}>
            <IconButton aria-label={t('toolbar.shortcuts')}>
              <Keyboard size={18} />
            </IconButton>
          </Tooltip>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="end" className="w-96">
          <ShortcutSheet />
        </PopoverContent>
      </Popover>
    </>
  );
}
```

### 6.7 ToastItem (외양 풍부화)

```tsx
// panels/Toast/ToastItem.tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/stores';
import type { Notification } from '@/stores/uiStore';
import { Info, CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react';

interface Props { readonly notification: Notification; }

const LEVEL_STYLE: Record<Notification['level'], { bar: string; icon: React.ComponentType<{size?:number;'aria-hidden'?:boolean}>; tone: string }> = {
  info: { bar: 'bg-accent', icon: Info, tone: 'text-accent' },
  success: { bar: 'bg-success', icon: CheckCircle, tone: 'text-success' },
  warn: { bar: 'bg-warn', icon: AlertTriangle, tone: 'text-warn' },
  error: { bar: 'bg-error', icon: XCircle, tone: 'text-error' },
};

export function ToastItem({ notification }: Props) {
  const { t } = useTranslation();
  const dismiss = useUiStore(s => s.actions.dismissNotification);
  const [exiting, setExiting] = useState(false);
  const { bar, icon: Icon, tone } = LEVEL_STYLE[notification.level];

  // 자동 dismiss
  useEffect(() => {
    if (notification.dismissAfterMs == null) return;
    const tid = setTimeout(() => onDismiss(), notification.dismissAfterMs);
    return () => clearTimeout(tid);
  }, [notification.dismissAfterMs]);

  const onDismiss = () => {
    setExiting(true);
    setTimeout(() => dismiss(notification.id), 150);
  };

  return (
    <div
      role={notification.level === 'error' ? 'alert' : 'status'}
      className={cn(
        'pointer-events-auto flex items-center gap-3 overflow-hidden rounded-md bg-bg-panel-elevated border border-border shadow-md transition-all duration-200',
        exiting ? 'opacity-0' : 'opacity-100 translate-y-0',
      )}
      style={{ minWidth: '20rem' }}
    >
      <div className={cn('w-1 self-stretch', bar)} />
      <Icon size={18} aria-hidden className={tone} />
      <span className="flex-1 text-sm text-fg-primary py-3">
        {t(notification.messageKey, notification.messageParams)}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('panels.toast.dismiss', { ns: 'panels' })}
        className="p-2 text-fg-muted hover:text-fg-primary"
      >
        <X size={16} />
      </button>
    </div>
  );
}
```

진입 애니메이션 (slide-in) 은 부모 (ToastContainer) 가 mount 시 CSS class 토글 — 본 컴포넌트는 *exit* 만 자체 처리. 또는 framer-motion 도입 여부는 §11 (현재는 단순 CSS transition).

### 6.8 phase-10 ToastContainer retrofit

phase-10 의 `<ToastSlot>` 를 `<ToastItem>` 로 교체:

```diff
// src/app/layout/ToastContainer.tsx (phase-10 retrofit)

- import type { Notification } from '@/stores/uiStore';
+ import { ToastItem } from '@/panels';

  export function ToastContainer() {
    const notifications = useUiStore(selectNotifications);
    return (
      <div role="status" aria-live="polite" aria-atomic="false"
           className="pointer-events-none fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2">
-       {notifications.map((n) => <ToastSlot key={n.id} notification={n} />)}
+       {notifications.map((n) => <ToastItem key={n.id} notification={n} />)}
      </div>
    );
  }

- function ToastSlot({ notification }: { notification: Notification }) { ... }
```

### 6.9 i18n 채움 정책

본 Phase 는 `panels.{ko,en}.json` 에 §5.4 의 키 트리 전체를 채운다. *문구 자체* 는 한·영 자연스러운 표현으로 작성하되, **Phase 15 가 최종 폴리싱** (예: `chemistry.ko.json` 의 화학 용어 사전과 일관성, 색약 모드 라벨 강제 on 검증, 단축키 표기 convention).

**기존 네임스페이스 retrofit**:
- `shortcuts.json` (한·영) 에 `bondCreate.diffMolecule` + `showShortcutSheet` 키 추가.

**chemistry.json (phase-02 가 정의)** 는 *재사용만* — 원소명 한·영 (`chemistry.elements.{symbol}.{ko,en}` 또는 phase-02 의 실제 구조) 을 PeriodicTable / MoleculeInfo 가 호출.

**common.json (phase-06 가 정의)** 의 `reaction.experimentalBadge` / `reaction.experimentalDisclaimer` / `reaction.error.*` 도 *재사용만*.

### 6.10 panels/index.ts 부팅 진입점

```ts
// src/panels/index.ts (barrel)

export { registerAllPanels } from './registerAll';
export { default as ToolbarBar } from './Toolbar/ToolbarBar';
export type { ToolbarProps } from './Toolbar/types';
export { ToastItem } from './Toast/ToastItem';
export type { ToastItemProps } from './Toast/ToastItem';

// MoleculeCard 는 _shared/ 라 barrel 미노출 — 패널 내부에서만 사용.
```

```ts
// src/app/App.tsx (phase-10 retrofit)
import { registerAllPanels, ToolbarBar } from '@/panels';
import { AppLayout } from '@/app/layout';
import type { ViewportApi } from '@/viewport';

// 부팅 시점 — render 전 1 회.
registerAllPanels();

export function App() {
  const viewportApiRef = React.useRef<ViewportApi | null>(null);
  return (
    <AppLayout
      viewportApiRef={viewportApiRef}
      toolbar={<ToolbarBar apiRef={viewportApiRef} />}
    />
  );
}
```

### 6.11 ShortcutSheet (D-SHORTCUT-SHEET-GROUPING)

```tsx
// panels/Toolbar/ShortcutSheet.tsx
import { useTranslation } from 'react-i18next';
import { KEY_MAP, describeKey } from '@/viewport';
import { Separator } from '@/components';

export function ShortcutSheet() {
  const { t } = useTranslation();
  const globals = KEY_MAP.filter(b => b.scope === 'global');
  const viewports = KEY_MAP.filter(b => b.scope === 'viewport');

  return (
    <div className="flex flex-col gap-3 p-4 max-h-96 overflow-auto">
      <Section title={t('panels.toolbar.shortcuts', { ns: 'panels' })} bindings={globals} />
      <Separator />
      <Section title={t('common.viewport')} bindings={viewports} />
    </div>
  );
}

function Section({ title, bindings }: { title: string; bindings: typeof KEY_MAP }) {
  const { t } = useTranslation();
  return (
    <section>
      <h3 className="text-xs font-medium text-fg-muted mb-2 uppercase">{title}</h3>
      <ul className="flex flex-col gap-1">
        {bindings.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-fg-primary">{t(b.i18nLabelKey, { ns: 'shortcuts' })}</span>
            <kbd className="text-xs px-2 py-0.5 rounded bg-bg-panel-elevated border border-border font-mono">
              {describeKey(b)}
            </kbd>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

**shortcuts.json 에 라벨 키 채움 의무**: phase-09 §4.4 의 `shortcuts.{action}` 키 들. 본 Phase 는 *기존 키* 를 재사용 + `showShortcutSheet` 1 개 추가.

### 6.12 D-LOAD-PRODUCTS retrofit 의 정확한 동작

`moleculeStore.addFromMolecule(m)` 의 구현 pseudo:

```ts
// src/stores/moleculeStore.ts (phase-11 retrofit)

// phase-07 §659–664 의 패턴: dispatcher 는 _shared/undoable 의 export 변수.
// phase-09 가 createUndoStack() 본 구현으로 *export 시점에 swap* — 호출자 코드 무변경.
import { dispatcher } from './_shared/undoable';

addFromMolecule: (m: Molecule): MoleculeId => {
  const newId = createMoleculeId();
  const newMolecule = withRegeneratedIds(m, newId); // atom/bond ID 재할당

  return dispatcher.dispatchUndoable(
    { kind: 'molecule.add-from-product', labelKey: 'undoable.molecule.addFromProduct' },
    () => {
      set((draft) => {
        draft.molecules[newId] = newMolecule;
        draft.ids.push(newId);
        draft.activeId = newId;
      });
      return newId;
    },
  );
},

addFromMolecules: (ms: ReadonlyArray<Molecule>): ReadonlyArray<MoleculeId> => {
  const batchId = crypto.randomUUID();
  const ids: MoleculeId[] = [];

  dispatcher.dispatchUndoable(
    { kind: 'molecule.add-from-product', labelKey: 'undoable.molecule.addFromProducts', group: `add-products-${batchId}` },
    () => {
      set((draft) => {
        for (const m of ms) {
          const newId = createMoleculeId();
          const newMolecule = withRegeneratedIds(m, newId);
          draft.molecules[newId] = newMolecule;
          draft.ids.push(newId);
          ids.push(newId);
        }
        if (ids.length > 0) {
          draft.activeId = ids[ids.length - 1]!;
        }
      });
    },
  );

  return ids;
},
```

**dispatcher 모듈 swap 패턴** (phase-07 §6.4 / §659–664): 본 코드 펜스의 `import { dispatcher } from './_shared/undoable'` 는 phase-07 의 `phase07PlaceholderDispatcher` 를 가리키다가, phase-09 구현 시점에 `createUndoStack(...)` 결과로 swap 된다. 호출자 (본 store action) 의 코드 변경은 **0** — phase-07 §16 의 동결 약속.

**meta 형태**: `UndoableMeta { kind, labelKey?, group? }` (phase-07 §3.2 의 인터페이스). `group` 키가 같은 연속 dispatch 는 phase-09 의 200 ms merge window 안에서 단일 entry 로 압축. `addFromMolecules` 는 batchId 로 group 키를 발급해 *동일 호출 안의 N 개 분자* 를 1 개 entry 로 묶는다.

**withRegeneratedIds** 는 phase-08 의 `createAtomId` / `createBondId` 를 활용해 atoms / bonds 의 stable ID 를 새로 발급. ReactionResult.products 의 분자 ID 가 reactionStore 안에서 *임시* 일 수 있어 재할당이 안전.

**fade-in**: phase-08 의 `useFadeOnMount` 가 `molecules[newId]` 의 mount 를 감지하면 자동 발화 — 별도 reaction-trigger 드라이버 불요. `architecture.md` §1.3 ⑥ "결합 변화 애니메이션" 약속의 *경로* 가 이 시점에 닫힌다.

### 6.13 D-UNDO-TOAST 의 정확한 동작

`<EditGroup>` 의 onUndo 구현 (§6.6 코드 참조):

1. undo 직전 `useUiStore.getState().selection` 비어있지 않은지 확인.
2. `undo()` 호출 (moleculeStore action).
3. selection 이 있었고, 마지막 토스트 발화로부터 200 ms 초과 시 → `notify({ level: 'info', ... })`.

**phase-08 useSelectionStaleGuard** 는 undo 후 selection 이 stale 한 ID 를 가리킬 때 selection 을 자동 정리 — 본 Phase 의 Toolbar 토스트는 *이를 사용자에게 안내*.

연속 undo (예: Cmd+Z 길게 누름) 의 KEY_MAP 발화 path 는 phase-09 의 `installGlobalUndoShortcuts` — KEY_MAP 핸들러도 동일 throttle 로 토스트 발화 (Toolbar 가 아닌 단축키로 undo 시 토스트 안 나면 일관성 깨짐 — *별도 throttle 변수 모듈 단위로*).

**구현 공유**: `panels/Toolbar/_shared/undoToast.ts` 에 `maybeNotifyUndoSelection()` 헬퍼 — Toolbar 와 KEY_MAP 핸들러가 공유. (단, KEY_MAP 핸들러는 phase-09 가 정의 — phase-09 의 `installGlobalUndoShortcuts` 에 콜백 prop 추가 retrofit 필요? — 아니, 본 헬퍼를 phase-09 의 dispatcher.subscribe 같은 hook 로 호출은 어색. **결정**: 본 Phase v1 = Toolbar 클릭 경로만 토스트 발화. 단축키 경로는 phase-09 §11 #8 의 후속 (별도 hook 추가). ⟵ §11 에 등재.

---

## 7. 파일/모듈 레이아웃

```
src/panels/
├── index.ts                              (barrel + 부팅 진입점)
├── registerAll.ts                        (registerAllPanels)
├── _shared/
│   └── MoleculeCard.tsx                  (CompoundBrowser + ReactionResult 공유)
├── PeriodicTable/
│   ├── index.tsx                         (default export — registerPanel.load)
│   ├── PeriodicGrid.tsx
│   └── ElementInfoSheet.tsx
├── CompoundBrowser/
│   ├── index.tsx                         (default export)
│   ├── SearchInput.tsx
│   ├── ResultList.tsx
│   ├── CategoryChips.tsx
│   └── useDebouncedQuery.ts
├── Conditions/
│   ├── index.tsx                         (default export)
│   ├── TemperatureSlider.tsx             (선택 — 본문은 단일 ConditionsPanel 안에 inline)
│   ├── PressureSlider.tsx                (선택)
│   ├── PhSlider.tsx                      (선택)
│   └── units.ts                          (K↔°C, atm↔Pa, rangesFor)
├── MoleculeInfo/
│   ├── index.tsx                         (default export)
│   ├── OverviewTab.tsx
│   ├── BondsTab.tsx
│   └── StereoTab.tsx
├── ReactionResult/
│   ├── index.tsx                         (default export)
│   ├── ProductsTab.tsx
│   ├── RuleTab.tsx
│   ├── ThermoTab.tsx
│   └── ExperimentalBadge.tsx
├── Toolbar/
│   ├── ToolbarBar.tsx                    (default export — App.tsx 직접 import)
│   ├── EditGroup.tsx
│   ├── ViewportGroup.tsx
│   ├── DisplayGroup.tsx
│   ├── AppGroup.tsx
│   ├── ShortcutSheet.tsx
│   └── types.ts                          (ToolbarProps)
└── Toast/
    └── ToastItem.tsx                     (ToastContainer placeholder 교체)

src/i18n/resources/{ko,en}/
├── panels.json                           (신규)
└── shortcuts.json                        (retrofit — bondCreate.diffMolecule + showShortcutSheet)

⟵ retrofit
├── src/stores/moleculeStore.ts           (addFromMolecule + addFromMolecules)
├── src/stores/moleculeStore.selectors.ts (selectBondMetrics + 타입)
├── src/app/App.tsx                       (registerAllPanels() 호출 + ToolbarBar 주입)
├── src/app/layout/ToastContainer.tsx     (placeholder ToastSlot → ToastItem import 교체)
└── src/viewport/interactions/shortcuts.ts (KEY_MAP 에 ? + KeyActionId 확장)
```

### 7.1 노출 경계

`@/panels` 가 외부에 노출:
- **컴포넌트**: `<ToolbarBar/>`, `<ToastItem/>`.
- **부팅 진입점**: `registerAllPanels`.
- **타입**: `ToolbarProps`, `ToastItemProps`.

`@/panels` 가 *미노출*:
- 개별 패널 default export (PanelRegistry 의 dynamic import 로만 접근).
- `_shared/*` (패널 내부 전용).
- 각 패널 내부의 sub-component (PeriodicGrid, ResultList, OverviewTab 등).

### 7.2 ESLint 가드

`.eslintrc` (phase-10 §7.2 의 가드에 *추가*):

```js
{
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        // 본 Phase 의 내부 helper 직접 import 금지
        { group: ['@/panels/_shared/*'], message: 'Use barrel or panel-local import.' },
        { group: ['@/panels/*/*'], message: 'Direct sub-component import not allowed; use registerPanel.load.' },
      ],
    }],
    // 레이어 가드 — panels/* 의 import 화이트리스트
    'import/no-restricted-paths': ['error', {
      zones: [
        {
          target: './src/panels',
          from: './src/engine',
          message: 'panels/* must not import engine/*; use stores.',
        },
        {
          target: './src/panels',
          from: './src/services',
          message: 'panels/* must not import services/*; use stores.',
        },
        {
          target: './src/panels',
          from: './src/viewport',
          // ViewportApi 타입 import 만 허용 — barrel default 통과.
          // 'except' 옵션으로 @/viewport (index) 는 통과.
          except: ['./src/viewport/index.ts', './src/viewport/index.tsx'],
        },
        {
          target: './src/panels',
          from: './src/chemistry',
          // chemistry/elements 만 허용 — 그 외 (compounds derive, bonds 계산) 차단.
          except: ['./src/chemistry/elements/**'],
        },
        {
          target: './src/panels',
          from: './src/data',
          // data/compounds (manifest) 만 허용 — 그 외 (data/elements 등은 chemistry/elements 통과).
          except: ['./src/data/compounds/**'],
        },
      ],
    }],
  },
}
```

P1 정합 + 화이트리스트 명시. phase-08 가 viewport/* 에서 chemistry/elements 직접 import 한 패턴과 **동일 강도** — 정적 데이터 + 표시 전용은 직접 import 가 합리적.

---

## 8. 테스트 계획

원칙: `architecture.md` §10 "모든 함수를 테스트하지 않는다. 핵심 로직과 핵심 동작만." 본 Phase 의 핵심 동작:
- (a) 6 패널 mount + 패널 내부 store 연결 동작.
- (b) PanelRegistry 등록 + `<SidePanelHost>` / `<ModalHost>` 가 panel 마운트.
- (c) Toolbar 14 슬롯 액션 호출 정확성.
- (d) ReactionResult AsyncState 4 분기 + product 적재 + fade-in 발화.
- (e) ToastItem level 별 외양 + 자동 dismiss.
- (f) i18n 키 t() 호출 회귀.
- (g) `addFromMolecule(s)` retrofit 의 단일 entry undoable + fade-in.

### 8.1 유닛 (Vitest)

`tests/unit/panels/`:

| ID | 대상 | 검증 |
|---|---|---|
| U1 | `units.ts` | kelvinToCelsius / celsiusToKelvin / atmToPa / paToAtm 라운드 트립 정확 (epsilon=1e-9). rangesFor 가 unit 별 적절한 step 반환. |
| U2 | `useDebouncedQuery` | fake timer 로 delay 내 변경은 마지막 값만 반영, delay 초과 후 debounced 갱신. unmount cleanup. |
| U3 | `selectBondMetrics` | 메탄 (C+4H) → length 표 4 행 (C-H), angle 표 6 행 (H-C-H 모든 쌍). 동일 분자 입력 시 동일 참조 반환 (memoize). |
| U4 | `addFromMolecule` | 단일 entry undoable, atom/bond ID 재할당, activeId 갱신. undo() 후 분자 제거 + activeId 복귀. |
| U5 | `addFromMolecules` | 그룹 undoable (batchId), 모든 분자 동시 추가, activeId = 마지막. undo() 후 *모두* 제거. |
| U6 | KEY_MAP retrofit | `?` 등록 후 matches(KeyboardEvent('?', shiftKey:true)) === true. 다른 키 → false. 우선순위 1 (text-input gate) 적용. |

### 8.2 컴포넌트 (Testing Library)

`tests/component/panels/`:

| ID | 대상 | 검증 |
|---|---|---|
| C1 | `<PeriodicTablePanel>` | 18×7 grid 렌더, 셀 클릭 → ElementInfoSheet 펼침, "이 원소로 분자 시작" → notify info 호출. |
| C2 | `<CompoundBrowserPanel>` | 모드 토글 → setMode 호출. Input → 300 ms 후 runCompoundSearch (mock) 호출. results.success 시 카드 리스트 표시. results.error 시 메시지 + retry 버튼. selectedCid 강조. addToWorkspace → addFromCompound 호출 + notify success. |
| C3 | `<ConditionsPanel>` | Slider 변경 → patchCondition 호출 (단위 변환 적용). pH Switch off → patchCondition({ pH: null }). resetToDefaults → 기본값 복귀. |
| C4 | `<MoleculeInfoPanel>` activeMolecule null/존재 분기. Tabs 전환. BondsTab 의 `selectBondMetrics` 호출 결과 표 표시. SMILES copy 버튼 → clipboard mock + notify success. |
| C5 | `<ReactionResultPanel>` AsyncState 4 분기 (idle/loading/error/success). success 의 `kind` 분기 (rule-based vs heuristic-experimental → ExperimentalBadge 표시). "이 생성물 추가" → addFromMolecule 호출 + notify. "전체 추가" → addFromMolecules 호출 + notify count. error → mapReactionErrorToKey 결과 표시 + retry → run({force:true}). |
| C6 | `<ToolbarBar>` 14 슬롯 모두 렌더. Undo/Redo 버튼 disabled 가 useUndoStack 결과 반영. Frame/Reset/Capture → viewportApi mock 호출. CreateBond 실패 → notify warn + i18n 키 'shortcuts.bondCreate.diffMolecule'. SMILES → notify info placeholder. 라벨 Switch → toggleAtomLabels. 테마 Switch → setTheme. 언어 → setLocale. ShortcutSheet `?` 키 → Popover open. |
| C7 | `<ToastItem>` level 별 색상/아이콘 매핑. dismissAfterMs 후 자동 dismiss (timer mock). dismiss 클릭 → 150 ms fade-out 후 unmount. role="alert" (error) vs "status" (info/success/warn). |
| C8 | `<ExperimentalBadge>` Tooltip 의 disclaimer 텍스트 (phase-06 §4.8 i18n 키). `*` 마커 표시. |
| C9 | `<MoleculeCard>` discriminated union 분기 (compound vs molecule). actions 호출. badge 표시. |
| C10 | `registerAllPanels()` 5 회 호출 후 `getPanelRegistry()` 가 5 개 entry. mode 정확. |

### 8.3 E2E (Playwright)

`tests/e2e/`:

| ID | 시나리오 | 검증 |
|---|---|---|
| E1 | PeriodicTable open + close | Toolbar 또는 store action 으로 modal 열기 → 18×7 grid 표시 → 셀 클릭 → ElementInfoSheet 표시 → Esc → modal 닫힘 + focus 복원. |
| E2 | CompoundBrowser 검색 + 추가 | 모달 열기 → "water" 입력 → 300 ms 후 결과 표시 → 첫 결과 클릭 → "작업공간에 추가" → viewport 에 분자 추가 (캔버스 픽셀) + toast success. |
| E3 | Conditions T 변경 → run | Slider 변경 → 25 → 50 °C → reactionStore.run() (mock or real) 호출 → ReactionResult 모달 열기 (수동) → success 표시. |
| E4 | ReactionResult products → 작업공간 | 모달 열기 → success → "전체 추가" → moleculeStore 분자 N 개 추가 → viewport fade-in → Cmd+Z → 모두 제거 (단일 undoable group). |
| E5 | Toolbar 테마 + 언어 토글 | 테마 Switch → light/dark CSS 변수 변경 (getComputedStyle). 언어 → KO/EN 라벨 변경 (i18n 갱신). |
| E6 | ShortcutSheet `?` 키 | viewport focus 외부에서 `?` → Popover 열림 → KEY_MAP 표시 → Esc → 닫힘. |
| E7 | Toast 자동 dismiss | notify dismissAfterMs=2000 → 토스트 표시 → 2000 ms 후 fade-out → unmount. role/aria 검증. |
| E8 | undo 후 selection 안내 토스트 | viewport 에서 atom 선택 → moleculeStore.removeAtom (undoable) → Cmd+Z (Toolbar Undo 클릭) → 'panels.toolbar.undoSelectionRestored.notice' 토스트. 연속 Cmd+Z → 1 회만 토스트 (200 ms throttle). |

### 8.4 a11y 회귀

`tests/component/panels/a11y/`:

| ID | 대상 | 검증 |
|---|---|---|
| A1 | PeriodicGrid | role="grid" + aria-label, 셀 role="gridcell" + aria-label (한·영 이름 + 원자번호 + selected). |
| A2 | ConditionsPanel | Slider htmlFor + Label, aria-valuenow, ←/→/PgUp/PgDn 키 step. |
| A3 | MoleculeInfo Tabs | Radix Tabs 의 role="tablist" / "tab" / "tabpanel" + aria-selected. |
| A4 | ReactionResult Dialog | Radix Dialog focus trap + Esc + trigger 복원. ExperimentalBadge Tooltip role. |
| A5 | Toolbar IconButton | aria-label, disabled aria-disabled. Tooltip role="tooltip". |
| A6 | ToastContainer | role="status" + aria-live="polite" (info/success/warn). role="alert" (error). |

axe 자동 검증은 phase-15 — 본 Phase 는 ARIA 속성 *존재 + 값* 만 회귀.

---

## 9. 리스크 및 대안

| ID | 시나리오 | 영향 | 대응 |
|---|---|---|---|
| **R1** | `panels/*` 의 chemistry/elements 직접 import 가 ESLint 가드 *과다 완화* | 다른 panels 가 chemistry/bonds derive 함수도 임의 import 가능 | §7.2 의 `import/no-restricted-paths` `except` 가 `chemistry/elements/**` *명시* — sub-directory 만 허용. chemistry/bonds 차단. |
| **R2** | `addFromMolecule` retrofit 이 phase-07 의 다른 액션 (replace, addAtom 등) 과 undoable 충돌 | undo 시 의도와 다른 분자 복원 | 단일 entry undoable + 명시적 kind=`molecule.add-from-product` 로 그룹 분리. groupKey=`add-products-${batchId}` 로 batch 격리. C2 / U4 / U5 검증. |
| **R3** | ReactionResult "전체 추가" 시 다수 분자 동시 fade-in | 시각적 부담 (특히 5+ products) | 본 Phase v1 = 동시 + mount fade. Phase 14 가 stagger (100 ms 간격) 도입 결정 (§11 #2). |
| **R4** | PubChem 검색이 디바운스 후에도 rate-limit 도달 (300 ms × 빠른 타이핑) | 5 req/sec 초과 → 429 | phase-05 의 `PubChemError.kind === 'RateLimited'` retryable=true → notify warn + retry 버튼. 사용자가 의도적으로 검색을 멈출 때까지 자체 backoff 는 phase-05 가 책임. |
| **R5** | ShortcutSheet 의 `?` 키가 text-input 안에서도 발화 | 입력 중 시트 열림 → UX 혼란 | useEffect keydown 핸들러 안에서 `target.tagName === 'INPUT' / 'TEXTAREA' / target.isContentEditable` 체크 (D-PANEL-SHORTCUTS). phase-09 §4.5 의 우선순위 1 (text-input gate) 정합. |
| **R6** | Conditions Slider 의 pH 0..14 정수 step + "무관" toggle 동시 | UX 혼란 | Switch off → pH=null + Slider disabled. on → pH=7 (default) + Slider enabled. 스크린 리더에 "비활성" 라벨 (D-CONDITIONS-UNITS). |
| **R7** | Toolbar 56 px 안에 14 슬롯 + 3 Separator + Tooltip popper 이 들어가지 않음 (좁은 화면 1024 px) | 일부 IconButton 가려짐 | D3 의 측정값 (≈608 px) 은 1024 px 사이드패널 240 px 가정. **결론**: 1024 px 화면에서도 Toolbar 가용 폭 = 1024-240 = 784 px → 608 px 적합. 다만 1024 px 미만은 desktop-first 비대상 (phase-10 R5). |
| **R8** | CategoryChips 가 phase-04 카테고리 수가 많을 때 줄바꿈 | Toolbar 영역 초과 | flex-wrap + max-h + scroll 또는 "더보기" Popover. D-COMPOUND-CATEGORY-DISPLAY 가 flat chip 으로 시작 — 카테고리 트리는 §11 #4. |
| **R9** | ExperimentalBadge 가 CVD 모드에서 색상 의존 | architecture §3.5 위반 가능 | D-EXPERIMENTAL-BADGE-PLACEMENT 가 *색상 + 라벨 + `*` 마커* 강제. phase-15 가 CVD 모드에서 패턴/심볼 추가 검증. |
| **R10** | ToastItem 의 진입 slide-in 이 React 18 strict-mode 이중 마운트와 충돌 | 애니메이션 깜빡임 | useEffect 안에서 `setTimeout` 으로 transition class 토글 — strict-mode 의 cleanup 로 timer clear. C7 검증. |
| **R11** | `selectBondMetrics` 의 WeakMap 캐시가 분자 mutation (immer draft) 시 stale | 잘못된 metrics 표시 | phase-07 §3.2 의 immutable 보장 — mutation 은 항상 새 참조 → WeakMap key miss → 재계산. C/U 검증. |
| **R12** | 특정 keyboard layout (일부 EU / 한국어 IME 활성 / dead-key layout) 에서 `?` 가 `e.key === '?'` 로 도착하지 않음 | 단축키 시트 열기 불가 | 본 Phase v1 = `matches: e => e.key === '?'` 단일 조건. **위험 시나리오**: ko IME 한자 변환 모드, dead-key 가 `?` 를 보조 키로 사용하는 layout. **대응**: U6 가 영문 + 한글 keyboard 양쪽 회귀 검증. 발화 안 되는 layout 발견 시 Phase 14+ 가 `e.code === 'Slash' && e.shiftKey` 보조 조건 또는 keydown→keyup 보조 매칭 도입. ShortcutSheet 는 Toolbar 의 IconButton 으로도 열 수 있어 *완전 차단은 아님*. |
| **R13** | `addFromMolecule` 이 reactionStore 의 product 복사본을 작업공간에 적재 시점에 reactionStore.lastResult 가 변경되어 stale | undo 후 reactionStore 와 moleculeStore 가 inconsistent | reactionStore 는 product 적재 후 변경 없음 (D-REACTION-RESULT-CLEAR). undo 는 moleculeStore 단독 — reactionStore 영향 없음. |
| **R14** | `<PanelErrorBoundary>` 가 패널 lazy load 실패 (네트워크 오류) 포착 | 패널 영구 오류 화면 | phase-10 D4 의 Retry 한도 3. 또한 SidePanelHost / ModalHost 의 Suspense fallback 이 LoadingOverlay panel 표시 — Boundary 와 Suspense 가 두 단계 안전망. |

---

## 10. 완료 기준 (Definition of Done)

### 10.1 패널 구현

- [ ] `<PeriodicTablePanel>` 18×7 grid + ElementInfoSheet 마운트 (C1, E1)
- [ ] `<CompoundBrowserPanel>` 검색 → 결과 → 추가 동작 (C2, E2)
- [ ] `<ConditionsPanel>` 3 슬라이더 + 단위 토글 + reset (C3, E3)
- [ ] `<MoleculeInfoPanel>` activeMolecule null/존재 + 3 Tabs (C4)
- [ ] `<ReactionResultPanel>` 4 AsyncState 분기 + products 추가 + experimental 배지 (C5, E4)
- [ ] `<ToolbarBar>` 14 슬롯 + 4 그룹 + ShortcutSheet (C6, E5, E6)
- [ ] `<ToastItem>` 4 level 외양 + 자동 dismiss (C7, E7)

### 10.2 PanelRegistry 등록

- [ ] `registerAllPanels()` 가 5 개 패널 등록 (C10)
- [ ] App.tsx 가 mount 전 1 회 호출
- [ ] `<SidePanelHost>` / `<ModalHost>` 가 active/is*Open 토글 시 lazy 마운트 (phase-10 §10 정합)

### 10.3 Store retrofit

- [ ] `moleculeStore.addFromMolecule(m)` 단일 entry undoable + activeId 갱신 (U4)
- [ ] `moleculeStore.addFromMolecules(ms)` group undoable + 마지막 active (U5)
- [ ] `selectBondMetrics(m)` standalone 순수 함수 + WeakMap memoize (U3)
- [ ] retrofit 이 phase-07 selector / action barrel 에 export

### 10.4 KEY_MAP retrofit

- [ ] `KeyActionId` 유니온에 `'showShortcutSheet'` 추가
- [ ] `KEY_MAP` 에 `?` (Shift+/ or Slash) global scope 등록 (U6)
- [ ] phase-09 우선순위 1 (text-input gate) 적용 — input 안에서 발화 안 함

### 10.5 i18n

- [ ] `panels.{ko,en}.json` 신규 — §5.4 키 트리 모두 채움
- [ ] `shortcuts.{ko,en}.json` retrofit — `bondCreate.diffMolecule` + `showShortcutSheet` 한·영
- [ ] `common.json#reaction.experimental{Badge,Disclaimer}` 재사용 검증 (P7)
- [ ] `common.json#reaction.error.*` 재사용 + `mapReactionErrorToKey` 호출 (P8)

### 10.6 phase-10 인계 닫음

- [ ] (a) `registerPanel` 5 회 호출 (D1)
- [ ] (b) 13 primitives 모두 사용 (Button × 다수, IconButton × 14, Tooltip × 14, Dialog × 3, Tabs × 3, Slider × 3, Switch × 5, Spinner × 3, Input × 1, Popover × 4, Separator × 3, Label × 3, VisuallyHidden × N)
- [ ] (c) `<ToolbarSlot>` 자식으로 `<ToolbarBar>` 주입
- [ ] (d) `useUndoableDispatcher` 컨텍스트 사용 (Toolbar EditGroup)
- [ ] (e) `<ToastContainer>` placeholder 교체 (`<ToastItem>` import)
- [ ] (f) `describeKey(binding)` 사용 (Tooltip + ShortcutSheet)
- [ ] (g) `KEY_MAP` 충돌 검사 (`?` 추가 시 기존 키와 충돌 없음)
- [ ] (h) `is*Open` 액션 사용 (ModalHost 정합 — Toolbar 가 toggleReactionResult 등 호출)
- [ ] (i) `<LoadingOverlay variant="panel">` 사용 (CompoundBrowser ResultList loading 분기)

### 10.7 phase-09 인계 닫음

- [ ] §11 #5 (Q3) — Tooltip + ShortcutSheet 형식 (D-SHORTCUT-HELP)
- [ ] §11 #8 (D-UNDO-TOAST) — undo 후 selection 안내 토스트 (Toolbar 클릭 경로). 단축키 경로는 §11 후속.
- [ ] §11 #9 (D-BOND-DIFF-MOL-I18N) — `shortcuts.bondCreate.diffMolecule` 한·영 채움
- [ ] §11 #11 (Q1) — D-LOAD-PRODUCTS, addFromMolecule(s) retrofit + fade-in 자연 발화

### 10.8 phase-10 §11 인계 닫음

- [ ] §11 #1 (Q2) — `lucide-react` 확정 (D-ICONS)
- [ ] §11 #2 (D-SIDEPANEL-WIDTH) — 320 px 기본값 유지 + Phase 14 후속
- [ ] §11 #3 (D-TOAST-VISUAL) — `right-4 bottom-4` + level 별 외양 확정
- [ ] §11 #5 (D2/D3) — Toolbar 56 px 적합성 측정 + 결론

### 10.9 라이브러리 / 빌드

- [ ] `lucide-react` `package.json` 에 추가 (또는 phase-10 가 이미 추가 시 import 만 검증)
- [ ] 신규 라이브러리 0 (phase-10 가 이미 등재한 lucide-react 의 사용 확정)
- [ ] ESLint 가드 (§7.2) 통과 — panels 의 import 화이트리스트
- [ ] 번들 분석 — 초기 chunk 영향 +10 KB gzip 이내 (phase-14 가 실측)

### 10.10 인계 가능성

- [ ] phase-12 가 본 Phase 의 `<ToolbarBar>` SMILES trigger 위치 + uiStore.toggleSmilesInput 등 추가만으로 SMILES 입력 모달 통합 가능
- [ ] phase-13 가 Toolbar 의 captureBlob 헬퍼 → 정식 export 헬퍼로 *교체* 가능 (다른 Toolbar 슬롯 수정 없음)
- [ ] phase-14 가 stagger fade-in / 카테고리 트리 / 사이드패널 폭 px 정확 등 *후속* 만 도입
- [ ] phase-15 가 a11y axe + CVD 모드 팔레트 + i18n 한·영 폴리싱 *추가* 만

---

## 11. 열린 질문 (User Decision / 후속 Phase)

본 Phase 가 D-table 로 잠정 결정했으나 사용자 확정 또는 후속 Phase 결정이 필요한 항목:

1. **Toolbar 56 px 적합성 (D2/D3)** — 1280 px viewport 가정 시 14 슬롯 + 3 Separator = 608 px 적합. 1024 px 미달 화면은 비대상 (phase-10 R5). **잠정 답: 56 px 유지**. 사용자가 *더 많은 슬롯 추가* 요청 시 64 px 또는 dual-row.
2. **ReactionResult 자동 열기 정책 (D-REACTION-RESULT-AUTO-OPEN)** — run() 성공 시 자동 vs 사용자 trigger. 본 Phase v1 = 사용자 trigger. **사용자 확정** 가능: settingsStore 의 `autoOpenReactionResult: boolean` 추가하면 phase 14+ 가 옵션 제공. 또는 *항상 자동 열기* 로 확정 가능.
3. **Conditions 권장 범위 hint** — phase-06 ReactionRule.condition 범위를 Slider 위에 시각화 (예: 배경 그라디언트 또는 mark). **잠정 답: 본 Phase 미포함**. Phase 14+ 가 도입.
4. **CompoundBrowser 카테고리 트리** — flat chip vs 계층 트리. 본 Phase = flat. Phase 14+ 가 카테고리 수 측정 후 결정.
5. **ShortcutSheet 그룹 분할** (D-SHORTCUT-SHEET-GROUPING) — 본 Phase = scope 별 (global/viewport). 액션 카테고리별 (편집/뷰포트/패널) 분할은 Phase 14+ 가 사용자 요구 강도에 따라.
6. **테마 토글 system 모드** — 현재 Toolbar 의 테마 Switch 는 light↔dark 토글 (system 무시). settingsStore.theme = 'system' 의 *3-state* UI (light / dark / system) 는 본 Phase 비포함 — Toolbar 가 단순 binary Switch. Phase 15 가 결정.
7. **Toast 큐 길이 50 (P12) UI 표시** — 50 도달 시 가장 오래된 자동 dismiss (phase-07 R7). UI 는 *모든* 항목 렌더 → 화면 영역 초과. 본 Phase v1 = 모두 렌더 (50 도달은 비현실적 가정). Phase 14+ 가 max-height + 스크롤 도입.
8. **사이드패널 폭 px 정확 보장** (D-SIDEPANEL-WIDTH 후속) — Phase 14 가 `useResizeObserver` + percentage 동적 변환 도입 결정.
9. **stagger fade-in** (R3) — Phase 14 가 ReactionResult 의 다수 product 동시 추가 시 100 ms 간격 분산 도입.
10. **panel-focused 우선순위 4 단축키 추가** (D-PANEL-SHORTCUTS 외) — `/` 검색 focus / `Cmd+K` 명령 팔레트 등은 Phase 14+ 가 사용자 요구 강도에 따라.
11. **`addFromMolecule` 호출자 (Toolbar 외)** — 본 Phase 는 ReactionResult 패널만 호출. Phase 12 의 SMILES 입력은 `addFromSmiles` 사용. Phase 13 의 JSON import 는 별도 진입점. 향후 *별도 import 경로* 가 추가되면 본 retrofit 의 활용 범위 확장.
12. **단축키 경로의 D-UNDO-TOAST 발화** (R6 의 후속) — phase-09 의 `installGlobalUndoShortcuts` 가 Toolbar 와 같은 토스트 발화 hook 을 노출하지 않음. 본 Phase v1 = Toolbar 클릭 경로만. Phase 14+ 가 `installGlobalUndoShortcuts({ onUndoFired? })` 콜백 추가 retrofit 결정.
13. **`<RuleTab>` 의 rule manifest lookup** — appliedRuleId 로 rules manifest (phase-04) 에서 source / version / license / categories 조회. 본 Phase 는 *appliedRuleId 텍스트만* 표시. Phase 14+ 가 rule manifest store 추가 결정 (또는 phase-06 ReactionResult 에 rule 메타 직접 포함 retrofit).
14. **MoleculeCard SMILES copy fallback** (D-MOLECULE-CARD-COPY) — clipboard API 미지원 (HTTPS 외) 시 textarea + execCommand fallback. Phase 15 검증.

---

## 12. 다음 Phase 로의 인계 (Hand-off)

| Phase | 본 Phase 가 인계하는 것 |
|---|---|
| **12 (Text Input Pipeline)** | (a) **Toolbar 의 SMILES Input trigger 버튼** — 현재 placeholder notify. Phase 12 가 *모달 열기 액션* 으로 교체. uiStore 에 `panels.isSmilesInputOpen` 등 새 토글 추가는 Phase 12 retrofit (또는 PanelKey `'smiles-input'` 신규 등록). (b) **`<MoleculeCard>` 재사용** — Phase 12 의 SMILES 입력 결과 미리보기 카드. (c) **`<Dialog>` + `<Input>` + `<Spinner>`** primitives 활용. (d) **`<PanelErrorBoundary slotName="modal">`** 가 파싱 런타임 예외 포착. (e) **isTextInputTarget 가드** (phase-09) — Phase 12 모달의 native `<input>` 안에서 Cmd+Z 가 native 통과. (f) **PeriodicTable 의 "이 원소로 분자 시작" 버튼** — 본 Phase placeholder, Phase 12 가 trigger 로 교체. |
| **13 (Export / Import)** | (a) **Toolbar 의 captureBlob 헬퍼** — 임시 `URL.createObjectURL` + `<a download>`. Phase 13 이 `io/png/exportPng.ts` 정식 헬퍼로 교체. (b) **JSON / SDF Export 버튼 추가** — Toolbar 또는 별도 모달. ToolbarBar 의 ViewportGroup 에 `Download` 아이콘 슬롯 1 개 추가는 Phase 13 retrofit. (c) **JSON Import Dialog** — `<Dialog>` + `<Input type="file">` + 검증 결과. importJson 후 `useUndoableDispatcher().clear()` 호출 (phase-09 §12 d 인계 정합). (d) **`<LoadingOverlay variant="app">`** — export/import 진행 중 큰 작업 (multi-molecule PNG capture 등). |
| **14 (Performance)** | (a) **Toolbar 56 → 64 px 확장 측정** (§11 #1). (b) **stagger fade-in 도입** (§11 #9 / R3). (c) **카테고리 트리** (§11 #4). (d) **사이드패널 폭 px 정확** (§11 #8). (e) **`cva` 도입 효과 측정** (phase-10 §11 #7 재방문). (f) **ShortcutSheet 그룹 분할** (§11 #5). (g) **panel-focused 단축키 추가** (§11 #10). (h) **단축키 경로의 undo 토스트** (§11 #12). (i) **rule manifest lookup** (§11 #13). (j) **번들 분석** — panels lazy chunk 의 Radix primitive + lucide-react tree-shake 검증. (k) **`useResizeObserver` 도입**. |
| **15 (Polish)** | (a) **a11y axe 자동 검증** — PeriodicGrid / Tabs / Slider / Dialog / Toast 모두. (b) **CVD 모드 실 팔레트** — ExperimentalBadge 의 `*` 마커 + ThermoFlag 아이콘 + 색상 대비 검증. (c) **i18n 한·영 최종 폴리싱** — panels.json 모든 키 자연스러운 표현 + chemistry 용어 사전 일관성. (d) **PeriodicGrid 화살표 키 nav** — 셀 ↔ 셀 이동 (현재는 Tab 만). (e) **테마 system 모드 UI** (§11 #6). (f) **Toast 큐 50 도달 UI** (§11 #7). (g) **clipboard fallback** (§11 #14). (h) **i18n 부팅 안전 시뮬레이션** — panels 패널 내부 t() 가 missing key 일 때 폴백 (key 자체 표시). |

### 12.1 소급 수정

- **phase-07 (Stores)**: `moleculeStore.actions` 에 `addFromMolecule` / `addFromMolecules` 추가. `moleculeStore.selectors` 에 `selectBondMetrics` + 타입 (`BondMetric`, `BondAngleMetric`, `BondMetricsResult`) 추가. barrel `src/stores/index.ts` 갱신.
- **phase-08 (Rendering)**: 변경 없음. `useFadeOnMount` 가 `addFromMolecule` 적재에도 자동 발화하는 정합만 검증 (코드 변경 없음).
- **phase-09 (Interactions)**: `KeyActionId` 유니온에 `'showShortcutSheet'` 추가. `KEY_MAP` 에 `?` (Shift+/ or Slash) global scope binding 등록. `shortcuts.{ko,en}.json` 에 `bondCreate.diffMolecule` + `showShortcutSheet` 키 추가.
- **phase-10 (UI Framework)**: `<ToastContainer>` 의 placeholder `<ToastSlot>` 을 `<ToastItem>` (`@/panels` import) 로 교체. App.tsx 가 `registerAllPanels()` 호출 + `<ToolbarBar/>` 주입.
- **phase-01 (Foundation)**: i18n `i18next.d.ts` 에 `panels` 네임스페이스 타입 추가. `src/i18n/init.ts` 의 `resources` 객체에 `panels: panelsKo / panelsEn` 추가.

본 변경은 **본 Phase 구현 PR 의 첫 커밋** 으로 들어간다 (phase-08 D1 retrofit 패턴과 동일).

### 12.2 architecture.md 변경

**없음**. 본 Phase 가 architecture 의 §1.3 ⑥ "결합 변화 애니메이션" 약속을 *경로 닫음* 으로 이행 — 약속 자체는 이미 존재. §6 의 "UI Panels — 주기율표, 화합물 검색, 조건, 분자 정보, 반응 결과, Toolbar" 명세도 본 Phase 가 충실히 이행.

---

*문서 버전: 0.1 (초안)*
*작성일: 2026-04-27*
