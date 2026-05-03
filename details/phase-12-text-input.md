# Phase 12 — Text Input Pipeline

> 본 문서는 `architecture.md` §13 의 Phase 12 상세 설계서다. 코드 작성은 모든 details 문서의 검토가 끝난 뒤에만 시작한다.
>
> **선행 문서**: `architecture.md` (특히 §1.3 ⑤ 텍스트 입력 → 자동 3D, §3.1 ① ETKDG/PubChem 3D, §3.1 ④ 입체화학, §3.6 사용자 입력 검증, §3.7 에러 처리, §3.8 Undo/Redo, §4.1 레이어 의존성, §11 i18n, §13 의존 Phase), `details/phase-03-chemistry-engine.md`, `details/phase-07-state-management.md`, `details/phase-08-rendering.md`, `details/phase-09-interactions.md`, `details/phase-10-ui-framework.md`, `details/phase-11-ui-panels.md`. (Phase 02 / 04 / 05 / 06 은 본 Phase 가 *직접 import 하지 않으나* 결과 타입 (`Element` / `Compound` / `IngestError.pubchem` / `ReactionResult`) 의 출처로 인용.)

---

## 1. 목적 (Purpose)

본 Phase 는 다음을 완성한다.

1. **텍스트 입력 → 3D 분자 생성 플로우** — 사용자가 SMILES, 분자식 (molecular formula), InChI 중 하나를 입력하면 phase-03 의 파싱 + 3D 임베드를 거쳐 `Molecule` 을 만들고 작업공간에 적재한다. `architecture.md` §1.3 ⑤ "SMILES / 화학식 / InChI 입력을 통한 자동 3D 구조 생성" 약속의 닫음.
2. **6 번째 패널 본문 + PanelRegistry 등록** — `panels/TextInput/` 신규. `<TextInputDialog/>` modal Dialog 가 phase-10 의 `<ModalHost/>` 위에 마운트. `registerAllPanels()` 가 6 번째 `registerPanel(def)` 호출.
3. **phase-11 §12 #12 (a–f) 6 항목 닫음** — Toolbar SMILES Input trigger placeholder 교체 (a), `<MoleculeCard>` preview 재사용 (b), `<Dialog>` + `<Input>` + `<Spinner>` + `<Tabs>` primitives 조립 (c), `<PanelErrorBoundary slotName="modal">` 가 본 모달 포착 (d), phase-09 D10 `isTextInputTarget` 가드 자동 통과 검증 (e), PeriodicTable 의 "이 원소로 분자 시작" trigger placeholder 교체 (f).
4. **phase-10 §12 #12 (a–e) 5 항목 닫음** — `<Dialog>` 활용 (a), `<Input>` + `<Spinner>` 활용 (b), Esc 닫기 / 포커스 복원 Radix 표준 (c), `<PanelErrorBoundary slotName="modal">` 사용 (d), `isTextInputTarget` 자연 통과 (e).
5. **phase-09 §12 #12 (a–b) 정합** — D10 가드가 본 Phase 모달의 native `<input>` / `<textarea>` 안에서 자동 작동 (a), KEY_MAP 에 신규 단축키 추가 안 함 → 기존 키와 충돌 없음 (b, D12 의 v1 미추가 결정).
6. **phase-07 §12 hand-off (line 1150) 닫음** — `addFromSmiles` / `addFromInchi` 진입점 사용 + `IngestError` 6 분기를 i18n 키로 매핑하는 표 완성.
7. **moleculeStore retrofit** — (a) `addFromFormula(input, opts?)` 액션 추가 (phase-03 `parseFormula` + `formulaToParsedMol` + `toMoleculeWith3D` 조립). (b) `previewFromText({ kind, raw, signal? })` 액션 추가 (state commit 없는 함수형 액션, D-PREVIEW-PATH 옵션 A). (c) `mapIngestErrorToKey(e: IngestError): { key; params?; action? }` selector 추가.
8. **uiStore retrofit** — `panels.isTextInputOpen: boolean`, `panels.textInputInitial: TextInputSeed | null`, `toggleTextInput(open?)`, `setTextInputInitial(seed)` 추가. `PanelKey` 유니온에 `'text-input'` 추가.
9. **공유 helper 분리** — phase-11 §6.12 의 인라인 `withRegeneratedIds` 를 `src/stores/_shared/regenerateIds.ts` 로 분리 (phase-11 retrofit 소급) → 본 Phase 의 replace 경로가 동일 헬퍼 import.
10. **dead placeholder i18n 키 2 개 제거** — `panels.toolbar.smilesInput.placeholder` 와 `panels.periodicTable.element.startMolecule.placeholder` 는 trigger 교체 후 호출 경로 0 → 두 키 삭제 + 옛 키 호출 0 회 검증.
11. **i18n `panels.textInput.*` + `common.ingest.error.*` 채움** — 한·영 양쪽. phase-15 가 최종 폴리싱.

본 Phase 는 `architecture.md` §12 의 열린 질문 중 **#1 (반응 예측 한계)** / **#2 (PubChem 큐레이션)** / **#3 (ΔH)** / **#5 (WebGL2)** / **#6 (이온)** 모두 *영역 외*. **#4 (RDKit 메인 스레드)** 는 본 Phase 가 phase-03 `RdkitBackend` 인터페이스만 사용 — Worker 분리 결정은 Phase 14 가 측정.

---

## 2. 범위 (Scope)

### 2.1 포함

#### 패널 본문

##### `panels/TextInput/`
- **`<TextInputDialog/>`** — modal Dialog (PanelKey `'text-input'`, mode='modal'). `panels.isTextInputOpen` 토글로 열림. 마운트 시점 `panels.textInputInitial` 이 있으면 mode + raw 입력으로 채움.
- 헤더: 제목 (`panels.textInput.title` — "SMILES / 화학식 / InChI 입력") + Radix Dialog Close (Esc 또는 X 버튼).
- 본문 구조 (위 → 아래):
  1. **`<ModeTabs/>`** — `<Tabs/>` (Radix). 3 탭 = `smiles | formula | inchi`. 활성 탭 = panel-local state. 탭 전환 시 raw 입력 reset (D-MODE-RESET).
  2. **`<InputArea mode raw onChange/>`** — mode 별 placeholder 변경 (`panels.textInput.placeholder.{smiles,formula,inchi}`). SMILES / formula = `<Input/>` (single-line). InChI = `<textarea/>` (multi-line — InChI 가 길어 줄바꿈 가능). `autocomplete="off"`, `spellcheck={false}`. 디바운스 300 ms 후 `usePreviewParse` 발화.
  3. **`<RdkitStatusInline/>`** (선택) — phase-03 `onRdkitStatusChange` 구독. `phase: 'loading'` 시 inline 텍스트 + Spinner ("RDKit 로드 중…"). `phase: 'ready'` 시 미표시. `phase: 'error'` 시 ErrorMessage 분기로 위임.
  4. **`<PreviewPane previewState/>`** — preview AsyncState 4 분기:
     - `idle`: "입력하면 미리보기가 표시됩니다." (`panels.textInput.preview.empty`)
     - `loading`: `<Spinner size="md"/>` + "분석 중…" (`panels.textInput.preview.loading`)
     - `success`: `<MoleculeCard molecule={preview} source="text-input"/>` + duplicate 검사 결과에 따라 `<DuplicateWarning/>` 추가 표시
     - `error`: `<ErrorMessage error={...}/>`
  5. **`<ReplaceSwitch checked onChange/>`** — "활성 분자 교체" Switch + 도움말 툴팁. `selectActiveMolecule` 이 null 이면 disabled + tooltip ("활성 분자 없음 — 새로 추가됩니다").
  6. **푸터** — `<Button variant="ghost" onClick={close}>취소</Button>` + `<Button variant="primary" disabled={!preview || preview.kind !== 'success'} onClick={onSubmit}>{replace ? '교체' : '추가'}</Button>`.
- **a11y**: Radix Dialog 가 자동 focus trap + focus 복원 + `role="dialog"` + `aria-labelledby` + `aria-describedby`. 본문 InputArea 의 `<Input>` 에 `autoFocus` (모달 mount 직후 첫 입력 박스 focus). ErrorMessage 는 `role="alert"` + `aria-live="assertive"`. PreviewPane 의 success 분기는 `aria-live="polite"` (입력 변경 시 안내).
- **키보드**: Esc → close (Radix). Tab → 컨트롤 순회. Enter (input 안) → submit (preview success 시) — 단, Enter 가 native textarea 의 줄바꿈인 InChI 모드에서는 Enter submit 비활성화.

##### `<RdkitStatusInline/>` 세부
- `useRdkitStatus(): RdkitStatus` hook (panel-local) — phase-03 `onRdkitStatusChange` 를 `useSyncExternalStore` 로 구독.
- `phase === 'loading'` 시: `progress` 가 있으면 `0–100%` 진행 인디케이터, 없으면 indeterminate Spinner.
- `phase === 'error'` 시: 본 컴포넌트 자체는 *미표시* — preview 도 자연스럽게 error 분기 (ParseError.code === 'RdkitNotReady' 또는 RdkitInitError 발생). ErrorMessage 가 `mapIngestErrorToKey` 로 메시지 + `'reload-page'` 액션 표시.

##### `<DuplicateWarning existingId onActivate/>`
- preview success 시점에 본 Phase 의 모달이 *제출 전* `selectMoleculeIds` + `selectMoleculeById` 로 모든 분자의 InChIKey 와 비교. 매칭이 있으면 본 컴포넌트 마운트.
- 외양: amber 배경 카드. 메시지 = "이미 동일한 분자가 작업공간에 있습니다." (`panels.textInput.duplicate.message`). 액션 = "기존 분자 활성화" 버튼 → `moleculeStore.setActive(existingId)` + `toggleTextInput(false)`.
- replace=on 인 경우는 본 컴포넌트 *비표시* (사용자가 명시적으로 교체 의도).

##### `<ErrorMessage error={ParseError | EmbedError | IngestError}/>`
- `mapIngestErrorToKey(error)` 호출 → `{ key, params?, action? }` 결과:
  - 메시지 = `t(key, params)` (i18n).
  - `action === 'open-compound-browser'` → "화합물 검색 열기" 버튼 → `uiStore.toggleCompoundBrowser(true)` + `toggleTextInput(false)`.
  - `action === 'activate-existing'` → DuplicateWarning 으로 위임 (ErrorMessage 자체는 미표시).
  - `action === 'reload-page'` → "페이지 새로고침" 버튼 → `window.location.reload()`.
  - `action === null/undefined` → 액션 버튼 없음, 메시지만.
- 외양: red 배경 카드 (CVD 모드 시 `*` 마커 + 라벨 강제 — phase-15).
- ParseError.at 파라미터 표시: i18n 키 `common.ingest.error.parse.smilesSyntaxAt` 사용 시 `{{at}}` 슬롯 — `"SMILES 파싱 실패 — {{at}}번째 문자 근처 괄호 불일치"` (architecture §3.7 정합).

#### 부팅 진입점 retrofit

##### `panels/registerAll.ts` (phase-11 retrofit)
- 6 번째 `registerPanel(def)` 호출 추가:
  ```ts
  registerPanel({
    key: 'text-input',
    mode: 'modal',
    i18nTitleKey: 'panels.textInput.title',
    load: () => import('./TextInput'),
  });
  ```

##### `panels/index.ts` barrel
- 추가 export 없음. `<TextInputDialog/>` default export 는 `registerPanel.load` 의 dynamic import 로만 접근 (phase-11 §5.1 패턴 정합).

#### Trigger 교체

##### `panels/Toolbar/EditGroup.tsx` (phase-11 retrofit)
- 기존 (phase-11 line 1376–1378):
  ```ts
  const onSmiles = () => {
    notify({ level: 'info', messageKey: 'panels.toolbar.smilesInput.placeholder', dismissAfterMs: 3000 });
  };
  ```
- 교체:
  ```ts
  const toggleTextInput = useUiStore(s => s.actions.toggleTextInput);
  const onSmiles = () => {
    toggleTextInput(true);
  };
  ```
- 버튼 라벨 `panels.toolbar.smilesInput` 유지 — 동작만 교체.

##### `panels/PeriodicTable/ElementInfoSheet.tsx` (phase-11 retrofit)
- 기존 (phase-11 §2.1 line 42 + §6.1 inline):
  ```ts
  onStartMolecule={() => {
    notify({ level: 'info', messageKey: 'panels.periodicTable.element.startMolecule.placeholder', dismissAfterMs: 3000 });
  }}
  ```
- 교체:
  ```ts
  const setTextInputInitial = useUiStore(s => s.actions.setTextInputInitial);
  const toggleTextInput = useUiStore(s => s.actions.toggleTextInput);
  onStartMolecule={() => {
    setTextInputInitial({ kind: 'formula', raw: getElementInitialFormula(element) });
    toggleTextInput(true);
    // PeriodicTable 모달 자동 닫기 — 두 modal 동시 표시 방지
    togglePeriodicTable(false);
  }}
  ```

#### Store retrofit

##### moleculeStore (phase-07 retrofit)

**액션**:
- `addFromFormula(input: string, opts?: { signal?: AbortSignal }): Promise<Result<MoleculeId, IngestError>>` — phase-03 `parseFormula` (sync) → success 시 `formulaToParsedMol(comp, { signal })` → success 시 `toMoleculeWith3D(parsed)` → success 시 commit (ingest AsyncState success + molecules + activeId 갱신). 실패 시 IngestError 분기 commit (kind='parse' 또는 'embed' 또는 'rdkit-not-ready').
- `previewFromText({ kind, raw, signal? }: { kind: TextInputMode; raw: string; signal?: AbortSignal }): Promise<Result<Molecule, IngestError>>` — **state commit 없음**. mode 별 phase-03 호출 → Result 반환만. duplicate 검출 미수행 (호출자 = 모달이 별도 검사).

**selector**:
- `mapIngestErrorToKey(e: IngestError): IngestErrorMapping` — 본 Phase 가 정의 (§5.4).

##### uiStore (phase-07 retrofit)

**state 추가**:
```ts
readonly panels: {
  // ... 기존 ...
  readonly isTextInputOpen: boolean;             // ⟵ 신규
  readonly textInputInitial: TextInputSeed | null; // ⟵ 신규
};
```

**PanelKey 확장**: 기존 6 개 + `'text-input'` = 7 개.

**액션 추가**:
- `toggleTextInput(open?: boolean): void` — open 인자 미지정 시 toggle. 지정 시 set.
- `setTextInputInitial(seed: TextInputSeed | null): void` — seed 슬롯 갱신. 모달 unmount 시 cleanup 으로 `setTextInputInitial(null)`.

##### `src/stores/_shared/regenerateIds.ts` (신규, phase-11 retrofit 소급)

```ts
import type { Molecule, MoleculeId } from '@/chemistry/compounds/types';
import { createAtomId, createBondId } from '@/viewport/ids';

/**
 * Molecule 의 atoms / bonds 의 stable ID 를 새로 발급. 기존 atom/bond 의 element / position /
 * formalCharge / order 등 모든 필드는 그대로 보존. molecule.id 는 인자로 받은 newId 로 교체.
 *
 * **사용처**:
 *  - phase-11 §6.12 `addFromMolecule(s)` (ReactionResult product 적재)
 *  - phase-12 §6.6 replace 경로 (text input 의 활성 분자 교체)
 *  - phase-13 (예정) JSON Import 경로
 */
export function withRegeneratedIds(m: Molecule, newId: MoleculeId): Molecule {
  return {
    ...m,
    id: newId,
    atoms: m.atoms.map((a) => ({ ...a, id: createAtomId() })),
    bonds: m.bonds.map((b) => ({ ...b, id: createBondId() })),
  };
}
```

**phase-11 §6.12 retrofit** (소급): 본 모듈 import 로 인라인 정의 제거. phase-11 의 `addFromMolecule(s)` 코드 본문은 변경 없음 (구현체만 분리).

#### MoleculeCard 확장 (phase-11 retrofit)

`MoleculeCardSource` 유니온 = `'compound' | 'reaction-product' | 'text-input'` (additive). 표시 분기는 *상단 출처 라벨* 만 변경:
- `'compound'` → "화합물 DB"
- `'reaction-product'` → "반응 생성물"
- `'text-input'` → "텍스트 입력 미리보기" (`panels.textInput.preview.sourceLabel`)

본 Phase 는 source 별 라벨만 추가 — 카드 외양 / 액션 버튼 등 다른 동작 변경 없음.

#### KEY_MAP 변경 없음 (phase-09)

본 Phase 는 KEY_MAP 에 신규 binding 추가 안 함 (D12 — Cmd+L 등 단축키는 Phase 14+). phase-09 D10 `isTextInputTarget` 가드는 자동 통과 (모달 안의 native `<input>`/`<textarea>` → `e.target.tagName` 매칭).

#### i18n 변경

- **`src/i18n/resources/{ko,en}/panels.json`** retrofit:
  - 신규: `panels.textInput.*` 키 트리 (§5.5 전체).
  - 제거: `panels.toolbar.smilesInput.placeholder`, `panels.periodicTable.element.startMolecule.placeholder` (dead — 호출 경로 0).
  - 보존: `panels.toolbar.smilesInput` (버튼 라벨 — 동작만 변경, 라벨 유지).
- **`src/i18n/resources/{ko,en}/common.json`** retrofit:
  - 신규: `common.ingest.error.*` 분기 (§5.4 매핑 표 모든 키).

### 2.2 비포함

| 항목 | 인계 Phase |
|---|---|
| Cmd+L / Cmd+Shift+I 등 단축키 (모달 토글) | 14 |
| 멀티-라인 SMILES 동시 입력 (한 번에 여러 분자) | 14+ |
| 강제 추가 (duplicate 검출 우회) | 14+ |
| 입력 히스토리 / 즐겨찾기 / 자동완성 | 14+ |
| 3D embed 옵션 노출 (seed / optimize) | 14+ |
| SDF / PDB / MOL 텍스트 직접 paste | 13 (Import) |
| Formula → SMILES 매핑 테이블 확장 | phase-03 D4 후속 |
| 모달 vs 상시 docked 변환 | 사용자 피드백 후 결정 |
| stagger fade-in (다수 product 동시 추가는 phase-11 영역) | — (본 Phase 단일 분자) |
| a11y axe 자동 검증 + i18n 한·영 최종 폴리싱 | 15 |
| 모바일 / 태블릿 반응형 | **비목표** (architecture desktop-first) |

### 2.3 명시적 비결정 / 후속 결정

| 영역 | 사유 | 결정 시점 |
|---|---|---|
| `addFromMolecule` 의 store-internal duplicate 검출 retrofit | 본 Phase v1 = 모달 측 검사 (옵션 b). Phase 13 의 JSON Import 가 동일 이슈 직면 → 통합 retrofit | Phase 13 |
| Cmd+L 등 단축키 키 선택 | Cmd+L (브라우저 주소창과 충돌) vs Cmd+Shift+I vs Cmd+/ | Phase 14 측정 후 |
| InChI 의 multi-line 입력 vs single-line trim | textarea 사용 시 사용자가 줄바꿈 → trim 으로 1 줄화 | 본 Phase v1 = textarea + trim |
| Formula 매핑 부재 시 화합물 검색 자동 trigger vs 사용자 클릭 | 자동 trigger 는 invasive UX, 사용자 클릭이 안전 | 본 Phase v1 = 사용자 클릭 |

---

## 3. 의존성 (Dependencies)

### 3.1 선행 Phase (직접 import / retrofit 대상)

| Phase | 본 Phase 가 사용하는 것 |
|---|---|
| **03 (Chemistry Engine)** | *직접 import 안 함* (D-PREVIEW-PATH 옵션 A 정합). 모든 phase-03 호출은 `moleculeStore.previewFromText` / `addFromSmiles/Inchi/Formula` 를 통해 store 내부에서. **타입만 import**: `ParseError`, `EmbedError`, `ParsedMol`, `InputKind`, `RdkitStatus` (TextInputMode 별칭 정의용). RDKit 상태 구독은 `onRdkitStatusChange` 도 store 경유 (phase-07 retrofit 가능 — 본 Phase 는 *panel-local hook* `useRdkitStatus()` 가 phase-03 의 export 를 *직접* 구독하는 예외 허용 — phase-08 가 viewport/* 에서 chemistry/elements 직접 import 한 P1 명시 예외 패턴과 동일). 단, RDKit 상태 = *읽기 전용 구독* 이지 phase-03 동작 함수 호출 아님 → P1 정신 위배 아님. **레이어 가드**: §7.3 의 `onRdkitStatusChange` 한정 import 화이트리스트. |
| **07 (Stores)** | 본 Phase 의 *주된 의존*. **모든 패널이 stores 만 통과해 도메인 데이터에 접근** (P1 정합).
  - **moleculeStore selector**: `selectActiveMolecule`, `selectMoleculeIds`, `selectMoleculeById(id)`, `selectIngestState`, `mapIngestErrorToKey` (retrofit).
  - **moleculeStore action**: `addFromSmiles`, `addFromInchi`, `addFromFormula` (retrofit), `previewFromText` (retrofit), `addFromMolecule` (phase-11 §4.6 retrofit), `replace`, `setActive`, `removeMolecule`, `undo`, `redo`.
  - **uiStore selector**: `selectActivePanel`, `selectIsTextInputOpen` (retrofit), `selectTextInputInitial` (retrofit), `selectNotifications`.
  - **uiStore action**: `toggleTextInput` (retrofit), `setTextInputInitial` (retrofit), `togglePeriodicTable`, `toggleCompoundBrowser`, `notify`, `dismissNotification`.
  - **settingsStore selector**: `selectLocale` (i18n locale 표시), `selectIsCvdOn` (CVD 모드 ErrorMessage 마커).
  - **공용 타입**: `IngestError`, `AsyncState<T,E>`, `MoleculeId`, `Notification`, `PanelKey` (확장). |
| **08 (Rendering)** | *직접 import 안 함*. `withRegeneratedIds` 가 사용하는 `createAtomId` / `createBondId` 는 phase-08 D1 의 `@/viewport/ids` barrel 에서 export — 본 Phase 의 `_shared/regenerateIds.ts` 가 import. UI 컴포넌트는 `<ViewportApi>` 사용 안 함 (모달 내부 = 뷰포트 비조작). |
| **09 (Interactions)** | *직접 import 안 함*. `KEY_MAP` 변경 없음. phase-09 D10 `isTextInputTarget` 가드는 자동 통과 — 본 Phase 의 모달 안 native `<input>` / `<textarea>` 가 `tagName === 'INPUT'/'TEXTAREA'` 매칭. **검증 의무**: §6.12 + C7 컴포넌트 테스트. |
| **10 (UI Framework)** | `<AppLayout/>` 변경 없음 (panel 추가는 PanelRegistry 통과). **13 primitives**: `Dialog` (Root/Trigger/Content/Title/Description/Close), `Tabs` (Root/List/Trigger/Content), `Input`, `Switch`, `Spinner`, `Button`, `IconButton`, `Tooltip`, `Label`, `Separator`, `VisuallyHidden`. `<LoadingOverlay variant="panel">` (RDKit 첫 로드 중 또는 preview 진행 중). `<PanelErrorBoundary panelKey="text-input" slotName="modal">`. `registerPanel(def)`, `<ModalHost/>`, `useUndoableDispatcher` (Toolbar 의 dispatcher 와 동일 — 본 Phase 는 직접 사용 안 함, store action 경유). CSS 변수 토큰 (`bg-canvas`, `bg-panel`, `bg-panel-elevated`, `fg-primary`, `fg-muted`, `border`, `accent`, `accent-fg`, `error`, `warn`, `success`). |
| **11 (UI Panels)** | `<MoleculeCard molecule source/>` (phase-11 §4.2 — `source` 유니온 확장 retrofit). `useDebouncedQuery` (`panels/CompoundBrowser/useDebouncedQuery.ts` — phase-11 §4.5 가 본 Phase 사용 명시). `addFromMolecule(m)` retrofit (phase-11 §4.6). Toolbar `<EditGroup/>` 의 `onSmiles` 본문 retrofit. PeriodicTable `<ElementInfoSheet/>` 의 `onStartMolecule` 본문 retrofit. |

본 Phase 는 `engine/parser` / `engine/geometry` / `services/*` *내부* 를 직접 import 하지 않는다 (D-PREVIEW-PATH 옵션 A). `chemistry/elements` (PeriodicTable 의 Element 타입만) 와 `viewport/ids` (regenerateIds 의 createAtomId/createBondId) 는 type-level / 정적 함수 import 한정 예외.

### 3.2 외부 라이브러리 (architecture §66 신규 도입 절차)

본 Phase 는 phase-11 가 §3.2 에 확정한 `lucide-react` 만 사용. **신규 라이브러리 0**.

| 라이브러리 | 버전 | 용도 | gzip | 대안 거절 |
|---|---|---|---|---|
| `lucide-react` (phase-11 확정) | ^0.4x | 모달 헤더 / 액션 / ErrorMessage 아이콘 (`Beaker`, `FileText`, `Atom`, `AlertCircle`, `RefreshCw`, `ArrowRightCircle`, `X`, `Search`) | tree-shake 사용 ~8 개 = ~3–5 KB 추가 (phase-11 의 ~22 개와 일부 중복) | — |

**번들 예산 정합** (`architecture.md` §3.2 의 `< 500 KB gzip`):
- 본 Phase 의 모든 컴포넌트 = `panels/TextInput/` lazy chunk (`registerPanel.load` dynamic import).
- 초기 chunk 영향 = **0** (Toolbar onSmiles / PeriodicTable onStartMolecule 본문 교체는 기존 chunk 재컴파일).
- `panels/TextInput` chunk 자체 ~5–8 KB gzip 예상 (Phase 14 가 실측 검증).

### 3.3 결정 사항

#### 선결정 사항 (P-table — 선행 Phase / architecture 가 이미 동결)

| ID | 내용 | 출처 |
|---|---|---|
| **P1** | 레이어 가드 — `panels/*` 는 viewport/engine/services/data/chemistry 중 **정적 데이터 + type-level + 표시 전용 함수** 만 직접 import 허용. 본 Phase 는 phase-03 의 `onRdkitStatusChange` (read-only 구독) 만 panel-local hook 에서 직접 import. 그 외 (engine 의 동작 함수, services) 는 store 통과. | architecture §4.1 / phase-11 P1 |
| **P2** | PanelRegistry 부팅 1 회 채워진 뒤 변하지 않는다. 본 Phase 의 `'text-input'` 등록은 phase-11 의 5 개와 함께 `registerAllPanels()` 안에서 동기 호출. | phase-10 §4.1 / phase-11 D-PANELS-INDEX |
| **P3** | PanelKey ↔ mode 매핑. 본 Phase 의 `'text-input'` = **modal** (`is*Open` 토글 보유). | phase-07 §4.4 / phase-10 D14 |
| **P4** | KEY_MAP 변경 시 phase-09 의 기존 키 충돌 검사 의무. 본 Phase 는 KEY_MAP 변경 없음 (D12). | phase-09 §4.5 / phase-11 P4 |
| **P5** | 도메인 실패는 Result 패턴으로 store 의 AsyncState / Result 분기에 흘러옴. 본 Phase 의 ErrorMessage 는 *Result.error* 만 표시. `<PanelErrorBoundary>` 는 *런타임 예외* (예: ref undefined) 만 포착. | architecture §3.7 / phase-10 P5 / phase-11 P5 |
| **P6** | i18n 부팅 실패 안전 — `<AppErrorBoundary>` fallback 정적 영문. 본 Phase 패널은 정상 부팅 가정 + Suspense fallback 만. | phase-10 D15 / phase-11 P6 |
| **P7** | `experimental` 배지 / disclaimer 는 phase-06 §4.8 가 정의. 본 Phase 는 그 키 *재사용 안 함* (반응 결과 영역 — 본 Phase 영역 외). | phase-06 §4.8 |
| **P8** | `mapReactionErrorToKey` (phase-07 §5.2) 패턴 = `mapIngestErrorToKey` 의 mirror. 본 Phase 가 IngestError 6 분기 + ParseError sub-code + EmbedError sub-code 매핑. | phase-07 §5.2 / phase-11 P8 |
| **P9** | Radix Dialog 의 focus trap + Esc 자동 닫기 + trigger 복원. 본 Phase 는 *추가 키보드 핸들링 없음* (Radix 기본). | phase-10 §6.x / phase-11 P9 |
| **P10** | `panels.active` ↔ `is*Open` 두 슬롯의 의미 분기 — phase-07 가 보장. 본 Phase 의 `'text-input'` modal 은 `panels.active` 의 docked 슬롯과 *동시 표시 가능*. | phase-07 §4.4 / phase-10 P10 / phase-11 P11 |
| **P11** | 토스트 큐 길이 상한 50 — phase-07 R7. 본 Phase 의 notify 호출 (Toolbar / PeriodicTable trigger 의 placeholder 교체로 호출 0 → 영향 없음, 단 Submit 성공 토스트 등 새 호출 추가). | phase-07 R7 / phase-11 P12 |
| **P12** | phase-03 의 RDKit 호출은 thread-safe 단일 인스턴스 (phase-03 §6.1 상태 머신). 본 Phase 의 previewFromText 와 addFromSmiles 가 동시 호출되어도 phase-03 의 cache 가 안전 처리. | phase-03 §6.1 / §6.3 |

#### 본 Phase 결정 (D-table)

| ID | 질문 | 확정 답 | 본문 영향 |
|---|---|---|---|
| **D1** | PanelKey 명명 | `'text-input'`. 다중 mode (smiles/formula/inchi) 포괄성 우선. `'smiles-input'` 거절 (mode 가 1 개로 오해 가능). | §2.1, §6.10 |
| **D2** | 모달 vs docked | **modal** (PanelKey mode='modal'). 사용자 진입점이 *명시적 trigger* (Toolbar 또는 PeriodicTable 셀) 라 docked 상시 표시는 화면 점유 과다. | §2.1 |
| **D3** | Mode 분리 vs 단일 모달 + Tabs | **단일 모달 + Tabs** (`smiles | formula | inchi`). 사용자가 mode 비교 / 전환 가능. PanelRegistry 등록 = 1 회. | §2.1, §6.2 |
| **D-MODE-RESET** | Tab 전환 시 raw 입력 보존 vs reset | **reset**. mode 변경 = 새 입력 컨텍스트. 사용자가 SMILES → InChI 같은 raw 입력은 무의미 (다른 형식). 보존 시 사용자 혼란. | §6.2 |
| **D-PREVIEW-DEBOUNCE** | Preview 디바운스 ms | **300 ms**. phase-11 §4.5 의 CompoundBrowser 와 동일. Phase 14 측정 후 150–500 ms 조정 가능. | §6.3 |
| **D-PREVIEW-PATH** | preview 가 store 통과 vs panel-local engine 직접 import | **store 통과 (옵션 A)**. `previewFromText` action 신설. P1 엄격 준수. RDKit race condition 회피 (단일 호출자). | §7.2, §5.3 |
| **D-LOAD-SEMANTICS** | Submit 시 add vs replace 분기 | **Switch 토글** (`<ReplaceSwitch/>`). default off (= add). 활성 분자가 null 이면 disabled (off 강제). | §2.1, §6.6 |
| **D-DUPLICATE-CHECK** | Duplicate 검출 위치 | **모달 측** (옵션 b). Submit 전 PreviewPane 에서 InChIKey 매칭 검사. addFromMolecule 본체에 검출 추가는 (a) — Phase 13 결정. | §6.6, §11.9 |
| **D-SEED-FORMAT** | PeriodicTable trigger 의 seed 형태 | `{ kind: 'formula', raw: getElementInitialFormula(element) }`. 단일 원소 (또는 diatomic) 표기. 사용자가 모달에서 자유 편집. | §6.8, §6.10 |
| **D-DIATOMIC-LOOKUP** | Diatomic 분자 lookup 위치 | **panel-local table** (`panels/TextInput/seedHelpers.ts`). phase-02 retrofit 회피 (data 모듈 슬림 유지). | §6.8 |
| **D-INPUT-WIDGET** | InChI 입력 widget | **textarea**. InChI 가 길어 줄바꿈 가능. SMILES / formula = single-line `<Input/>`. | §2.1 |
| **D-ENTER-SUBMIT** | Enter 키 submit 발화 | **single-line input 만 Enter→submit** (preview success 시). InChI textarea 의 Enter = native 줄바꿈. | §2.1 |
| **D-MULTIMODAL-COEXIST** | PeriodicTable + TextInput 동시 표시 | **PeriodicTable 자동 닫기**. seed 인계 후 PeriodicTable.toggle(false) → TextInput open. 두 modal 겹쳐 표시는 UX 혼란. | §2.1 |
| **D-RDKIT-STATUS-IMPORT** | `onRdkitStatusChange` import 경로 | **panel-local hook 이 phase-03 직접 import** (P1 명시 예외 — read-only 구독 한정). store retrofit (`uiStore.rdkitStatus`) 는 *과잉 설계* — 모달 닫혀 있을 때 store 슬롯 무의미. | §3.1, §6.10 |
| **D-DEAD-PLACEHOLDER** | 옛 placeholder i18n 키 | **제거**. `panels.toolbar.smilesInput.placeholder`, `panels.periodicTable.element.startMolecule.placeholder` 두 키 삭제. grep 으로 잔존 0 검증. | §2.1, §10.5, §10.6 |
| **D-REGENID-MODULE** | `withRegeneratedIds` export 경로 | `src/stores/_shared/regenerateIds.ts` 신규 모듈. phase-11 §6.12 인라인 → import 변경 (소급). | §2.1, §12.1 |
| **D-LOG-RUNTIME** | 패널 내부 런타임 예외 | `<PanelErrorBoundary panelKey="text-input" slotName="modal">` 가 `logger.error('panel-boundary.caught', ...)` 자동. 본 Phase 컴포넌트는 *추가 logger 호출 안 함* (Boundary 가 책임). 도메인 실패 (Result.error) 는 ErrorMessage 가 표시 (logger 호출 안 함 — 정상 흐름). | §6 전반 |
| **D-PREVIEW-CACHE** | preview 와 commit 의 RDKit 이중 호출 | **무시 가능**. phase-03 §6.3 의 normalized key cache 가 두 번째 호출 (commit 시 addFromSmiles) 즉시 반환. preview 가 cache miss → 호출, commit 이 cache hit → 즉시. | §6.6 |
| **D-INTL-LOCALE-FALLBACK** | i18n missing key 시 표시 | react-i18next 기본 fallback (key 자체 표시). `panels.textInput.*` / `common.ingest.error.*` 의 누락은 빌드타임 ESLint 검증 (Phase 15 — 본 Phase 는 한·영 양쪽 채움 완료 보장). | §6.9 |

---

## 4. 데이터 모델 / 타입

본 Phase 는 새 도메인 타입을 *최소* 도입한다. 대부분 phase-03 / phase-07 의 기존 타입 재사용.

### 4.1 TextInputMode (`src/panels/TextInput/types.ts`)

```ts
import type { InputKind } from '@/engine/rdkit/types'; // phase-03 §4.1 line 170

/**
 * 본 모달의 활성 입력 mode. phase-03 의 InputKind 와 동일 값 — 별칭으로 정의해
 * UI 레이어가 phase-03 타입 재export 의무 없이 사용.
 */
export type TextInputMode = InputKind;  // 'smiles' | 'inchi' | 'formula'
```

### 4.2 TextInputSeed (`src/stores/uiStore.ts` 의 retrofit)

```ts
export interface TextInputSeed {
  readonly kind: TextInputMode;
  readonly raw: string;
}
```

uiStore.panels 의 `textInputInitial: TextInputSeed | null` 슬롯에 보관. PeriodicTable trigger 가 set, 모달 unmount 가 clear.

### 4.3 PreviewState (panel-local)

```ts
import type { Molecule } from '@/chemistry/compounds/types';
import type { IngestError } from '@/stores';
import type { AsyncState } from '@/stores';

export type PreviewState = AsyncState<Molecule, IngestError>;
```

phase-07 의 `AsyncState<T, E>` 4 분기 (idle/loading/success/error) 재사용. panel-local `useState<PreviewState>` 로 보관 — store 에 commit 안 함.

### 4.4 IngestErrorMapping (`src/stores/moleculeStore.selectors.ts` retrofit)

```ts
/**
 * mapIngestErrorToKey 의 결과. UI 가 메시지 + 액션 버튼 분기에 사용.
 */
export interface IngestErrorMapping {
  /** i18n 키 (common.json#ingest.error.* 또는 panels.textInput.* 의 절대 경로). */
  readonly key: string;
  /** i18n interpolation 파라미터 (있을 때). */
  readonly params?: Readonly<Record<string, string | number>>;
  /** UI 가 노출할 후속 액션 (있을 때). */
  readonly action?: 'open-compound-browser' | 'activate-existing' | 'reload-page' | null;
}
```

### 4.5 uiStore retrofit (PanelKey + state + actions)

```ts
// src/stores/uiStore.ts (phase-12 retrofit)

export type PanelKey =
  | 'periodic-table'
  | 'compound-browser'
  | 'conditions'
  | 'molecule-info'
  | 'reaction-result'
  | 'toolbar'
  | 'text-input';                        // ⟵ phase-12 추가

export interface UiStoreState {
  readonly panels: {
    readonly active: PanelKey | null;
    readonly isCompoundBrowserOpen: boolean;
    readonly isPeriodicTableOpen: boolean;
    readonly isReactionResultOpen: boolean;
    readonly isTextInputOpen: boolean;             // ⟵ phase-12 추가
    readonly textInputInitial: TextInputSeed | null; // ⟵ phase-12 추가
  };
  // ... 기타 ...
}

export interface UiStoreActions {
  // ... 기존 ...
  toggleTextInput(open?: boolean): void;            // ⟵ phase-12 추가
  setTextInputInitial(seed: TextInputSeed | null): void; // ⟵ phase-12 추가
}
```

selector:
```ts
export const selectIsTextInputOpen = (s: UiStoreState): boolean => s.panels.isTextInputOpen;
export const selectTextInputInitial = (s: UiStoreState): TextInputSeed | null => s.panels.textInputInitial;
```

### 4.6 moleculeStore retrofit

```ts
// src/stores/moleculeStore.ts (phase-12 retrofit)

export interface MoleculeStoreActions {
  // ── 기존 비동기 진입점 ──
  addFromSmiles(input: string, opts?: { signal?: AbortSignal }): Promise<Result<MoleculeId, IngestError>>;
  addFromInchi(input: string, opts?: { signal?: AbortSignal }): Promise<Result<MoleculeId, IngestError>>;
  addFromCompound(cid: number, opts?: { signal?: AbortSignal }): Promise<Result<MoleculeId, IngestError>>;
  // ── phase-12 추가 ──
  /**
   * 분자식 입력으로 Molecule 생성 + 작업공간 적재.
   * 1. parseFormula(input)         → FormulaComposition 또는 ParseError
   * 2. formulaToParsedMol(comp)    → ParsedMol 또는 ParseError (FormulaUnsupported 포함)
   * 3. toMoleculeWith3D(parsed)    → Molecule 또는 EmbedError
   * 4. duplicate 검출 (InChIKey 매칭)
   * 5. molecules + activeId commit + ingest AsyncState success
   */
  addFromFormula(input: string, opts?: { signal?: AbortSignal }): Promise<Result<MoleculeId, IngestError>>;

  /**
   * 텍스트 입력의 *preview* — Molecule 만 반환, **state commit 없음**.
   * 호출자 (Phase 12 모달) 가 반환값을 panel-local state 로 보관 → MoleculeCard 표시 → 사용자 Submit 시
   * 별도 commit 액션 (addFromMolecule / replace) 호출.
   *
   * **중요**: 본 액션은 ingest AsyncState 변경 안 함. 호출자가 자체 AsyncState 관리.
   */
  previewFromText(args: {
    readonly kind: TextInputMode;
    readonly raw: string;
    readonly signal?: AbortSignal;
  }): Promise<Result<Molecule, IngestError>>;

  // ── 기존 동기 편집 ── (변경 없음)
  // ...
}
```

selector:
```ts
// src/stores/moleculeStore.selectors.ts (phase-12 retrofit)
export function mapIngestErrorToKey(e: IngestError): IngestErrorMapping;
```

본문 매핑 표 = §6.11.

### 4.7 MoleculeCardSource 확장 (phase-11 retrofit)

```ts
// src/panels/_shared/MoleculeCard.tsx (phase-12 retrofit)
export type MoleculeCardSource = 'compound' | 'reaction-product' | 'text-input'; // ⟵ phase-12 추가
```

표시 라벨 분기:
```ts
const SOURCE_LABEL: Record<MoleculeCardSource, string> = {
  'compound': 'panels.compoundBrowser.sourceLabel',           // 기존 (phase-11)
  'reaction-product': 'panels.reactionResult.sourceLabel',    // 기존 (phase-11)
  'text-input': 'panels.textInput.preview.sourceLabel',       // ⟵ phase-12 추가
};
```

(phase-11 의 SOURCE_LABEL 매핑이 *형태로만 존재* 하면 본 Phase 가 추가, 아니면 본 Phase 에서 신설.)

### 4.8 i18n namespace 트리 (`src/i18n/types.ts` 변경 없음)

phase-11 가 이미 `panels` namespace 등재. 본 Phase 는 *키 트리 확장* 만 — 타입 모듈 변경 없음.

```ts
// src/i18n/types.ts (phase-11 정의, phase-12 영향 없음)
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof import('./resources/en/common.json');
      chemistry: typeof import('./resources/en/chemistry.json');
      shortcuts: typeof import('./resources/en/shortcuts.json');
      panels: typeof import('./resources/en/panels.json');     // 키 추가는 panels.json 자체 갱신
    };
  }
}
```

---

## 5. 퍼블릭 API / 인터페이스

### 5.1 `@/panels` barrel 추가 export 없음

`<TextInputDialog/>` 의 default export 는 `registerPanel.load` 의 dynamic import 로만 접근 (phase-11 §5.1 패턴 정합). barrel 노출 안 함.

```ts
// src/panels/index.ts (phase-11 정의, phase-12 변경 없음)
export { registerAllPanels } from './registerAll';
export { default as ToolbarBar } from './Toolbar/ToolbarBar';
export type { ToolbarProps } from './Toolbar/types';
export { ToastItem } from './Toast/ToastItem';
export type { ToastItemProps } from './Toast/ToastItem';
// TextInput default export 미노출 — registerPanel.load 만 접근.
```

### 5.2 `panels/registerAll.ts` retrofit

```ts
// src/panels/registerAll.ts (phase-12 retrofit)

import { registerPanel } from '@/app/layout';

export function registerAllPanels(): void {
  registerPanel({ key: 'periodic-table', mode: 'modal', i18nTitleKey: 'panels.periodicTable.title', load: () => import('./PeriodicTable') });
  registerPanel({ key: 'compound-browser', mode: 'modal', i18nTitleKey: 'panels.compoundBrowser.title', load: () => import('./CompoundBrowser') });
  registerPanel({ key: 'conditions', mode: 'docked', i18nTitleKey: 'panels.conditions.title', load: () => import('./Conditions') });
  registerPanel({ key: 'molecule-info', mode: 'docked', i18nTitleKey: 'panels.moleculeInfo.title', load: () => import('./MoleculeInfo') });
  registerPanel({ key: 'reaction-result', mode: 'modal', i18nTitleKey: 'panels.reactionResult.title', load: () => import('./ReactionResult') });
  // ⟵ phase-12 추가
  registerPanel({
    key: 'text-input',
    mode: 'modal',
    i18nTitleKey: 'panels.textInput.title',
    load: () => import('./TextInput'),
  });
}
```

### 5.3 uiStore 액션 시그니처 (phase-07 retrofit)

```ts
// src/stores/uiStore.ts (phase-12 retrofit, 액션 본문 추출)

toggleTextInput: (open?: boolean) => void;
setTextInputInitial: (seed: TextInputSeed | null) => void;
```

본문:
```ts
toggleTextInput: (open) => set((s) => {
  s.panels.isTextInputOpen = open !== undefined ? open : !s.panels.isTextInputOpen;
  if (!s.panels.isTextInputOpen) {
    // 닫을 때 seed 도 자동 cleanup
    s.panels.textInputInitial = null;
  }
}),
setTextInputInitial: (seed) => set((s) => {
  s.panels.textInputInitial = seed;
}),
```

### 5.4 moleculeStore 액션 시그니처 + IngestError 분기 표

```ts
addFromFormula: (input: string, opts?: { signal?: AbortSignal }) => Promise<Result<MoleculeId, IngestError>>;
previewFromText: (args: { kind: TextInputMode; raw: string; signal?: AbortSignal }) => Promise<Result<Molecule, IngestError>>;
```

`mapIngestErrorToKey` 의 정확한 분기 표 (§6.11 참조). i18n 키 트리:

```jsonc
// en/common.json (phase-12 추가 분기)
{
  "ingest": {
    "error": {
      "parse": {
        "empty": "Enter SMILES, formula, or InChI.",
        "tooLong": "Input is too long (max 2000 characters).",
        "smilesSyntax": "Invalid SMILES syntax.",
        "smilesSyntaxAt": "SMILES parse failed near character {{at}}.",
        "inchiSyntax": "Invalid InChI syntax.",
        "formulaSyntax": "Invalid formula syntax.",
        "formulaUnsupported": "No SMILES mapping for this formula. Try SMILES input or compound search.",
        "unknownElement": "Unknown element symbol.",
        "sanitization": "Molecule sanitization failed.",
        "generic": "Parse error: {{message}}"
      },
      "embed": {
        "timeout": "3D structure generation timed out. Try again or use simpler input.",
        "failed": "3D structure generation failed.",
        "ionHandling": "Cannot handle this ion / radical for 3D embedding.",
        "invalidMolecule": "Molecule is invalid for 3D embedding.",
        "generic": "Embed error: {{message}}"
      },
      "duplicate": "An identical molecule already exists in the workspace.",
      "rdkitNotReady": "Chemistry engine is not ready. Reload the page if this persists.",
      "internal": "Internal error: {{message}}"
    }
  }
}
```

(ko/common.json 은 동일 구조 한국어. phase-15 폴리싱.)

### 5.5 `panels.textInput.*` i18n 키 트리

```jsonc
// en/panels.json (phase-12 추가 영역 — 기존 panels.toolbar.* / panels.periodicTable.* 와 별개)
{
  "textInput": {
    "title": "Add Molecule from Text",
    "modeTabs": {
      "smiles": "SMILES",
      "formula": "Formula",
      "inchi": "InChI"
    },
    "placeholder": {
      "smiles": "e.g., CCO (ethanol)",
      "formula": "e.g., H2O, NH4+",
      "inchi": "e.g., InChI=1S/H2O/h1H2"
    },
    "preview": {
      "empty": "Enter input to see a preview.",
      "loading": "Analyzing…",
      "sourceLabel": "Text input preview"
    },
    "rdkitLoading": "Loading chemistry engine…",
    "replaceToggle": {
      "label": "Replace active molecule",
      "helpReplace": "Replace the active molecule's structure with this input.",
      "helpAdd": "Add as a new molecule to the workspace.",
      "disabledNoActive": "No active molecule — will add as new."
    },
    "duplicate": {
      "message": "An identical molecule is already in the workspace.",
      "activateExisting": "Activate existing"
    },
    "formulaUnsupported": {
      "openCompoundBrowser": "Open compound search"
    },
    "rdkitInitFailed": {
      "reloadPage": "Reload page"
    },
    "action": {
      "addToWorkspace": "Add",
      "replaceActive": "Replace",
      "cancel": "Cancel"
    },
    "submitted": {
      "added": "Added to workspace.",
      "replaced": "Active molecule replaced."
    }
  }
}
```

ko/panels.json 은 동일 구조 한국어 번역.

---

## 6. 핵심 로직 / 전략

### 6.1 TextInputDialog 구조

```tsx
// panels/TextInput/index.tsx
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useUiStore,
  useMoleculeStore,
  selectIsTextInputOpen,
  selectTextInputInitial,
  selectActiveMolecule,
} from '@/stores';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Button,
  Spinner,
  VisuallyHidden,
} from '@/components';
import { ModeTabs } from './ModeTabs';
import { InputArea } from './InputArea';
import { PreviewPane } from './PreviewPane';
import { ReplaceSwitch } from './ReplaceSwitch';
import { DuplicateWarning } from './DuplicateWarning';
import { ErrorMessage } from './ErrorMessage';
import { RdkitStatusInline } from './RdkitStatusInline';
import { usePreviewParse } from './usePreviewParse';
import { useDuplicateCheck } from './useDuplicateCheck';
import type { TextInputMode } from './types';
import { withRegeneratedIds } from '@/stores/_shared/regenerateIds';

export default function TextInputDialog() {
  const { t } = useTranslation('panels');
  const open = useUiStore(selectIsTextInputOpen);
  const initial = useUiStore(selectTextInputInitial);
  const toggle = useUiStore(s => s.actions.toggleTextInput);
  const notify = useUiStore(s => s.actions.notify);
  const active = useMoleculeStore(selectActiveMolecule);
  const addFromMolecule = useMoleculeStore(s => s.actions.addFromMolecule);
  const replace = useMoleculeStore(s => s.actions.replace);
  const setActive = useMoleculeStore(s => s.actions.setActive);

  const [mode, setMode] = useState<TextInputMode>(initial?.kind ?? 'smiles');
  const [raw, setRaw] = useState<string>(initial?.raw ?? '');
  const [replaceOn, setReplaceOn] = useState(false);

  // seed 인계 — initial 변경 시 mode + raw 초기화 (모달 재오픈 마다 1 회).
  useEffect(() => {
    if (initial) {
      setMode(initial.kind);
      setRaw(initial.raw);
    } else {
      setMode('smiles');
      setRaw('');
      setReplaceOn(false);
    }
  }, [initial, open]);

  const preview = usePreviewParse({ mode, raw, debounceMs: 300 });
  const duplicate = useDuplicateCheck(preview.kind === 'success' ? preview.value : null);

  const onSubmit = () => {
    if (preview.kind !== 'success') return;
    const m = preview.value;
    if (replaceOn && active) {
      const regenerated = withRegeneratedIds(m, active.id);
      replace(active.id, regenerated);
      notify({ level: 'success', messageKey: 'panels.textInput.submitted.replaced', dismissAfterMs: 2500 });
    } else {
      const newId = addFromMolecule(m); // 내부에서 withRegeneratedIds + setActive 자동
      notify({ level: 'success', messageKey: 'panels.textInput.submitted.added', dismissAfterMs: 2500 });
    }
    toggle(false);
  };

  return (
    <Dialog open={open} onOpenChange={toggle}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>{t('textInput.title')}</DialogTitle>
        <VisuallyHidden>
          {/* description for a11y — DialogDescription 도 사용 가능 */}
          {t('textInput.preview.empty')}
        </VisuallyHidden>
        <div className="flex flex-col gap-4 py-4">
          <ModeTabs mode={mode} onChange={(m) => { setMode(m); setRaw(''); }} />
          <InputArea mode={mode} raw={raw} onChange={setRaw} onEnterSubmit={mode !== 'inchi' ? onSubmit : undefined} />
          <RdkitStatusInline />
          <PreviewPane preview={preview} duplicate={duplicate} />
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <ReplaceSwitch
            checked={replaceOn}
            disabled={active == null}
            onChange={setReplaceOn}
          />
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button variant="ghost">{t('textInput.action.cancel')}</Button>
            </DialogClose>
            <Button
              variant="primary"
              disabled={preview.kind !== 'success' || (duplicate.exists && !replaceOn)}
              onClick={onSubmit}
            >
              {replaceOn ? t('textInput.action.replaceActive') : t('textInput.action.addToWorkspace')}
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
```

### 6.2 ModeTabs

```tsx
// panels/TextInput/ModeTabs.tsx
import { Tabs, TabsList, TabsTrigger } from '@/components';
import { useTranslation } from 'react-i18next';
import type { TextInputMode } from './types';

interface Props {
  readonly mode: TextInputMode;
  readonly onChange: (m: TextInputMode) => void;  // 호출 시 raw 입력 reset (D-MODE-RESET)
}

export function ModeTabs({ mode, onChange }: Props) {
  const { t } = useTranslation('panels');
  return (
    <Tabs value={mode} onValueChange={(v) => onChange(v as TextInputMode)}>
      <TabsList>
        <TabsTrigger value="smiles">{t('textInput.modeTabs.smiles')}</TabsTrigger>
        <TabsTrigger value="formula">{t('textInput.modeTabs.formula')}</TabsTrigger>
        <TabsTrigger value="inchi">{t('textInput.modeTabs.inchi')}</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
```

### 6.3 usePreviewParse 훅

```ts
// panels/TextInput/usePreviewParse.ts
import { useEffect, useRef, useState } from 'react';
import { useMoleculeStore } from '@/stores';
import type { PreviewState } from './types';
import type { TextInputMode } from './types';

interface Args {
  readonly mode: TextInputMode;
  readonly raw: string;
  readonly debounceMs: number;
}

export function usePreviewParse({ mode, raw, debounceMs }: Args): PreviewState {
  const [state, setState] = useState<PreviewState>({ kind: 'idle' });
  const previewFromText = useMoleculeStore((s) => s.actions.previewFromText);
  const acRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // raw 비어있으면 idle.
    if (raw.trim().length === 0) {
      setState({ kind: 'idle' });
      acRef.current?.abort();
      return;
    }

    const handle = setTimeout(async () => {
      // 이전 inflight abort
      acRef.current?.abort();
      const ac = new AbortController();
      acRef.current = ac;

      setState({ kind: 'loading', startedAt: Date.now() });

      const result = await previewFromText({ kind: mode, raw: raw.trim(), signal: ac.signal });

      // abort 후 결과는 무시 (StaleClosure 방지)
      if (ac.signal.aborted) return;

      if (result.ok) {
        setState({ kind: 'success', value: result.value, settledAt: Date.now() });
      } else {
        setState({ kind: 'error', error: result.error, settledAt: Date.now() });
      }
    }, debounceMs);

    return () => {
      clearTimeout(handle);
      // mode 변경 / raw 변경 / unmount 시 inflight 도 abort
      acRef.current?.abort();
    };
  }, [mode, raw, debounceMs, previewFromText]);

  return state;
}
```

본 hook 의 phase-03 호출 매핑은 **store 의 `previewFromText` 가 내부적으로 분기** (D-PREVIEW-PATH 옵션 A):
- `'smiles'` → `smilesTo3DMolecule(raw)`
- `'inchi'` → `parseInchi(raw)` → success 시 `toMoleculeWith3D(parsed)`
- `'formula'` → `parseFormula(raw)` → success 시 `formulaToParsedMol(comp)` → success 시 `toMoleculeWith3D(parsed)`

각 단계 실패 시 `IngestError` 로 wrap (kind=`'parse'` 또는 `'embed'`).

### 6.4 PreviewPane

```tsx
// panels/TextInput/PreviewPane.tsx
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components';
import { MoleculeCard } from '@/panels/_shared/MoleculeCard';
import { ErrorMessage } from './ErrorMessage';
import { DuplicateWarning } from './DuplicateWarning';
import type { PreviewState } from './types';
import type { DuplicateInfo } from './useDuplicateCheck';

interface Props {
  readonly preview: PreviewState;
  readonly duplicate: DuplicateInfo;
}

export function PreviewPane({ preview, duplicate }: Props) {
  const { t } = useTranslation('panels');

  if (preview.kind === 'idle') {
    return <p className="text-sm text-fg-muted text-center py-8">{t('textInput.preview.empty')}</p>;
  }

  if (preview.kind === 'loading') {
    return (
      <div className="flex flex-col items-center gap-3 py-8" aria-live="polite">
        <Spinner size="md" />
        <p className="text-sm text-fg-muted">{t('textInput.preview.loading')}</p>
      </div>
    );
  }

  if (preview.kind === 'error') {
    return <ErrorMessage error={preview.error} />;
  }

  // success
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <MoleculeCard molecule={preview.value} source="text-input" />
      {duplicate.exists && (
        <DuplicateWarning existingId={duplicate.existingId} />
      )}
    </div>
  );
}
```

### 6.5 ErrorMessage

```tsx
// panels/TextInput/ErrorMessage.tsx
import { useTranslation } from 'react-i18next';
import { useUiStore, useMoleculeStore, mapIngestErrorToKey } from '@/stores';
import { Button } from '@/components';
import { AlertCircle, Search, RefreshCw, ArrowRightCircle } from 'lucide-react';
import type { IngestError } from '@/stores';

interface Props {
  readonly error: IngestError;
}

export function ErrorMessage({ error }: Props) {
  const { t } = useTranslation();
  const mapped = mapIngestErrorToKey(error);
  const toggleCompoundBrowser = useUiStore(s => s.actions.toggleCompoundBrowser);
  const toggleTextInput = useUiStore(s => s.actions.toggleTextInput);
  const setActive = useMoleculeStore(s => s.actions.setActive);

  const onAction = () => {
    switch (mapped.action) {
      case 'open-compound-browser':
        toggleTextInput(false);
        toggleCompoundBrowser(true);
        break;
      case 'reload-page':
        window.location.reload();
        break;
      case 'activate-existing':
        // DuplicateWarning 으로 위임 — 본 ErrorMessage 분기에 도달하지 않음.
        break;
    }
  };

  return (
    <div role="alert" aria-live="assertive" className="flex flex-col gap-2 rounded-md bg-error/10 p-3 ring-1 ring-error/30">
      <div className="flex items-start gap-2">
        <AlertCircle aria-hidden size={16} className="mt-0.5 text-error flex-shrink-0" />
        <p className="text-sm text-fg-primary">{t(mapped.key, mapped.params)}</p>
      </div>
      {mapped.action != null && mapped.action !== 'activate-existing' && (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={onAction}>
            {mapped.action === 'open-compound-browser' && (
              <><Search size={14} className="mr-1" />{t('panels.textInput.formulaUnsupported.openCompoundBrowser', { ns: 'panels' })}</>
            )}
            {mapped.action === 'reload-page' && (
              <><RefreshCw size={14} className="mr-1" />{t('panels.textInput.rdkitInitFailed.reloadPage', { ns: 'panels' })}</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
```

### 6.6 Submit 플로우 (replace vs add)

§6.1 의 `onSubmit` 본문 + 세부 의미:

**공통 전처리** (phase-11 §6.12 retrofit 정합):
- `addFromMolecule(m)` 은 phase-11 §6.12 가 *내부에서* `withRegeneratedIds(m, newId)` 자동 호출 → 호출자 (본 Phase) 추가 작업 없음.
- `replace(activeId, m)` 은 phase-07 §5.1 의 호출자 책임 정책 — 본 Phase 가 **명시 적용**: `withRegeneratedIds(m, activeId)` (id 인자 = 기존 activeId 유지, atom/bond ID 만 새로 발급).

**replace=on**:
```ts
const regenerated = withRegeneratedIds(m, active.id);
replace(active.id, regenerated);
notify({ level: 'success', messageKey: 'panels.textInput.submitted.replaced', dismissAfterMs: 2500 });
```
- phase-07 의 `replace` 는 단일 entry undoable (kind=`'molecule.replace'`) — phase-09 가 본 구현 인수.
- duplicate 검출 미적용 (사용자가 명시적으로 교체 의도).

**replace=off**:
```ts
const newId = addFromMolecule(m);  // phase-11 retrofit
notify({ level: 'success', messageKey: 'panels.textInput.submitted.added', dismissAfterMs: 2500 });
```
- phase-11 §6.12 가 자동: withRegeneratedIds + setActive(newId) + 단일 entry undoable (kind=`'molecule.add-from-product'` — *본 Phase 의 사용처는 product 가 아닌 text input 이지만 semantic 동일하므로 kind 재사용*. 또는 phase-11 retrofit 으로 kind 분리 가능 — D-LOAD-PRODUCTS 의 후속 결정).
- duplicate 검출은 본 Phase 의 모달이 *제출 전* `useDuplicateCheck` 로 검사 (D-DUPLICATE-CHECK 옵션 b). 매칭 시 Submit 버튼 disabled + DuplicateWarning 표시 + "기존 분자 활성화" 버튼.

`useDuplicateCheck`:
```ts
// panels/TextInput/useDuplicateCheck.ts
import { useMemo } from 'react';
import { useMoleculeStore, selectMoleculeIds } from '@/stores';
import type { Molecule, MoleculeId } from '@/chemistry/compounds/types';

export interface DuplicateInfo {
  readonly exists: boolean;
  readonly existingId: MoleculeId | null;
}

export function useDuplicateCheck(preview: Molecule | null): DuplicateInfo {
  const ids = useMoleculeStore(selectMoleculeIds);
  const molecules = useMoleculeStore((s) => s.molecules); // raw record
  return useMemo(() => {
    if (!preview || !preview.inchiKey) return { exists: false, existingId: null };
    for (const id of ids) {
      const m = molecules[id];
      if (m?.inchiKey && m.inchiKey === preview.inchiKey) {
        return { exists: true, existingId: id };
      }
    }
    return { exists: false, existingId: null };
  }, [preview, ids, molecules]);
}
```

**InChIKey 부재 시**: `preview.inchiKey === null` 이면 duplicate 검출 skip (e.g. RDKit 가 InChI 생성 실패한 매우 특수한 분자). 사용자 명시 안내 불필요.

### 6.7 Seed 인계

§6.1 의 `useEffect([initial, open])` 패턴. 핵심:
1. `initial` 변경 → mode + raw 갱신.
2. `open` false → raw / mode / replaceOn reset.
3. 모달 unmount (또는 `toggleTextInput(false)`) 시 uiStore 의 `setTextInputInitial(null)` 자동 호출 (§5.3 의 `toggleTextInput` 본문 안에 내장).

### 6.8 PeriodicTable trigger 의 seed

```ts
// panels/TextInput/seedHelpers.ts
import type { Element } from '@/chemistry/elements/types';

const DIATOMIC_HOMONUCLEAR: ReadonlySet<string> = new Set(['H', 'N', 'O', 'F', 'Cl', 'Br', 'I']);

/**
 * 원소 → 모달 입력 seed (formula 형태). 이원자 동핵 분자 (H₂, N₂, O₂, F₂, Cl₂, Br₂, I₂) 는 "X2".
 * 노블가스 / 금속 / 그 외 = 단일 원소 표기 (e.g., "He", "Na", "Fe").
 *
 * **본 룩업은 panel-local** (phase-02 의 standardState 필드는 'gas/liquid/solid/unknown' 만 제공
 * — diatomic 플래그 부재). phase-02 retrofit 회피 (data 모듈 슬림 유지).
 */
export function getElementInitialFormula(element: Element): string {
  if (DIATOMIC_HOMONUCLEAR.has(element.symbol)) return `${element.symbol}2`;
  return element.symbol;
}
```

PeriodicTable 의 ElementInfoSheet 가 호출:
```ts
import { getElementInitialFormula } from '@/panels/TextInput/seedHelpers';
// (panels/PeriodicTable 가 panels/TextInput/seedHelpers 를 직접 import — 동일 panels/* 레이어 간 참조 허용)

onStartMolecule={() => {
  setTextInputInitial({ kind: 'formula', raw: getElementInitialFormula(element) });
  toggleTextInput(true);
  togglePeriodicTable(false);
}}
```

### 6.9 Toolbar trigger 교체

```ts
// panels/Toolbar/EditGroup.tsx (phase-12 retrofit, 발췌)
const toggleTextInput = useUiStore(s => s.actions.toggleTextInput);

const onSmiles = () => {
  toggleTextInput(true);
};

// 버튼 라벨 i18n 키 'panels.toolbar.smilesInput' = "SMILES input" — 변경 없음.
// notify(placeholder) 호출 제거.
```

### 6.10 RDKit 상태 표시

```tsx
// panels/TextInput/RdkitStatusInline.tsx
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components';
import { onRdkitStatusChange, getRdkit } from '@/engine/rdkit';
import type { RdkitStatus } from '@/engine/rdkit/types';

function getSnapshot(): RdkitStatus {
  return getRdkit().getStatus(); // phase-03 §5.x 의 RdkitService 인터페이스 — 동기 status 접근
}

function subscribe(notify: () => void): () => void {
  return onRdkitStatusChange(() => notify());
}

function useRdkitStatus(): RdkitStatus {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function RdkitStatusInline() {
  const { t } = useTranslation('panels');
  const status = useRdkitStatus();

  if (status.phase === 'ready' || status.phase === 'idle') return null;

  if (status.phase === 'loading') {
    return (
      <div className="flex items-center gap-2 text-sm text-fg-muted" aria-live="polite">
        <Spinner size="sm" />
        <span>{t('textInput.rdkitLoading')}</span>
        {status.progress !== undefined && (
          <span className="ml-1">{Math.round(status.progress * 100)}%</span>
        )}
      </div>
    );
  }

  // status.phase === 'error' — ErrorMessage 가 자연스럽게 처리 (preview 가 RdkitNotReady 분기 표시).
  return null;
}
```

**phase-03 직접 import (P1 명시 예외)**: `onRdkitStatusChange` + `getRdkit` 가 read-only 구독 / 동기 status 접근 함수. 동작 함수 (`parseSmiles` 등) 는 직접 import 안 함. ESLint 가드는 §7.3 가 `engine/rdkit/index` 의 두 export 만 화이트리스트.

### 6.11 mapIngestErrorToKey 본문

```ts
// src/stores/moleculeStore.selectors.ts (phase-12 retrofit)
import type { IngestError } from './moleculeStore.types';
import type { ParseError } from '@/engine/rdkit/types';
import type { EmbedError } from '@/engine/geometry/types';

export interface IngestErrorMapping {
  readonly key: string;
  readonly params?: Readonly<Record<string, string | number>>;
  readonly action?: 'open-compound-browser' | 'activate-existing' | 'reload-page' | null;
}

export function mapIngestErrorToKey(e: IngestError): IngestErrorMapping {
  switch (e.kind) {
    case 'parse':
      return mapParseError(e.detail);
    case 'embed':
      return mapEmbedError(e.detail);
    case 'pubchem':
      // 본 Phase 미사용 (text input 은 PubChem 미경유). addFromCompound 만 발생.
      return { key: 'common.ingest.error.internal', params: { message: e.detail.message ?? 'pubchem' } };
    case 'duplicate':
      return {
        key: 'common.ingest.error.duplicate',
        params: { existingId: e.existingId },
        action: 'activate-existing',
      };
    case 'rdkit-not-ready':
      return { key: 'common.ingest.error.rdkitNotReady', action: 'reload-page' };
    case 'internal':
      return { key: 'common.ingest.error.internal', params: { message: e.message } };
  }
}

function mapParseError(p: ParseError): IngestErrorMapping {
  switch (p.code) {
    case 'InputEmpty':
      return { key: 'common.ingest.error.parse.empty' };
    case 'InputTooLong':
      return { key: 'common.ingest.error.parse.tooLong' };
    case 'SmilesSyntax':
      return p.at !== undefined
        ? { key: 'common.ingest.error.parse.smilesSyntaxAt', params: { at: p.at } }
        : { key: 'common.ingest.error.parse.smilesSyntax' };
    case 'InchiSyntax':
      return { key: 'common.ingest.error.parse.inchiSyntax' };
    case 'FormulaSyntax':
      return { key: 'common.ingest.error.parse.formulaSyntax' };
    case 'FormulaUnsupported':
      return { key: 'common.ingest.error.parse.formulaUnsupported', action: 'open-compound-browser' };
    case 'UnknownElement':
      return { key: 'common.ingest.error.parse.unknownElement' };
    case 'SanitizationFailed':
      return { key: 'common.ingest.error.parse.sanitization' };
    case 'RdkitNotReady':
      return { key: 'common.ingest.error.rdkitNotReady', action: 'reload-page' };
    case 'InternalError':
      return { key: 'common.ingest.error.parse.generic', params: { message: p.message } };
  }
}

function mapEmbedError(e: EmbedError): IngestErrorMapping {
  switch (e.code) {
    case 'EmbedTimeout':
      return { key: 'common.ingest.error.embed.timeout' };
    case 'EmbedFailed':
      return { key: 'common.ingest.error.embed.failed' };
    case 'IonHandlingFailed':
      return { key: 'common.ingest.error.embed.ionHandling' };
    case 'InvalidMolecule':
      return { key: 'common.ingest.error.embed.invalidMolecule' };
    case 'RdkitNotReady':
      return { key: 'common.ingest.error.rdkitNotReady', action: 'reload-page' };
    case 'InternalError':
      return { key: 'common.ingest.error.embed.generic', params: { message: e.message } };
  }
}
```

**완전성**: ParseError 9 코드 + EmbedError 6 코드 + IngestError 6 분기 모두 매핑. switch 의 exhaustive 검증은 TypeScript `assertNever` 패턴 (생략 시 빌드 에러).

### 6.12 isTextInputTarget 정합 검증

phase-09 §4.5 / D10 의 가드:
- 우선순위 1: `isTextInputTarget(e.target)` 가 true 이면 KEY_MAP 의 모든 binding 발화 차단. native `<input>` / `<textarea>` / contentEditable 안의 키 입력은 viewport shortcuts 로 흘러가지 않음.
- 본 Phase 의 모달:
  - `<InputArea>` 는 native `<input>` (smiles/formula) 또는 `<textarea>` (inchi) 를 직접 마운트.
  - 사용자가 입력 박스에 focus 한 상태에서 Cmd+Z → `e.target.tagName === 'INPUT'/'TEXTAREA'` 매칭 → phase-09 가드 통과 → viewport undo 발화 안 함 → native browser undo (입력 텍스트 undo) 정상 작동.
- **검증**: §8.2 C7 컴포넌트 테스트가 `keydown` 이벤트 dispatch + `useMoleculeStore.getState().actions.undo` mock spy 호출 0 회 확인.

### 6.13 SMILES 표시 정책

preview 의 `<MoleculeCard molecule={preview} source="text-input"/>` 가 `molecule.canonicalSmiles` 표시 (phase-11 §6.4 패턴 정합). 사용자가 입력한 raw SMILES (예: `"OC(=O)c1ccccc1"`) 가 canonical SMILES (예: `"O=C(O)c1ccccc1"`) 와 다를 수 있음 — 사용자가 모달 입력 박스에 raw 를 보존하고 있으므로 비교 가능. 명시 안내 불필요 (자명).

InChI 도 동일 — `preview.inchi` 표시. raw InChI 입력과 RDKit 가 재산출한 InChI 가 다른 경우는 매우 드문 edge case (InChI 의 표준화는 이미 unique).

---

## 7. 파일/모듈 레이아웃

```
src/panels/TextInput/
├── index.tsx                              (default export — registerPanel.load)
├── ModeTabs.tsx                           (Tabs: smiles / formula / inchi)
├── InputArea.tsx                          (Input or textarea + onChange)
├── PreviewPane.tsx                        (AsyncState 4 분기 표시)
├── ErrorMessage.tsx                       (IngestError → 메시지 + action)
├── DuplicateWarning.tsx                   (InChIKey 매칭 시 표시)
├── ReplaceSwitch.tsx                      (활성 분자 교체 토글)
├── RdkitStatusInline.tsx                  (RDKit loading 상태 표시)
├── usePreviewParse.ts                     (디바운스 + previewFromText 호출 hook)
├── useDuplicateCheck.ts                   (InChIKey 매칭 hook)
├── seedHelpers.ts                         (getElementInitialFormula)
└── types.ts                               (TextInputMode, PreviewState 별칭)

src/stores/_shared/regenerateIds.ts        (신규 — phase-11 인라인 분리)

src/i18n/resources/{ko,en}/
├── panels.json                            (retrofit — panels.textInput.* 추가, dead placeholder 키 2 개 제거)
└── common.json                            (retrofit — common.ingest.error.* 추가)

⟵ retrofit
├── src/panels/registerAll.ts              (6 번째 registerPanel 호출 추가)
├── src/panels/Toolbar/EditGroup.tsx       (onSmiles 본문 교체)
├── src/panels/PeriodicTable/ElementInfoSheet.tsx (onStartMolecule 본문 교체)
├── src/panels/_shared/MoleculeCard.tsx    (MoleculeCardSource 유니온 확장)
├── src/stores/uiStore.ts                  (PanelKey + isTextInputOpen + textInputInitial + 액션)
├── src/stores/moleculeStore.ts            (addFromFormula + previewFromText 액션)
├── src/stores/moleculeStore.selectors.ts  (mapIngestErrorToKey + IngestErrorMapping 타입)
├── src/stores/index.ts                    (barrel — 위 항목 export)
└── (phase-11 §6.12 retrofit 소급) addFromMolecule(s) 의 인라인 withRegeneratedIds → import 변경
```

### 7.1 노출 경계

`@/panels` 가 외부에 노출:
- 추가 export 없음 (phase-11 의 ToolbarBar / ToastItem / registerAllPanels / ToastItemProps / ToolbarProps 만).

`@/panels` 가 *미노출*:
- `<TextInputDialog/>` default export (`registerPanel.load` 의 dynamic import 만 접근).
- `panels/TextInput/*` 의 sub-component (PreviewPane, ErrorMessage 등) — 패널 내부 전용.
- `seedHelpers.ts` 의 `getElementInitialFormula` — `panels/PeriodicTable/ElementInfoSheet.tsx` 가 *동일 panels/* 레이어 간 참조* 로 직접 import.

`@/stores/_shared/regenerateIds` 노출:
- `withRegeneratedIds` — phase-11 §6.12 + phase-12 §6.6 + phase-13 (예정) 가 import. `_shared` 디렉터리지만 stores 내부 전용 export.

### 7.2 레이어 가드 — preview 경로 결정 (D-PREVIEW-PATH)

본 Phase 의 핵심 아키텍처 결정 (Plan §7.2 의 옵션 A 채택).

**채택**: `moleculeStore.actions.previewFromText({ kind, raw, signal? }): Promise<Result<Molecule, IngestError>>` 추가.
- store 가 phase-03 호출 → preview Molecule 반환 (commit 안 함, state 변경 없음).
- 본 Phase 의 모달은 `useMoleculeStore(s => s.actions.previewFromText)` 만 호출.
- panels/TextInput 가 engine/* 직접 import 안 함 (P1 정합).

**예외 1개**: `panels/TextInput/RdkitStatusInline.tsx` 가 `@/engine/rdkit` 의 `onRdkitStatusChange` + `getRdkit().getStatus()` 직접 import. 정당화:
- `onRdkitStatusChange` = read-only 구독 함수 (이벤트 emitter 등록).
- `getRdkit().getStatus()` = 동기 read-only 상태 접근.
- 동작 함수 (parseSmiles, toMoleculeWith3D 등) 는 *직접 import 안 함*.
- store 통과 패턴 (uiStore.rdkitStatus + onRdkitStatusChange subscriber 가 store action dispatch) 은 *과잉 설계* — 모달 닫혀 있을 때 store 슬롯 무의미하고, RdkitStatus 는 phase-03 이미 *전역 싱글톤*.
- phase-08 의 viewport/* 가 chemistry/elements 직접 import 한 P1 명시 예외 패턴과 *동일 강도*.

ESLint 가드: §7.3 의 `import/no-restricted-paths` 가 `panels/TextInput` 만 `engine/rdkit` 의 두 export 화이트리스트.

### 7.3 ESLint 가드

`.eslintrc` (phase-11 §7.2 의 가드에 *부분 보완*):

```js
{
  rules: {
    'import/no-restricted-paths': ['error', {
      zones: [
        // ... phase-11 의 기존 zones (그대로 유지) ...

        // phase-12 추가:
        {
          target: './src/panels/TextInput',
          from: './src/engine',
          // 본 패널만 engine/rdkit 의 read-only 구독 export 허용.
          // engine/parser, engine/geometry 등 동작 함수는 차단 유지 (zone 의 except 미적용).
          // — except 가 없으면 from 의 모든 path 차단. 단, RdkitStatusInline 만 예외 필요.
          //
          // 정확 표현: panels/TextInput → engine/rdkit/index 만 허용.
          except: ['./src/engine/rdkit/index.ts'],
        },
        // 다른 panels/* 의 engine/* 차단 (phase-11 P1) 은 그대로 유지 — 본 추가는 panels/TextInput 만.
      ],
    }],
    'no-restricted-imports': ['error', {
      patterns: [
        // ... phase-11 의 기존 패턴 ...
        // phase-12 의 panels/TextInput sub-component 직접 import 차단 (panels/PeriodicTable 가 seedHelpers
        // 만 import 허용 — 별도 path 가드 불필요, ESLint 표준 import/no-relative-parent-imports 정도로 충분).
      ],
    }],
  },
}
```

P1 정합 + 정확한 화이트리스트 (file-level except). phase-08 의 viewport/* → chemistry/elements 직접 import 패턴과 동일 강도 (read-only / 정적 데이터 한정).

---

## 8. 테스트 계획

원칙: `architecture.md` §10 "모든 함수를 테스트하지 않는다. 핵심 로직과 핵심 동작만." 본 Phase 의 핵심 동작:
- (a) 텍스트 입력 → preview → submit (add 또는 replace) 전체 플로우.
- (b) IngestError 6 분기 + 대표 sub-code 의 i18n 매핑.
- (c) duplicate 검출 + 활성화 액션.
- (d) PeriodicTable / Toolbar trigger 교체 (placeholder 호출 0 검증).
- (e) Tab 전환 시 raw 입력 reset.
- (f) RDKit loading 상태 표시.
- (g) Cmd+Z 가 native input undo 로 가고 viewport undo 발화 안 함 (phase-09 D10 정합).

### 8.1 유닛 테스트 (Vitest)

`tests/unit/panels/TextInput/`:

| ID | 대상 | 검증 |
|---|---|---|
| **U1** | `mapIngestErrorToKey` | 대표 12 케이스 (Cartesian 매트릭스 90 회피): parse.InputEmpty, parse.SmilesSyntax (with at + without at), parse.FormulaUnsupported (action='open-compound-browser'), parse.UnknownElement, embed.EmbedTimeout, embed.IonHandlingFailed, duplicate (action='activate-existing', existingId param), rdkit-not-ready (action='reload-page'), internal (message param), pubchem (key='common.ingest.error.internal' fallback). switch exhaustive 검증 (assertNever). |
| **U2** | `getElementInitialFormula` | H/N/O/F/Cl/Br/I → "H2"/"N2"/.../"I2". C → "C", Na → "Na", He → "He", Fe → "Fe". 빈 symbol 입력 시 빈 문자열 반환 안전. |
| **U3** | `addFromFormula` (mock RDKit) | "H2O" → success + ingest commit + activeId. "Xx2" → IngestError.kind='parse'+detail.code='UnknownElement'. "C10H22" → 'FormulaUnsupported'. signal abort → ingest 변경 없음. |
| **U4** | `usePreviewParse` (fake timer) | 디바운스 정확 (raw 변경 후 300 ms 대기 후 호출). raw 비면 idle (timer cancel). 디바운스 중 mode 변경 → inflight abort + 새 timer. error → success transition (raw 변경 시). |
| **U5** | PanelKey 유니온 확장 | `'text-input'` 등록 후 `getPanelRegistry().has('text-input')` true. mode='modal' 검증. |
| **U6** | `previewFromText` action | 호출 전후 `useMoleculeStore.getState().ingest` 변경 없음 (state commit 없음 검증). 호출 전후 `molecules` 변경 없음. 반환값 = Result. |
| **U7** | `withRegeneratedIds` | 입력 Molecule 의 atoms[*].id / bonds[*].id 가 모두 새로 발급 (UUID 형식, 입력값과 다름). element / position / formalCharge 등 필드는 보존. molecule.id 는 인자로 받은 newId 로 교체. |
| **U8** | `useDuplicateCheck` | InChIKey 매칭 시 exists=true + existingId. 매칭 없을 시 exists=false. preview.inchiKey === null 시 exists=false (skip). |
| **U9** | `toggleTextInput` action | open=true 시 isTextInputOpen=true. open 미지정 시 toggle. close 시 textInputInitial=null 자동 cleanup. |

### 8.2 컴포넌트 테스트 (Testing Library)

`tests/component/panels/TextInput/`:

| ID | 대상 | 검증 |
|---|---|---|
| **C1** | `<TextInputDialog>` mount + close | open=true 시 Dialog 표시 + DialogTitle 렌더. Esc → onOpenChange(false) 호출. close 후 trigger 요소 focus 복원 (Radix). |
| **C2** | ModeTabs 전환 | smiles 탭에서 "CCO" 입력 후 formula 탭 클릭 → InputArea raw 가 "" 으로 reset (D-MODE-RESET). |
| **C3** | SMILES preview success | "CCO" 입력 → 300 ms 대기 → MoleculeCard 표시 (molecule.canonicalSmiles="CCO"). source label = "Text input preview". |
| **C4** | SMILES syntax error | "C(C" 입력 → 300 ms 대기 → ErrorMessage role="alert" + i18n 키 'common.ingest.error.parse.smilesSyntax' (또는 smilesSyntaxAt + at param). 액션 버튼 없음. |
| **C5** | Formula preview + FormulaUnsupported | "H2O" → success preview. "C10H22" → ErrorMessage + "화합물 검색 열기" 버튼 → 클릭 시 toggleCompoundBrowser(true) + toggleTextInput(false). |
| **C6** | Duplicate detection | mock molecules 에 InChIKey="XLYOFNOQVPJJNP-UHFFFAOYSA-N" (water) 있는 상태에서 "O" 입력 → preview success → DuplicateWarning 표시 + "기존 분자 활성화" 버튼 → 클릭 시 setActive(existingId) + toggleTextInput(false). Submit 버튼 disabled (replaceOn=false 시). |
| **C7** | Replace Switch + submit | active molecule 있는 상태에서 ReplaceSwitch on + "CCO" preview success → Submit 클릭 → moleculeStore.replace(activeId, regenerated) 호출 + notify success + close. ReplaceSwitch off → addFromMolecule 호출. activeMolecule null 시 ReplaceSwitch disabled. |
| **C8** | PeriodicTable seed 인계 | uiStore mock: `setTextInputInitial({kind:'formula', raw:'O2'})` + `toggleTextInput(true)` → 모달 mount → mode='formula' + InputArea 의 raw="O2" 자동 채움. |
| **C9** | Toolbar SMILES 버튼 | EditGroup 의 SMILES 버튼 클릭 → toggleTextInput(true) 호출. **placeholder messageKey 'panels.toolbar.smilesInput.placeholder' 호출 0 회 검증** (notify mock spy). |
| **C10** | RDKit loading 상태 | mock onRdkitStatusChange → status.phase='loading' 시 RdkitStatusInline 표시 ("RDKit 로드 중…" + Spinner). 'ready' 시 미표시. progress=0.5 → "50%" 표시. |
| **C11** | Cmd+Z native input undo | InputArea focus 후 "CCO" 입력 → Cmd+Z keydown → moleculeStore.undo mock spy 호출 0 회 검증 (phase-09 D10 가드 정합). |
| **C12** | ErrorMessage reload action | IngestError.kind='rdkit-not-ready' → ErrorMessage 의 "페이지 새로고침" 버튼 표시. (window.location.reload mock — 실 호출 안 함, mock spy 호출 검증.) |

### 8.3 E2E 테스트 (Playwright)

`tests/e2e/text-input/`:

| ID | 시나리오 | 검증 |
|---|---|---|
| **E1** | Toolbar → SMILES 입력 → 추가 | Toolbar SMILES 버튼 클릭 → 모달 열림 → SMILES 탭 active → "CCO" 입력 → 300 ms 후 preview MoleculeCard ("ethanol" 분자식 C2H6O) → "추가" 버튼 → viewport 에 분자 적재 (캔버스 픽셀 + activeId 갱신) + toast success. |
| **E2** | PeriodicTable → 원소 → 메탄 | PeriodicTable 모달 열기 → C 셀 클릭 → ElementInfoSheet 표시 → "이 원소로 분자 시작" 버튼 → 모달 전환 (PeriodicTable close + TextInput open) + mode='formula' + raw='C' → 300 ms 후 preview (메탄 CH4) → "추가" → 메탄 적재. |
| **E3** | 잘못된 SMILES 수정 | "C(C" 입력 → ErrorMessage 표시 ("괄호 불일치") + "추가" 버튼 disabled → 입력을 "C(C)C" 로 수정 → 300 ms 후 preview 정상 → "추가" 활성화 → 클릭 → 적재. |
| **E4** | 동일 SMILES 두 번 시도 | "CCO" 입력 → 추가 (1 회). 모달 닫고 다시 열어 "CCO" 재입력 → preview success + DuplicateWarning 표시 + "추가" 버튼 disabled → "기존 분자 활성화" 클릭 → 모달 닫힘 + 기존 분자 active 갱신 (UI 검증). |
| **E5** | InChI 입력 | InChI 탭 클릭 → "InChI=1S/H2O/h1H2" 입력 → 300 ms 후 preview (water) → "추가" → 적재. |
| **E6** | Replace 토글 | 기존 분자 추가 → 모달 재오픈 → ReplaceSwitch on → "CCN" (ethylamine) 입력 → preview → "교체" → 활성 분자 atoms 변경 (id 보존, atoms 새 형태) + toast success. |
| **E7** | FormulaUnsupported → 화합물 검색 | "C10H22" 입력 → ErrorMessage + "화합물 검색 열기" 버튼 → 클릭 → CompoundBrowser 모달 열림 + TextInput 모달 닫힘 + CompoundBrowser 검색 입력 = "C10H22" (자동 채움 — Phase 14+ 가능, v1 빈 입력). |
| **E8** | Cmd+Z native undo | InputArea focus 후 "CCO" 타이핑 → Cmd+Z → 입력 박스의 "CCO" 가 native undo (e.g. "CC" 또는 "") → viewport 의 분자는 변경 없음. (viewport undo mock 또는 실제 분자 추가 후 검증.) |

### 8.4 a11y 회귀

`tests/component/panels/TextInput/a11y/`:

| ID | 대상 | 검증 |
|---|---|---|
| **A1** | TextInputDialog | Radix Dialog role="dialog" + aria-labelledby (DialogTitle) + aria-describedby. focus trap 작동. close 후 trigger focus 복원. |
| **A2** | InputArea | `<Input>` 에 aria-label (i18n) + autoFocus on mount. textarea (InChI) 동일. |
| **A3** | ErrorMessage | role="alert" + aria-live="assertive". |
| **A4** | PreviewPane loading/success | aria-live="polite" — 입력 변경 시 스크린 리더에 안내. |
| **A5** | ReplaceSwitch | Radix Switch role="switch" + aria-checked + aria-label (i18n). disabled 시 aria-disabled. |
| **A6** | DuplicateWarning | role="status" + 메시지 + 액션 버튼 aria-label. |

axe 자동 검증은 phase-15 — 본 Phase 는 ARIA 속성 *존재 + 값* 만 회귀.

---

## 9. 리스크 및 대안

| ID | 시나리오 | 영향 | 대응 |
|---|---|---|---|
| **R1** | preview 가 매 입력마다 RDKit 호출 → 빠른 타이핑 시 부하 | RDKit thread 점유 / WASM 메모리 압박 | 디바운스 300 ms (D-PREVIEW-DEBOUNCE) + AbortController + phase-03 §6.3 normalized key cache. Phase 14 측정 후 ms 조정. |
| **R2** | 매우 큰 SMILES (벤조피렌 등 50+ atom) embed 4 s timeout | EmbedTimeout error | ErrorMessage 분기 ("3D 생성 시간초과") + "다시 시도" 버튼 (재시도 시 다른 seed — phase-03 EmbedOptions.seed 변경. 본 Phase v1 미노출 — 사용자 클릭 = 동일 seed 재시도, 사실상 동일 결과. Phase 14+ 가 advanced 옵션 제공). |
| **R3** | replace=on 인데 activeId 가 null | Switch 활성화 시 invalid 상태 | ReplaceSwitch.disabled = (active == null) — Switch off 강제 + tooltip "활성 분자 없음". |
| **R4** | Formula → SMILES 매핑 누락 | FormulaUnsupported 좌절 | ErrorMessage + "화합물 검색 열기" 액션 (D8). 사용자에게 다음 단계 명확. |
| **R5** | RDKit 초기 로드 실패 (네트워크) | 모든 입력 RdkitNotReady | RdkitStatusInline 의 'error' 분기 + ErrorMessage 의 "페이지 새로고침" 액션. UI 영구 비활성화 방지. |
| **R6** | Duplicate detection 의 InChIKey 비교가 stereochemistry 무시 | 다른 입체이성질체 SMILES 가 동일 분자로 판정 | architecture §3.1 ④ 정합 (입체화학은 표시만, 반응/판정 무관). v1 수용. |
| **R7** | PeriodicTable seed 가 모달 open 전에 set 되면 stale | 다른 trigger 가 동시 set 시 마지막 seed 만 적용 | useEffect cleanup 으로 모달 unmount 시 setTextInputInitial(null). toggleTextInput(false) 시 자동 cleanup (§5.3 본문). |
| **R8** | phase-09 D10 가드의 ContentEditable 미체크 | contentEditable 영역에서 Cmd+Z 가 viewport undo 로 흘러감 | 본 Phase 는 contentEditable 미사용 — 영향 없음. Radix Dialog 도 contentEditable 사용 안 함. |
| **R9** | phase-03 toMoleculeWith3D 가 반환하는 Molecule 의 atom/bond ID 가 phase-08 D1 의 crypto.randomUUID() 과 다른 형식 | replace 후 viewport 가 atom ID 매칭 실패 → 렌더 오류 / selection 손실 | §6.6 의 `withRegeneratedIds(preview, activeId)` 명시 적용 — replace 호출 전 ID 강제 재발급. addFromMolecule 은 phase-11 §6.12 가 자동 처리. R9 가 *방어 위주* — 본 Phase 가 호출자 책임을 정확히 이행하면 발생 안 함. |
| **R10** | RDKit canonicalization 결과가 RDKit 버전 / 옵션에 따라 변할 수 있음 | InChIKey duplicate 검출 false negative | v1 수용 (RDKit 의 canonicalization 안정성 신뢰). RDKit 업그레이드 시 회귀 검증. |
| **R11** | 모달이 열린 채 다른 작업 가능 (Toolbar 클릭 / 패널 전환) | 동시 다중 modal | Radix Dialog modal=true 의 focus trap + overlay 차단. ModalHost 의 z-index 정합 (phase-10 §6.x 정합 검증). PeriodicTable trigger 는 명시적으로 PeriodicTable.toggle(false) 호출 (§6.8). |
| **R12** | ESLint `engine/rdkit` 직접 import 화이트리스트 *과다 완화* | panels/TextInput 의 다른 파일이 동작 함수 직접 import 가능 | §7.3 의 except 가 `engine/rdkit/index.ts` *file-level* — `engine/rdkit/parse.ts` 등 sub-file 차단 유지. RdkitStatusInline 만 본 import 사용 — 다른 컴포넌트 검증은 PR 리뷰. |
| **R13** | `previewFromText` 가 `addFromSmiles` 와 phase-03 cache 충돌 | preview 와 commit 간 race condition | phase-03 §6.3 cache 가 동시 호출에 안전 (mutex 또는 memo). cache miss 시 둘 다 RDKit 호출 = 중복. v1 수용 (cache hit 비율 높음). |
| **R14** | InChI textarea 의 Enter→줄바꿈 vs Submit 충돌 | UX 혼란 | D-ENTER-SUBMIT 정책: single-line input 만 Enter→submit. textarea 는 Enter=native 줄바꿈 (사용자가 Submit 버튼 클릭). |
| **R15** | i18n 누락 (panels.textInput / common.ingest.error 일부 키) | "key 자체" 표시 | 본 Phase v1 = 한·영 양쪽 채움 완료 (§5.4 / §5.5 표 전체). 누락 검증은 빌드타임 ESLint (phase-15). 부팅 시 t() 호출은 react-i18next 기본 fallback (key 자체) — 영구 차단 아님. |

---

## 10. 완료 기준 (Definition of Done)

### 10.1 패널 구현

- [ ] `<TextInputDialog>` Dialog mount + Esc + focus 복원 (C1, E1)
- [ ] ModeTabs 전환 + raw reset (C2, E1/E5)
- [ ] InputArea (single-line / textarea) + autoFocus (A2)
- [ ] PreviewPane AsyncState 4 분기 (C3, C4, C10)
- [ ] DuplicateWarning + "기존 분자 활성화" (C6, E4)
- [ ] ErrorMessage IngestError 분기 + 액션 버튼 (C5, C12)
- [ ] ReplaceSwitch + active null 시 disabled (C7, R3)
- [ ] RdkitStatusInline (C10)

### 10.2 PanelRegistry 등록

- [ ] `registerAllPanels()` 가 6 개 패널 등록 (5 기존 + text-input)
- [ ] PanelKey 유니온에 `'text-input'` 추가 (U5)
- [ ] `<ModalHost>` 가 isTextInputOpen 토글 시 lazy 마운트

### 10.3 Store retrofit

- [ ] `uiStore.panels.isTextInputOpen` + `textInputInitial` + 액션 2 개 (U9)
- [ ] `moleculeStore.addFromFormula(input, opts?)` (U3)
- [ ] `moleculeStore.previewFromText({kind, raw, signal?})` — state commit 없음 (U6)
- [ ] `mapIngestErrorToKey(e): IngestErrorMapping` (U1)
- [ ] `MoleculeCardSource` 유니온 확장 (`'text-input'` 추가)
- [ ] `src/stores/_shared/regenerateIds.ts` 신규 + barrel export (U7)
- [ ] phase-11 §6.12 인라인 `withRegeneratedIds` → `regenerateIds` import 변경 (소급)

### 10.4 Trigger 교체

- [ ] Toolbar `<EditGroup>` 의 onSmiles → `toggleTextInput(true)` (C9)
- [ ] PeriodicTable `<ElementInfoSheet>` 의 onStartMolecule → `setTextInputInitial + toggleTextInput + togglePeriodicTable(false)` (C8, E2)

### 10.5 i18n

- [ ] `panels.textInput.*` 키 트리 한·영 양쪽 채움 (§5.5)
- [ ] `common.ingest.error.*` 분기 한·영 양쪽 채움 (§5.4)
- [ ] **dead placeholder 키 2 개 제거** — `panels.toolbar.smilesInput.placeholder`, `panels.periodicTable.element.startMolecule.placeholder`
- [ ] `panels.toolbar.smilesInput` 라벨 보존 (버튼 라벨)

### 10.6 Placeholder trigger 도달 불가 검증

- [ ] C9 컴포넌트 테스트가 `notify` mock spy 로 placeholder messageKey 호출 0 회 검증
- [ ] C8 동일 (PeriodicTable trigger)
- [ ] grep `'panels.toolbar.smilesInput.placeholder'` / `'panels.periodicTable.element.startMolecule.placeholder'` codebase 잔존 0 검증

### 10.7 phase-11 인계 닫음

- [ ] (a) Toolbar SMILES Input trigger placeholder → 모달 trigger 교체
- [ ] (b) `<MoleculeCard>` 재사용 — preview 표시 (`source="text-input"`)
- [ ] (c) `<Dialog>` + `<Input>` + `<Spinner>` + `<Tabs>` primitives 조립
- [ ] (d) `<PanelErrorBoundary slotName="modal">` 가 모달 포착 (phase-10 ModalHost 정합)
- [ ] (e) phase-09 isTextInputTarget 가드 자동 통과 검증 (C11, E8)
- [ ] (f) PeriodicTable "이 원소로 분자 시작" trigger placeholder 교체

### 10.8 phase-10 인계 닫음

- [ ] (a) `<Dialog>` Root/Content/Title/Close 사용
- [ ] (b) `<Input>` + `<Spinner>` + `<Tabs>` + `<Switch>` + `<Button>` + `<Tooltip>` + `<Separator>` + `<Label>` + `<VisuallyHidden>` 사용
- [ ] (c) Esc 닫기 + focus 복원 Radix 표준 (A1, C1)
- [ ] (d) `<PanelErrorBoundary slotName="modal">` 사용
- [ ] (e) isTextInputTarget 자연 통과 (C11)

### 10.9 phase-09 인계 정합

- [ ] (a) D10 isTextInputTarget 자동 통과 검증 (C11)
- [ ] (b) KEY_MAP 변경 없음 — 기존 키 충돌 없음 (D12)

### 10.10 phase-07 인계 닫음

- [ ] addFromSmiles / addFromInchi / addFromFormula 모든 진입점 사용
- [ ] IngestError 6 분기 표 i18n 매핑 완성 (mapIngestErrorToKey)
- [ ] previewFromText action retrofit
- [ ] AsyncState 패턴 일관 (preview 도 panel-local AsyncState)

### 10.11 라이브러리 / ESLint 가드

- [ ] 신규 라이브러리 0 — lucide-react (phase-11 확정) 만 사용
- [ ] ESLint `import/no-restricted-paths` 화이트리스트 1 항목 추가 (panels/TextInput → engine/rdkit/index)
- [ ] phase-11 의 다른 zone 변경 없음
- [ ] 번들 영향 — 초기 chunk +0 KB (panels/TextInput = lazy chunk)

### 10.12 인계 가능성

- [ ] phase-13 가 본 Phase 의 Dialog + Input + Spinner 패턴 재사용으로 JSON Import 모달 구현 가능
- [ ] phase-13 가 `addFromMolecule` 호출 경로 추가 (JSON import) — 본 Phase retrofit 변경 없이
- [ ] phase-13 가 옵션 (a) duplicate 검출의 store-internal 통합 retrofit 결정 (§11.9)
- [ ] phase-14 가 Cmd+L 등 단축키 추가 + 입력 히스토리 등 *추가* 만으로 확장 가능
- [ ] phase-15 가 a11y axe + i18n 폴리싱 *추가* 만

---

## 11. 열린 질문 (User Decision / 후속 Phase)

본 Phase 가 D-table 로 잠정 결정했으나 사용자 확정 또는 후속 Phase 결정이 필요한 항목:

1. **단축키 (D12)** — Cmd+L (브라우저 주소창과 충돌) vs Cmd+Shift+I vs Cmd+/ vs `T` (panel-focused). 본 Phase v1 = 미추가. 사용자가 자주 사용 시 Phase 14 가 키 선택 + KEY_MAP 추가.
2. **다중 SMILES 동시 입력** — "CCO.CCN" 같은 dot-notation 분리 SMILES 를 *N 개 분자로 분리* 추가. 본 Phase v1 = 단일 분자 (RDKit 가 disconnected fragments 로 처리). 사용자 요구 강도에 따라 Phase 14+.
3. **강제 추가 (duplicate 우회)** — DuplicateWarning 의 "이대로 추가" 버튼. 본 Phase v1 미지원. 동일 InChIKey 중복은 의도적이라기 어려움. 사용자 명시 요청 시 Phase 14+.
4. **입력 히스토리 / 즐겨찾기** — 최근 입력 N 개 + Star 즐겨찾기. localStorage 보관. Phase 14+.
5. **Formula 매핑 테이블 확장** — phase-03 §6.4 의 `formula-map.ts` 확장. UI 측은 v1 변경 없음.
6. **3D embed 옵션 노출** (seed / optimize=uff/mmff94 / maxIters) — "고급" 영역에 포함. 연구자 사용자 요구 시 Phase 14+.
7. **모달 vs 상시 docked 패널** — 사용 빈도가 매우 높으면 docked. 사용자 피드백 후 결정.
8. **PeriodicTable seed 의 다원자 분자 정책** — H/N/O/F/Cl/Br/I 다원자, 그 외 단일. 노블가스 (He/Ne/Ar/Kr/Xe/Rn) 도 단원자 (정상). 사용자 피드백에 따라 조정.
9. **`addFromMolecule` 의 store-internal duplicate 검출 통합** (옵션 a) — 본 Phase v1 = 모달 측 검사 (옵션 b). Phase 13 의 JSON Import 도 duplicate 직면 → phase-13 가 옵션 (a) 통합 retrofit 결정 (`addFromMolecule` 본체에 InChIKey 검출 + duplicate IngestError 반환).
10. **InChI textarea trim 정책** — multi-line 입력 시 줄바꿈 모두 제거 후 trim. 본 Phase v1 = `raw.trim()` (사용자가 의도적으로 줄바꿈 넣어도 무시). InChI 표준은 single-line 이라 안전.
11. **FormulaUnsupported 화합물 검색 자동 채움** — "C10H22" 입력 → 화합물 검색 모달 열기 시 검색 입력에 "C10H22" 자동 채움. 본 Phase v1 = 빈 입력 (사용자가 다시 입력). Phase 14+ 가 자동 채움 (uiStore.compoundSearch slice 의 query 직접 set).
12. **MoleculeCard preview 의 actions** — phase-11 의 `actions.onAddToWorkspace` 를 본 Phase 의 PreviewPane 에 활용 가능. 본 Phase v1 = MoleculeCard 의 actions 미사용 (PreviewPane 의 footer Submit 버튼이 별도). 일관성을 위해 MoleculeCard.actions 를 사용하도록 retrofit 가능 — Phase 14+ 검토.

---

## 12. 다음 Phase 로의 인계 (Hand-off)

| Phase | 본 Phase 가 인계하는 것 |
|---|---|
| **13 (Export / Import)** | (a) **`<Dialog>` + `<Input>` + 모달 패턴 재사용** — JSON Import 모달이 본 Phase 의 TextInputDialog 구조 (헤더 + 본문 + footer + AsyncState preview) 답습 가능. (b) **`addFromMolecule` 호출 경로 확장** — JSON Import 후 분자 적재가 동일 액션 호출. (c) **SDF / PDB / MOL 텍스트 paste 입력** — 본 Phase 의 4 번째 mode tab 또는 별도 Import 모달. (d) **duplicate 검출 통합 retrofit (옵션 a)** — `addFromMolecule` 본체에 InChIKey 검출 추가 → 본 Phase 모달 측 검사 (옵션 b) 제거 가능. (e) **`<PanelErrorBoundary slotName="modal">`** 패턴 재사용. (f) **`mapIngestErrorToKey`** 의 `'pubchem'` 분기 — JSON Import 가 PubChem 데이터를 포함할 수 있어 본 매핑 활용. |
| **14 (Performance Optimization)** | (a) **preview 디바운스 ms 측정** — 300 ms 가 적절한지 사용자 타이핑 패턴 분석. (b) **RDKit Worker 분리** (architecture §12 #4) — phase-03 가 Worker 로 이동 시 본 Phase 의 `previewFromText` / `addFromSmiles` 비동기 경로 정합 검증. (c) **Cmd+L 등 단축키 추가** (§11.1). (d) **입력 히스토리 / 즐겨찾기** (§11.4). (e) **Formula 매핑 테이블 확장** (§11.5). (f) **3D embed 옵션 노출** (§11.6). (g) **panels/TextInput chunk 크기 측정** — lazy import 의 실제 KB. (h) **다중 SMILES 분리 입력** (§11.2). (i) **FormulaUnsupported 자동 채움** (§11.11). (j) **MoleculeCard.actions 통합** (§11.12). |
| **15 (Testing & Polish)** | (a) **i18n 한·영 최종 폴리싱** — `panels.textInput.*` / `common.ingest.error.*` 모든 키 자연스러운 표현 + chemistry 용어 사전 (`chemistry.ko.json`) 일관성. (b) **a11y axe 자동 검증** — Dialog focus trap, Input aria-describedby (error 메시지 연결), Switch aria-disabled, Tabs aria-selected. (c) **CVD 모드 ErrorMessage 마커** — `*` 또는 패턴 보조 표시. (d) **clipboard fallback** — preview 의 SMILES copy 가 clipboard API 미지원 시 textarea fallback (phase-11 §11.14 정합). (e) **i18n 부팅 안전** — 본 Phase 패널 내부 t() 가 missing key 일 때 폴백 (key 자체 표시) 검증. (f) **PeriodicTable seed 다원자 정책** (§11.8) — 사용자 피드백에 따라 lookup table 조정. |

### 12.1 소급 수정

- **phase-07 (Stores)**:
  - `uiStore.panels` 에 `isTextInputOpen` + `textInputInitial` 필드 추가.
  - `uiStore.actions` 에 `toggleTextInput` + `setTextInputInitial` 추가.
  - `PanelKey` 유니온에 `'text-input'` 추가.
  - `moleculeStore.actions` 에 `addFromFormula` + `previewFromText` 추가.
  - `moleculeStore.selectors` 에 `mapIngestErrorToKey` + `IngestErrorMapping` 타입 추가.
  - barrel `src/stores/index.ts` 갱신.
- **phase-11 (UI Panels)**:
  - `MoleculeCardSource` 유니온에 `'text-input'` 추가 (additive).
  - `Toolbar/EditGroup.tsx` 의 `onSmiles` 본문 교체 (placeholder notify → toggleTextInput).
  - `PeriodicTable/ElementInfoSheet.tsx` 의 `onStartMolecule` 본문 교체 (placeholder notify → setTextInputInitial + toggleTextInput + togglePeriodicTable(false)).
  - `panels/registerAll.ts` 에 6 번째 `registerPanel(...)` 호출 추가.
  - `panels.json` 의 dead placeholder 키 2 개 제거 (`panels.toolbar.smilesInput.placeholder`, `panels.periodicTable.element.startMolecule.placeholder`).
  - `§6.12` 의 인라인 `withRegeneratedIds` 정의 제거 → `import { withRegeneratedIds } from '@/stores/_shared/regenerateIds'` 로 변경.
- **phase-09 (Interactions)**: 변경 없음 (D10 자동 정합).
- **phase-08 (Rendering)**: 변경 없음 (`createAtomId` / `createBondId` export 는 이미 phase-08 D1 의 `@/viewport/ids` barrel).
- **phase-03 (Chemistry Engine)**: 변경 없음 (Phase 03 의 공개 API + read-only 구독만 사용).
- **phase-01 (Foundation)**: i18n 타입 모듈 변경 없음 (panels / common namespace 모두 phase-11 / phase-06 가 이미 등재 — 본 Phase 는 키 추가만).

본 변경은 **본 Phase 구현 PR 의 첫 커밋** 으로 들어간다 (phase-08 D1 / phase-11 §12.1 retrofit 패턴과 동일).

### 12.2 architecture.md 변경

**없음**. 본 Phase 가 architecture 의 다음 약속을 *경로 닫음* 으로 이행:
- §1.3 ⑤ "SMILES / 화학식 / InChI 입력을 통한 자동 3D 구조 생성" — 본 Phase 가 충실 이행.
- §3.6 "사용자 입력 문자열은 RDKit 파싱 단계에서 검증, 파싱 실패 시 사용자에게 원인을 표시" — IngestError 분기 표 + ErrorMessage UI 가 이행.
- §3.7 "사용자 피드백은 구체적으로 제공" + 예시 "SMILES 파싱 실패 — 3번째 문자 근처 괄호 불일치" — `common.ingest.error.parse.smilesSyntaxAt` 키 + `{{at}}` 파라미터로 이행.
- §6 "Text Input Pipeline" 매핑 — 본 Phase 가 충실 이행.

---

*문서 버전: 0.1 (초안)*
*작성일: 2026-04-30*
