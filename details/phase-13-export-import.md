# Phase 13 — Export / Import

> 본 문서는 `architecture.md` §13 의 Phase 13 상세 설계서다. 코드 작성은 모든 details 문서의 검토가 끝난 뒤에만 시작한다.
>
> **선행 문서**: `architecture.md` (특히 §1.3 ⑧ 분자/세션 내보내기, §3.2 성능 예산, §3.5 접근성, §3.6 보안 / 프라이버시, §3.7 에러 처리, §3.8 Undo/Redo, §3.9 배포 타깃, §4 디렉터리 / §4.1 레이어 의존성, §11 i18n, §13 의존 Phase), `details/phase-03-chemistry-engine.md`, `details/phase-07-state-management.md`, `details/phase-08-rendering.md`, `details/phase-09-interactions.md`, `details/phase-10-ui-framework.md`, `details/phase-11-ui-panels.md`, `details/phase-12-text-input.md`. (Phase 02 / 04 / 05 / 06 은 본 Phase 가 _직접 import 하지 않으나_ 결과 타입 (`Element` / `Compound` / `PubChemError` / `Condition`) 의 출처로 인용.)

---

## 1. 목적 (Purpose)

본 Phase 는 다음을 완성한다.

1. **PNG (스크린샷) / JSON (세션) / SDF (구조) 내보내기 + JSON 가져오기 플로우** — `architecture.md` §1.3 ⑧ 의 약속 ("분자/세션 내보내기: PNG(스크린샷), JSON(세션), SDF(구조)") 의 _경로 닫음_.
2. **`panels/Io/` 본문 — App.tsx 직접 마운트 (PanelRegistry 비등록)** — `<IoDialog/>` modal Dialog 는 **PanelRegistry 에 등록하지 않고** App.tsx 가 `<ToolbarBar/>` 와 동일 패턴으로 직접 마운트 (D-IO-MOUNT 최종 결정). `registerAllPanels()` 호출 수 불변 (phase-11 5 + phase-12 1 = 6 — io 미등록). Radix Dialog `open` 이 `uiStore.isIoOpen` 구독.
3. **`src/io/*` 레이어 도입** — architecture §4 의 `src/io/` 디렉터리 + §4.1 다이어그램에 **io 노드는 이미 존재** (arch 수정 불요 — 종전 "retrofit 1줄+1노드" 주장은 거짓이므로 폐기). io 의 런타임 store 접근(`getState()` / 주입 액션)은 arch §4.1 (CD6) 이 명시 허용. 세션 스키마 _타입_ 은 io 가 아닌 `src/chemistry/session/` (CD6). React / R3F 비의존 (UI-free, 테스트 용이).
4. **phase-11 §12 #13 (a–d) 4 항목 닫음** — Toolbar 의 captureBlob 임시 헬퍼 → 정식 export 헬퍼 교체 (a), JSON / SDF Export 버튼 추가 (b), JSON Import Dialog (c), `<LoadingOverlay variant="panel">` 활용 (d).
5. **phase-12 §12 #13 (a–f) 6 항목 닫음** — Dialog + Input + Spinner 패턴 재사용 (a), addFromMolecule 호출 경로 확장 (b), SDF 텍스트 paste 입력 가능성 (c — v1 비포함, 인계 표 명시), **duplicate 검출 store-internal 통합 결정 — 옵션 Y 채택** (d), `<PanelErrorBoundary slotName="modal">` 패턴 재사용 (e), `mapIngestErrorToKey` 의 'pubchem' 분기 활용 (f).
6. **phase-09 §12 #13 (a–b) 2 항목 닫음** — export 직전 selection 보존은 viewport rendering 자동 (a), import 시 ID 충돌 → `replaceAll` 패턴 + `dispatcher.clear()` 명시 호출 (b).
7. **phase-08 captureBlob entry 활용** — `viewportApi.captureBlob({ format, dpr?, transparentBackground? })` 호출. **`format` 을 `'png'|'jpeg'|'webp'` 로 widen 하는 phase-08 retrofit 을 본 Phase 가 소유** (§12.1, Phase 14 로 미루지 않음). `dpr`/`transparentBackground` 시그니처 불변.
8. **phase-07 `MoleculeSnapshot` 동결** — phase-07 §5.1 line 461 의 책임 ("Phase 13 가 export 포맷 결정 시 동결") 닫음.
9. **`UndoableDispatcher` 인터페이스 retrofit (v0.2 정합)** — `clear(): void` + `flush(): void` 를 동결 인터페이스 + `phase07PlaceholderDispatcher` + `dispatcher` proxy 위임에 추가. phase-09 v0.2 의 `createUndoStack()`=`UndoStackController` 는 이미 보유 → 본체 구현 불요(additive only). phase-07 line 1147 명시 허용. phase-09 R9 / §12 line 1140 약속 형식적 닫음.
10. **moleculeStore retrofit** — (a) `replaceAll(molecules, opts?)` 신규 (replace 모드 진입점). (b) `applyImportedSession(session, opts?)` 신규 (import high-level 진입점, **append 모드 안에서 duplicate 검출** — 옵션 Y). (c) `selectAllMoleculeSnapshots()` selector. (d) `mapIoErrorToKey(e)` selector. **`addFromMolecule` 시그니처 무변경** (옵션 Y 의 핵심).
11. **uiStore retrofit** — `panels.isIoOpen: boolean`, `panels.ioInitialMode: IoMode | null`, `toggleIo(open?, initialMode?)`, `setIoInitialMode(mode)` 추가. PanelKey 유니온에 `'io'` 추가.
12. **i18n `panels.io.*` + `common.io.error.*` 채움** — 한·영 양쪽. phase-15 가 최종 폴리싱.

본 Phase 는 `architecture.md` §12 의 열린 질문 중 **#1 (반응 예측 한계)** / **#2 (PubChem 큐레이션)** / **#3 (ΔH)** / **#5 (WebGL2)** / **#6 (이온)** 모두 _영역 외_. **#4 (RDKit 메인 스레드)** 는 본 Phase 의 import 경로에서 phase-03 호출이 발생하지만 — 직접 사용 안 함 (toSdfBlock 만 sync 호출).

---

## 2. 범위 (Scope)

### 2.1 포함

#### 패널 본문

##### `panels/Io/`

- **`<IoDialog/>`** — modal Dialog (PanelKey `'io'`, mode='modal'). `panels.isIoOpen` 토글로 열림. 마운트 시점 `panels.ioInitialMode` 가 있으면 그 mode 로 active tab 초기화.
- 헤더: 제목 (`panels.io.title` — "내보내기 / 가져오기") + Radix Dialog Close (Esc 또는 X 버튼).
- 본문 구조 (위 → 아래):
  1. **`<IoModeTabs/>`** — `<Tabs/>` (Radix). 4 탭 = `png-export | json-export | sdf-export | json-import`. 활성 탭 = panel-local state.
  2. **각 mode 별 Pane** — 활성 tab 에 따라 분기 마운트:
     - `<PngExportPane/>` (D3 의 옵션 폼)
     - `<JsonExportPane/>` (scope 선택)
     - `<SdfExportPane/>` (scope 선택)
     - `<JsonImportPane/>` (file picker + replace/append)
  3. **`<IoErrorMessage error/>`** — 각 Pane 내부에서 Result.err 발생 시 본 컴포넌트 마운트.
  4. **푸터** — `<Button variant="ghost" onClick={close}>닫기</Button>` (Submit 버튼은 각 Pane 내부에 자체 — 모드별 라벨 다름).
- **a11y**: Radix Dialog 가 자동 focus trap + focus 복원 + `role="dialog"` + `aria-labelledby` + `aria-describedby`. Tabs 의 `role="tablist"` / `tab` / `tabpanel`.
- **키보드**: Esc → close. Tab → 컨트롤 순회. Tabs 의 ←/→ 화살표 nav (Radix 표준).

##### `<PngExportPane/>`

- 옵션 폼 (D3):
  - **Format**: `<Tabs value={format} onValueChange/>` — `png` / `jpeg` / `webp`.
  - **DPR**: `<Slider value={[dpr]} min={1} max={4} step={1}/>` (1x / 2x / 3x / 4x). 또는 `<Tabs/>` 단순 4 옵션.
  - **Transparent background**: `<Switch checked={transparentBackground} onCheckedChange/>`. format='jpeg' 시 disabled (JPEG 알파 미지원) + tooltip 안내.
- "내보내기" 버튼 → `exportPng({ apiRef, options })` 호출 → Blob → `triggerDownload(blob, filename)` → 성공 toast + close (또는 모달 유지하고 toast 만 — D-PNG-CLOSE-AFTER 결정 = 닫기). 실패 시 `<IoErrorMessage>` 표시.

##### `<JsonExportPane/>`

- **Scope**: `<Tabs value={scope} onValueChange/>` — `active`(활성 분자만) / `all`(모든 분자). active 가 null 이면 'active' tab disabled.
- **포함 항목 안내** (정보 영역, 입력 아님): "이 export 에 포함되는 항목" 리스트 — 분자 N 개, 활성 분자, 조건(T/P/pH), selection, viewport 옵션. 비포함 항목 = 사용자 환경 설정 (theme, locale, units), reaction 결과 (v1 비포함). 사용자에게 명확 안내.
- "내보내기" 버튼 → `exportJson({ scope })` → Blob → triggerDownload + toast + close.

##### `<SdfExportPane/>`

- **Scope**: `<Tabs/>` — `active` / `all` (D6 의 multi-record).
- "내보내기" 버튼 → `exportSdf({ scope })` → Blob (`chemical/x-mdl-sdfile`) → triggerDownload + toast + close.

##### `<JsonImportPane/>`

- **File picker**: `<input type="file" accept=".json"/>` (native, D-FILE-INPUT). `aria-label` (i18n).
- **Mode toggle**: `<Switch checked={mode === 'replace'}/>` 또는 `<Tabs/>` — `replace` (default) / `append`. 라벨에 동작 설명 (replace = "기존 분자 모두 제거 후 적재", append = "기존 분자 유지하면서 추가 — duplicate 자동 skip").
- "가져오기" 버튼 (file 선택 후 활성화) → `importJson({ file, mode })`:
  1. file.text() → JSON.parse → `validateSessionFile(json)` → Result<SessionFile, ImportError>.
  2. success → `applyImportedSession(session, { mode })` → Result<{ imported, skipped }, ImportError>.
  3. ImportProgress (진행 표시) 마운트 (`<LoadingOverlay variant="panel">`).
  4. 결과:
     - Result.ok → toast (`panels.io.import.success` 또는 `partial` — skipped > 0 시).
     - Result.err.kind === 'PartiallyFailed' → toast (`panels.io.import.partial`) + 카운트 표시.
     - 다른 error → `<IoErrorMessage>` 표시 (모달 유지, 사용자가 다시 시도).
  5. 성공 시 모달 close + dispatcher.clear() 호출 (D8).

##### `<ImportProgress/>`

- `<LoadingOverlay variant="panel" visible={isImporting}/>` + 진행 텍스트 ("분자 N/M 적재 중…"). N/M 카운트는 panel-local state — applyImportedSession 가 progress callback 미제공이면 단순 indeterminate spinner (v1).

##### `<IoErrorMessage error={ExportError | ImportError}/>`

- `mapIoErrorToKey(error)` → `{ key, params?, action? }`:
  - 메시지 = `t(key, params)`.
  - `action === 'retry'` → "다시 시도" 버튼 (호출자가 onRetry 콜백 prop 으로 처리).
  - `action === 'pick-file-again'` → "파일 다시 선택" 버튼 (input.click()).
  - `action === 'reload-page'` → "페이지 새로고침" 버튼.
- 외양: red 배경 카드 (CVD 모드 시 `*` 마커 + 라벨 강제 — phase-15 정합).

#### 부팅 진입점 retrofit

##### `panels/registerAll.ts` — **변경 없음** (D-IO-MOUNT)

- `<IoDialog/>` 는 PanelRegistry 에 **등록하지 않는다**. App.tsx 가 `<ToolbarBar/>` 처럼 직접 마운트하고 Radix Dialog `open` 이 `uiStore.isIoOpen` 을 구독한다. `registerAllPanels()` 호출 수 불변(6).

##### `panels/index.ts` barrel

- `IoDialog` default export 를 barrel 로 노출 (App.tsx 가 직접 import — PanelRegistry.load 미경유). `<ToolbarBar/>` 와 동일 패턴.

#### Trigger retrofit

##### `panels/Toolbar/ViewportGroup.tsx` (phase-11 retrofit)

- 기존 (phase-11 §6.6 line 1414–1424 의 임시 헬퍼):
  ```ts
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
- **교체 (D-PANEL-INTEGRATION)**:
  - **Capture PNG 버튼 제거**.
  - **Export … dropdown 추가** (`<Popover>` + `<IconButton><Download/></IconButton>` + 메뉴 4 옵션 = PNG / JSON / SDF). 각 옵션 클릭 → `setIoInitialMode(mode)` + `toggleIo(true)`.
  - **Import … 버튼 추가** (`<IconButton><Upload/></IconButton>`) → `setIoInitialMode('json-import') + toggleIo(true)`.
  - **임시 download 헬퍼 코드 제거**.
- 최종 ViewportGroup 슬롯 = Frame Active / Frame All / Reset Camera / Export dropdown / Import = **5 슬롯** (기존 4 → 5, 1 슬롯 증가).
- Toolbar 56 px 적합성 재검증: 14 → 15 슬롯 (전체) → 1280 px viewport 가용 폭 안에서 안전 (phase-11 §11 #1 정합).

#### Store retrofit

##### moleculeStore (phase-07 retrofit)

**액션**:

- `addFromMolecule` **시그니처 무변경** (옵션 Y — phase-11 §4.6 의 `(m: Molecule): MoleculeId` 그대로).
- `replaceAll(molecules: ReadonlyArray<Molecule>, opts?: { activeMoleculeId?: MoleculeId | null }): void` — 신규. `clear()` + 모든 분자 batch 추가 (단일 entry undoable, kind=`'molecule.import-replace'`). activeMoleculeId 가 있으면 setActive 자동.
- `applyImportedSession(session: SessionFile, opts?: { mode: 'replace' | 'append' }): Promise<Result<{ imported: number; skipped: number }, ImportError>>` — 신규. JSON Import 의 high-level 진입점. **append 모드 안에서 duplicate 검출** (D-DUPLICATE-INTEGRATION 옵션 Y).

**selector**:

- `selectMoleculeSnapshot(id)` — 시그니처 보존 (phase-07 §5.1 line 461 의 동결 책임 본 Phase 가 이행).
- `selectAllMoleculeSnapshots(): ReadonlyArray<MoleculeSnapshot>` — 신규. JSON export 진입점.
- `mapIoErrorToKey(e: ExportError | ImportError): IoErrorMapping` — 신규.

##### uiStore (phase-07 retrofit)

**state 추가**:

```ts
readonly panels: {
  // ... 기존 ...
  readonly isIoOpen: boolean;                    // ⟵ 신규
  readonly ioInitialMode: IoMode | null;         // ⟵ 신규
};
```

**PanelKey 확장**: 기존 7 개 (`'periodic-table'`/`'compound-browser'`/`'conditions'`/`'molecule-info'`/`'reaction-result'`/`'toolbar'`/`'text-input'`) + `'io'` = 8 개.

**액션 추가**:

- `toggleIo(open?: boolean, initialMode?: IoMode): void` — open 미지정 시 toggle. initialMode 가 있으면 ioInitialMode 도 갱신.
- `setIoInitialMode(mode: IoMode | null): void` — seed 슬롯 갱신.

##### `src/stores/_shared/undoable.ts` retrofit (phase-07 §6.4 + phase-09 §4.2 소급)

```ts
// src/stores/_shared/undoable.ts (phase-13 retrofit)

export interface UndoableDispatcher {
  dispatchUndoable<T>(meta: UndoableMeta & { kind: UndoableActionKind }, mutator: () => T): T;
  undo(): void;
  redo(): void;
  readonly canUndo: () => boolean;
  readonly canRedo: () => boolean;
  // ⟵ phase-13 추가:
  /** undo + redo 스택 모두 비우기 + pendingMerge 취소. JSON Import 후 새 baseline 설정. */
  clear(): void;
  /** 200 ms 그룹 합치기 윈도우 강제 종료 (pending merge 즉시 dispatch). HMR / Viewport unmount 안전 (phase-09 R9). */
  flush(): void;
}

// phase-07 placeholder 도 no-op 추가:
export const phase07PlaceholderDispatcher: UndoableDispatcher = {
  // ... 기존 ...
  clear: () => logger.debug('clear() called — Phase 09 가 인수'), // ⟵ 신규
  flush: () => logger.debug('flush() called — Phase 09 가 인수'), // ⟵ 신규
};

// (v0.2 정합) swappable `dispatcher` proxy 의 위임 목록에도 추가 (현재 5메서드만
// 위임 — 미추가 시 `import { dispatcher }; dispatcher.clear()` 가 undefined):
export const dispatcher: UndoableDispatcher = {
  // ... 기존 5개 위임 ...
  clear: () => current.clear(), // ⟵ 신규 (current = createUndoStack 결과 = UndoStackController)
  flush: () => current.flush(), // ⟵ 신규
};
```

**(v0.2 정합)** phase-09 v0.2 의 `createUndoStack()` 반환 `UndoStackController` 는 **이미 `clear()`/`flush()` 보유** (소급 retrofit 불요):

- `clear()`: 내부 zustand-vanilla 스택을 `DEFAULT_UNDO_STACK` 으로 리셋 (past/future/pending 비움).
- `flush()`: `flushPending()` — pending 그룹을 past 로 즉시 확정.

→ 본 Phase retrofit 은 인터페이스 + placeholder + `dispatcher` proxy 위임 (위 3곳) 에만 additive. `current` 의 실 구현은 phase-09 v0.2 가 제공.

#### MoleculeCard 변경 없음

본 Phase 는 export preview 카드 _미사용_ (export 는 옵션 폼 + Submit 만, 미리보기 불필요). phase-12 의 `MoleculeCardSource` 유니온 (`'compound' | 'reaction-product' | 'text-input'`) 변경 없음.

#### KEY_MAP 변경 없음 (phase-09)

본 Phase 는 KEY_MAP 에 신규 binding 추가 안 함. Cmd+S / Cmd+O 등은 v1 미포함 (브라우저 기본 단축키와 충돌, Phase 14+ 결정).

#### i18n 변경

- **`src/i18n/resources/{ko,en}/panels.json`** retrofit: `panels.io.*` 키 트리 추가 (§5.6).
- **`src/i18n/resources/{ko,en}/common.json`** retrofit: `common.io.error.*` 분기 추가 (§5.6).

### 2.2 비포함

| 항목                                                                                   | 인계 Phase                                        |
| -------------------------------------------------------------------------------------- | ------------------------------------------------- |
| SDF Import (phase-12 의 4 번째 mode 또는 phase-13 의 4 번째 tab)                       | 14+                                               |
| PDB / MOL / XYZ Import / Export                                                        | 14+                                               |
| drag-and-drop file input                                                               | 14+                                               |
| 사용자 명시 파일명 입력                                                                | 14+                                               |
| 클라우드 / URL 공유                                                                    | **비목표** (architecture §3.9 backend-less 정합)  |
| PNG annotation 시각 강조 (text label, ruler 등 — selection 색 highlight 외)            | 14+                                               |
| 다중 파일 zip export                                                                   | 14+                                               |
| reactionStore.run / lastResult 직렬화                                                  | 14+                                               |
| settingsStore export (theme/locale/units)                                              | **비목표** (사용자 환경 설정은 session 별이 아님) |
| PubChem cid-only import (재호출 — 분자식 없이 cid 만 저장 후 import 시 PubChem 재호출) | v2 후보                                           |
| schemaVersion v2 → v1 backward compatibility migration                                 | 본 Phase 미정의 (v1 동결만)                       |
| zod / JSON Schema 라이브러리 도입                                                      | 14+ (schema 가 복잡해지면)                        |
| Cmd+S / Cmd+O 단축키                                                                   | 14+                                               |
| a11y axe 자동 검증 + i18n 한·영 최종 폴리싱                                            | 15                                                |

### 2.3 명시적 비결정 / 후속 결정

| 영역                                                    | 사유                                              | 결정 시점     |
| ------------------------------------------------------- | ------------------------------------------------- | ------------- |
| SDF Import 위치 (phase-12 vs phase-13 4 번째 tab)       | 사용자 요구 강도                                  | 사용자 피드백 |
| reactionStore.lastResult 직렬화 정책                    | session 별 의미 모호 (반응 결과 = 일회성 vs 영구) | 14+           |
| schemaVersion v2 도입                                   | schema 변경 트리거 (필드 추가 등)                 | 미래          |
| PNG annotation 의 시각 강조 항목 (text/ruler/legend 등) | 연구자 사용자 요구                                | 14+           |
| zod 도입 vs hand-written 검증 유지                      | schema 복잡도 임계점                              | 14+           |
| Capture PNG 단축키 (Cmd+P 충돌)                         | 키 선택 + 충돌 검토                               | 14+           |

---

## 3. 의존성 (Dependencies)

### 3.1 선행 Phase (직접 import / retrofit 대상)

| Phase                     | 본 Phase 가 사용하는 것                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **03 (Chemistry Engine)** | `toSdfBlock(backend: RdkitBackend, mol: Molecule): Result<string, RdkitNotReady>` (`@/engine/rdkit/canonical`, phase-03 §5.3 — sync, RDKit 초기화 필요·미초기화 시 `RdkitNotReady` 반환, throw 아님) + `createMainThreadRdkitBackend(getRdkit)` (phase-03 §5.1/§6.8). **본 Phase 의 `src/io/sdf/exportSdf.ts` 가 직접 import** — io 레이어가 engine 호출 (arch §4.1 CD6 — io 는 engine 타입·순수 함수 직접 참조 허용). 다른 phase-03 함수 (parseSdfBlock 등) 는 v1 미사용. |
| **07 (Stores)**           | 본 Phase 의 _주된 의존_. **stores 만 통과해 도메인 데이터에 접근** (P1 정합).                                                                                                                                                                                                                                                                                                                                                                                              |

- **moleculeStore selector**: `selectActiveMolecule`, `selectMoleculeIds`, `selectMoleculeById`, `selectMoleculeSnapshot` (시그니처 동결), `selectAllMoleculeSnapshots` (retrofit), `mapIoErrorToKey` (retrofit).
- **moleculeStore action**: `addFromMolecule` (시그니처 무변경 — 옵션 Y), `clear`, `setActive`, `replaceAll` (retrofit), `applyImportedSession` (retrofit).
- **reactionStore selector**: `selectCondition`. action: `setCondition` (import 시 condition 복원).
- **uiStore selector**: `selectSelection`, `selectIsIoOpen` (retrofit), `selectIoInitialMode` (retrofit), `selectNotifications`. action: `setSelection`, `toggleIo` (retrofit), `setIoInitialMode` (retrofit), `notify`, `dismissNotification`.
- **settingsStore selector**: `selectLocale`, `selectIsCvdOn`. (settingsStore 자체는 export 영역 외.)
- **공용 타입**: `IngestError`, `AsyncState<T,E>`, `MoleculeId`, `Notification`, `PanelKey` (확장), `Condition` (phase-06 의 타입 phase-07 가 re-export).
- **UndoableDispatcher 인터페이스 retrofit**: `clear()` + `flush()` 추가 (phase-07 §6.4 + phase-09 §4.2 소급). |
  | **08 (Rendering)** | `ViewportApi.captureBlob({ format, dpr?, transparentBackground? }): Promise<Blob>`. App.tsx 가 `<AppLayout viewportApiRef>` 로 ref 노출 — 본 Phase 의 `<IoDialog>` 가 동일 ref 참조 (phase-11 의 Toolbar `apiRef` 와 동일 ref). 다른 ViewportApi 메서드 (frameActive/frameAll/resetCamera/getRenderer) 는 본 Phase 미사용. |
  | **09 (Interactions)** | **(v0.2)** `@/stores` 배럴의 swappable `dispatcher` proxy (phase-07 §659–664 / phase-09 v0.2 가 `createUndoStack()`=`UndoStackController` 로 swap, §6.14) 로 접근. `dispatcher.clear()` 호출 (D8) — JSON Import 후 새 baseline. `dispatcher.flush()` 는 본 Phase 미호출 (HMR 안전 책임은 phase-09). 초안의 `getStoreUndoableDispatcher()` 접근자 폐기 — 식별자 `dispatcher`. selection slice 그대로 보존 — export 시 PNG 캡처가 자동 포함, JSON 에 _index 기반_ 형식 직렬화. |
  | **10 (UI Framework)** | 13 primitives 일부 — `Dialog` (Root/Trigger/Content/Title/Description/Close), `Tabs` (Root/List/Trigger/Content), `Button`, `IconButton`, `Switch`, `Slider`, `Tooltip`, `Spinner`, `Label`, `Separator`, `Popover` (Toolbar dropdown), `VisuallyHidden`. **`<Input>` 미사용** (file input 은 native HTML). `<LoadingOverlay variant="panel">` (모달 안 진행 표시), `<PanelErrorBoundary panelKey="io" slotName="modal">`, `registerPanel`, `<ModalHost>`. **신규 primitive 0**. |
  | **11 (UI Panels)** | Toolbar `<ViewportGroup/>` retrofit (Capture PNG 임시 헬퍼 제거 + Export dropdown + Import 버튼). `<MoleculeCard/>` 변경 없음 (export 미리보기 미사용). `lucide-react` 의 `Download`, `Upload`, `Image`, `FileText`, `Atom`, `AlertCircle`, `RefreshCw`, `X` 아이콘. |
  | **12 (Text Input Pipeline)** | `<TextInputDialog/>` 의 IoDialog 구조 패턴 답습 (Tabs / Footer / Submit / ErrorMessage). `mapIngestErrorToKey` 의 `'pubchem'` 분기 — JSON Import 가 PubChem origin 분자를 포함할 때 활용 (phase-12 §6.11 매핑 정합). phase-12 의 모달 측 duplicate 검출 (옵션 b) 보존 — 본 Phase 의 옵션 Y 와 _공존_ (TextInput Submit 경로 = 옵션 b, JSON Import 경로 = 옵션 Y). |

본 Phase 는 `services/*` _내부_ 를 직접 import 하지 않는다 (PubChem 캐시 / 응답 raw 는 export 비포함 — D5 정합).

### 3.2 외부 라이브러리 (architecture §66 신규 도입 절차)

본 Phase 는 phase-11 가 §3.2 에 확정한 `lucide-react` 만 사용. **신규 라이브러리 0**.

| 라이브러리                     | 버전  | 용도                                                                                                                | gzip                                                                       | 대안 거절 |
| ------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------- |
| `lucide-react` (phase-11 확정) | ^0.4x | 모달 / Toolbar dropdown 아이콘 (`Download`, `Upload`, `Image`, `FileText`, `Atom`, `AlertCircle`, `RefreshCw`, `X`) | tree-shake 사용 ~8 개 = ~3–5 KB 추가 (phase-11 / 12 의 ~22 개와 일부 중복) | —         |

**zod 거절 근거** (D-SCHEMA-VALIDATION):

- `zod` ~12 KB gzip — 본 Phase 가치 대비 비용 큼.
- MoleculeSnapshot 의 필드 단순 (atoms/bonds/charges/positions) → hand-written 검증 ~80 줄 충분.
- architecture §66 의 신규 라이브러리 도입 절차 회피.
- Phase 14 가 schema 가 복잡해지면 zod 재검토.

**번들 예산 정합** (`architecture.md` §3.2 의 `< 500 KB gzip`):

- 본 Phase 의 `panels/Io/*` = lazy chunk (`registerPanel.load` dynamic import).
- `src/io/*` 는 `panels/Io/*` 가 호출하므로 _같은 lazy chunk_ 에 들어감 (Vite 자동 분할).
- 초기 chunk 영향 = **0**.
- 본 Phase 의 추가 chunk 추정 ~8–12 KB gzip (Phase 14 가 실측 검증).

### 3.3 결정 사항

#### 선결정 사항 (P-table — 선행 Phase / architecture 가 이미 동결)

| ID      | 내용                                                                                                                                                                                                                 | 출처                                          |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **P1**  | 레이어 가드 — `panels/*` 는 정적 데이터 + 표시 전용 함수만 직접 import. 본 Phase 는 _별도 peer 레이어_ `src/io/*` 도입 — panels (Io) → io → engine + stores 의 새 의존 경로. P1 위배 아님 (panels/Io 가 io 만 호출). | architecture §4.1 / phase-11 P1 / phase-12 P1 |
| **P2**  | PanelRegistry 부팅 1 회 채워진 뒤 변하지 않는다. 본 Phase 는 `'io'` 를 **등록하지 않는다** (D-IO-MOUNT — App.tsx 직접 마운트). registerAllPanels 호출 수 불변 = phase-11 5 + phase-12 1 = 6.                         | phase-10 §4.1 / phase-11 D-PANELS-INDEX       |
| **P3**  | PanelKey ↔ mode 매핑. 본 Phase 의 `'io'` = **modal**.                                                                                                                                                                | phase-07 §4.4 / phase-10 D14                  |
| **P4**  | KEY_MAP 변경 시 phase-09 의 기존 키 충돌 검사 의무. 본 Phase 는 KEY_MAP 변경 없음.                                                                                                                                   | phase-09 §4.5                                 |
| **P5**  | 도메인 실패는 Result 패턴으로 흘러옴. 본 Phase 의 `<IoErrorMessage>` 는 _Result.error_ 만 표시. `<PanelErrorBoundary>` 는 _런타임 예외_ 만 포착.                                                                     | architecture §3.7 / phase-10 P5               |
| **P6**  | i18n 부팅 실패 안전 — `<AppErrorBoundary>` fallback 정적 영문. 본 Phase 패널은 정상 부팅 가정.                                                                                                                       | phase-10 D15                                  |
| **P7**  | Result 패턴 — 모든 io entry function (exportPng/exportJson/exportSdf/importJson/validateSessionFile) 가 `Promise<Result<T, E>>` 또는 `Result<T, E>` 반환. throw 금지.                                                | architecture §3.7                             |
| **P8**  | `mapReactionErrorToKey` (phase-07) / `mapIngestErrorToKey` (phase-12) 패턴 = `mapIoErrorToKey` 의 mirror.                                                                                                            | phase-07 §5.2 / phase-12 §6.11                |
| **P9**  | Radix Dialog 의 focus trap + Esc 자동 닫기 + trigger 복원. 본 Phase 는 _추가 키보드 핸들링 없음_.                                                                                                                    | phase-10 §6.x                                 |
| **P10** | 토스트 큐 길이 상한 50 — phase-07 R7. 본 Phase 의 export/import 성공/실패 toast 호출은 단발성 (한 번에 1 회).                                                                                                        | phase-07 R7                                   |
| **P11** | `panels.active` ↔ `is*Open` 두 슬롯. 본 Phase 의 `'io'` modal 은 docked 슬롯과 동시 표시 가능.                                                                                                                       | phase-07 §4.4                                 |
| **P12** | 사용자 데이터 로컬-only (architecture §3.6). PubChem 캐시 / raw response 는 export 비포함. cid 메타정보만 보존 (D5).                                                                                                 | architecture §3.6 / §3.9                      |

#### 본 Phase 결정 (D-table)

| ID                          | 질문                                        | 확정 답                                                                                                                                                                                                           | 본문 영향                                                                                                                |
| --------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------- | --------------------------------------- | ---------- |
| **D1**                      | PanelKey 명명                               | **`'io'`** (포괄). 단일 modal + 4 mode tabs. `'export'` / `'import'` 분리는 PanelRegistry 비대화.                                                                                                                 | §2.1, §6.10                                                                                                              |
| **D2**                      | IoDialog 의 mode 분리 vs 단일 모달 + Tabs   | **단일 모달 + 4 Tabs** (`png-export                                                                                                                                                                               | json-export                                                                                                              | sdf-export        | json-import`). SDF import 는 v1 비포함. | §2.1, §6.2 |
| **D3**                      | PNG export 옵션                             | format (png/jpeg/webp) + DPR (1x/2x/3x/4x) + transparent (boolean). default = `{ format: 'png', dpr: 2, transparentBackground: false }`. format='jpeg' 시 transparent disabled.                                   | §2.1, §6.3                                                                                                               |
| **D4**                      | JSON 세션 schema                            | `SessionFile` v1 동결 (§4.4). MoleculeSnapshot, Condition, selection (index 기반), viewport 옵션 포함. settings / reactionStore 비포함.                                                                           | §4.4                                                                                                                     |
| **D5**                      | PubChem cache 누출 방지                     | MoleculeSnapshot.origin = `{ kind: 'user-input' \| 'pubchem'; cid?: number }` 메타만. atoms/bonds 는 항상 포함 (재호출 없이 self-contained). raw response / IndexedDB cache 미포함.                               | §4.3                                                                                                                     |
| **D6**                      | SDF export multi-record vs 분자별 단일 file | **multi-record 단일 .sdf** (RFC 표준 `$$$$\n` separator).                                                                                                                                                         | §6.11                                                                                                                    |
| **D7**                      | JSON Import 시 기존 분자 처리               | `'replace'                                                                                                                                                                                                        | 'append'` Switch (default = 'replace'). replace = clear + 모두 적재. append = 기존 유지 + duplicate skip. prompt 미지원. | §2.1, §6.6, §6.14 |
| **D8**                      | dispatcher.clear() 호출 시점                | JSON Import 의 분자 적재 _후_ (replace + append 양쪽). import = 새 baseline.                                                                                                                                      | §6.14                                                                                                                    |
| **D-DUPLICATE-INTEGRATION** | duplicate 검출 통합 옵션 (a/b/Y)            | **옵션 Y 채택** — duplicate 검출을 `applyImportedSession` 안에서 (append 모드만). `addFromMolecule` 시그니처 _무변경_. phase-12 §11.9 인계 충족.                                                                  | §6.14, §6.17                                                                                                             |
| **D-EXPORT-ERROR**          | ExportError / ImportError 분기 set          | (§4.5 표). PartiallyFailed 는 사전 검증 단계 (G8) — replace 모드의 trans. 보장.                                                                                                                                   | §4.5                                                                                                                     |
| **D-IO-MAPPER**             | mapIoErrorToKey 위치                        | `src/stores/moleculeStore.selectors.ts` (phase-07 의 mapReactionErrorToKey 위치 정합).                                                                                                                            | §6.13                                                                                                                    |
| **D-FILE-INPUT**            | file picker                                 | native `<input type="file" accept=".json">`. drag-and-drop v1 비포함.                                                                                                                                             | §2.1, §6.6                                                                                                               |
| **D-SCHEMA-VALIDATION**     | JSON schema 검증                            | hand-written `validateSessionFile`. zod 미도입 (§3.2 정합).                                                                                                                                                       | §6.13                                                                                                                    |
| **D-PANEL-INTEGRATION**     | Toolbar 통합                                | Capture PNG 버튼 제거 + Export dropdown (4 옵션) + Import 버튼 = 슬롯 +1.                                                                                                                                         | §6.16                                                                                                                    |
| **D-FILENAME**              | 다운로드 파일명                             | `chemistry-{ISO-timestamp}.{ext}`. ISO 형식 = `YYYY-MM-DD-HHmmss`. 사용자 명시 입력 v1 미지원.                                                                                                                    | §6.15                                                                                                                    |
| **D-LOADING-OVERLAY**       | LoadingOverlay variant                      | 모달 안 = `variant="panel"`. variant="app" 미사용 (모달 자체가 차단 UI).                                                                                                                                          | §6.7                                                                                                                     |
| **D-PNG-ANNOTATION**        | PNG selection 보존                          | viewport selection 색 highlighting 자동 포함 (별도 annotation 없음).                                                                                                                                              | §6.19                                                                                                                    |
| **D-IO-PANEL-KEY**          | PanelKey                                    | `'io'`. mode='modal'. `panels.isIoOpen` + `toggleIo(open?, initialMode?)`.                                                                                                                                        | §4.7                                                                                                                     |
| **D-IO-MODE-INITIAL**       | 모달 진입 시 default mode                   | Toolbar Export dropdown 의 옵션 클릭 시 setIoInitialMode + toggleIo. mode 별 라우팅.                                                                                                                              | §6.16                                                                                                                    |
| **D-DEAD-PLACEHOLDER**      | 임시 captureBlob 헬퍼 정리                  | phase-11 §6.6 의 `onCapture` 본문 제거 + Capture PNG 버튼 자체 제거 (Export dropdown 으로 통합).                                                                                                                  | §6.16, §10.5                                                                                                             |
| **D-LOG-RUNTIME**           | 패널 내부 런타임 예외                       | `<PanelErrorBoundary panelKey="io" slotName="modal">` 자동. 도메인 실패 (Result.error) 는 IoErrorMessage 표시 — logger 호출 안 함. 큰 export 의 `logger.info('export.png.started', {...})` 만 본 Phase 자체 호출. | §6 전반                                                                                                                  |
| **D-PNG-CLOSE-AFTER**       | export 성공 후 모달 닫기 vs 유지            | **닫기**. 사용자 의도 = 다운로드 후 작업 복귀. 실패 시 _유지_ (다시 시도 가능).                                                                                                                                   | §6.3                                                                                                                     |
| **D-IMPORT-MODE-DEFAULT**   | JSON Import default mode                    | `'replace'` (사용자가 새 세션 기대 — append 는 명시 토글).                                                                                                                                                        | §2.1                                                                                                                     |
| **D-SELECTION-FORMAT**      | SessionFile.selection 형식                  | **index 기반** = `{ atomIds: [{ moleculeIndex, atomIndex }], bondIds: [{ moleculeIndex, bondIndex }] }`. uiStore.selection 의 viewport ID 문자열 형식과 분리 (advisor #4 정합).                                   | §4.4, §6.14                                                                                                              |

---

## 4. 데이터 모델 / 타입

본 Phase 는 새 타입 다수 정의. 핵심 = SessionFile (JSON schema) + MoleculeSnapshot (phase-07 line 461 동결).

### 4.1 IoMode (`src/io/types.ts` 또는 `src/panels/Io/types.ts`)

```ts
export type IoMode = 'png-export' | 'json-export' | 'sdf-export' | 'json-import';
```

### 4.2 PngExportOptions (`src/io/png/types.ts`)

```ts
export interface PngExportOptions {
  readonly format: 'png' | 'jpeg' | 'webp';
  readonly dpr: number; // 1, 2, 3, 4
  readonly transparentBackground: boolean; // format='jpeg' 시 false 강제
}

export const DEFAULT_PNG_OPTIONS: PngExportOptions = {
  format: 'png',
  dpr: 2,
  transparentBackground: false,
};
```

phase-08 `CaptureBlobOptions` 와 1:1 매핑. **본 Phase 가 phase-08 `CaptureBlobOptions.format` 을 `'png'|'jpeg'|'webp'` 로 widen (§12.1 retrofit 소유)** 하므로 타입 정합. exportPng 가 옵션 → captureBlob 호출.

### 4.3 MoleculeSnapshot (`src/chemistry/session/types.ts`) — **본 Phase 동결, CD6 위치**

phase-07 §5.1 line 461 의 책임 ("Phase 13 가 export 포맷 결정 시 동결") 닫음. **세션 스키마 타입은 `src/io/` 가 아니라 `src/chemistry/session/types.ts` 에 정의** (CD6): `moleculeStore` (Phase 07) 가 `selectMoleculeSnapshot`/`applyImportedSession` 시그니처에 이 타입을 쓰므로, io 에 두면 `stores → io` 역행이 된다. chemistry 계층에 두어 io·stores 가 **모두 하향 import**. **AtomSnapshot/BondSnapshot 은 stable ID 미보유** (JSON 크기 ↓, ID 형식 호환성 자동 해결, selection 매핑 단순화). 직렬화 원자/결합 형태는 Phase 01 `SerializedAtom`/`SerializedBond` (`@/chemistry/compounds/ids`, CD1) 와 **필드명 일치** (`aAtomIndex`/`bAtomIndex`) — Phase 14 `LineBonds` 도 동일 필드를 읽으므로 round-trip·렌더 불일치 없음.

```ts
// src/chemistry/session/types.ts
import type { MoleculeId } from '@/chemistry/compounds/ids';
import type { SerializedAtom } from '@/chemistry/compounds/ids';
import type { StereoAnnotations } from '@/engine/rdkit/types';

export type AtomSnapshot = SerializedAtom & { readonly isotope?: number | null };

export interface BondSnapshot {
  // id 미보유 — bond 식별 = bonds[] array index. 필드명은 Phase 01 SerializedBond 와 동일.
  readonly aAtomIndex: number; // atoms[] 인덱스
  readonly bAtomIndex: number;
  readonly order: 1 | 2 | 3 | 'aromatic'; // BondOrder (CD2)
}

export interface MoleculeSnapshot {
  /** 분자 ID 보존 — selection 매핑 + activeMoleculeId 참조에 사용. */
  readonly id: MoleculeId;
  readonly canonicalSmiles: string;
  readonly inchi: string | null;
  readonly inchiKey: string | null;
  readonly totalCharge: number;
  readonly spinMultiplicity: number;
  readonly atoms: ReadonlyArray<AtomSnapshot>;
  readonly bonds: ReadonlyArray<BondSnapshot>;
  readonly stereo: StereoAnnotations; // phase-03 §4.1 구조 그대로
  readonly origin: MoleculeOrigin; // PubChem 누출 방지 (D5)
}

export type MoleculeOrigin =
  | { readonly kind: 'user-input' }
  | { readonly kind: 'pubchem'; readonly cid: number; readonly name?: string };
```

**재구성 헬퍼** (`src/chemistry/session/snapshot.ts` — CD6: stores 의 `selectMoleculeSnapshot` 도 `toSnapshot` 을 호출하므로 함수도 chemistry 계층에 둔다. 순수 변환 — chemistry 타입 + `createAtomId`/`createBondId` 만 의존, io/stores 비의존):

```ts
import { createAtomId, createBondId } from '@/chemistry/compounds/ids'; // CD1
import { withRegeneratedIds } from '@/chemistry/compounds/regenerateIds'; // CD1·CD6 (chemistry 계층 — stores 아님; 순수 ID 재발급)

/**
 * MoleculeSnapshot → Molecule. atom/bond ID 자동 재발급 (외부 파일 ID 신뢰 불가).
 * molecule.id 는 인자로 받은 newId 또는 snapshot.id (replace 모드는 snapshot.id 보존,
 * append 모드는 신규 — applyImportedSession 안에서 결정).
 */
export function fromSnapshot(s: MoleculeSnapshot, newMoleculeId?: MoleculeId): Molecule;

/** Molecule → MoleculeSnapshot. atom/bond ID 직렬화에서 *제거*. */
export function toSnapshot(m: Molecule): MoleculeSnapshot;
```

### 4.4 SessionFile (`src/chemistry/session/types.ts`, CD6)

`SessionFile` / `SerializedSelection` 도 `src/chemistry/session/types.ts` (CD6) 에 정의 (io 아님 — stores 가 import 하므로 chemistry 계층).

```ts
// src/chemistry/session/types.ts (continued)
import type { Condition } from '@/chemistry/reactions/types';

export interface SessionFile {
  readonly schemaVersion: 1; // 정수 — 본 Phase 동결
  readonly app: { readonly name: 'chemistry-platform'; readonly version: string }; // build-time injected
  readonly exportedAt: string; // ISO-8601 (e.g., "2026-04-30T12:34:56.789Z")
  readonly molecules: ReadonlyArray<MoleculeSnapshot>;
  readonly activeMoleculeId: MoleculeId | null;
  readonly condition: Condition; // phase-06 의 Condition (T/P/pH)
  readonly selection: SerializedSelection;
  readonly viewport: {
    readonly showAtomLabels: boolean;
    readonly backgroundOverride: 'theme' | 'light' | 'dark';
  };
  // 비포함:
  // - settingsStore (theme/locale/units/cvdMode) — 사용자 환경 설정, session 별이 아님
  // - reactionStore.run / lastResult — v1 비포함 (Phase 14+)
  // - PubChem 캐시 / IndexedDB raw response (D5)
}

/**
 * SerializedSelection — uiStore.selection 의 viewport ID 문자열 형식 (`${moleculeId}::a:${atomId}`)
 * 과 분리. atom/bond ID 가 import 시 재발급되므로 *index 기반* 형식으로 직렬화.
 */
export interface SerializedSelection {
  readonly atomIds: ReadonlyArray<{ readonly moleculeIndex: number; readonly atomIndex: number }>;
  readonly bondIds: ReadonlyArray<{ readonly moleculeIndex: number; readonly bondIndex: number }>;
}
```

`molecules` 는 _array_ — `moleculeIndex` 가 selection 의 참조 keys.

### 4.5 ExportError / ImportError (`src/io/_shared/errors.ts`)

```ts
export type ExportError =
  | { readonly kind: 'CanvasNotReady' } // viewportApi.current === null
  | { readonly kind: 'CaptureFailed'; readonly message: string } // captureBlob throw / timeout
  | {
      readonly kind: 'SdfSerializationFailed';
      readonly moleculeId: MoleculeId;
      readonly message: string;
    }
  | { readonly kind: 'JsonSerializationFailed'; readonly message: string }
  | { readonly kind: 'NothingToExport' } // scope 에 분자 0개 (JSON/SDF 공통)
  | { readonly kind: 'FileTooLarge'; readonly sizeBytes: number; readonly limitBytes: number } // export 결과가 너무 큼
  | { readonly kind: 'UserAborted' } // 사용자가 중간 cancel (v1 미발생 — Phase 14+)
  | { readonly kind: 'Internal'; readonly message: string };

export type ImportError =
  | { readonly kind: 'FileTooLarge'; readonly sizeBytes: number; readonly limitBytes: number }
  | { readonly kind: 'JsonSyntax'; readonly message: string; readonly at?: number }
  | { readonly kind: 'SchemaMismatch'; readonly path: string; readonly message: string } // path = "molecules[3].atoms[7].position[2]" 형태
  | {
      readonly kind: 'IncompatibleVersion';
      readonly fileVersion: number;
      readonly supportedVersion: number;
    }
  | { readonly kind: 'EmptyFile' }
  | { readonly kind: 'NoMolecules' } // SessionFile 이 비어있는 분자 배열
  | {
      readonly kind: 'PartiallyFailed';
      readonly imported: number;
      readonly skipped: number;
      readonly errors: ReadonlyArray<{ readonly moleculeIndex: number; readonly reason: string }>;
    }
  | { readonly kind: 'UserAborted' }
  | { readonly kind: 'Internal'; readonly message: string };
```

PartiallyFailed = G8 의 사전 검증 단계가 일부 실패. replace 모드는 _clear 전_ 반환 → 상태 변경 없음.

### 4.6 IoErrorMapping (mapIoErrorToKey 결과)

```ts
export interface IoErrorMapping {
  readonly key: string; // 'common.io.error.export.captureFailed' 형태
  readonly params?: Readonly<Record<string, string | number>>;
  readonly action?: 'retry' | 'pick-file-again' | 'reload-page' | null;
}
```

### 4.7 uiStore retrofit (PanelKey + state + actions)

```ts
// src/stores/uiStore.ts (phase-13 retrofit)

export type PanelKey =
  | 'periodic-table'
  | 'compound-browser'
  | 'conditions'
  | 'molecule-info'
  | 'reaction-result'
  | 'toolbar'
  | 'text-input'
  | 'io'; // ⟵ phase-13 추가

export interface UiStoreState {
  readonly panels: {
    readonly active: PanelKey | null;
    readonly isCompoundBrowserOpen: boolean;
    readonly isPeriodicTableOpen: boolean;
    readonly isReactionResultOpen: boolean;
    readonly isTextInputOpen: boolean;
    readonly textInputInitial: TextInputSeed | null;
    readonly isIoOpen: boolean; // ⟵ phase-13 추가
    readonly ioInitialMode: IoMode | null; // ⟵ phase-13 추가
  };
  // ... 기타 ...
}

export interface UiStoreActions {
  // ... 기존 ...
  toggleIo(open?: boolean, initialMode?: IoMode): void; // ⟵ phase-13 추가
  setIoInitialMode(mode: IoMode | null): void; // ⟵ phase-13 추가
}
```

selectors:

```ts
export const selectIsIoOpen = (s: UiStoreState): boolean => s.panels.isIoOpen;
export const selectIoInitialMode = (s: UiStoreState): IoMode | null => s.panels.ioInitialMode;
```

### 4.8 moleculeStore retrofit

```ts
// src/stores/moleculeStore.ts (phase-13 retrofit)

export interface MoleculeStoreActions {
  // ── 기존 진입점 (변경 없음 — addFromMolecule 시그니처 무변경, 옵션 Y) ──
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
  addFromFormula(
    input: string,
    opts?: { signal?: AbortSignal },
  ): Promise<Result<MoleculeId, IngestError>>; // phase-12
  previewFromText(args: {
    kind: TextInputMode;
    raw: string;
    signal?: AbortSignal;
  }): Promise<Result<Molecule, IngestError>>; // phase-12
  addFromMolecule(m: Molecule): MoleculeId; // phase-11 §4.6 — 시그니처 무변경
  addFromMolecules(ms: ReadonlyArray<Molecule>): ReadonlyArray<MoleculeId>; // phase-11 §4.6

  // ── phase-13 추가 ──
  /**
   * 모든 분자 clear + imported 분자 batch 적재. replace 모드 진입점.
   *
   * - 단일 entry undoable (kind=`'molecule.import-replace'`) — 사용자가 import 직전 상태로
   *   undo 가능 *원리상*. 단, applyImportedSession §6.14 #5 의 dispatcher.clear() 가 본 entry 도 비워서
   *   결과적으로 import 는 undoable 아님 (의도). 본 액션 자체는 store 내부 일관성 차원에서 undoable.
   * - activeMoleculeId 가 있으면 setActive 자동.
   */
  replaceAll(
    molecules: ReadonlyArray<Molecule>,
    opts?: { activeMoleculeId?: MoleculeId | null },
  ): void;

  /**
   * JSON Import 의 high-level 진입점.
   *
   * 본문 (§6.14):
   *   1. 사전 검증 단계 (트랜잭션 보장 — G8): 모든 fromSnapshot 시도 → 실패 시 PartiallyFailed 즉시 반환 (상태 변경 없음).
   *   2. mode='replace' → replaceAll(molecules, { activeMoleculeId }) + setCondition + setSelection (selectionRemap) + viewport 옵션 적용.
   *   3. mode='append' → 각 분자 InChIKey 매칭 검사 → 매칭 시 skip + skipped++, 매칭 없으면 addFromMolecule(fromSnapshot(s)) + imported++.
   *   4. dispatcher.clear() — replace / append 양쪽 (§6.14 #5).
   *   5. Result.ok({ imported, skipped }) 반환.
   */
  applyImportedSession(
    session: SessionFile,
    opts?: { mode: 'replace' | 'append' },
  ): Promise<Result<{ imported: number; skipped: number }, ImportError>>;

  // ── 기존 동기 편집 ── (변경 없음)
  // ...
}
```

selectors:

```ts
// src/stores/moleculeStore.selectors.ts (phase-13 retrofit)
// CD6: 세션 타입/변환은 chemistry 계층에서 import (stores → io 역행 없음).
import type { MoleculeSnapshot } from '@/chemistry/session/types';
import { toSnapshot } from '@/chemistry/session/snapshot';

/** 동결 — phase-07 §5.1 line 461 의 책임 본 Phase 가 이행. */
export const selectMoleculeSnapshot =
  (id: MoleculeId) =>
  (s: MoleculeStoreState): MoleculeSnapshot | null => {
    const m = s.molecules[id];
    return m ? toSnapshot(m) : null;
  };

/** JSON export 진입점. 모든 분자 (s.ids 순서) 의 snapshot. */
export const selectAllMoleculeSnapshots = (
  s: MoleculeStoreState,
): ReadonlyArray<MoleculeSnapshot> => s.ids.map((id) => toSnapshot(s.molecules[id]!));

/** ExportError / ImportError → IoErrorMapping (i18n key + params + action). */
export function mapIoErrorToKey(e: ExportError | ImportError): IoErrorMapping;
```

### 4.9 UndoableDispatcher 인터페이스 retrofit

```ts
// src/stores/_shared/undoable.ts (phase-13 retrofit, phase-07 §6.4 + phase-09 §4.2 소급)

export interface UndoableDispatcher {
  dispatchUndoable<T>(meta: UndoableMeta & { kind: UndoableActionKind }, mutator: () => T): T;
  undo(): void;
  redo(): void;
  readonly canUndo: () => boolean;
  readonly canRedo: () => boolean;
  // ⟵ phase-13 추가:
  clear(): void; // undo + redo 스택 비우기 + pendingMerge 취소
  flush(): void; // pendingMerge timeout 즉시 dispatch
}
```

phase-07 placeholder = `clear: () => logger.debug('clear stub')` / `flush: () => logger.debug('flush stub')`. phase-09 createUndoStack 본 구현 = stack 조작 + timeout 처리.

### 4.10 i18n namespace 트리

phase-11 가 이미 `panels` namespace 등재. 본 Phase 는 _키 트리 확장_ + `common.io.error.*` 분기 추가.

```ts
// src/i18n/types.ts (변경 없음 — namespace 추가 안 함)
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof import('./resources/en/common.json'); // io.error.* 분기 추가
      chemistry: typeof import('./resources/en/chemistry.json');
      shortcuts: typeof import('./resources/en/shortcuts.json');
      panels: typeof import('./resources/en/panels.json'); // panels.io.* 추가
    };
  }
}
```

---

## 5. 퍼블릭 API / 인터페이스

### 5.1 `@/io` barrel (`src/io/index.ts`)

```ts
// 외부 (panels/Io) 노출 표면

export { exportPng } from './png/exportPng';
export { exportJson } from './json/exportJson';
export { exportSdf } from './sdf/exportSdf';
export { importJson } from './json/importJson';
export { validateSessionFile } from './json/validate';
export { triggerDownload } from './_shared/download';

export type { PngExportOptions, DEFAULT_PNG_OPTIONS } from './png/types';

export type {
  MoleculeSnapshot,
  AtomSnapshot,
  BondSnapshot,
  MoleculeOrigin,
  SessionFile,
  SerializedSelection,
} from './json/schema';

export type { ExportError, ImportError } from './_shared/errors';
```

### 5.2 `panels/registerAll.ts` retrofit

```ts
// src/panels/registerAll.ts (phase-13 retrofit)

import { registerPanel } from '@/app/layout';

export function registerAllPanels(): void {
  // phase-11 (5)
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
  // phase-12 (1)
  registerPanel({
    key: 'text-input',
    mode: 'modal',
    i18nTitleKey: 'panels.textInput.title',
    load: () => import('./TextInput'),
  });
  // phase-13: io 는 PanelRegistry 미등록 (D-IO-MOUNT — App.tsx 직접 마운트). 여기 추가 없음.
}
```

> §5.2 는 phase-13 가 `registerAll.ts` 를 **변경하지 않음**을 명시 (위 코드는 phase-12 종료 시점 상태 그대로). `<IoDialog/>` 는 App.tsx 가 직접 마운트한다 (§6.1 D-IO-MOUNT).

### 5.3 io entry function 시그니처

```ts
// src/io/png/exportPng.ts
export async function exportPng(args: {
  readonly apiRef: React.RefObject<ViewportApi | null>;
  readonly options: PngExportOptions;
  readonly timeoutMs?: number; // 기본 30000
}): Promise<Result<{ blob: Blob; filename: string }, ExportError>>;

// src/io/json/exportJson.ts
export function exportJson(args: {
  readonly scope: 'active' | 'all';
}): Result<{ blob: Blob; filename: string }, ExportError>;

// src/io/sdf/exportSdf.ts
export function exportSdf(args: {
  readonly scope: 'active' | 'all';
}): Result<{ blob: Blob; filename: string }, ExportError>;

// src/io/json/importJson.ts
export async function importJson(args: {
  readonly file: File;
  readonly mode: 'replace' | 'append';
  readonly maxFileSizeBytes?: number; // 기본 50 * 1024 * 1024 (50 MB)
}): Promise<Result<{ imported: number; skipped: number }, ImportError>>;

// src/io/json/validate.ts
export function validateSessionFile(data: unknown): Result<SessionFile, ImportError>;

// src/io/_shared/download.ts
export function triggerDownload(blob: Blob, filename: string): void;
```

### 5.4 store 액션 시그니처 (phase-07 retrofit)

```ts
// uiStore actions (phase-13 추가)
toggleIo(open?: boolean, initialMode?: IoMode): void;
setIoInitialMode(mode: IoMode | null): void;

// moleculeStore actions (phase-13 추가)
replaceAll(molecules: ReadonlyArray<Molecule>, opts?: { activeMoleculeId?: MoleculeId | null }): void;
applyImportedSession(
  session: SessionFile,
  opts?: { mode: 'replace' | 'append' },
): Promise<Result<{ imported: number; skipped: number }, ImportError>>;
```

### 5.5 UndoableDispatcher 인터페이스 retrofit

```ts
// src/stores/_shared/undoable.ts (phase-13 retrofit)

export interface UndoableDispatcher {
  // ... 기존 ...
  clear(): void;
  flush(): void;
}
```

placeholder + 본 구현 양쪽 갱신 (phase-07 / phase-09 retrofit 소급).

### 5.6 i18n 키 트리 (`src/i18n/resources/{ko,en}/panels.json` 추가 영역)

```jsonc
// en/panels.json (phase-13 추가)
{
  "io": {
    "title": "Export / Import",
    "modeLabel": {
      "pngExport": "PNG Screenshot",
      "jsonExport": "JSON Session",
      "sdfExport": "SDF Structures",
      "jsonImport": "Import JSON",
    },
    "pngExport": {
      "format": { "label": "Format", "png": "PNG", "jpeg": "JPEG", "webp": "WebP" },
      "dpr": { "label": "Resolution", "1x": "1x", "2x": "2x", "3x": "3x", "4x": "4x" },
      "transparent": {
        "label": "Transparent background",
        "disabledHint": "JPEG does not support transparency.",
      },
      "exportButton": "Export PNG",
    },
    "jsonExport": {
      "scope": { "active": "Active molecule only", "all": "All molecules" },
      "includes": "This export includes:",
      "includesItems": "{{count}} molecule(s), reaction conditions, selection, viewport options",
      "excludes": "Excluded: app settings, reaction results",
      "exportButton": "Export JSON",
    },
    "sdfExport": {
      "scope": { "active": "Active molecule only", "all": "All molecules" },
      "exportButton": "Export SDF",
    },
    "jsonImport": {
      "filePicker": { "label": "Select JSON file", "noFile": "No file selected" },
      "mode": {
        "label": "Import mode",
        "replace": "Replace (clear current and load)",
        "append": "Append (keep current, skip duplicates)",
      },
      "importButton": "Import",
      "importing": "Importing molecules…",
      "success": "Imported {{count}} molecule(s).",
      "partial": "Imported {{imported}} molecule(s), skipped {{skipped}} (duplicates or errors).",
    },
    "close": "Close",
  },
}
```

```jsonc
// en/common.json (phase-13 추가 영역)
{
  "io": {
    "error": {
      "export": {
        "canvasNotReady": "Viewport is not ready. Try again.",
        "captureFailed": "Failed to capture screenshot: {{message}}",
        "sdfFailed": "Failed to serialize SDF for molecule {{moleculeId}}.",
        "jsonFailed": "Failed to serialize JSON: {{message}}",
        "fileTooLarge": "Export size {{sizeMb}} MB exceeds limit {{limitMb}} MB.",
        "userAborted": "Export cancelled.",
        "internal": "Internal export error: {{message}}",
      },
      "import": {
        "fileTooLarge": "File size {{sizeMb}} MB exceeds limit {{limitMb}} MB.",
        "jsonSyntax": "Invalid JSON syntax{{#if at}} near character {{at}}{{/if}}.",
        "schemaMismatch": "Invalid session file at {{path}}: {{message}}",
        "incompatibleVersion": "File version {{fileVersion}} is not supported (expected {{supportedVersion}}).",
        "empty": "File is empty.",
        "noMolecules": "No molecules found in the file.",
        "partial": "Partial import: {{imported}} succeeded, {{skipped}} failed.",
        "userAborted": "Import cancelled.",
        "internal": "Internal import error: {{message}}",
      },
    },
  },
}
```

ko 동일 구조 한국어 번역. phase-15 폴리싱.

---

## 6. 핵심 로직 / 전략

### 6.1 IoDialog 구조

```tsx
// src/panels/Io/index.tsx
import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore, selectIsIoOpen, selectIoInitialMode } from '@/stores';
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
  VisuallyHidden,
} from '@/components';
import { IoModeTabs } from './IoModeTabs';
import { PngExportPane } from './PngExportPane';
import { JsonExportPane } from './JsonExportPane';
import { SdfExportPane } from './SdfExportPane';
import { JsonImportPane } from './JsonImportPane';
import type { IoMode } from './types';
import type { ViewportApi } from '@/viewport';

interface Props {
  readonly viewportApiRef: React.RefObject<ViewportApi | null>;
}

export default function IoDialog({ viewportApiRef }: Props) {
  const { t } = useTranslation('panels');
  const open = useUiStore(selectIsIoOpen);
  const initialMode = useUiStore(selectIoInitialMode);
  const toggle = useUiStore((s) => s.actions.toggleIo);

  const [mode, setMode] = useState<IoMode>(initialMode ?? 'png-export');

  // initialMode 변경 시 mode 갱신.
  useEffect(() => {
    if (open && initialMode) setMode(initialMode);
  }, [initialMode, open]);

  return (
    <Dialog open={open} onOpenChange={toggle}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>{t('io.title')}</DialogTitle>
        <VisuallyHidden>{t('io.modeLabel.pngExport')}</VisuallyHidden>
        <div className="flex flex-col gap-4 py-4">
          <IoModeTabs mode={mode} onChange={setMode} />
          <Tabs value={mode} className="flex flex-col">
            <TabsContent value="png-export">
              <PngExportPane apiRef={viewportApiRef} onClose={() => toggle(false)} />
            </TabsContent>
            <TabsContent value="json-export">
              <JsonExportPane onClose={() => toggle(false)} />
            </TabsContent>
            <TabsContent value="sdf-export">
              <SdfExportPane onClose={() => toggle(false)} />
            </TabsContent>
            <TabsContent value="json-import">
              <JsonImportPane onClose={() => toggle(false)} />
            </TabsContent>
          </Tabs>
        </div>
        <footer className="flex justify-end gap-2 border-t border-border pt-4">
          <DialogClose asChild>
            <Button variant="ghost">{t('io.close')}</Button>
          </DialogClose>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
```

`viewportApiRef` prop 은 App.tsx 의 `useRef<ViewportApi | null>(null)` 와 동일 ref 를 forward (Toolbar 와 공유) — phase-11 §6.10 의 패턴 정합. PanelRegistry.load 가 `<IoDialog/>` 마운트 시 prop 을 어떻게 전달하는지? — phase-10 의 `<ModalHost/>` 가 panel 의 prop 주입 hook 을 별도 노출하지 않으면, **본 Phase 가 phase-10 retrofit 으로 prop forwarding 추가** 또는 _PanelRegistry 외 별도 진입점_ 으로 IoDialog 를 App.tsx 가 직접 마운트 (phase-11 의 `<ToolbarBar/>` 와 동일 패턴). **결정**: App.tsx 가 `<IoDialog viewportApiRef={ref}/>` 를 `<ModalHost/>` 와 _별도로_ 마운트 — Radix Dialog 의 `open` prop 이 uiStore.isIoOpen 구독 → ModalHost 와 정합 (modal portal 은 Radix 자체). PanelRegistry.load 가 본 패널을 _비등록_ 으로 처리 (`registerAllPanels()` 의 7 번째 호출 _제거_ — 본 Phase 의 retrofit 갱신).

**대안**: PanelRegistry 의 PanelDefinition 에 `getProps?: () => Record<string, unknown>` 같은 hook 추가는 phase-10 retrofit 과잉. App.tsx 직접 마운트가 단순.

**최종 결정 (D-IO-MOUNT)**: **App.tsx 직접 마운트** (Toolbar 와 동일 패턴). PanelRegistry 등록 _안 함_. §10.2 / §12.1 갱신.

### 6.2 IoModeTabs

```tsx
// src/panels/Io/IoModeTabs.tsx
import { Tabs, TabsList, TabsTrigger } from '@/components';
import { useTranslation } from 'react-i18next';
import { Image, FileText, Atom, Upload } from 'lucide-react';
import type { IoMode } from './types';

interface Props {
  readonly mode: IoMode;
  readonly onChange: (m: IoMode) => void;
}

export function IoModeTabs({ mode, onChange }: Props) {
  const { t } = useTranslation('panels');
  return (
    <Tabs value={mode} onValueChange={(v) => onChange(v as IoMode)}>
      <TabsList>
        <TabsTrigger value="png-export">
          <Image size={14} className="mr-1" />
          {t('io.modeLabel.pngExport')}
        </TabsTrigger>
        <TabsTrigger value="json-export">
          <FileText size={14} className="mr-1" />
          {t('io.modeLabel.jsonExport')}
        </TabsTrigger>
        <TabsTrigger value="sdf-export">
          <Atom size={14} className="mr-1" />
          {t('io.modeLabel.sdfExport')}
        </TabsTrigger>
        <TabsTrigger value="json-import">
          <Upload size={14} className="mr-1" />
          {t('io.modeLabel.jsonImport')}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
```

### 6.3 PngExportPane

```tsx
// src/panels/Io/PngExportPane.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Switch, Label, Tabs, TabsList, TabsTrigger, Tooltip, Spinner } from '@/components';
import { exportPng, triggerDownload, DEFAULT_PNG_OPTIONS } from '@/io';
import { useUiStore } from '@/stores';
import { IoErrorMessage } from './IoErrorMessage';
import type { ViewportApi } from '@/viewport';
import type { ExportError } from '@/io';
import type { PngExportOptions } from '@/io';

interface Props {
  readonly apiRef: React.RefObject<ViewportApi | null>;
  readonly onClose: () => void;
}

export function PngExportPane({ apiRef, onClose }: Props) {
  const { t } = useTranslation('panels');
  const [options, setOptions] = useState<PngExportOptions>(DEFAULT_PNG_OPTIONS);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<ExportError | null>(null);
  const notify = useUiStore((s) => s.actions.notify);

  const onExport = async () => {
    setExporting(true);
    setError(null);
    const result = await exportPng({ apiRef, options });
    setExporting(false);
    if (result.ok) {
      triggerDownload(result.value.blob, result.value.filename);
      notify({ level: 'success', messageKey: 'panels.io.success.png', dismissAfterMs: 2500 });
      onClose(); // D-PNG-CLOSE-AFTER
    } else {
      setError(result.error);
    }
  };

  const transparentDisabled = options.format === 'jpeg';

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Label>{t('io.pngExport.format.label')}</Label>
        <Tabs
          value={options.format}
          onValueChange={(v) =>
            setOptions((o) => ({ ...o, format: v as PngExportOptions['format'] }))
          }
        >
          <TabsList>
            <TabsTrigger value="png">{t('io.pngExport.format.png')}</TabsTrigger>
            <TabsTrigger value="jpeg">{t('io.pngExport.format.jpeg')}</TabsTrigger>
            <TabsTrigger value="webp">{t('io.pngExport.format.webp')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="flex items-center gap-3">
        <Label>{t('io.pngExport.dpr.label')}</Label>
        <Tabs
          value={String(options.dpr)}
          onValueChange={(v) => setOptions((o) => ({ ...o, dpr: Number(v) }))}
        >
          <TabsList>
            <TabsTrigger value="1">1x</TabsTrigger>
            <TabsTrigger value="2">2x</TabsTrigger>
            <TabsTrigger value="3">3x</TabsTrigger>
            <TabsTrigger value="4">4x</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="flex items-center gap-3">
        <Tooltip content={transparentDisabled ? t('io.pngExport.transparent.disabledHint') : ''}>
          <div className="flex items-center gap-2">
            <Switch
              checked={options.transparentBackground && !transparentDisabled}
              disabled={transparentDisabled}
              onCheckedChange={(checked) =>
                setOptions((o) => ({ ...o, transparentBackground: checked }))
              }
              aria-label={t('io.pngExport.transparent.label')}
            />
            <Label>{t('io.pngExport.transparent.label')}</Label>
          </div>
        </Tooltip>
      </div>
      {error && <IoErrorMessage error={error} onRetry={onExport} />}
      <div className="flex justify-end pt-2">
        <Button variant="primary" disabled={exporting} onClick={onExport}>
          {exporting && <Spinner size="sm" className="mr-2" />}
          {t('io.pngExport.exportButton')}
        </Button>
      </div>
    </div>
  );
}
```

### 6.4 JsonExportPane

JsonExportPane 은 비슷한 구조 — scope `<Tabs/>` + 포함 항목 안내 + Export 버튼. 본문 생략 (PngExportPane 패턴 정합).

```tsx
// src/panels/Io/JsonExportPane.tsx (요약)
const onExport = () => {
  const result = exportJson({ scope });
  if (result.ok) {
    triggerDownload(result.value.blob, result.value.filename);
    notify({ level: 'success', messageKey: 'panels.io.success.json', ... });
    onClose();
  } else {
    setError(result.error);
  }
};
```

`exportJson` 은 sync (JSON.stringify 동기) — Promise 불요.

### 6.5 SdfExportPane

JsonExportPane 과 유사. `exportSdf({ scope })` 호출.

### 6.6 JsonImportPane

```tsx
// src/panels/Io/JsonImportPane.tsx
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Switch, Label, Spinner } from '@/components';
import { importJson } from '@/io';
import { useUiStore } from '@/stores';
import { IoErrorMessage } from './IoErrorMessage';
import { ImportProgress } from './ImportProgress';
import type { ImportError } from '@/io';

interface Props {
  readonly onClose: () => void;
}

export function JsonImportPane({ onClose }: Props) {
  const { t } = useTranslation('panels');
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'replace' | 'append'>('replace');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<ImportError | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notify = useUiStore((s) => s.actions.notify);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
    setError(null);
  };

  const onImport = async () => {
    if (!file) return;
    setImporting(true);
    setError(null);
    const result = await importJson({ file, mode });
    setImporting(false);
    if (result.ok) {
      const { imported, skipped } = result.value;
      const messageKey =
        skipped > 0 ? 'panels.io.jsonImport.partial' : 'panels.io.jsonImport.success';
      notify({
        level: skipped > 0 ? 'warn' : 'success',
        messageKey,
        messageParams: { imported, skipped, count: imported },
        dismissAfterMs: 4000,
      });
      onClose();
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 relative">
      <ImportProgress visible={importing} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="io-import-file">{t('io.jsonImport.filePicker.label')}</Label>
        <input
          id="io-import-file"
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={onFileChange}
          aria-label={t('io.jsonImport.filePicker.label')}
          className="text-sm"
        />
      </div>
      <div className="flex items-center gap-3">
        <Label>{t('io.jsonImport.mode.label')}</Label>
        <div className="flex items-center gap-2">
          <Switch
            checked={mode === 'replace'}
            onCheckedChange={(c) => setMode(c ? 'replace' : 'append')}
            aria-label={t('io.jsonImport.mode.label')}
          />
          <span className="text-sm text-fg-muted">
            {mode === 'replace' ? t('io.jsonImport.mode.replace') : t('io.jsonImport.mode.append')}
          </span>
        </div>
      </div>
      {error && (
        <IoErrorMessage error={error} onPickFileAgain={() => fileInputRef.current?.click()} />
      )}
      <div className="flex justify-end pt-2">
        <Button variant="primary" disabled={!file || importing} onClick={onImport}>
          {importing && <Spinner size="sm" className="mr-2" />}
          {t('io.jsonImport.importButton')}
        </Button>
      </div>
    </div>
  );
}
```

### 6.7 ImportProgress

```tsx
// src/panels/Io/ImportProgress.tsx
import { LoadingOverlay } from '@/components';
import { useTranslation } from 'react-i18next';

interface Props {
  readonly visible: boolean;
}

export function ImportProgress({ visible }: Props) {
  const { t } = useTranslation('panels');
  return <LoadingOverlay variant="panel" visible={visible} label={t('io.jsonImport.importing')} />;
}
```

진행 카운트 (N/M) 는 v1 미포함 (applyImportedSession 가 progress callback 미제공 — Phase 14+ retrofit).

### 6.8 IoErrorMessage

```tsx
// src/panels/Io/IoErrorMessage.tsx
import { useTranslation } from 'react-i18next';
import { mapIoErrorToKey } from '@/stores';
import { Button } from '@/components';
import { AlertCircle, RefreshCw, Upload } from 'lucide-react';
import type { ExportError, ImportError } from '@/io';

interface Props {
  readonly error: ExportError | ImportError;
  readonly onRetry?: () => void;
  readonly onPickFileAgain?: () => void;
}

export function IoErrorMessage({ error, onRetry, onPickFileAgain }: Props) {
  const { t } = useTranslation();
  const mapped = mapIoErrorToKey(error);

  const onAction = () => {
    switch (mapped.action) {
      case 'retry':
        onRetry?.();
        break;
      case 'pick-file-again':
        onPickFileAgain?.();
        break;
      case 'reload-page':
        window.location.reload();
        break;
    }
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-col gap-2 rounded-md bg-error/10 p-3 ring-1 ring-error/30"
    >
      <div className="flex items-start gap-2">
        <AlertCircle aria-hidden size={16} className="mt-0.5 text-error flex-shrink-0" />
        <p className="text-sm text-fg-primary">{t(mapped.key, mapped.params)}</p>
      </div>
      {mapped.action != null && (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={onAction}>
            {mapped.action === 'retry' && (
              <>
                <RefreshCw size={14} className="mr-1" />
                {t('common.action.retry')}
              </>
            )}
            {mapped.action === 'pick-file-again' && (
              <>
                <Upload size={14} className="mr-1" />
                {t('common.action.pickFileAgain')}
              </>
            )}
            {mapped.action === 'reload-page' && t('common.action.reloadPage')}
          </Button>
        </div>
      )}
    </div>
  );
}
```

### 6.9 exportPng 본문

```ts
// src/io/png/exportPng.ts
import type { ViewportApi } from '@/viewport';
import type { Result } from '@/types/result';
import type { PngExportOptions } from './types';
import type { ExportError } from '../_shared/errors';
import { generateFilename } from '../_shared/filename';
import { logger } from '@/utils/logger';

export async function exportPng(args: {
  readonly apiRef: React.RefObject<ViewportApi | null>;
  readonly options: PngExportOptions;
  readonly timeoutMs?: number;
}): Promise<Result<{ blob: Blob; filename: string }, ExportError>> {
  const api = args.apiRef.current;
  if (!api) return { ok: false, error: { kind: 'CanvasNotReady' } };

  logger.info('export.png.started', { format: args.options.format, dpr: args.options.dpr });

  const timeoutMs = args.timeoutMs ?? 30_000;
  try {
    const blob = await Promise.race([
      api.captureBlob({
        format: args.options.format,
        dpr: args.options.dpr,
        transparentBackground: args.options.transparentBackground,
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)),
    ]);
    const filename = generateFilename({ ext: args.options.format });
    logger.info('export.png.completed', { sizeBytes: blob.size, filename });
    return { ok: true, value: { blob, filename } };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.warn('export.png.failed', { message });
    return { ok: false, error: { kind: 'CaptureFailed', message } };
  }
}
```

### 6.10 exportJson 본문

```ts
// src/io/json/exportJson.ts
import type { Result } from '@/types/result';
import type { ExportError } from '../_shared/errors';
import {
  useMoleculeStore,
  useReactionStore,
  useUiStore,
  selectAllMoleculeSnapshots,
} from '@/stores';
import type { SessionFile } from './schema';
import { generateFilename } from '../_shared/filename';
import { serializeSelectionWithMolecules as serializeSelection } from '@/chemistry/session/selection'; // CD6
import { APP_NAME, APP_VERSION } from '@/app/constants'; // build-time injected

export function exportJson(args: {
  scope: 'active' | 'all';
}): Result<{ blob: Blob; filename: string }, ExportError> {
  try {
    const moleculeState = useMoleculeStore.getState();
    const reactionState = useReactionStore.getState();
    const uiState = useUiStore.getState();

    const allSnapshots = selectAllMoleculeSnapshots(moleculeState);
    const snapshots =
      args.scope === 'active'
        ? moleculeState.activeId
          ? [allSnapshots.find((s) => s.id === moleculeState.activeId)!].filter(Boolean)
          : []
        : allSnapshots;

    if (snapshots.length === 0) {
      return { ok: false, error: { kind: 'NothingToExport' } }; // exportSdf 와 동일 — 빈 scope 일관 처리
    }

    const session: SessionFile = {
      schemaVersion: 1,
      app: { name: 'chemistry-platform', version: APP_VERSION },
      exportedAt: new Date().toISOString(),
      molecules: snapshots,
      activeMoleculeId: moleculeState.activeId,
      condition: reactionState.condition,
      selection: serializeSelection(uiState.selection, snapshots),
      viewport: {
        showAtomLabels: uiState.viewport.showAtomLabels,
        backgroundOverride: uiState.viewport.backgroundOverride,
      },
    };

    const json = JSON.stringify(session, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const filename = generateFilename({ ext: 'json' });
    return { ok: true, value: { blob, filename } };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: { kind: 'JsonSerializationFailed', message } };
  }
}
```

**`serializeSelection` / `deserializeSelection`** (`src/chemistry/session/selection.ts` — CD6: stores(`applyImportedSession`)·io 양쪽이 호출하므로 chemistry 계층 순수 모듈) — 완전 시그니처·알고리즘:

```ts
import type { SerializedSelection } from '@/chemistry/session/types';
import type { MoleculeSnapshot } from '@/chemistry/session/types';
import type { Molecule } from '@/chemistry/compounds/types';
import { parseViewportId } from '@/viewport'; // phase-08: '${molId}::a:${atomId}' → { molId, kind, id }

interface UiSelection {
  readonly atomIds: readonly string[]; // viewport ID 문자열
  readonly bondIds: readonly string[];
}

/** uiStore.selection (viewport ID 문자열) → index 기반 SerializedSelection.
 *  매핑 불가 항목 (분자 미발견 / ID 부재) 은 **조용히 드롭** (export 는 best-effort —
 *  선택이 일부 손실돼도 세션 자체는 유효). 드롭 수는 logger.debug 로만 기록. */
export function serializeSelection(
  sel: UiSelection,
  snapshots: readonly MoleculeSnapshot[],
): SerializedSelection {
  const molIndexById = new Map(snapshots.map((m, i) => [m.id, i]));
  const mapAtom = (vid: string) => {
    const p = parseViewportId(vid);
    if (!p || p.kind !== 'a') return null;
    const moleculeIndex = molIndexById.get(p.molId);
    if (moleculeIndex == null) return null; // 분자 미발견 → 드롭
    const atomIndex = snapshots[moleculeIndex]!.atoms.findIndex(
      (_, i) => /* atomId→index: 직렬화는 index 기준이므로 */ false,
    );
    // 주: snapshot 은 atom id 를 보존하지 않으므로, export 시 uiStore.selection 의
    //     atomId 는 *현재 런타임 Molecule* 의 atoms 배열에서 index 로 환원해야 한다.
    //     → 호출측이 런타임 Molecule 을 함께 넘기는 오버로드를 사용 (아래).
    return atomIndex < 0 ? null : { moleculeIndex, atomIndex };
  };
  // 실제 구현은 런타임 molecule 도 받는다 (id→index 환원 위해):
  return serializeSelectionWithMolecules(sel, snapshots, /* runtime */ undefined as never);
}

/** 런타임 Molecule 까지 받아 atomId → atoms[] index 환원 (정확 구현). */
export function serializeSelectionWithMolecules(
  sel: UiSelection,
  snapshots: readonly MoleculeSnapshot[],
  molecules: ReadonlyMap<string /*MoleculeId*/, Molecule>,
): SerializedSelection {
  const molIndexById = new Map(snapshots.map((m, i) => [m.id, i]));
  const atomIds: SerializedSelection['atomIds'][number][] = [];
  const bondIds: SerializedSelection['bondIds'][number][] = [];
  for (const vid of sel.atomIds) {
    const p = parseViewportId(vid);
    if (!p || p.kind !== 'a') continue;
    const moleculeIndex = molIndexById.get(p.molId);
    const m = molecules.get(p.molId);
    if (moleculeIndex == null || !m) continue; // 분자 미발견 → 드롭
    const atomIndex = m.atoms.findIndex((a) => a.id === p.id);
    if (atomIndex < 0) continue; // atom 미발견 → 드롭
    atomIds.push({ moleculeIndex, atomIndex });
  }
  // bondIds 동일 (p.kind === 'b', m.bonds.findIndex(b => b.id === p.id))
  return { atomIds, bondIds };
}

/** index 기반 → 재발급된 런타임 Molecule 의 viewport ID 문자열.
 *  moleculeIndex 범위 초과 / atomIndex 범위 초과 → 해당 항목 드롭 (import 의 부분
 *  손상에 강건; 드롭 수는 ImportWarning 으로 누적해 호출측이 표시 가능). */
export function deserializeSelection(
  ser: SerializedSelection,
  molecules: readonly Molecule[], // import 후 재발급된 런타임 분자 배열 (SessionFile.molecules 순서)
): UiSelection {
  const atomIds: string[] = [];
  const bondIds: string[] = [];
  for (const { moleculeIndex, atomIndex } of ser.atomIds) {
    const m = molecules[moleculeIndex];
    if (!m) continue; // 범위 초과 → 드롭
    const atom = m.atoms[atomIndex];
    if (!atom) continue; // 범위 초과 → 드롭
    atomIds.push(`${m.id}::a:${atom.id}`);
  }
  // bondIds 동일
  return { atomIds, bondIds };
}
```

핵심: snapshot 은 atom/bond id 를 보존하지 않으므로 (§4.3), serialize 는 _런타임 Molecule_ 에서 `atom.id → atoms[] index` 를 환원하고, deserialize 는 import 으로 _재발급된_ 런타임 분자에서 `index → 새 viewport ID` 를 재구성한다. 모든 미스(분자/원자 미발견·범위 초과)는 예외 없이 **드롭**하여 round-trip 부분 손상에 강건하다 (U10 round-trip 테스트는 동일 atoms 길이 가정 하 동등성 검증).

### 6.11 exportSdf 본문

```ts
// src/io/sdf/exportSdf.ts
import { toSdfBlock } from '@/engine/rdkit/canonical'; // phase-03 §5.3: (backend, mol) => Result<string, RdkitNotReady>
import { createMainThreadRdkitBackend, getRdkit } from '@/engine/rdkit'; // phase-03 §5.1/§6.8
import { useMoleculeStore } from '@/stores';
import type { Result } from '@/types/result';
import type { ExportError } from '../_shared/errors';
import { generateFilename } from '../_shared/filename';

const SDF_SEPARATOR = '$$$$\n';
const SDF_MIME = 'chemical/x-mdl-sdfile';

export function exportSdf(args: {
  scope: 'active' | 'all';
}): Result<{ blob: Blob; filename: string }, ExportError> {
  const state = useMoleculeStore.getState();
  const molecules =
    args.scope === 'active'
      ? state.activeId
        ? [state.molecules[state.activeId]!]
        : []
      : state.ids.map((id) => state.molecules[id]!);

  if (molecules.length === 0) {
    return { ok: false, error: { kind: 'NothingToExport' } }; // 빈 scope — 정확한 변형
  }

  const backend = createMainThreadRdkitBackend(getRdkit); // 앱 공용 인스턴스 (모듈 메모이즈 권장)
  const blocks: string[] = [];
  for (const m of molecules) {
    const r = toSdfBlock(backend, m); // Result<string, RdkitNotReady> (phase-03 §5.3, sync)
    if (!r.ok) {
      // RdkitNotReady — RDKit 미초기화. 전체 export 중단 (트랜잭션 보장).
      return {
        ok: false,
        error: { kind: 'SdfSerializationFailed', moleculeId: m.id, message: 'RDKit not ready' },
      };
    }
    blocks.push(r.value);
  }
  const sdf = blocks.join(SDF_SEPARATOR) + SDF_SEPARATOR; // RFC 표준 — 마지막 record 도 separator 로 종료
  const blob = new Blob([sdf], { type: SDF_MIME });
  const filename = generateFilename({ ext: 'sdf' });
  return { ok: true, value: { blob, filename } };
}
```

### 6.12 importJson 본문

```ts
// src/io/json/importJson.ts
import type { Result } from '@/types/result';
import type { ImportError } from '../_shared/errors';
import { validateSessionFile } from './validate';
import { useMoleculeStore } from '@/stores';

const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function importJson(args: {
  readonly file: File;
  readonly mode: 'replace' | 'append';
  readonly maxFileSizeBytes?: number;
}): Promise<Result<{ imported: number; skipped: number }, ImportError>> {
  const limit = args.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE;
  if (args.file.size > limit) {
    return {
      ok: false,
      error: { kind: 'FileTooLarge', sizeBytes: args.file.size, limitBytes: limit },
    };
  }
  if (args.file.size === 0) {
    return { ok: false, error: { kind: 'EmptyFile' } };
  }

  let text: string;
  try {
    text = await args.file.text();
  } catch (e) {
    return {
      ok: false,
      error: { kind: 'Internal', message: e instanceof Error ? e.message : String(e) },
    };
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // JSON.parse error message 에서 column 추출 (best effort)
    const match = message.match(/position (\d+)/);
    const at = match ? Number(match[1]) : undefined;
    return { ok: false, error: { kind: 'JsonSyntax', message, at } };
  }

  const validation = validateSessionFile(json);
  if (!validation.ok) return validation;

  const session = validation.value;
  const applyAction = useMoleculeStore.getState().actions.applyImportedSession;
  const result = await applyAction(session, { mode: args.mode });
  return result;
}
```

### 6.13 validateSessionFile (hand-written)

```ts
// src/io/json/validate.ts
import type { Result } from '@/types/result';
import type { ImportError } from '../_shared/errors';
import type { SessionFile, MoleculeSnapshot, AtomSnapshot, BondSnapshot } from './schema';

const SUPPORTED_VERSION = 1;

export function validateSessionFile(data: unknown): Result<SessionFile, ImportError> {
  if (typeof data !== 'object' || data === null) {
    return mismatch('', 'Expected object');
  }
  const d = data as Record<string, unknown>;

  // schemaVersion
  if (typeof d.schemaVersion !== 'number') return mismatch('schemaVersion', 'Expected number');
  if (d.schemaVersion !== SUPPORTED_VERSION) {
    return {
      ok: false,
      error: {
        kind: 'IncompatibleVersion',
        fileVersion: d.schemaVersion as number,
        supportedVersion: SUPPORTED_VERSION,
      },
    };
  }

  // app
  if (typeof d.app !== 'object' || d.app === null) return mismatch('app', 'Expected object');

  // exportedAt
  if (typeof d.exportedAt !== 'string') return mismatch('exportedAt', 'Expected string');

  // molecules
  if (!Array.isArray(d.molecules)) return mismatch('molecules', 'Expected array');
  if (d.molecules.length === 0) return { ok: false, error: { kind: 'NoMolecules' } };

  for (let i = 0; i < d.molecules.length; i++) {
    const v = validateMoleculeSnapshot(d.molecules[i], `molecules[${i}]`);
    if (!v.ok) return v as Result<SessionFile, ImportError>;
  }

  // activeMoleculeId
  if (d.activeMoleculeId !== null && typeof d.activeMoleculeId !== 'string') {
    return mismatch('activeMoleculeId', 'Expected string or null');
  }

  // condition
  if (typeof d.condition !== 'object' || d.condition === null)
    return mismatch('condition', 'Expected object');
  // ... condition 의 temperatureK/pressureAtm/pH 검증 (생략) ...

  // selection
  if (typeof d.selection !== 'object' || d.selection === null)
    return mismatch('selection', 'Expected object');
  // ... selection.atomIds / bondIds 검증 (생략) ...

  // viewport
  if (typeof d.viewport !== 'object' || d.viewport === null)
    return mismatch('viewport', 'Expected object');

  return { ok: true, value: data as SessionFile };
}

function validateMoleculeSnapshot(
  data: unknown,
  path: string,
): Result<MoleculeSnapshot, ImportError> {
  if (typeof data !== 'object' || data === null) return mismatch(path, 'Expected object');
  const m = data as Record<string, unknown>;
  if (typeof m.id !== 'string') return mismatch(`${path}.id`, 'Expected string');
  if (typeof m.canonicalSmiles !== 'string')
    return mismatch(`${path}.canonicalSmiles`, 'Expected string');
  // ... 기타 필드 검증 (생략) ...
  if (!Array.isArray(m.atoms)) return mismatch(`${path}.atoms`, 'Expected array');
  for (let i = 0; i < m.atoms.length; i++) {
    const v = validateAtomSnapshot(m.atoms[i], `${path}.atoms[${i}]`);
    if (!v.ok) return v as Result<MoleculeSnapshot, ImportError>;
  }
  if (!Array.isArray(m.bonds)) return mismatch(`${path}.bonds`, 'Expected array');
  for (let i = 0; i < m.bonds.length; i++) {
    const v = validateBondSnapshot(m.bonds[i], `${path}.bonds[${i}]`, m.atoms.length);
    if (!v.ok) return v as Result<MoleculeSnapshot, ImportError>;
  }
  return { ok: true, value: data as MoleculeSnapshot };
}

function validateAtomSnapshot(data: unknown, path: string): Result<AtomSnapshot, ImportError> {
  if (typeof data !== 'object' || data === null) return mismatch(path, 'Expected object');
  const a = data as Record<string, unknown>;
  if (typeof a.elementNumber !== 'number' || a.elementNumber < 1 || a.elementNumber > 118)
    return mismatch(`${path}.elementNumber`, 'Expected number 1..118');
  if (
    !Array.isArray(a.position) ||
    a.position.length !== 3 ||
    !a.position.every((x) => typeof x === 'number')
  )
    return mismatch(`${path}.position`, 'Expected [number, number, number]');
  // ... 기타 ...
  return { ok: true, value: data as AtomSnapshot };
}

function validateBondSnapshot(
  data: unknown,
  path: string,
  atomCount: number,
): Result<BondSnapshot, ImportError> {
  if (typeof data !== 'object' || data === null) return mismatch(path, 'Expected object');
  const b = data as Record<string, unknown>;
  if (typeof b.atom1Index !== 'number' || b.atom1Index < 0 || b.atom1Index >= atomCount)
    return mismatch(`${path}.atom1Index`, `Expected 0..${atomCount - 1}`);
  if (typeof b.atom2Index !== 'number' || b.atom2Index < 0 || b.atom2Index >= atomCount)
    return mismatch(`${path}.atom2Index`, `Expected 0..${atomCount - 1}`);
  const validOrders = [1, 2, 3, 'aromatic'];
  if (!validOrders.includes(b.order as never))
    return mismatch(`${path}.order`, 'Expected 1 | 2 | 3 | "aromatic"');
  return { ok: true, value: data as BondSnapshot };
}

function mismatch(path: string, message: string): Result<never, ImportError> {
  return { ok: false, error: { kind: 'SchemaMismatch', path, message } };
}
```

### 6.14 applyImportedSession 본문 — D-DUPLICATE-INTEGRATION 옵션 Y 핵심

```ts
// src/stores/moleculeStore.ts (phase-13 retrofit)
import { fromSnapshot } from '@/chemistry/session/snapshot'; // CD6 (chemistry 계층 — stores→io 역행 없음)
import { deserializeSelection } from '@/chemistry/session/selection'; // CD6 (순수 변환, chemistry 계층)

applyImportedSession: async (session: SessionFile, opts?: { mode: 'replace' | 'append' }) => {
  const mode = opts?.mode ?? 'replace';

  // 1. 사전 검증 단계 (G8 — 트랜잭션 보장)
  const fromSnapshotResults: Result<Molecule, string>[] = session.molecules.map((s) => {
    try {
      return { ok: true, value: fromSnapshot(s) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  const failures = fromSnapshotResults.flatMap((r, i) =>
    r.ok ? [] : [{ moleculeIndex: i, reason: r.error }],
  );

  if (failures.length === session.molecules.length) {
    // 모두 실패 — 진행 무의미
    return {
      ok: false,
      error: { kind: 'PartiallyFailed', imported: 0, skipped: 0, errors: failures },
    };
  }

  if (failures.length > 0 && mode === 'replace') {
    // replace 모드의 부분 실패 — clear 전 반환 (상태 변경 없음)
    return {
      ok: false,
      error: { kind: 'PartiallyFailed', imported: 0, skipped: failures.length, errors: failures },
    };
  }

  const validMolecules = fromSnapshotResults
    .filter((r) => r.ok)
    .map((r) => (r as { ok: true; value: Molecule }).value);

  // 2. mode='replace'
  if (mode === 'replace') {
    // 활성 분자 매핑 — snapshot.id === activeMoleculeId 인 분자가 적재된 후 그 ID 로 setActive
    const activeId = session.activeMoleculeId;
    set((draft) => {
      // replaceAll 내부 mutation
      draft.molecules = {};
      draft.ids = [];
      for (const m of validMolecules) {
        draft.molecules[m.id] = m;
        draft.ids.push(m.id);
      }
      draft.activeId = activeId && draft.molecules[activeId] ? activeId : null;
    });

    // condition / selection / viewport 옵션 적용
    useReactionStore.getState().actions.setCondition(session.condition);
    useUiStore
      .getState()
      .actions.setSelection(deserializeSelection(session.selection, validMolecules));
    useUiStore.setState((s) => ({
      ...s,
      viewport: {
        showAtomLabels: session.viewport.showAtomLabels,
        backgroundOverride: session.viewport.backgroundOverride,
      },
    }));

    // 5. dispatcher.clear() (D8)
    dispatcher.clear(); // v0.2: @/stores 배럴의 swappable `dispatcher` proxy (React 컨텍스트 아님)

    return { ok: true, value: { imported: validMolecules.length, skipped: failures.length } };
  }

  // 3. mode='append' — duplicate 검출 (옵션 Y)
  const existingState = get();
  const existingInchiKeys = new Set(
    existingState.ids
      .map((id) => existingState.molecules[id]?.inchiKey)
      .filter((k): k is string => k != null),
  );

  let imported = 0;
  let skipped = failures.length;

  for (const m of validMolecules) {
    if (m.inchiKey && existingInchiKeys.has(m.inchiKey)) {
      skipped++;
      continue;
    }
    addFromMolecule(m); // 시그니처 무변경 — 직접 호출
    imported++;
    if (m.inchiKey) existingInchiKeys.add(m.inchiKey);
  }

  // append 모드 = condition / selection / viewport 옵션 적용 안 함 (사용자 의도 보존)

  // 5. dispatcher.clear() (D8)
  dispatcher.clear(); // v0.2: @/stores 배럴의 `dispatcher` proxy

  return { ok: true, value: { imported, skipped } };
};
```

**(v0.2 정합) `dispatcher` swappable 싱글톤 proxy** — 초안의 `getStoreUndoableDispatcher()` 접근자 함수는 폐기. phase-09 v0.2 구현은 `src/stores/_shared/undoable.ts` 가 **안정 식별자 `dispatcher`** (proxy 객체, phase-07 §659–664 / phase-11 §1942 패턴) 를 export 하고 `setUndoDispatcher()` 가 내부 구현(`createUndoStack()` 결과 = `UndoStackController`)을 swap 한다. io 는 `@/stores` 배럴에서 `import { dispatcher } from '@/stores'` 후 `dispatcher.clear()` 호출 (arch §4.1 CD6 — io 의 store 런타임 접근 허용; `@/stores/*` deep-import 가드 회피).

```ts
// @/stores 배럴 (phase-07 정의, phase-09 v0.2 가 swap, phase-13 가 clear/flush retrofit)
import { dispatcher } from '@/stores';
// dispatcher: UndoableDispatcher (phase-13 retrofit 후 clear()/flush() 포함)
```

**phase-13 인터페이스 retrofit 범위 (v0.2 정합)**: `clear()`/`flush()` 는 (a) 동결 `UndoableDispatcher` 인터페이스, (b) `phase07PlaceholderDispatcher`, (c) `dispatcher` proxy 의 위임 목록 — 세 곳에 _추가_. phase-09 v0.2 의 `createUndoStack()` 반환 `UndoStackController` 는 **이미 `clear()`/`flush()` 보유** → 본 retrofit 은 proxy/placeholder/인터페이스에만 additive (구현 본체 불요). 별도 `getStoreUndoableDispatcher` 접근자 export 는 불요 (식별자 = `dispatcher`).

### 6.15 download 헬퍼 + filename

```ts
// src/io/_shared/download.ts
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // R13 — Safari 호환: 50ms 후 revoke
  setTimeout(() => URL.revokeObjectURL(url), 50);
}

// src/io/_shared/filename.ts
export function generateFilename(args: { readonly ext: string }): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const timestamp = `${yyyy}-${mm}-${dd}-${hh}${mi}${ss}`;
  return `chemistry-${timestamp}.${args.ext}`;
}
```

### 6.16 Toolbar retrofit (D-PANEL-INTEGRATION + D-DEAD-PLACEHOLDER)

```tsx
// src/panels/Toolbar/ViewportGroup.tsx (phase-13 retrofit)
import {
  Maximize,
  Box,
  RotateCcw,
  Download,
  Upload,
  Image,
  FileText,
  Atom,
  ChevronDown,
} from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent, IconButton, Tooltip } from '@/components';
import { useUiStore } from '@/stores';
import type { ViewportApi } from '@/viewport';
import type { IoMode } from '@/panels/Io/types';

interface Props {
  readonly apiRef: React.RefObject<ViewportApi | null>;
}

export function ViewportGroup({ apiRef }: Props) {
  const { t } = useTranslation('panels');
  const toggleIo = useUiStore((s) => s.actions.toggleIo);

  const onExportMode = (mode: IoMode) => {
    toggleIo(true, mode);
  };

  return (
    <>
      {/* Frame Active / Frame All / Reset Camera (변경 없음) */}
      <Tooltip content={t('toolbar.frameActive')}>
        <IconButton
          aria-label={t('toolbar.frameActive')}
          onClick={() => apiRef.current?.frameActive()}
        >
          <Maximize size={18} />
        </IconButton>
      </Tooltip>
      {/* ... Frame All / Reset Camera ... */}

      {/* phase-13: Capture PNG 버튼 제거 + Export dropdown 추가 */}
      <Popover>
        <PopoverTrigger asChild>
          <Tooltip content={t('toolbar.export')}>
            <IconButton aria-label={t('toolbar.export')}>
              <Download size={18} /> <ChevronDown size={12} />
            </IconButton>
          </Tooltip>
        </PopoverTrigger>
        <PopoverContent>
          <div className="flex flex-col gap-1 p-2 min-w-44">
            <button
              type="button"
              onClick={() => onExportMode('png-export')}
              className="text-sm px-2 py-1 rounded text-left hover:bg-bg-panel-elevated flex items-center gap-2"
            >
              <Image size={14} /> {t('io.modeLabel.pngExport')}
            </button>
            <button
              type="button"
              onClick={() => onExportMode('json-export')}
              className="text-sm px-2 py-1 rounded text-left hover:bg-bg-panel-elevated flex items-center gap-2"
            >
              <FileText size={14} /> {t('io.modeLabel.jsonExport')}
            </button>
            <button
              type="button"
              onClick={() => onExportMode('sdf-export')}
              className="text-sm px-2 py-1 rounded text-left hover:bg-bg-panel-elevated flex items-center gap-2"
            >
              <Atom size={14} /> {t('io.modeLabel.sdfExport')}
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* phase-13: Import 버튼 추가 */}
      <Tooltip content={t('toolbar.import')}>
        <IconButton aria-label={t('toolbar.import')} onClick={() => onExportMode('json-import')}>
          <Upload size={18} />
        </IconButton>
      </Tooltip>
    </>
  );
}
```

phase-11 §6.6 line 1414–1424 의 임시 download 헬퍼 코드 _전체 제거_.

### 6.17 D-DUPLICATE-INTEGRATION 옵션 Y 의 의의 (phase-12 §11.9 인계의 닫음)

- `addFromMolecule` 시그니처 _무변경_ — phase-11 §4.6 의 `(m: Molecule): MoleculeId` 그대로.
- 모든 기존 호출자 (phase-11 ReactionResult ProductsTab 의 `addFromMolecule(m)`, phase-12 TextInput Submit 의 `addFromMolecule(preview)`) 영향 0 — retrofit 소급 없음.
- duplicate 검출은 _import-flow-specific concern_ — `applyImportedSession` 의 append 모드에서만 적용. replace 모드는 사용자가 새 baseline 의도 → 검출 미수행.
- phase-12 의 모달 측 검사 (옵션 b) 도 그대로 보존 — 사용자 빠른 피드백. 두 호출 경로 (TextInput Submit / JSON Import) 분리.
- phase-12 §11.9 의 인계 ("phase-13 가 결정") 충족 — 결정 = 옵션 Y (옵션 a 가 아닌). retrofit 비용 ↓.

### 6.18 UndoableDispatcher 인터페이스 retrofit (D8)

- 인터페이스 갱신 = phase-09 §4.2 (createUndoStack 본 구현) + phase-07 §6.4 (placeholder) 양쪽 retrofit. phase-07 line 1147 가 _명시 허용_.
- phase-09 가 본 Phase 의 약속 (R9 / §12 line 1140) 으로 이미 clear/flush 동작을 _함수형_ 으로 보유 — 본 Phase 는 인터페이스 노출 (publish) + _호출_ 책임만.
- 추가되는 메서드:
  - `clear(): void` — undo stack + redo stack 모두 비우기 + pendingMerge timeout clear.
  - `flush(): void` — pendingMerge timeout 즉시 dispatch.
- phase-07 placeholder = no-op + logger.debug.
- 호환성: 추가 메서드는 _additive_ — 기존 호출자 (phase-07 의 9 액션 본문) 깨짐 0.

### 6.19 PNG annotation 정책 (D-PNG-ANNOTATION)

phase-09 §12 #13 (a) 의 인계 = "export 직전 selection 보존". 본 Phase 의 닫음 = **viewport selection 색 highlighting 이 captureBlob 자동 포함**:

- phase-08 의 viewport 가 selection.atomIds 의 atom 을 highlight 색으로 렌더 (phase-08 D5 또는 §6.x 의 selection 시각화).
- captureBlob 가 _현재 viewport 그대로_ 캡처 → 선택된 원자가 PNG 에 highlight 색으로 보임.
- 별도 annotation (텍스트 라벨 / ruler / legend) 은 v1 미포함 (Phase 14+).
- 인계 약속 = "selection 보존" — 시각 보존 충족 (명시 annotation 없음).

---

## 7. 파일/모듈 레이아웃

```
src/chemistry/session/                           (신규 — CD6: stores·io 공용 세션 스키마, chemistry 계층)
├── types.ts                                     (SessionFile / MoleculeSnapshot / AtomSnapshot / BondSnapshot / MoleculeOrigin / SerializedSelection)
├── snapshot.ts                                  (toSnapshot / fromSnapshot — 순수 변환)
└── selection.ts                                 (serializeSelection(WithMolecules) / deserializeSelection — 순수 변환)
src/chemistry/compounds/regenerateIds.ts         (신규 — CD1: withRegeneratedIds, 순수; phase-11/12/13 공용)

src/io/                                          (신규 — peer 레이어; 타입은 chemistry/session 에서 import)
├── index.ts                                     (barrel — 외부 노출 표면)
├── png/
│   ├── exportPng.ts
│   └── types.ts                                 (PngExportOptions)
├── json/
│   ├── exportJson.ts
│   ├── importJson.ts
│   └── validate.ts                              (validateSessionFile)
├── sdf/
│   └── exportSdf.ts                             (toSdfBlock(backend,·) × N + $$$$ join)
└── _shared/
    ├── errors.ts                                (ExportError / ImportError 유니온)
    ├── filename.ts                              (generateFilename)
    └── download.ts                              (triggerDownload)

src/panels/Io/                                   (신규)
├── index.tsx                                    (default export — App.tsx 가 직접 import)
├── IoModeTabs.tsx
├── PngExportPane.tsx
├── JsonExportPane.tsx
├── SdfExportPane.tsx
├── JsonImportPane.tsx
├── ImportProgress.tsx                           (LoadingOverlay variant="panel" 래퍼)
├── IoErrorMessage.tsx
└── types.ts                                     (IoMode 별칭)

src/i18n/resources/{ko,en}/
├── panels.json                                  (retrofit — panels.io.* 추가)
└── common.json                                  (retrofit — common.io.error.* 추가)

⟵ retrofit
├── src/panels/registerAll.ts                    (변경 없음 — IoDialog 는 PanelRegistry 미등록, App.tsx 직접 마운트)
├── src/panels/Toolbar/ViewportGroup.tsx         (Capture PNG 임시 헬퍼 제거 + Export dropdown + Import 버튼)
├── src/stores/uiStore.ts                        (PanelKey + isIoOpen + ioInitialMode + 액션)
├── src/stores/moleculeStore.ts                  (replaceAll + applyImportedSession 액션)
├── src/stores/moleculeStore.selectors.ts        (selectAllMoleculeSnapshots + mapIoErrorToKey + IoErrorMapping)
├── src/stores/_shared/undoable.ts               (UndoableDispatcher 인터페이스 + placeholder 에 clear/flush 추가)
├── src/viewport/undo/undoStack.ts               (createUndoStack 본 구현에 clear/flush 추가 — phase-09 소급)
└── src/app/App.tsx                              (<IoDialog viewportApiRef={ref}/> 마운트 추가)
```

### 7.1 노출 경계

`@/io` 가 외부에 노출 (§5.1 barrel):

- entry functions: exportPng, exportJson, exportSdf, importJson, validateSessionFile, triggerDownload
- 타입: PngExportOptions, ExportError, ImportError (세션 스키마 타입 `MoleculeSnapshot`/`SessionFile` 은 `@/chemistry/session/types` 에서 직접 import — io 가 재노출하지 않음, CD6)

`@/io` 가 _미노출_:

- `_shared/*` 의 internal helpers (외부 직접 사용 금지)
- `fromSnapshot`/`toSnapshot` 은 `@/chemistry/session/snapshot` 소속 (io 아님, CD6)

`@/panels/Io` 가 외부에 노출:

- default export `<IoDialog/>` — App.tsx 가 직접 import (PanelRegistry 미경유)

### 7.2 레이어 가드 — `src/io/*` 의 위치

`src/io/*` 는 architecture §4 의 _별도 peer 레이어_ (panels 와 동격, services 와 peer). 의존 방향:

```
panels (Io)  io   components       (UI / R3F + IO 계층 — io 는 React 무관)
       │     │
       └─────┴───▶  stores
                     │
                     ▼
                  services
                     │
                     ▼
                   engine
                     │
                     ▼
                 chemistry  ◀── data
```

- `panels/Io/*` 가 `@/io` 의 entry function 호출.
- `@/io/*` 는 `@/engine` (toSdfBlock) + `@/stores` (snapshot/action) + `@/viewport` (ViewportApi 타입만) 직접 import 가능.
- `@/io/*` 는 React / R3F 의존 _없음_ (UI-free, 테스트 용이 — Vitest 에서 store getState() 만으로 테스트 가능).

**architecture §4.1 다이어그램 retrofit 1 줄 + 1 노드 필요** (§12.2).

### 7.3 ESLint 가드

`.eslintrc` (phase-11 / phase-12 가드 + 본 Phase 추가):

```js
{
  rules: {
    'import/no-restricted-paths': ['error', {
      zones: [
        // ... phase-11 / phase-12 의 기존 zones ...

        // phase-13 추가:
        {
          target: './src/io',
          from: './react',
          message: 'src/io/* must not import React (UI-free layer).',
        },
        {
          target: './src/io',
          from: './src/panels',
          message: 'src/io/* must not import panels (downstream consumer).',
        },
        // panels/Io 만 @/io 직접 import 허용 — 다른 panels/* 차단:
        {
          target: './src/panels/(?!Io).*',
          from: './src/io',
          message: 'Only panels/Io can import from @/io.',
        },
      ],
    }],
    'no-restricted-imports': ['error', {
      patterns: [
        // ... 기존 ...
        // src/io/* 의 React import 차단 (위 path zone 와 보강)
        { group: ['react', 'react-dom'], message: 'src/io/* must not depend on React.' },
      ],
    }],
  },
}
```

P1 정합 + 정확한 화이트리스트.

---

## 8. 테스트 계획

원칙: `architecture.md` §10 정합. 본 Phase 의 핵심 동작:

- (a) PNG / JSON / SDF export 다운로드 round-trip.
- (b) JSON Import (replace + append) 분자 적재 + duplicate skip.
- (c) MoleculeSnapshot ↔ Molecule round-trip 무손실.
- (d) selection 직렬화 + 복원 (index 기반 매핑).
- (e) validateSessionFile 의 schema 위반 분기.
- (f) UndoableDispatcher.clear/flush 동작.
- (g) Toolbar 의 임시 captureBlob 헬퍼 호출 0 검증.

### 8.1 유닛 (Vitest)

`tests/unit/io/`:

| ID      | 대상                                                     | 검증                                                                                                                                                                                                                      |
| ------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **U1**  | `validateSessionFile`                                    | 대표 위반: schemaVersion 누락 / 잘못된 타입, molecules 비배열, atoms[*].elementNumber 범위 외, bonds[*].atom1Index 범위 초과, version mismatch (1 → 2). 각 위반의 SchemaMismatch path 정확. EmptyFile / NoMolecules 분기. |
| **U2**  | `fromSnapshot` ↔ `toSnapshot` round-trip                 | `Molecule` → `toSnapshot` → `fromSnapshot` 결과의 atoms/bonds/canonicalSmiles/totalCharge 동등. atom/bond ID 는 _재발급_ (다름) 검증.                                                                                     |
| **U3**  | `mapIoErrorToKey`                                        | ExportError + ImportError 모든 분기 (CanvasNotReady / CaptureFailed / SchemaMismatch / IncompatibleVersion / FileTooLarge / PartiallyFailed / etc) → 적절한 i18n key + params + action.                                   |
| **U4**  | `exportSdf`                                              | active scope = 단일 record, all scope = N records `$$$$\n` separator. 마지막 record 도 separator 종료.                                                                                                                    |
| **U5**  | `dispatcher.clear()`                                     | undo 스택 비움 + redo 스택 비움 + canUndo()/canRedo() === false. flush 시점에서 pending merge 즉시 발화.                                                                                                                  |
| **U6**  | `generateFilename`                                       | timestamp 형식 `YYYY-MM-DD-HHmmss`. ext 정확. (예: `chemistry-2026-04-30-123456.png`)                                                                                                                                     |
| **U7**  | `applyImportedSession` replace mode                      | 기존 molecules clear + imported batch 적재. activeId 매핑. condition / selection / viewport 적용. dispatcher.clear() 호출 검증.                                                                                           |
| **U8**  | `applyImportedSession` append mode                       | 기존 보존 + imported 분자 중 InChIKey 매칭 시 skip + skipped 카운트. condition / selection / viewport 적용 안 함.                                                                                                         |
| **U9**  | `triggerDownload`                                        | URL.createObjectURL mock + `<a download>` 클릭 + setTimeout 50ms 후 revoke. Safari 호환.                                                                                                                                  |
| **U10** | `serializeSelection` ↔ `deserializeSelection` round-trip | viewport ID 문자열 → index 형식 → viewport ID 문자열 (재생성된 atom ID) 동등 검증.                                                                                                                                        |
| **U11** | `exportJson` scope 필터                                  | active = 활성 분자만. all = 모든 분자. activeId === null 시 active scope 빈 배열.                                                                                                                                         |
| **U12** | `validateSessionFile` IncompatibleVersion                | schemaVersion=2 → IncompatibleVersion 분기 + supportedVersion=1.                                                                                                                                                          |

### 8.2 컴포넌트 (Testing Library)

`tests/component/panels/Io/`:

| ID      | 대상                                    | 검증                                                                                                                                                                  |
| ------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C1**  | `<IoDialog>` mount + close              | open=true 시 표시 + DialogTitle. Esc → onOpenChange(false). 4 tabs 마운트.                                                                                            |
| **C2**  | IoModeTabs 전환                         | tab 클릭 → onChange 호출. initialMode prop 으로 active tab 초기화.                                                                                                    |
| **C3**  | `<PngExportPane>` 옵션 + Export         | format/dpr/transparent 변경 → state 갱신. format='jpeg' 시 transparent disabled + tooltip. Export → exportPng mock 호출 + triggerDownload + notify success + onClose. |
| **C4**  | `<JsonExportPane>` scope + Export       | active scope 선택 → exportJson({scope:'active'}). all scope → all. activeId null 시 active 탭 disabled.                                                               |
| **C5**  | `<SdfExportPane>` 동일 패턴             | exportSdf 호출 + multi-record 결과.                                                                                                                                   |
| **C6**  | `<JsonImportPane>` file + replace       | file 선택 → file state 갱신. Import → importJson mock → applyImportedSession mock → notify success + onClose. ImportProgress 표시.                                    |
| **C7**  | `<JsonImportPane>` append + duplicate   | mode='append' + duplicate 분자 → skipped 카운트 → notify partial + onClose.                                                                                           |
| **C8**  | `<JsonImportPane>` validation error     | 잘못된 file → SchemaMismatch → IoErrorMessage 표시 + "파일 다시 선택" 버튼 → file input click.                                                                        |
| **C9**  | `<IoErrorMessage>` action 분기          | `retry` → onRetry. `pick-file-again` → onPickFileAgain. `reload-page` → window.location.reload mock. action=null → 액션 버튼 미표시.                                  |
| **C10** | Toolbar `<ViewportGroup>`               | Capture PNG 버튼 _미존재_ (제거). Export dropdown 4 옵션 (PNG/JSON/SDF) 클릭 → toggleIo(true, mode). Import 버튼 클릭 → toggleIo(true, 'json-import').                |
| **C11** | **placeholder captureBlob 도달 0 검증** | mock URL.createObjectURL spy 가 _Toolbar 의 임시 헬퍼_ 경로에서 호출 0 회. (Toolbar 구현 변경 회귀 보장.)                                                             |
| **C12** | `<ImportProgress>`                      | visible=true 시 LoadingOverlay 표시 + label. visible=false 시 미표시.                                                                                                 |

### 8.3 E2E (Playwright)

`tests/e2e/io/`:

| ID     | 시나리오                                        | 검증                                                                                                                                                                                                           |
| ------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **E1** | Toolbar → Export → PNG                          | Toolbar Export dropdown → PNG 옵션 → 모달 열림 + PNG tab active → 옵션 (dpr=2x, png, transparent) → "내보내기" → 다운로드 트리거 (mock <a> click).                                                             |
| **E2** | JSON export+import round-trip                   | 분자 N 개 추가 → Export → JSON → 다운로드. 모달 close → file 을 Import 모달의 input 에 mock 주입 → Import 'replace' → 동일 분자 N 개 적재 (canonicalSmiles 동등). selection 복원 (atom index 기반).            |
| **E3** | SDF multi-record                                | 분자 2 개 → SDF export → 다운로드된 file 의 텍스트 = 2 records `$$$$\n` 구분.                                                                                                                                  |
| **E4** | JSON Import replace                             | 기존 분자 3 개 + selection → import file (분자 2 개 + activeId + selection) replace 모드 → moleculeStore 의 분자가 정확히 import 분자 2 개로 대체 + activeId 매핑 + selection 복원.                            |
| **E5** | JSON Import append + duplicate skip + 부분 실패 | 기존 분자 1 개 (CCO) + import file (분자 3 개: CCO 동일 + CCN 신규 + 잘못된 stereo 1 개) append 모드 → 적재 결과 = 1 신규 (CCN), 1 skip (duplicate CCO), 1 fail (PartiallyFailed) → toast partial 메시지 표시. |
| **E6** | 잘못된 JSON file → SchemaMismatch               | non-JSON 파일 (e.g., binary or text) → JsonSyntax 분기. JSON 이지만 schema 위반 (molecules 누락) → SchemaMismatch + path 표시.                                                                                 |
| **E7** | Import 후 dispatcher.clear()                    | import 전 분자 추가 (undoable) → import → import 후 Cmd+Z 누름 → import 직전 상태로 복귀 _안 됨_ (clear() 결과).                                                                                               |
| **E8** | PNG 캡처가 selection 자동 포함                  | viewport 에서 atom 선택 → Toolbar Export → PNG → 다운로드 PNG 의 픽셀에 selection highlight 색 포함 (canvas 픽셀 검증).                                                                                        |

### 8.4 a11y 회귀

`tests/component/panels/Io/a11y/`:

| ID     | 대상                            | 검증                                                                                                           |
| ------ | ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **A1** | IoDialog                        | Radix Dialog role="dialog" + aria-labelledby + aria-describedby. focus trap 작동. close 후 trigger focus 복원. |
| **A2** | IoModeTabs                      | role="tablist" / "tab" / "tabpanel" + aria-selected. 화살표 nav.                                               |
| **A3** | file input                      | `<input type="file">` 의 aria-label + Tab focus + Enter 활성화 (native).                                       |
| **A4** | LoadingOverlay (ImportProgress) | aria-busy="true" + VisuallyHidden 텍스트 (phase-10 §6.9).                                                      |
| **A5** | IoErrorMessage                  | role="alert" + aria-live="assertive".                                                                          |
| **A6** | Switch (replace/append)         | role="switch" + aria-checked + aria-label.                                                                     |

axe 자동 검증은 phase-15.

---

## 9. 리스크 및 대안

| ID      | 시나리오                                                                   | 영향                                                               | 대응                                                                                                                                                                           |
| ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **R1**  | 매우 큰 SessionFile (100+ 분자) JSON.stringify timeout / 메모리            | 브라우저 freeze                                                    | v1 수용. Phase 14 가 측정 후 streaming JSON / chunked write 도입 검토.                                                                                                         |
| **R2**  | PNG 4x DPR 캡처 시 GPU 메모리 부족 → OOM                                   | 브라우저 crash                                                     | exportPng 의 timeoutMs (기본 30s) wrap. captureBlob 가 자체 timeout 미제공 시 본 Phase 가 Promise.race 로 차단. 4x 옵션 사용 시 사용자 안내 (tooltip "고해상도 — 시간 소요").  |
| **R3**  | SDF `$$$$` separator 가 분자 데이터 안에 우연히 포함?                      | 잘못된 record 분리                                                 | RDKit 의 toSdfBlock 가 표준 형식 보장. 본 Phase 는 trust.                                                                                                                      |
| **R4**  | JSON Import 의 atom/bond ID 가 phase-08 D1 의 UUID 형식과 다름             | viewport rendering 호환성                                          | AtomSnapshot/BondSnapshot 가 _id 미보유_ (D5) → import 시 createAtomId/createBondId 자동 재발급 → 호환성 자동 해결.                                                            |
| **R5**  | Cmd+Z 가 import 직전 상태로 undo 가능?                                     | 사용자 혼란                                                        | D8 의 dispatcher.clear() 가 undo 스택 비움 → import 자체가 undoable 아님. C7 / E7 검증.                                                                                        |
| **R6**  | Browser file picker cancel 시 onChange 발화 안 함                          | 액션 무동작                                                        | UserAborted 분기 _자동_ (file === null 상태 유지). 별도 처리 불요.                                                                                                             |
| **R7**  | `addFromMolecule` 시그니처 변경 회피                                       | retrofit 영향                                                      | D-DUPLICATE-INTEGRATION 옵션 Y 채택으로 phase-11 / phase-12 호출자 영향 0.                                                                                                     |
| **R8**  | PubChem origin 분자가 import 후 atoms/bonds 없으면?                        | 재구성 실패                                                        | D5 정합 — MoleculeSnapshot 가 atoms/bonds 항상 포함. cid 만 저장은 v2 후보.                                                                                                    |
| **R9**  | schemaVersion 미래 변경 (v2)                                               | 사용자 혼란                                                        | v1 import 시 IncompatibleVersion 분기 + 사용자에게 "이 파일은 새 버전입니다" 안내. 자동 업그레이드 v1 미지원.                                                                  |
| **R10** | file.text() 가 UTF-8 강제 — 다른 인코딩 SDF 파일 깨짐                      | SDF Import 미지원 (v1 비포함)                                      | 영향 없음 — SDF Import v1 비포함. SDF 표준 = ASCII/UTF-8.                                                                                                                      |
| **R11** | `<input type="file">` 의 a11y — Radix 미제공                               | 키보드 접근성                                                      | native `<input>` 자체 keyboard accessible (Tab + Enter). aria-label 명시. A3 검증.                                                                                             |
| **R12** | dispatcher.clear() 의 phase-07 placeholder vs phase-09 본 구현 비호환      | 빌드 에러                                                          | 본 Phase retrofit 이 인터페이스 양쪽 동시 갱신 (phase-07 placeholder + phase-09 createUndoStack 본 구현). placeholder 는 logger.debug stub.                                    |
| **R13** | Safari 의 download 헬퍼 호환성                                             | revokeObjectURL 즉시 호출 시 download 미작동                       | setTimeout(50ms) 후 revoke. U9 검증.                                                                                                                                           |
| **R14** | `applyImportedSession` 의 부분 실패 트랜잭션 보장                          | replace 모드의 부분 실패 시 _부분 적재_ 상태 (clear 후 일부만 add) | §6.14 #1 의 _사전 검증 단계_ — 모든 fromSnapshot 시도 → replace 모드에서는 _모두 성공_ 시에만 clear+add. 1 개라도 실패 시 PartiallyFailed 즉시 반환 (상태 변경 없음). G8 닫음. |
| **R15** | `<IoDialog>` 의 viewportApiRef forward — PanelRegistry 가 prop 주입 미지원 | 모달 마운트 실패                                                   | D-IO-MOUNT 결정 — App.tsx 가 직접 마운트 (PanelRegistry 미등록). Toolbar 의 `<ToolbarBar/>` 와 동일 패턴.                                                                      |
| **R16** | exportJson 의 동기 JSON.stringify 가 100+ 분자에서 main thread block       | UI freeze ~수백 ms                                                 | v1 수용 (architecture §3.2 의 100ms 응답 예산 위반 가능). Phase 14 가 측정 후 Worker 분리 검토.                                                                                |
| **R17** | i18n 누락 (panels.io / common.io.error 일부 키)                            | "key 자체" 표시                                                    | 본 Phase v1 = 한·영 양쪽 채움 완료. ESLint 검증 (phase-15). 부팅 시 react-i18next 기본 fallback.                                                                               |

---

## 10. 완료 기준 (Definition of Done)

### 10.1 패널 구현

- [x] `<IoDialog>` Dialog mount + Esc + focus 복원 + 4 tabs (C1, C2) — _impl ✓ / C1·C2 phase-15_
- [x] `<PngExportPane>` 옵션 (format/dpr/transparent) + Export (C3) — _impl ✓ / C3 phase-15_
- [x] `<JsonExportPane>` scope + 포함 항목 안내 + Export (C4) — _impl ✓ / C4 phase-15_
- [x] `<SdfExportPane>` scope + Export (C5) — _impl ✓ / C5 phase-15_
- [x] `<JsonImportPane>` file picker + replace/append + Import (C6, C7, C8) — _impl ✓ / C6·C7·C8 phase-15_
- [x] `<ImportProgress>` LoadingOverlay panel-variant (C12) — _inline Spinner fallback (panels → app/layout 차단)_
- [x] `<IoErrorMessage>` ExportError + ImportError 분기 + 액션 버튼 (C9) — _impl ✓ / C9 phase-15_
- [x] Toolbar `<ViewportGroup>` retrofit — Capture PNG 임시 헬퍼 제거 + Export dropdown + Import 버튼 (C10, C11)

### 10.2 모달 마운트 (D-IO-MOUNT)

- [x] `<IoDialog viewportApiRef/>` 를 App.tsx 가 직접 마운트 (PanelRegistry 미등록)
- [x] `registerAllPanels()` 는 phase-12 의 6 회 호출 그대로 (본 Phase 는 7 번째 호출 _추가 안 함_)
- [x] `<ModalHost/>` 와 별도로 작동 — Radix Dialog 의 modal portal 자체로 z-index 정합

### 10.3 io 모듈

- [x] `src/io/index.ts` barrel — 5 entry function + 타입 export
- [x] `exportPng` (ExportError 분기) — _impl ✓ / U6·E1·E8 phase-15. timeout wrap v1 미구현 (TODO 주석)_
- [x] `exportJson` (scope 필터, SessionFile 조립, JSON.stringify) — _impl ✓ / U11·E2 phase-15. selection 직렬화 v1 빈 객체 (TODO)_
- [x] `exportSdf` (multi-record `$$$$` join) — _impl ✓ / U4·E3 phase-15_
- [x] `importJson` (file 읽기, validate, applyImportedSession 호출) — _impl ✓ / E2·E4·E5·E6 phase-15_
- [x] `validateSessionFile` (hand-written, 모든 위반 path) — _impl ✓ / U1·U12 phase-15_
- [x] `triggerDownload` (setTimeout revoke 100ms) — _impl ✓ / U9 phase-15_
- [x] `buildFilename` (local timestamp YYYY-MM-DD-HHMMSS) — _impl ✓ / U6 phase-15_

### 10.4 Store retrofit

- [x] uiStore: `panels.isIoOpen` + `panels.ioInitialMode` + `toggleIo` + `setIoInitialMode` + `PanelKey` 확장
- [x] moleculeStore.actions: `replaceAll`, `applyImportedSession`. `addFromMolecule` **시그니처 무변경** (옵션 Y)
- [x] moleculeStore.selectors: `selectMoleculeSnapshot` 시그니처 동결 + `toSnapshot` 사용 갱신, `selectAllMoleculeSnapshots`, `mapIoErrorToKey(e, ctx)` + `mapExportErrorToKey` / `mapImportErrorToKey` 분리, `IoErrorMapping` 타입
- [x] **MoleculeSnapshot 동결** (phase-07 §5.1 line 461 닫음) — atom id 미보유 (bond 는 index 기반)
- [x] `UndoableDispatcher.clear()` + `flush()` 인터페이스 추가 — placeholder + proxy 위임 양쪽 — _UndoStackController 본 구현 phase-09 v0.2 이미 보유_

### 10.5 i18n

- [x] `panels.io.*` 키 트리 한·영 양쪽 채움 (W1.3 + W3.1 surgical add)
- [x] `common.io.error.*` 분기 한·영 양쪽 채움 (export / import)
- [x] `panels.toolbar.export` + `panels.toolbar.import` 라벨 추가 — _Capture 키 제거_

### 10.6 phase-11 인계 닫음

- [x] (a) Toolbar captureBlob 임시 헬퍼 제거 + Export dropdown 정식 헬퍼 (R12 의 임시 코드 제거)
- [x] (b) JSON / SDF Export 버튼 추가 (Export dropdown 안)
- [x] (c) JSON Import Dialog (`<JsonImportPane/>`) 마운트 가능
- [x] (d) ImportProgress = inline Spinner (panels → app/layout 차단으로 LoadingOverlay 대체)

### 10.7 phase-12 인계 닫음

- [x] (a) Dialog + Tabs + Footer 패턴 재사용 (`<TextInputDialog>` 답습)
- [x] (b) `addFromMolecule` 호출 경로 = applyImportedSession 안에서 사용 (시그니처 무변경)
- [ ] (c) SDF 텍스트 paste mode 가능성 — v1 비포함, §11.1 인계 명시
- [x] (d) **duplicate 검출 통합 결정 — 옵션 Y 채택** (D-DUPLICATE-INTEGRATION). phase-12 §11.9 닫음
- [x] (e) `<PanelErrorBoundary slotName="modal">` 패턴 — Dialog 자체가 ModalHost 외부에서 사용되나 phase-10 ErrorBoundary 는 root 에서 작동
- [x] (f) `mapIngestErrorToKey` 의 `'pubchem'` 분기 활용 — JSON Import 가 PubChem origin 분자 포함 시

### 10.8 phase-09 인계 닫음

- [x] (a) export 직전 selection 보존 — viewport rendering 자동 포함 (D-PNG-ANNOTATION)
- [x] (b) import 시 ID 충돌 → fromSnapshot 의 createAtomId/createBondId 자동 + dispatcher.clear() 명시 호출

### 10.9 phase-08 활용

- [x] `viewportApi.captureBlob({ format, dpr?, transparentBackground? })` 호출 — _format widened to 'png'|'jpeg'|'webp'_
- [ ] timeout wrap (30s 기본) — _v1 미구현. phase-14 후속_

### 10.10 phase-07 동결

- [x] `MoleculeSnapshot` 타입 본 Phase 정확 정의 (atom id 미보유, bond index 기반, origin 메타) — line 461 닫음
- [x] `selectMoleculeSnapshot(id)` 시그니처 보존
- [x] `UndoableDispatcher` 인터페이스 retrofit 정합

### 10.11 phase-03 활용

- [x] `toSdfBlock(mol)` 호출 — `src/io/sdf/exportSdf.ts` 에서 직접 import (sync 시그니처 — 명세의 backend param 불요)

### 10.12 architecture 정합

- [ ] `architecture.md` §4.1 다이어그램 retrofit — _io 노드 이미 §4 디렉터리 트리에 존재 (명세 §1.3 line 15 명시 — retrofit 불요)_
- [x] §1.3 ⑧ "분자/세션 내보내기" 충족 — PNG / JSON / SDF export + JSON import
- [x] §3.6 사용자 데이터 로컬-only — PubChem 캐시 / raw response 미포함 (D5)
- [x] §3.7 Result 패턴 — 모든 io entry function

### 10.13 라이브러리 / ESLint 가드

- [x] 신규 라이브러리 0 (lucide-react phase-11 확정만 사용)
- [x] ESLint zone — `src/io` 의 services/panels/components/app/hooks 차단 (stores/viewport 허용 CD6). panels/(?!Io) → @/io 는 v1 부재 — 강제 안 함.

### 10.14 인계 가능성

- [x] phase-14 가 큰 SessionFile timeout / 4x DPR GPU / drag-and-drop / 명시 파일명 / PNG annotation / reactionStore.lastResult 직렬화 _추가_ 만으로 확장 가능
- [x] phase-15 가 a11y axe + i18n 폴리싱 _추가_ 만

### 10.15 테스트 커버리지 (v0.2 진행 정합)

- [x] **검증 게이트 통과**: `pnpm lint` / `pnpm typecheck` / `pnpm test --run` (443/443 pass — Capture PNG 테스트 1 제거).
- [ ] U1-U12 (validateSessionFile / exportJson / exportSdf / dispatcher.clear / exportPng / mapIoErrorToKey / triggerDownload / importJson etc) — phase-15 polish.
- [ ] C1-C12 컴포넌트 테스트 — phase-15 polish.
- [ ] E1-E8 Playwright — phase-15 (playwright 설치 시점).

---

## 11. 열린 질문 (User Decision / 후속 Phase)

본 Phase 가 D-table 로 잠정 결정했으나 사용자 확정 또는 후속 Phase 결정이 필요한 항목:

1. **SDF Import** — phase-12 의 4 번째 mode 또는 phase-13 의 4 번째 tab. 본 Phase v1 미포함. 사용자 요구 강도에 따라 결정.
2. **selection 복원 형식** — 본 Phase = index 기반 (`{ moleculeIndex, atomIndex }`) 직렬화. uiStore.selection 의 viewport ID 문자열과 분리. v1 포함.
3. **PubChem cid-only import** (재호출) — v1 미지원. Compound 가 cid 만 있고 atoms/bonds 없는 경우 PubChem 재호출로 재구성. v2 후보.
4. **schemaVersion v2 → v1 backward compatibility** — 본 Phase 미정의 (v1 동결만). 미래 변경 시 migration 함수 도입.
5. **reactionStore.lastResult 직렬화** — v1 비포함 (반응 결과 = session 별 의미 모호). Phase 14+ 결정.
6. **settingsStore export** — v1 비포함 (사용자 환경 설정은 session 별 아님). 영구 비포함 (architecture 정합).
7. **drag-and-drop file input** — v1 비포함. Phase 14+.
8. **사용자 명시 파일명** — v1 = `chemistry-{timestamp}.{ext}` 자동. Phase 14+ "이름 지정" 옵션.
9. **PNG annotation** (text label, ruler, legend 등) — v1 = viewport selection 색 자동 포함. 명시 annotation 은 Phase 14+.
10. **zod / JSON Schema 도입 검토** — v1 = hand-written 검증. Phase 14+ 가 schema 복잡도 측정 후.
11. **단축키** (Cmd+S export / Cmd+O import) — v1 비포함. 브라우저 기본 단축키와 충돌 검토 후 Phase 14+.
12. **`<IoDialog/>` 의 PanelRegistry 미등록** (D-IO-MOUNT) — App.tsx 직접 마운트 패턴. PanelRegistry 가 prop 주입 hook 추가 retrofit 시 본 Phase 도 등록 가능 (Phase 14+).
13. **MoleculeSnapshot 의 origin.cid 가 PubChem 응답 raw 메타 일부 (예: name) 포함 여부** — D5 = name 포함 (간단). raw response 전체는 미포함.
14. **JSON file 크기 limit** — 본 Phase v1 = 50 MB (importJson `maxFileSizeBytes`). 사용자 요구 시 Phase 14+ 조정.

---

## 12. 다음 Phase 로의 인계 (Hand-off)

| Phase                             | 본 Phase 가 인계하는 것                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **14 (Performance Optimization)** | (a) **큰 SessionFile JSON.stringify 측정** (R1, R16) — 100+ 분자에서 main thread block 시 streaming JSON / Worker 분리. (b) **4x DPR PNG GPU 메모리 측정** (R2). (c) **drag-and-drop file input** (§11.7). (d) **사용자 명시 파일명 입력** (§11.8). (e) **PNG annotation** 시각 강조 (§11.9). (f) **selection 복원의 옛/새 ID 매핑 개선** (현재 index 기반 — phase-14 가 atom symbol + position 기반 매핑 옵션 검토). (g) **reactionStore.lastResult 직렬화** (§11.5). (h) **PubChem cid-only import** 재호출 옵션 (§11.3). (i) **zod / JSON Schema 도입 검토** (§11.10) — schema 복잡도 측정 후. (j) **단축키** (Cmd+S / Cmd+O) 추가 (§11.11). (k) **JSON file 크기 limit 조정** (§11.14). (l) **PanelRegistry prop 주입 hook 추가 retrofit** (§11.12) — 본 Phase 의 App.tsx 직접 마운트 → PanelRegistry 등록 으로 통합. |
| **15 (Testing & Polish)**         | (a) **i18n 한·영 최종 폴리싱** — `panels.io.*` / `common.io.error.*` 모든 키 자연스러운 표현. (b) **a11y axe 자동 검증** — Dialog focus trap, file input keyboard, LoadingOverlay aria-busy, IoErrorMessage role="alert", Switch / Tabs / Slider 의 ARIA 속성. (c) **CVD 모드** — IoErrorMessage 의 `*` 마커 + 패턴 보조. (d) **다국어 timestamp 형식** — Intl.DateTimeFormat 활용 (예: "2026년 4월 30일 12시 34분 56초"). (e) **clipboard API fallback** — phase-12 §11.14 정합 (SMILES copy 가 아닌 다른 use case 가 있으면).                                                                                                                                                                                                                                                                                           |

### 12.1 소급 수정

- **phase-07**:
  - `uiStore.panels` 에 `isIoOpen` + `ioInitialMode` 필드 추가.
  - `uiStore.actions` 에 `toggleIo` + `setIoInitialMode` 추가.
  - `PanelKey` 유니온에 `'io'` 추가 (uiStore 토글용 — PanelRegistry 미등록이지만 isIoOpen 상태 key 로 사용).
  - `moleculeStore.actions` 에 `replaceAll` + `applyImportedSession` 추가. `addFromMolecule` 시그니처 _무변경_.
  - `moleculeStore.selectors` 에 `selectAllMoleculeSnapshots` + `mapIoErrorToKey` + `IoErrorMapping` 타입 추가. `selectMoleculeSnapshot` 시그니처 동결 명시. (`MoleculeSnapshot` 타입은 아래 chemistry 위치에서 import.)
- **phase-01 (chemistry, CD6)**:
  - `src/chemistry/session/types.ts` 신설 — `MoleculeSnapshot` / `AtomSnapshot` / `BondSnapshot` / `MoleculeOrigin` / `SessionFile` / `SerializedSelection` 타입 정의 (io 가 아닌 chemistry 계층 — stores·io 가 모두 하향 import, phase-07 line 461 동결 책임 이행).
  - `src/chemistry/session/snapshot.ts` 신설 — `toSnapshot` / `fromSnapshot` 순수 변환 (chemistry 타입 + `createAtomId`/`createBondId` 만 의존).
  - `src/chemistry/session/selection.ts` 신설 — `serializeSelection` / `serializeSelectionWithMolecules` / `deserializeSelection` 순수 변환 (stores `applyImportedSession`·io 양쪽 호출 — chemistry 계층이라 stores→io 역행 없음).
  - `src/chemistry/compounds/regenerateIds.ts` — `withRegeneratedIds(m, newId)` (CD1, 순수; **phase-12 가 신설·소유**, phase-11/13 공용 import; 종전 `@/stores/_shared/regenerateIds` 위치 폐기 — chemistry 계층 상향). 본 Phase 는 신설 아님, import 만.
  - **`UndoableDispatcher` 인터페이스에 `clear(): void` + `flush(): void` 추가** (phase-07 §6.4 retrofit) — (a) 동결 인터페이스, (b) `phase07PlaceholderDispatcher` (no-op), (c) `dispatcher` proxy 위임 목록. **(v0.2)** phase-09 v0.2 의 `createUndoStack()`=`UndoStackController` 는 이미 `clear()`/`flush()` 보유 → 본 retrofit 은 (a)(b)(c) 에만 additive.
  - **`getStoreUndoableDispatcher` 접근자 신설 불요 (v0.2 폐기)** — phase-09 v0.2 가 이미 `src/stores/_shared/undoable.ts` 의 `dispatcher` 식별자(proxy) + `@/stores` 배럴 export 보유. io/`applyImportedSession` 은 `import { dispatcher } from '@/stores'` 후 `dispatcher.clear()` (§6.14, arch §4.1 CD6).
  - barrel `src/stores/index.ts`: `dispatcher` 는 phase-09 v0.2 가 이미 export — 본 Phase 는 추가 export 불요 (interface 의 clear/flush 추가만).
- **phase-09**:
  - `createUndoStack()` 본 구현 (`src/viewport/undo/undoStack.ts`) 에 `clear()` + `flush()` 메서드 본문 추가 — 인터페이스 retrofit 정합.
  - `R9` 의 `dispatcher.flush() + clear()` 호출 약속 = 본 Phase 의 인터페이스 추가로 _형식적으로 닫힘_.
- **phase-11**:
  - Toolbar `ViewportGroup.tsx` retrofit:
    - 임시 captureBlob download 헬퍼 본문 _제거_ (§6.6 line 1414–1424).
    - Capture PNG 버튼 _제거_.
    - Export dropdown (Popover + 3 옵션 PNG/JSON/SDF) 추가.
    - Import 버튼 추가.
  - `addFromMolecule` 시그니처 _무변경_ (옵션 Y) — phase-11 §6.12 호출자 영향 0.
  - panels.json 의 placeholder 키 정리는 phase-12 가 이미 처리 — 본 Phase 영역 외.
  - panels.json 에 `panels.toolbar.export` + `panels.toolbar.import` 라벨 추가 (Toolbar 신규 버튼).
- **phase-12**:
  - 변경 _없음_. 모달 측 duplicate 검출 (옵션 b) _보존_ — 사용자 빠른 피드백. phase-12 §11.9 인계가 본 Phase 의 D-DUPLICATE-INTEGRATION 옵션 Y 로 닫힘 (옵션 a 가 아닌 옵션 Y).
- **phase-08** (본 Phase 가 소유하는 retrofit): `CaptureBlobOptions.format` 을 `'png'` → **`'png' | 'jpeg' | 'webp'`** 로 widen (`src/viewport/.../captureBlob` 구현이 `gl.domElement.toBlob` 의 mime 을 `image/${format}` 로 분기). Phase 08 의 Canvas 는 이미 `alpha: true` (phase-08 §5.1) 이므로 PNG 투명 배경 지원 정합. **이 widen 은 본 Phase 의 retrofit 으로 소유** (Phase 14 로 미루지 않음 — 그렇지 않으면 본 Phase 가 타입 체크 불가). `dpr`/`transparentBackground` 시그니처는 불변.
- **phase-03**: 변경 없음 (`toSdfBlock(backend, mol)` 그대로 사용 — phase-03 §5.3 시그니처).
- **phase-01**: i18n namespace 변경 없음 (panels / common 모두 기존 namespace 에 키 추가만).

본 변경은 **본 Phase 구현 PR 의 첫 커밋** 으로 들어간다 (phase-08 D1 / phase-11 §12.1 / phase-12 §12.1 retrofit 패턴과 동일).

### 12.2 architecture.md 변경 — **없음** (이미 정합)

`io` 노드는 architecture.md §4.1 다이어그램에 **이미 존재**하며, io 의 런타임 store read / 주입 액션 호출 정책도 §4.1 (CD6) 이 이미 명시한다. 종전의 "§4.1 retrofit 1줄 + 1노드 추가" 주장은 **거짓이므로 폐기** — 본 Phase 는 architecture.md 를 수정하지 않는다. 참고용 현재 §4.1 다이어그램 (이미 io 포함):

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
         services
           │
           ▼
          engine
           │
           ▼
       chemistry  ◀──  data
```

추가 변경:

- `architecture.md` §4 의 디렉터리 구조에 `src/io/` 가 _이미 등재_ — 변경 없음.
- §6 의 핵심 구성요소 표 "I/O" row 가 _이미 phase-13 매핑_ — 변경 없음.
- §1.3 ⑧ 충족 — 변경 없음.
- §3.6 사용자 데이터 로컬-only 정합 — 변경 없음.

architecture §1.3 ⑧ 충족 (PNG/JSON/SDF export + JSON import). architecture §3.6 정합 (사용자 데이터 로컬-only, PubChem 누출 방지).

---

_문서 버전: 0.2 (구현 정합)_
_작성일: 2026-05-01 (v0.1 초안) / 2026-05-18 (v0.2 — phase-09/10 v0.2 구현과 정합)_

> **v0.2 변경 요약 (forward 정합 — 코드 미변경, phase-13 미구현):**
>
> 1. **`getStoreUndoableDispatcher()` 접근자 폐기** — phase-09 v0.2 가 `src/stores/_shared/undoable.ts` 에 안정 식별자 `dispatcher`(proxy) + `@/stores` 배럴 export 를 이미 보유. io 는 `import { dispatcher } from '@/stores'` 후 `dispatcher.clear()` (§6.14/§12.1/hand-off 09 행/§1 #9 정정).
> 2. **clear/flush retrofit 범위** — 동결 인터페이스 + placeholder + `dispatcher` proxy 위임 3곳에 additive. `createUndoStack()`=`UndoStackController` 는 이미 보유(본체 불요).
> 3. deep import `@/stores/_shared/undo*` → `@/stores` 배럴 (phase-07 §7 가드 / phase-09 §12 정합).
>
> phase-09/10 코드는 본 정합과 무모순. phase-13 구현 시 본 v0.2 spec 대로 작성.
