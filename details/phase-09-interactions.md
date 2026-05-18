# Phase 09 — 3D Interaction System

> 본 문서는 `architecture.md` §13 의 Phase 09 상세 설계서다. 코드 작성은 모든 details 문서의 검토가 끝난 뒤에만 시작한다.
>
> **선행 문서**: `architecture.md` (특히 §3.4, §3.5, §3.7, §3.8, §3.10, §6, §9.2), `details/phase-01-foundation.md`, `details/phase-02-element-data.md`, `details/phase-03-chemistry-engine.md`, `details/phase-04-compound-data-pipeline.md`, `details/phase-05-runtime-data-layer.md`, `details/phase-06-reaction-engine.md`, `details/phase-07-state-management.md`, `details/phase-08-rendering.md`.

---

## 1. 목적 (Purpose)

Phase 08 의 표시 계층 위에 사용자 입력을 도메인 액션으로 잇는 **인터랙션 / 키보드 / 애니메이션 / Undo 본 구현 계층** 을 구축한다. 본 Phase 의 핵심 약속은 다음 네 가지다.

1. **인터랙션 본 구현** — 원자 드래그 (카메라 평면 투영), 단일/Shift-멀티 선택, 두-단계 결합 생성, 결합 차수 변경, 분자/원자/결합 삭제. 모든 인터랙션은 Phase 07 의 9 개 동기 액션을 거쳐 도메인에 commit 된다 (architecture §3.4 ③ "스토어가 유일한 부수효과 지점").
2. **키보드 접근 본 구현 (architecture §3.5)** — Tab/Shift+Tab atom 순환, Esc clearSelection, Delete/Backspace 삭제, B (결합 생성), 1/2/3/A (차수 변경), F (frameActive), R (resetCamera). Cmd+Z / Shift+Cmd+Z 는 **전역 스코프** (텍스트 입력 외 컨텍스트에서 작동).
3. **Undo / Redo 본 구현 (architecture §3.8 마감)** — Phase 07 의 swappable `dispatcher` 싱글톤(`_shared/undoable.ts` 의 export 변수, phase-07 §659–664 패턴) 의 내부 구현을 `createUndoStack()` 결과로 교체. **full Molecule snapshot per undoable action**, 스택 용량 N=50 FIFO drop, 200 ms 그룹 합치기 (드래그 stream), Redo 는 새 액션 시 비움. 인터페이스 (`UndoableDispatcher`) 무변경 — Phase 07 의 9개 액션 본문은 한 줄도 손대지 않는다. **(v0.2 정합)** `createUndoStack` 은 R3F/viewport 의존이 전무한 순수 store snapshot 로직이므로 **stores 레이어 `@/stores/_shared/undo`** 에 위치한다 (architecture §4.1 — 의존을 만족하는 가장 낮은 레이어; phase-10 §6.6 / phase-11 §1942 / phase-13 §4.2 가 본 모듈을 stores 싱글톤으로 참조). 본 §의 초안이 가정한 `src/viewport/undo/` 배치는 stores→viewport 레이어 위반이라 폐기됨. 교체 메커니즘은 `setUndoDispatcher()` 주입 (phase-09 = `<Viewport>` 마운트, phase-10 §6.6 = AppLayout `UndoableDispatcherProvider`) — "export 시점 swap, 호출자 무변경"(phase-11 §1942).
4. **애니메이션 — 분자 등장/퇴장 페이드** — Phase 08 의 `useFadeOnMount` 를 본 구현 (mount 0.15 s, unmount 0.15 s + delayed remove). 분자가 moleculeStore 에 추가/삭제될 때 자동 발화. **반응 trigger crossfade 별도 드라이버는 v1 미구현** — Phase 06 의 `ReactionResult.products` 가 reactionStore 안에만 머무르고 moleculeStore 에 자동 적재되지 않으므로 product 분자는 _viewport 가 그릴 수 없다_. product 적재 파이프라인 결정 시 (Phase 11/14) 기존 mount fade-in 이 자연스럽게 작동 (D16). 결합 단위 보간 역시 Phase 06 atom-map 표면화 필요 — **본 Phase 비포함**, Phase 14+ 인계.

본 Phase 는 architecture §12 의 열린 질문 중 **(없음)** 을 닫지 않는다. 단 §3.8 의 _스택 용량 + 스냅샷 전략_ 은 본 Phase 가 마감한다 (§3.8 마지막 줄의 "Phase 09 상세 설계에서 확정" 약속).

---

## 2. 범위 (Scope)

### 2.1 포함

- **드래그** — `usePointerDrag` 훅. atom 의 카메라 평면 투영 + `moveAtom` 디스패치 (group=`drag:${atomId}`). drag begin 시 `OrbitControls.enabled = false` + `useAtomMatrixSubscription.suspend()`, drag end 시 복원 (Phase 08 §6.5 인계).
- **선택** — `usePointerSelect` 훅. 일반 클릭 = 단일 선택 교체. Shift+클릭 = 토글 add/remove. Esc = clearSelection. 박스 선택은 비포함 (Phase 14+).
- **결합 생성** — `useBondCreateFlow`. 두 atom 선택 + B 키 또는 외부 트리거 (`BondCreateFlowApi.createFromSelection()`) → `addBond(molId, aIndex, bIndex, order=1)`. 다른 분자 atom 끼리는 거부 (분자 합치기는 비목표).
- **결합 차수 변경** — 선택된 결합 1개 + 키보드 1/2/3/A → `setBondOrder`.
- **삭제** — Delete/Backspace 가 선택된 atom/bond/분자 제거 (`removeAtom` / `removeBond` / `removeMolecule`).
- **키보드 네비** — Tab/Shift+Tab 으로 active 분자 안 atom 순환 (atomIndex 순서, D7). 방향키는 본 Phase 미사용 (D7 은 atomIndex 단순 순환만 — 화면 좌표 거리 기반 네비는 Phase 14+).
- **Undo 스택 본 구현** — `createUndoStack({ capacity: 50, mergeWindowMs: 200 })`. snapshot push / pop / redo / canUndo / canRedo / 그룹 합치기 / FIFO drop. Phase 07 의 인터페이스 그대로.
- **분자 mount/unmount 페이드 본 구현** — `useFadeOnMount({ durationMs: 150 })` (D15). Phase 08 의 표면 그대로, 본 구현만 인수.
- **(반응 trigger crossfade 본 Phase 비포함 — D16 참조)** — `useReactionAnimationDriver` 미구현. moleculeStore 에 product 분자가 적재되는 시점이 Phase 11/14 에서 결정되면 그 적재가 자연스럽게 mount fade-in 을 발화한다.
- **카메라 단축키** — F (frameActive), R (resetCamera). `useThree(s => s.controls)` + Phase 08 `viewportApi` 호출.
- **텍스트 입력 가드** — Cmd+Z 등 전역 단축키는 `<input>` / `<textarea>` / `[contenteditable=true]` 에서 _발화하지 않음_ (D10).
- **테스트** — Vitest + jsdom 단위 테스트, `@react-three/test-renderer` 컴포넌트 테스트 (Phase 08 §3.2 그대로 활용).

### 2.2 비포함 (다른 Phase / 비목표)

- **ErrorBoundary 분할** → Phase 10 (architecture §3.7).
- **패널 UI 컴포넌트 / Toolbar** → Phase 11. 본 Phase 는 _키보드 단축키만_. Toolbar 의 "결합 생성" / "Frame Active" 버튼이 본 Phase 의 `BondCreateFlowApi` / `viewportApi.frameActive` 호출.
- **텍스트 입력 패널 (SMILES / formula / InChI)** → Phase 12. 본 Phase 의 D10 가드는 _어떤_ 텍스트 입력에든 적용.
- **Export 트리거 UI** → Phase 13. captureBlob 진입은 Phase 08 표면 그대로.
- **드래그 throttle 임계** → Phase 14. 본 Phase 는 매 mousemove 마다 액션 발화 + group 합치기로 충분 (D17).
- **박스 선택 / drag-drop 결합 생성 UX** → Phase 14+.
- **결합 단위 반응 애니메이션** → Phase 14+ (Phase 06 atom-map retrofit 선행 필요).
- **CVD 시각 회귀 / a11y axe 검증 / Playwright E2E** → Phase 15.
- **Web Worker 분리 (RDKit / Reaction Engine)** → Phase 14. 본 Phase 무영향.
- **VSEPR 기반 자동 좌표 정정** → 비목표 (architecture §1.4).
- **i18n 실제 문구** — 단축키 도움말 키 (`shortcuts.*`) 만 정의. 한·영 문구는 Phase 11 가 채움.

### 2.3 명시적 비결정 (후속 결정)

- **드래그 throttle 임계** — Phase 14 가 측정 후 결정. 본 Phase 는 매 이벤트 발화.
- **multi-hit raycast** — 본 Phase 는 첫 hit 만 처리 (Phase 08 D10 그대로). 분자 겹침 시 사용자 선호가 갈리는 경우 Phase 14+ 가 슬라이더/키 토글 도입.
- **단축키 i18n / OS 차이** — 본 Phase 는 macOS = Cmd, Win/Linux = Ctrl 자동 분기 (`event.metaKey || event.ctrlKey`). 사용자 지정 키맵은 비목표 (Phase 14+ 검토).
- **반응 애니메이션의 결합 단위 보간** — Phase 06 atom-map retrofit 후 도입. 본 Phase 는 분자 crossfade 만.
- **undo 후 selection 복원** — 비-undoable 정책상 미복원 (D14). 사용자 안내 토스트 도입 여부는 Phase 11.

---

## 3. 의존성 (Dependencies)

### 3.1 선행 Phase

| Phase                  | 본 Phase 가 사용하는 자산                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 (Foundation)        | `Brand<T, K>`, `Result<T, E>`, `Logger`, i18n 네임스페이스 (`common`, `chemistry`, `shortcuts`)                                                                                                                                                                                                                                                                                                                                                                                                           |
| 02 (Element Data)      | 직접 import 없음 (Phase 08 경유)                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 03 (Chemistry Engine)  | `Molecule` / `Atom` / `Bond` / `BondOrder`, `Atom.id` / `Bond.id` (Phase 01 정의, CD1 — Phase 03 `toDomain` 가 `createAtomId`/`createBondId` 로 채움)                                                                                                                                                                                                                                                                                                                                                     |
| 04 (Compound Pipeline) | 직접 import 없음                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 05 (Runtime Data)      | 직접 import 없음                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 06 (Reaction Engine)   | `ReactionResult`, `ReactionPredictionKind` — **참조만**. 본 Phase 는 reaction trigger 애니메이션 드라이버를 구현하지 않으므로 (D16) atom-map 도 products 적재 경로도 사용하지 않음                                                                                                                                                                                                                                                                                                                        |
| 07 (Stores)            | `useMoleculeStore` / `useUiStore` / `useReactionStore`, 9 개 동기 편집 액션 (`moveAtom` / `addBond` / `removeBond` / `setBondOrder` / `addAtom` / `removeAtom` / `removeMolecule` / `setActive` / `replace`), `UndoableDispatcher` 인터페이스 (§4.2 placeholder), `UndoableActionKind` enum, `UndoableMeta`, `lastResult` selector, `selection` slice + `setSelection` / `clearSelection`, `removeMolecule` (내부적으로 cascade 처리 — Phase 07 `_crossStore` 내부 헬퍼는 본 Phase 가 직접 호출하지 않음) |
| 08 (Rendering)         | `getAtomIdFromIntersection(intersection)`, `useAtomMatrixSubscription(molId).suspend/resume`, `viewportApi.frameActive` / `frameAll` / `resetCamera`, `atomIdToIndex` / `bondIdToIndex` / `atomIndexToId`, `parseViewportId` / `viewportIdForAtom` / `viewportIdForBond`, `useFadeOnMount` 표면 (본 구현은 본 Phase), `useSelectionStaleGuard` (이미 `<Viewport />` 마운트 — 본 Phase 인계만), R3F `useThree` (controls 접근)                                                                             |

본 Phase 는 **`@/stores`**, **`@/chemistry/*`**, **`@/viewport/*`** 만 import 한다 (Phase 08 P1 동일 가드 + viewport 자체는 본 Phase 의 동급 레이어). Phase 06 / Phase 07 의 reactionStore selector 는 stores 경유로 사용. Phase 08 의 `viewportApi` 는 imperative ref 로 받는다 (Phase 08 §5.2).

### 3.2 외부 라이브러리

| 라이브러리                      | 용도                                                                              | 비고             |
| ------------------------------- | --------------------------------------------------------------------------------- | ---------------- |
| `three` (Phase 01)              | `Vector3`, `Plane`, `Raycaster` (드래그 평면 unproject), `Quaternion`             | 추가 의존성 없음 |
| `@react-three/fiber` (Phase 01) | `useThree` (camera, gl, scene 접근), `useFrame` (애니메이션 보간), pointer events | 추가 의존성 없음 |
| `@react-three/drei` (Phase 01)  | 본 Phase 추가 사용 헬퍼 없음 (raw R3F 이벤트 사용)                                | 추가 의존성 없음 |

**신규 라이브러리 0개.** Phase 08 의 의존성에서 추가가 없다. 단축키 라이브러리 (`mousetrap`, `react-hotkeys-hook` 등) 도 미사용 — 본 Phase 의 단축키 표 (§3.3 D11) 가 단순해 native `KeyboardEvent` 로 충분.

### 3.3 결정 사항 (Plan 단계에서 모두 확정)

| ID      | 질문                                       | 확정 답                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 본문 영향                                                                                                        |
| ------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **D1**  | Undo 스냅샷 전략                           | **full `Molecule` snapshot per undoable action**. immer 의 구조적 공유로 변경 안 된 분자/원자/결합은 메모리 공유 (실 메모리 = 변경된 가지 만큼). reverse-action 미채택                                                                                                                                                                                                                                                                                                                                                                                                                                              | §6.1                                                                                                             |
| **D2**  | Undo 스택 용량                             | **N = 50** 액션 (FIFO drop)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | §4.3, §6.1                                                                                                       |
| **D3**  | Undoable 액션 그룹핑                       | **`UndoableMeta.group` + 200 ms 합치기 윈도우**. flush 트리거: (a) 200 ms 침묵, (b) 다른 group 의 액션, (c) undo/redo 호출. **pointer-up 자체는 flush 트리거 아님**. 그룹 안에서는 첫 액션의 _prev_ 와 마지막 액션의 _next_ 만 보관                                                                                                                                                                                                                                                                                                                                                                                 | §6.1.3                                                                                                           |
| **D4**  | 드래그 좌표 평면                           | **카메라 평면 투영**. 클릭 시점 atom 깊이 고정, 마우스 이동을 그 평면 unproject                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | §6.2                                                                                                             |
| **D5**  | 결합 생성 UX                               | **두 atom 순차 클릭 + B 키 / 외부 트리거**. drag-drop 은 Phase 14+                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | §6.4                                                                                                             |
| **D6**  | 선택 모델                                  | **단일 + Shift-멀티**. 박스 선택은 Phase 14+                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | §6.3                                                                                                             |
| **D7**  | 키보드 원자 네비 알고리즘                  | **atomIndex 순서** (Tab 다음 / Shift+Tab 이전). active 분자 안에서만 순환                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | §6.5.1                                                                                                           |
| **D8**  | 호버 슬라이스 위치 (Phase 08 §11 #3 마감)  | **viewport-local 유지**. multi-hit 가 본 Phase 비포함이라 승격 불요                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | §2.3                                                                                                             |
| **D9**  | 결합 변화 애니메이션 길이                  | **0.3 s** (생성 / 분리). opacity 0↔1 + scale 0.5↔1 (생성), 1→0.5 + opacity 1→0 (분리)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | §6.6.2                                                                                                           |
| **D10** | Undo 단축키 충돌 처리                      | **텍스트 입력 (`<input>`, `<textarea>`, `[contenteditable=true]`) 안에서는 native undo 우선**. 이벤트 target 검사 (`isTextInputTarget(e)`) 헬퍼                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | §6.8                                                                                                             |
| **D11** | 키보드 단축키 표 + 스코프 분리             | **(α) 전역 스코프** (window listener + D10 가드): `Cmd/Ctrl+Z`, `Shift+Cmd/Ctrl+Z`, `Cmd/Ctrl+Y`. **(β) Viewport-focused 스코프** (`<Viewport tabIndex={0}>`): `Tab` / `Shift+Tab`, `Esc`, `Delete` / `Backspace`, `B`, `1` / `2` / `3` / `A`, `F`, `R`. 두 스코프는 별도 핸들러 모듈                                                                                                                                                                                                                                                                                                                               | §4.5, §6.5                                                                                                       |
| **D12** | 드래그 시작/종료 시 OrbitControls 토글     | **drag begin → controls.enabled = false + suspend()**, drag end → enabled = true + resume()                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | §6.2                                                                                                             |
| **D13** | 결합 차수 변경 인터랙션                    | 선택된 결합이 **단일** (1개) 일 때만 키보드 1/2/3/A 발화. 0개 또는 2개+ 는 무시                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | §6.5.2                                                                                                           |
| **D14** | Undo/Redo 가 발화하는 cross-store 효과     | **moleculeStore 만 snapshot 대상**. selection / condition / settings 보존. **부수 효과 (UX)**: atom 삭제를 undo 하면 atom 자체는 복원되지만 selection 은 복원되지 않는다 (selection 비-undoable + stale guard 가 이미 정리). Phase 11 가 사용자 안내 토스트 도입 여부 결정                                                                                                                                                                                                                                                                                                                                          | §6.1.5                                                                                                           |
| **D15** | 분자 등장/퇴장 트랜지션 본 구현            | Phase 08 의 `useFadeOnMount` 를 본 구현. mount = opacity 0→1 0.15 s, unmount = 1→0 0.15 s + delayed removal (`setState` 후 150 ms 뒤 실 unmount)                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | §6.7                                                                                                             |
| **D16** | Phase 06 ReactionResult 변화 시 애니메이션 | **본 Phase v1 = 명시적 reaction-trigger 애니메이션 없음**. 근거: Phase 06 `ReactionResult.products: ReadonlyArray<Molecule>` 는 _reactionStore 안의 객체_ 이며 moleculeStore 에 자동 적재되지 않는다 (Phase 06 §6.1 + Phase 07 §4.3 — `lastResult` 만 보유). 따라서 product 분자는 viewport 가 _그릴 수 없다_. 향후 Phase 11/14 가 _reaction product → moleculeStore 적재 파이프라인_ 을 결정하면, 그 적재가 발화하는 기존 `useFadeOnMount` 가 자연스럽게 fade-in 을 제공 (D15 의 mount fade 재사용). 별도 crossfade 드라이버 불요. **본 Phase 는 `useReactionAnimationDriver` 미구현** — §11 #2 + §11 #11 에 등재. | architecture §6 "간단한 결합 변화 애니메이션" 의 약속은 _적재 후 자연스러운 fade-in_ 으로 충족. 별도 시퀀스 없음 |
| **D17** | 드래그 좌표 update 빈도 제한               | **본 Phase 는 throttle 없음**. D3 의 group 합치기 + Phase 08 setMatrixAt 직접 갱신으로 React 리렌더 회피 → 충분. throttle 임계는 Phase 14                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | §2.3                                                                                                             |

선결정 사항 P-표:

| ID     | 결정                                                                                                                                                                                                                                                                                                                                                                                            | 근거                        |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| **P1** | `viewport/interactions/` 와 `viewport/animations/` 는 stores + chemistry + viewport(자체) 만 import (Phase 08 §7.1 가드). **(v0.2)** undo 코어는 viewport 가 아니라 `@/stores/_shared/undo` (stores 레이어) — viewport→stores 단방향, 위반 0.                                                                                                                                                   | architecture §4.1           |
| **P2** | Phase 07 `UndoableActionKind` 9 개 (atom.add/remove/move, bond.create/break/setOrder, molecule.create/replace/remove) 가 모두 본 Phase 의 dispatcher 통과                                                                                                                                                                                                                                       | P07 §4.2 인계               |
| **P3** | 키보드 이벤트 두 스코프: (α) Viewport-focused = `<Viewport tabIndex={0} onKeyDown>` 합성 이벤트. (β) 전역 = `window.addEventListener('keydown')` + D10 텍스트 입력 가드. 모듈: `installGlobalUndoShortcuts()` (전역) vs `useViewportShortcuts()` (focused)                                                                                                                                      | architecture §3.5 + UX 표준 |
| **P4** | 드래그 mutation 은 매 mousemove 마다 `moveAtom` 디스패치 — group 키 (`drag:${atomId}`) 로 D3 합치기. **(v0.2 정합)** Phase 07 `moveAtom` meta 는 groupless 이고 §1.3 가 본문 불변을 못박으므로, 드래그 컨트롤러가 `beginUndoGroup('drag:'+atomId)`/`endUndoGroup()` 로 ambient group 을 설정하고 dispatcher 가 `meta.group ?? getCurrentUndoGroup()` 로 해소 (`_shared/undoable.ts`).           | snapshot 폭증 방지          |
| **P5** | Undo/Redo 액션 자체는 **비-undoable** (재귀 방지). dispatcher 의 `undo()` / `redo()` 메소드는 별도 경로                                                                                                                                                                                                                                                                                         | 자명                        |
| **P6** | snapshot 은 `Molecule` 트리만 저장 (atomCount × ref + bondCount × ref). immer 의 같은 참조는 메모리 공유                                                                                                                                                                                                                                                                                        | D1 의 메모리 효율 근거      |
| **P7** | Redo 스택은 **새 액션 시 비움** (linear history)                                                                                                                                                                                                                                                                                                                                                | 표준 UX                     |
| **P8** | suspend/resume 계약 보존. **(v0.2 정합)** 본 구현은 drag 가 `setMatrixAt` 을 직접 호출하지 않고 매 mousemove `moveAtom` 디스패치 → Phase 08 `useAtomMatrixSubscription` 이 그 변화로 setMatrixAt(리렌더 0회). 즉 실 경로는 구독을 suspend 하지 않으며(suspend 시 시각 갱신 정지), suspend/resume 은 컨트롤러 API·테스트 계약으로만 유지(§8.3 mock). 라이브 per-molecule 핸들 라우팅은 Phase 15. | 구독 위임 — Phase 08 §6.5.1 |
| **P9** | 단축키 등록은 `<Viewport />` 의 `onKeyDown` 가 합성 이벤트로 위임 (전역 listener 는 Cmd+Z 한정). Phase 10 의 패널이 자체 단축키를 추가할 때 본 Phase 의 keymap 과 충돌하지 않게 우선순위 표 (§4.5) 보존                                                                                                                                                                                         | Phase 10 패널 키 충돌 회피  |

---

## 4. 데이터 모델 / 타입

### 4.1 Undo 자료구조 (`src/stores/_shared/undo/types.ts`, v0.2)

```ts
import type { MoleculeStoreState } from '@/stores/moleculeStore.types';
import type { UndoableMeta, UndoableActionKind } from '@/stores/_shared/undoable';

/**
 * 한 액션의 snapshot. moleculeStore 의 핵심 필드만 저장 — UI / reaction / settings 는 보존.
 *
 * D1 + P6: full snapshot. immer 의 구조적 공유로 prev 와 next 가 같은 참조 가지면 메모리 0 추가 비용.
 */
export interface UndoSnapshot {
  readonly molecules: MoleculeStoreState['molecules'];
  readonly ids: MoleculeStoreState['ids'];
  readonly activeId: MoleculeStoreState['activeId'];
}

/**
 * 스택 항목: 한 그룹의 *시작 직전* prev 와 *마지막* next.
 * D3 의 그룹 합치기 결과로 항목당 snapshot 2개만 보관 (중간 폐기).
 */
export interface UndoEntry {
  readonly meta: UndoableMeta & { readonly kind: UndoableActionKind };
  readonly group: string | null; // meta.group ?? null
  readonly firstAt: number; // 그룹 시작 시각 (ms)
  readonly lastAt: number; // 그룹 마지막 액션 시각 (ms)
  readonly prev: UndoSnapshot; // 그룹 시작 직전
  readonly next: UndoSnapshot; // 그룹 마지막 액션 직후
}

export interface UndoStackState {
  readonly past: ReadonlyArray<UndoEntry>; // 가장 오래된 → 가장 최근. capacity 초과 시 head drop
  readonly future: ReadonlyArray<UndoEntry>; // redo 용. 새 액션 발생 시 비움 (P7)
  /** 진행 중 그룹의 *작성 중 마지막 액션* — 다음 액션이 동일 group + 200ms 안이면 합침. */
  readonly pending: UndoEntry | null;
}

export const DEFAULT_UNDO_STACK: UndoStackState = {
  past: [],
  future: [],
  pending: null,
};
```

### 4.2 `UndoableDispatcher` 본 구현 옵션 (`src/stores/_shared/undo/undoStack.ts`, v0.2)

```ts
import type {
  UndoableDispatcher,
  UndoableMeta,
  UndoableActionKind,
} from '@/stores/_shared/undoable';

export interface UndoStackOpts {
  /** D2: 50. */
  readonly capacity?: number;
  /** D3: 200 ms. */
  readonly mergeWindowMs?: number;
  /** snapshot 채취 진입점 — moleculeStore.getState() 로 디폴트. 테스트 주입 가능. */
  readonly readSnapshot?: () => UndoSnapshot;
  /** snapshot 복원 진입점 — moleculeStore.setState(snap, true) 로 디폴트. */
  readonly writeSnapshot?: (snap: UndoSnapshot) => void;
  /** clock 주입 (테스트). 미지정 시 Date.now. */
  readonly now?: () => number;
}

/** Phase 07 의 UndoableDispatcher 본 구현 — placeholder 와 동일 인터페이스. */
export function createUndoStack(opts?: UndoStackOpts): UndoableDispatcher;
```

### 4.3 KeyMap (`src/viewport/interactions/shortcuts.ts`)

```ts
/**
 * D11 의 단축키 표 — 두 스코프.
 *
 * scope:
 *   'global'   → window.addEventListener (D10 텍스트 입력 가드 적용)
 *   'viewport' → <Viewport tabIndex=0 onKeyDown> (focus 일 때만)
 */
export interface KeyBinding {
  readonly id: string; // 고유 ID — i18n 키 + 도움말 표시
  readonly scope: 'global' | 'viewport';
  /**
   * 매칭 함수. 단일 키 / 조합 / OS 분기 (Cmd vs Ctrl) 모두 표현.
   * 리턴 true 면 이 binding 발화.
   */
  readonly matches: (e: KeyboardEvent) => boolean;
  readonly action: KeyActionId; // §4.4 enum
  readonly i18nLabelKey: string; // shortcuts.{action}
}

export type KeyActionId =
  | 'undo'
  | 'redo'
  | 'navAtomNext'
  | 'navAtomPrev'
  | 'clearSelection'
  | 'deleteSelection'
  | 'createBondFromSelection'
  | 'setBondOrder1'
  | 'setBondOrder2'
  | 'setBondOrder3'
  | 'setBondOrderAromatic'
  | 'frameActive'
  | 'resetCamera';

export const KEY_MAP: ReadonlyArray<KeyBinding>;
```

### 4.4 `KeyActionId` 매핑 — i18n 키 (Phase 11 가 한·영 문구 채움)

```jsonc
// src/i18n/resources/{ko,en}/shortcuts.json (Phase 11 이 채움)
{
  "undo": { "label": "...", "key": "Cmd+Z" },
  "redo": { "label": "...", "key": "Shift+Cmd+Z" },
  // ...
}
```

### 4.5 우선순위 표 (P9 — Phase 10 패널과의 충돌 회피)

| 우선          | 스코프           | 키                                                          | 액션                          |
| ------------- | ---------------- | ----------------------------------------------------------- | ----------------------------- |
| 1 (가장 높음) | text-input gate  | (모든 키)                                                   | native 처리 — 본 Phase 비발화 |
| 2             | global           | Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z, Cmd/Ctrl+Y                    | undo / redo                   |
| 3             | viewport-focused | Tab, Shift+Tab, Esc, Delete, Backspace, B, 1, 2, 3, A, F, R | viewport actions              |
| 4 (Phase 10)  | panel-focused    | (Phase 10 가 정의)                                          | panel actions                 |

본 Phase 가 Phase 10 의 _우선 4_ 영역에 키를 추가하지 않도록 P9 가드. Phase 10 가 동일 키를 등록하면 우선 3 보다 후순위로 처리되도록 _Phase 10 가_ 본 Phase 의 KEY_MAP 을 import 하여 회피해야 한다 (Phase 10 인계 §12).

### 4.6 DragState (`src/viewport/interactions/usePointerDrag.ts`)

```ts
import type * as THREE from 'three';
import type { MoleculeId } from '@/stores/_shared/types';
import type { AtomId } from '@/chemistry/compounds/types';

export interface DragState {
  readonly molId: MoleculeId;
  readonly atomId: AtomId;
  readonly initialPosition: readonly [number, number, number];
  /** 클릭 시점 atom 의 카메라-스페이스 깊이를 보존하는 평면 (월드 좌표계). */
  readonly plane: THREE.Plane;
  /** group key — D3 합치기. */
  readonly groupKey: string; // "drag:${atomId}"
  readonly startedAt: number;
}
```

### 4.7 BondCreateFlowState (`src/viewport/interactions/useBondCreateFlow.ts`)

```ts
export interface BondCreateFlowState {
  readonly stage: 'idle' | 'awaitingSecond';
  /** stage === 'awaitingSecond' 일 때만 의미. */
  readonly firstAtom: { readonly molId: MoleculeId; readonly atomId: AtomId } | null;
}

/** Phase 11 Toolbar 가 외부에서 같은 플로우를 발화할 수 있도록 노출. */
export interface BondCreateFlowApi {
  /** 현재 selection.atomIds 가 정확히 2개면 그 둘로 결합 생성. 그 외에는 no-op. */
  createFromSelection(): boolean;
  readonly state: BondCreateFlowState;
}
```

### 4.8 BondTransitionState (`src/viewport/animations/useBondTransition.ts`)

```ts
export type BondTransitionPhase = 'creating' | 'breaking' | 'idle';

export interface BondTransitionState {
  readonly bondId: BondId;
  readonly phase: BondTransitionPhase;
  /** 0..1 진행도. useFrame 마다 갱신. */
  readonly progress: number;
  readonly startedAt: number;
}
```

본 Phase v1 에서는 결합 단위 보간 미사용 (D16). 본 타입은 분자 mount/unmount 페이드 (D15) 의 progress 추적에도 재사용 (`phase: 'creating'` ≡ mount fade-in, `'breaking'` ≡ unmount fade-out).

### 4.9 (예약) ReactionAnimationState — 본 Phase 미사용

D16 결정에 따라 본 Phase 는 별도 reaction-trigger 드라이버를 두지 않는다. 향후 Phase 11/14 가 product 적재 + 명시적 crossfade 드라이버를 도입하면 이 자리에 타입 정의가 들어간다.

---

## 5. 퍼블릭 API / 인터페이스

본 Phase 의 외부 면은 **`src/viewport/index.ts`** (Phase 08 이 정의한 동일 barrel) 에 다음을 추가 export 한다.

### 5.1 `createUndoStack`

```ts
// src/stores/_shared/undo/undoStack.ts  (v0.2 정합 — stores 레이어)
import type { UndoableDispatcher } from '../undoable';

// UndoableDispatcher 를 확장한 구체 컨트롤러 (flush/clear 는 R9 + phase-13 §4.2;
// 동결 인터페이스 불변, 구체 타입만 확장).
export interface UndoStackController extends UndoableDispatcher {
  flush(): void;
  clear(): void;
}
export function createUndoStack(opts?: UndoStackOpts): UndoStackController;
```

Phase 07 의 swappable `dispatcher` 싱글톤(`_shared/undoable.ts` export 변수)의 내부 구현이 `createUndoStack()` 결과로 교체된다 — `setUndoDispatcher()` 주입, 식별자·인터페이스 불변, 호출자 코드 무변경(phase-11 §1942). **(v0.2 정합)** `createUndoStack` 은 `@/stores/_shared/undo` (stores 레이어) 에 위치하므로 stores→viewport 위반이 없다(초안의 `src/viewport/undo/` 폐기). 공개 경로: `@/stores` 배럴 + `@/stores/_shared/undo` (phase-10 §6.6 import 호환). DI 주입 지점: phase-09 = `<Viewport>` 마운트, phase-10 §6.6 = AppLayout `UndoableDispatcherProvider`.

### 5.2 `KEY_MAP` + `KeyBinding` 타입

```ts
// src/viewport/interactions/shortcuts.ts
export const KEY_MAP: ReadonlyArray<KeyBinding>;
export type { KeyActionId, KeyBinding };

/** Phase 11 Toolbar 가 도움말 표시에 사용. */
export function describeKey(binding: KeyBinding): string;
```

### 5.3 `BondCreateFlowApi`

```ts
// src/viewport/interactions/useBondCreateFlow.ts
export type { BondCreateFlowApi, BondCreateFlowState };
```

`<Viewport />` 안에서 `useBondCreateFlow()` 가 마운트되며, `viewportApi` (Phase 08 §5.2) 에 `createBondFromSelection(): boolean` 메소드가 추가된다 (D14 추가 분).

```ts
// Phase 08 §4.5 가 이미 선언한 ViewportApi (재게시 — 본 Phase 는 인터페이스 변경 없음)
export interface ViewportApi {
  // ... (Phase 08 의 기존 멤버: frameActive/frameAll/resetCamera/captureBlob/getRenderer)
  /** 선택된 atom 이 정확히 2개일 때 결합 생성. 성공 시 true. */
  createBondFromSelection(): boolean;
  /** 현재 undo/redo 가능 여부 — Toolbar 비활성화 표시 용. */
  readonly canUndo: () => boolean;
  readonly canRedo: () => boolean;
}
```

> **Phase 08 인터페이스 소유 — 본 Phase 는 stub 본문만 교체**: `createBondFromSelection` / `canUndo` / `canRedo` 는 **Phase 08 §4.5 가 인터페이스로 이미 선언·소유** (stub: false 반환/no-op). 본 Phase 는 이 인터페이스에 **멤버를 추가하지 않으며**, stub _구현 본문_ 만 실제 동작으로 교체한다 — 시그니처·인터페이스 불변, retrofit/additive 변경 아님. (Phase 07 `phase07PlaceholderDispatcher` → `createUndoStack()` 교체와 동일한 "구현 교체, 인터페이스 동결" 패턴.)
>
> **`canUndo` / `canRedo` 의 React 반응성 주의**: imperative method (`api.canUndo()`) 는 호출 시점 값일 뿐, React 가 변화에 자동 리렌더하지 않는다. Phase 11 의 Toolbar 가 Undo/Redo 버튼 활성/비활성을 토글하려면 다음 둘 중 하나로 구독:
>
> 1. 본 Phase 가 `useUndoStack(): { canUndo: boolean; canRedo: boolean }` selector 훅을 별도 export (`src/stores/_shared/undo/useUndoStack.ts`, v0.2; `@/stores` 배럴 노출). 내부적으로 zustand-vanilla `subscribeWithSelector` + `useSyncExternalStore`. Phase 10 §6.6 의 `UndoableDispatcherProvider` context 가 본 모듈-레지스트리를 대체(단일 인스턴스).
> 2. Phase 11 의 Toolbar 가 직접 `subscribeWithSelector` 외부 구독 + `useState` 동기화.
>
> **권장**: (1) — 본 Phase 가 selector 훅도 함께 export 한다. 시그니처:
>
> ```ts
> export function useUndoStack(): { readonly canUndo: boolean; readonly canRedo: boolean };
> ```
>
> Phase 11 인계 §12 에 명시.

### 5.4 (예약) reaction trigger 애니메이션 — 본 Phase 미구현

D16 결정에 따라 본 Phase 는 reactionStore.lastResult 를 구독해 별도 시퀀스를 발화하는 드라이버를 _구현하지 않는다_. 향후 product 적재 파이프라인이 결정되면 기존 `useFadeOnMount` 가 mount fade-in 을 자연스럽게 제공한다. 본 절은 자리 표시자로 유지 — Phase 11/14 가 적재 정책을 결정한 뒤 별도 details 보강.

### 5.5 단축키 설치

```ts
// src/viewport/interactions/shortcuts.ts
/** 전역 (D10 가드 후만 발화) — `<Viewport />` 마운트 시 1회 호출. */
export function installGlobalUndoShortcuts(opts?: {
  readonly dispatcher: UndoableDispatcher;
}): () => void; // unsubscribe

/** Viewport-focused — `<Viewport tabIndex={0} onKeyDown={…}>` 의 핸들러. */
export function useViewportShortcuts(): (e: React.KeyboardEvent) => void;
```

### 5.6 텍스트 입력 가드 (`src/viewport/interactions/textInputGuard.ts`)

```ts
/** D10: <input> / <textarea> / [contenteditable=true] 안에서 발생한 키 이벤트인지 검사. */
export function isTextInputTarget(target: EventTarget | null): boolean;
```

---

## 6. 핵심 로직 / 전략

### 6.1 Undo 스택 본 구현 (D1, D2, D3)

#### 6.1.1 dispatcher 의 의미

Phase 07 의 `UndoableDispatcher.dispatchUndoable(meta, mutator)` 은 다음 책임을 진다:

- mutator 실행 _전_ moleculeStore snapshot 채취 (`prev`)
- mutator 실행 (실제 store mutation 발생)
- mutator 실행 _후_ snapshot 채취 (`next`)
- 그룹 합치기 정책 (D3) 에 따라 push 또는 merge
- capacity 초과 시 가장 오래된 entry drop
- redo 스택 비움 (P7)

본 Phase 는 위 책임의 _본 구현_ 을 제공하되, mutator 자체는 호출자의 코드 그대로 실행 (Phase 07 §6.4 의 placeholder 와 동일).

#### 6.1.2 snapshot 채취 / 복원

```ts
function readSnapshot(): UndoSnapshot {
  const s = useMoleculeStore.getState();
  return {
    molecules: s.molecules,
    ids: s.ids,
    activeId: s.activeId,
  };
}

function writeSnapshot(snap: UndoSnapshot): void {
  // (v0.2 정합) draft 형 → partial-object 형. zustand 공개 setState 는 immer
  // 미들웨어가 함수 updater 만 produce 로 감싸고 객체 updater 는 그대로
  // shallow-merge 통과 → immer 래핑 여부와 무관히 동일 결과(actions/ingest/
  // canUndo 보존 + 세 키만 교체). snap 의 frozen 참조를 그대로 대입하므로
  // D1/P6 구조적 공유 보존. R12(frozen 대입 후 후속 write) 는 §8.2 가 경험 검증.
  useMoleculeStore.setState({
    molecules: snap.molecules,
    ids: snap.ids,
    activeId: snap.activeId,
  });
}
```

- `setState` 두 번째 인자 `replace = false` (default) — moleculeStore 의 actions 객체는 보존.
- `useUiStore.selection` 은 변경하지 않음. atom 삭제로 stale 이 된 selection 은 Phase 08 의 `useSelectionStaleGuard` 가 다음 microtask 에 정리 (D14).

#### 6.1.3 dispatch 알고리즘 (D3 그룹 합치기 포함)

```pseudo
dispatchUndoable(meta, mutator):
  prev = readSnapshot()
  result = mutator()                              # 호출자 액션 실행
  next = readSnapshot()
  now = clock()

  state = stack.state                             # 모듈-레벨 store
  pending = state.pending
  group = meta.group ?? null

  if pending != null
     and group != null
     and pending.group === group
     and (now - pending.lastAt) < mergeWindowMs:
    # 합치기 — pending 의 next 만 갱신
    stack.set({
      pending: { ...pending, next, lastAt: now },
    })
  else:
    # 새 항목 시작 — 이전 pending flush
    if pending != null:
      stack.set({
        past: dropOldest(state.past concat pending, capacity),
        future: [],                               # P7
        pending: null,
      })
    stack.set({
      pending: { meta, group, firstAt: now, lastAt: now, prev, next },
    })

  # 비-그룹 액션 (group === null) 은 즉시 flush
  if group === null:
    flushPending(now)

  return result
```

#### 6.1.4 flush 트리거 (D3)

flush 는 다음 셋 중 하나에 의해 발화:

(a) **200 ms 침묵**: dispatch 호출 시 `(now - pending.lastAt) >= mergeWindowMs` 이고 새 액션의 group 이 다르거나 null 이면 → 위 알고리즘에서 자동 flush.

(b) **다른 group 의 액션**: 새 액션이 `group !== pending.group` 이면 즉시 flush (위 분기).

(c) **undo / redo 호출**: pending 이 있으면 flush 후 undo/redo 진행.

추가로, `<Viewport />` unmount 시 `dispatcher.flush()` 명시 호출 (메모리 정리). 200 ms 타이머 기반 자동 flush 는 _없음_ — 사용자가 200 ms 침묵 후 다음 액션 호출 시점에 flush. UX 상 문제 없음 (pending 항목은 _현재 상태와 동일_ 한 next 를 보유 → undo 시 정상 복귀).

#### 6.1.5 undo / redo

```pseudo
undo():
  flushPending(now)
  state = stack.state
  if state.past.length === 0: return
  entry = last(state.past)
  writeSnapshot(entry.prev)
  stack.set({
    past: state.past.slice(0, -1),
    future: [entry, ...state.future],
    pending: null,
  })

redo():
  flushPending(now)
  state = stack.state
  if state.future.length === 0: return
  entry = state.future[0]
  writeSnapshot(entry.next)
  stack.set({
    past: dropOldest(state.past concat entry, capacity),
    future: state.future.slice(1),
    pending: null,
  })
```

> **pending.next 의 정확성 보장**: 위 `flushPending(now)` 호출 시, `pending.next` 는 §6.1.3 의 dispatch 알고리즘에 의해 _항상 마지막 dispatch 시점의 readSnapshot 결과_ 로 갱신되어 있다 (line 455 의 `pending: { ...pending, next, lastAt: now }`). 따라서 사용자 시나리오 "드래그 mousemove 10회 → 200 ms 미만 후 Cmd+Z" 에서 pending.next 는 _마지막 mousemove 후 상태_ 와 정확히 일치하며, undo 는 (a) pending 을 past 로 flush 한 뒤 (b) `entry.prev` (드래그 시작 직전 상태) 로 복귀시켜 _드래그 직전 상태_ 를 정확히 복원한다. 별도 "현재 상태 재snapshot" 단계는 필요하지 않다 (이미 dispatch 가 매번 갱신하므로).

`writeSnapshot(prev)` 후 `useSelectionStaleGuard` 가 자동으로 selection 정리 (D14 — atom 복원으로 stale 이 _해소_ 되거나 atom 삭제 redo 로 stale 이 _생성_ 되거나).

`canUndo` = `past.length > 0 || pending != null`. `canRedo` = `future.length > 0`.

#### 6.1.6 메모리 비용

`UndoSnapshot` 은 `molecules: Record<MoleculeId, Molecule>` 참조를 그대로 보유. immer 가 변경된 분자만 새 객체로 만들고 나머지는 참조 공유 → 50 entry × 평균 분자 5개 × 평균 atom 30개 ≈ 7,500 atom-equiv. atom 이 `{ id, element, position, formalCharge, implicitHCount }` 5 필드 ≈ 80 B → 600 KB 상한 (실제로는 구조적 공유 덕에 훨씬 작음). architecture §9.1 의 500 KB 초기 번들 예산과는 무관 (런타임 메모리).

### 6.2 드래그 (D4, D12, P8)

#### 6.2.1 평면 산출

클릭 시점 atom 의 월드 좌표 `P`, 카메라 forward 벡터 `n` (정규화) 으로 평면 정의:

```ts
const cameraForward = camera.getWorldDirection(new THREE.Vector3());
const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
  cameraForward, // normal
  P, // point on plane
);
```

#### 6.2.2 mousemove → unproject

```ts
function onPointerMove(e: PointerEvent): void {
  const ndc = new THREE.Vector2(
    (e.clientX / canvas.clientWidth) * 2 - 1,
    -(e.clientY / canvas.clientHeight) * 2 + 1,
  );
  raycaster.setFromCamera(ndc, camera);
  const target = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(plane, target)) {
    moleculeStore.actions.moveAtom(drag.molId, atomIdToIndex(activeMolecule, drag.atomId), [
      target.x,
      target.y,
      target.z,
    ]);
  }
}
```

- `moveAtom` 액션은 D3 합치기로 단일 entry. **(v0.2 정합)** Phase 07 `moveAtom` meta 는 group 을 싣지 않으며 §1.3 가 본문 불변을 못박으므로, 위 의사코드의 `group: drag.groupKey` 직접 전달은 폐기. 대신 drag 컨트롤러가 `beginUndoGroup('drag:'+atomId)`/`endUndoGroup()` 로 ambient group 을 설정하고 dispatcher 가 `meta.group ?? getCurrentUndoGroup()` 로 해소(P4). 아래 §6.2.3 의사코드의 `setMatrixAt 직접 호출`·`positionSubHandle.suspend()` 도 illustrative — 실 구현은 `moveAtom` 디스패치 → Phase 08 구독이 setMatrixAt(리렌더 0회) 위임이므로 실 경로는 구독을 suspend 하지 않는다(P8 정합).
- atomIdToIndex 의 -1 분기 (분자가 사라진 경우) 는 drag end 로 분기 — `useSelectionStaleGuard` 가 selection 도 정리.

#### 6.2.3 drag begin / end

```ts
function onPointerDown(e: PointerEvent): void {
  const picked = getAtomIdFromIntersection(/* ... */);
  if (!picked || picked.kind !== 'atom') return;
  e.stopPropagation(); // OrbitControls 차단 (Phase 08 §6.7.2)

  // P8: 구독 일시정지 — 드래그 자체가 setMatrixAt 직접 호출
  positionSubHandle.current?.suspend();
  // D12: OrbitControls 비활성
  orbitControls.enabled = false;

  setDragState(buildDragState(picked /* camera, atom */));
  canvas.setPointerCapture(e.pointerId);
}

function onPointerUp(e: PointerEvent): void {
  if (drag == null) return; // drag 미진행 중 (이미 정리됨) 이면 무시
  positionSubHandle.current?.resume();
  orbitControls.enabled = true;
  setDragState(null);
  // setPointerCapture 로 캡처된 pointer 를 명시 해제. 누락 시 다음 pointerdown 까지 capture 잔존 →
  // OrbitControls 재활성에도 불구하고 카메라 회전이 시작되지 않는 묵음 버그 가능성. 명시 호출로 안전.
  if (canvas.hasPointerCapture(e.pointerId)) {
    canvas.releasePointerCapture(e.pointerId);
  }
  // dispatcher 의 group 은 200 ms 침묵 후 flush — pointer-up 자체는 flush 트리거 아님 (D3)
}

// onPointerCancel — 시스템이 pointer 를 강제로 회수 (예: 다른 앱이 포커스 가져감, 터치 인터럽트):
function onPointerCancel(e: PointerEvent): void {
  if (drag == null) return;
  // 정리는 onPointerUp 와 동일 — 다만 dispatchUndoable 이 발화하지 않도록 마지막 mutator 는 호출 안 함
  // (드래그 중간 위치는 이미 last dispatch 로 반영됨; cancel 은 *현재 위치 그대로 종료* 의미).
  positionSubHandle.current?.resume();
  orbitControls.enabled = true;
  setDragState(null);
  if (canvas.hasPointerCapture(e.pointerId)) {
    canvas.releasePointerCapture(e.pointerId);
  }
}
```

`canvas.setPointerCapture` 로 마우스가 atom 밖으로 나가도 drag 가 유지된다. **반드시 `releasePointerCapture` 로 짝을 맞춰야** 한다 — 캡처 잔존 시 OrbitControls 가 재활성되어도 입력을 받지 못하는 미묘한 잠금 상태가 생긴다. `onPointerCancel` 도 등록하여 시스템 이벤트에 안전 (`<Viewport>` 의 `onPointerCancel` prop 또는 `addEventListener('pointercancel')`).

### 6.3 선택 (D6)

```ts
function onPointerDown(e: PointerEvent): void {
  if (drag != null) return; // drag 진행 중이면 선택 우회
  const picked = getAtomIdFromIntersection(/* first hit */);
  if (!picked) {
    if (!e.shiftKey) uiStore.actions.clearSelection();
    return;
  }
  const sid =
    picked.kind === 'atom'
      ? viewportIdForAtom(picked.molId, picked.atomId)
      : viewportIdForBond(picked.molId, picked.bondId);

  if (e.shiftKey) {
    // 토글 add/remove
    const cur = uiStore.getState().selection;
    const isAtom = picked.kind === 'atom';
    const list = isAtom ? cur.atomIds : cur.bondIds;
    const next = list.includes(sid) ? list.filter((x) => x !== sid) : [...list, sid];
    uiStore.actions.setSelection({
      atomIds: isAtom ? next : cur.atomIds,
      bondIds: isAtom ? cur.bondIds : next,
    });
  } else {
    // 단일 선택 교체
    uiStore.actions.setSelection({
      atomIds: picked.kind === 'atom' ? [sid] : [],
      bondIds: picked.kind === 'bond' ? [sid] : [],
    });
  }
}
```

- atom 선택과 bond 선택이 _동시에_ 존재 가능 (bond 차수 변경 + 추가 atom 강조 등). UX 단순화 위해 본 Phase 는 동시 가능, Phase 11 가 분리 표시 결정.
- `useSelectionStaleGuard` (Phase 08) 가 후처리.

### 6.4 결합 생성 플로우 (D5)

`useBondCreateFlow` 는 두 경로를 처리:

#### 6.4.1 키보드 B 트리거

```ts
function onShortcutB(): void {
  const sel = uiStore.getState().selection;
  if (sel.atomIds.length !== 2) return;
  const [a, b] = sel.atomIds.map(parseViewportId).filter((x) => x?.kind === 'atom');
  if (!a || !b || a.molId !== b.molId) {
    // 다른 분자끼리는 거부 — Phase 11 가 toast 표시 (i18n: 'shortcuts.bondCreate.diffMolecule')
    uiStore.actions.notify({
      level: 'warn',
      messageKey: 'shortcuts.bondCreate.diffMolecule',
    });
    return;
  }
  const mol = useMoleculeStore.getState().molecules[a.molId];
  const aIndex = atomIdToIndex(mol, a.atomId);
  const bIndex = atomIdToIndex(mol, b.atomId);
  if (aIndex < 0 || bIndex < 0) return;
  if (existsBond(mol, aIndex, bIndex)) {
    // 이미 결합 있으면 차수 +1 (1→2→3→1)
    const bondIdx = findBondIndex(mol, aIndex, bIndex);
    const cur = mol.bonds[bondIdx].order;
    const next = cur === 1 ? 2 : cur === 2 ? 3 : 1;
    moleculeStore.actions.setBondOrder(a.molId, bondIdx, next);
  } else {
    moleculeStore.actions.addBond(a.molId, aIndex, bIndex, 1);
  }
}
```

> **`existsBond` / `findBondIndex` 헬퍼 위치**: 본 헬퍼들은 `src/chemistry/compounds/bondUtils.ts` 의 **순수 도메인 함수** 로 위치한다 (viewport 로컬 모듈 아님). 근거:
>
> 1. 두 함수는 R3F / DOM 의존이 전혀 없는 순수 그래프 검색 (atom index 쌍 비교) 이다 → chemistry 레이어가 적합 (architecture §4.1).
> 2. Phase 06 (Reaction Engine) 의 휴리스틱 알고리즘 §6.7 step 6 ("기존 결합 있으면 order 증가") 에서 동일 로직이 필요 → 도메인 계층에 두면 phase-06 도 import 가능, 중복 구현 회피.
> 3. 단위 테스트 용이 — `tests/unit/chemistry/compounds/bondUtils.test.ts` 에서 R3F mock 없이 직접 검증.
>
> 시그니처:
>
> ```ts
> // src/chemistry/compounds/bondUtils.ts
> export function existsBond(mol: Molecule, aIdx: number, bIdx: number): boolean;
> export function findBondIndex(mol: Molecule, aIdx: number, bIdx: number): number; // -1 if not found
> ```
>
> 본 Phase 가 위 두 함수를 chemistry 레이어에 _추가_ (소급 retrofit) 한다. Phase 01 의 chemistry/compounds 디렉터리는 본 Phase 가 자유롭게 확장 가능 (architecture §4.1: 동일 레이어 내 추가는 단방향 의존 위반 아님).

#### 6.4.2 외부 트리거 (Toolbar 등 — Phase 11 인계)

`viewportApi.createBondFromSelection(): boolean` 이 동일 로직 호출. 성공 시 true, 실패 (선택 != 2 또는 다른 분자) 시 false.

### 6.5 키보드 네비 (D7, D11)

#### 6.5.1 Tab / Shift+Tab — atom 순환

```ts
function onTab(direction: +1 | -1): void {
  const ui = uiStore.getState();
  const ms = useMoleculeStore.getState();
  const activeMol = ms.activeId ? ms.molecules[ms.activeId] : null;
  if (!activeMol || activeMol.atoms.length === 0) return;

  // 현재 선택 atom 의 첫 번째를 기준 — 없으면 atomIndex 0 부터 시작
  const sel = ui.selection.atomIds.map(parseViewportId).filter(x => x?.kind === 'atom');
  const cur = sel.find(s => s.molId === activeMol.id);
  const curIdx = cur ? atomIdToIndex(activeMol, cur.atomId) : -1;
  const nextIdx = curIdx < 0
    ? (direction > 0 ? 0 : activeMol.atoms.length - 1)
    : (curIdx + direction + activeMol.atoms.length) % activeMol.atoms.length;

  const nextAtomId = activeMol.atoms[nextIdx].id;
  uiStore.actions.setSelection({
    atomIds: [viewportIdForAtom(activeMol.id, nextAtomId)],
    bondIds: [],
  });
}
```

`event.preventDefault()` 호출하여 브라우저 Tab focus 이동 차단 — `<Viewport />` 가 focus 이고 viewport-focused 스코프 (P3) 일 때만.

#### 6.5.2 결합 차수 변경 (D13) — 1/2/3/A

```ts
function onBondOrderKey(order: BondOrder): void {
  const sel = uiStore.getState().selection;
  if (sel.bondIds.length !== 1) return; // D13: 단일 결합만
  const parsed = parseViewportId(sel.bondIds[0]);
  if (parsed?.kind !== 'bond') return;
  const mol = useMoleculeStore.getState().molecules[parsed.molId];
  const idx = bondIdToIndex(mol, parsed.bondId);
  if (idx < 0) return;
  moleculeStore.actions.setBondOrder(parsed.molId, idx, order);
}
```

`A` 는 `'aromatic'`. 1/2/3 은 숫자.

#### 6.5.3 삭제 — Delete / Backspace

```ts
function onDelete(): void {
  const sel = uiStore.getState().selection;

  // bond 우선 — bond 삭제는 atom 보존
  for (const sid of sel.bondIds) {
    const p = parseViewportId(sid);
    if (p?.kind !== 'bond') continue;
    const mol = useMoleculeStore.getState().molecules[p.molId];
    const idx = bondIdToIndex(mol, p.bondId);
    if (idx >= 0) moleculeStore.actions.removeBond(p.molId, idx);
  }

  for (const sid of sel.atomIds) {
    const p = parseViewportId(sid);
    if (p?.kind !== 'atom') continue;
    const mol = useMoleculeStore.getState().molecules[p.molId];
    const idx = atomIdToIndex(mol, p.atomId);
    if (idx >= 0) moleculeStore.actions.removeAtom(p.molId, idx);
  }
}
```

선택 분자가 _완전 빈_ 상태가 되면 (atom 0개) 본 Phase 는 분자 자체는 보존. 사용자가 명시적으로 분자 삭제하려면 Toolbar 의 "Remove Molecule" (Phase 11) 사용. 이는 architecture §3.8 의 "분자 삭제" 동작이 별도 undoable kind (`molecule.remove`) 로 이미 분리된 것과 일관.

> **루프 안정성 주의**: 위 두 for-loop 는 `sel.bondIds` / `sel.atomIds` 를 한 번만 capture 한 뒤 매 iteration 마다 `getState()` + `bondIdToIndex(mol, bondId)` / `atomIdToIndex(mol, atomId)` 로 _현재_ 인덱스를 재계산한다. atom/bond 삭제 후 인덱스가 shift 되어도 selection 의 stable ID (`AtomId` / `BondId`, Phase 01 식별 모델 CD1) 는 **변하지 않으므로** 루프는 안전하다. 이 안정성이 하이브리드 식별 모델(CD1)의 핵심 가치 — index 기반이었다면 매 삭제 후 후속 인덱스를 재계산해야 했을 것이다.

#### 6.5.4 Esc — clearSelection

```ts
function onEsc(): void {
  uiStore.actions.clearSelection();
}
```

#### 6.5.5 F / R — 카메라

```ts
function onFrameActive(): void {
  viewportApi.frameActive();
}
function onResetCamera(): void {
  viewportApi.resetCamera();
}
```

### 6.6 반응 결과 애니메이션 — D16 결정에 따라 _본 Phase 미구현_

본 Phase 는 reactionStore.lastResult 변화를 구독하는 별도 드라이버를 두지 않는다. 근거 (D16 재인용):

1. Phase 06 의 `ReactionResult.products: ReadonlyArray<Molecule>` 는 reactionStore.lastResult 안의 객체이며, **moleculeStore 에 자동 적재되지 않는다** (Phase 06 §6.1 + Phase 07 §4.3 그대로).
2. viewport 는 `moleculeStore.molecules` 만 그린다 (Phase 08 §6.2). 따라서 product 분자는 viewport 가 _그릴 수 없다_.
3. 향후 Phase 11 (ReactionResult 패널) 또는 Phase 14 (product → moleculeStore 적재 파이프라인) 가 결정되면, 그 적재 액션이 발화하는 **기존 `useFadeOnMount` (§6.7)** 가 자연스럽게 fade-in 을 제공.
4. reactant 분자들은 그대로 moleculeStore 에 남아 있을 수도, 사용자가 명시 삭제할 수도 있다 — fade-out 발화 여부는 _분자 삭제 액션_ 이 결정 (이미 unmount fade 가 D15 로 있음).

따라서 architecture §6 의 "간단한 결합 변화 애니메이션" 약속은:

- (v1 본 Phase) **mount/unmount 페이드 자연 동작** 으로 충족.
- (v2+) Phase 11/14 가 product 적재를 결정한 뒤, 필요 시 본 Phase animation 모듈에 _명시적 reaction-trigger crossfade 드라이버_ 를 추가 (별도 details PR).

결합 단위 보간 역시 Phase 06 atom-map 표면화 (`ReactionResult.atomMap`) 가 선행 — Phase 14+ 인계.

**구체 인계 경로**: Phase 11 의 ReactionResult 패널 또는 Phase 14 가 _product → moleculeStore 적재 액션_ 을 정의하면, 그 액션이 발화하는 시점에:

1. `moleculeStore.molecules` 에 product `Molecule` 이 새로 들어오므로 §6.7 의 `useFadeOnMount` (mount 0→1, 150 ms easeInOutCubic) 가 자동 발화 → product 분자가 자연스럽게 등장.
2. (선택) reactant 분자를 moleculeStore 에서 제거하면 §6.7 의 unmount fade-out 이 자동 발화 → reactant 가 자연스럽게 사라짐.
3. 추가 시각화 (결합 단위 progress, atom-by-atom 변환 등) 가 필요하면 본 Phase animation 모듈에 `useReactionAnimationDriver` 또는 `useBondTransition` 을 _별도 details PR_ 로 도입. **본 Phase 의 §4.4 `BondTransitionState` 타입** 은 이를 위한 자리 표시자 (현재 mount/unmount fade 의 progress 추적에도 재사용 중).

즉, *적재 정책 결정만 끝나면 본 Phase 의 코드 변경 없이 자연스러운 장면 전환이 작동*하며, "결합 단위" 수준의 정밀한 시각화만이 후속 Phase 의 일.

본 Phase §11 #2, §11 #11 에 등재.

### 6.7 분자 mount/unmount 페이드 (D15)

`useFadeOnMount` 의 본 구현:

```ts
export function useFadeOnMount(opts?: UseFadeOnMountOpts): {
  readonly opacity: number;
  readonly transparent: true;
} {
  const durationMs = opts?.durationMs ?? 150;
  const [opacity, setOpacity] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  useFrame(({ clock }) => {
    if (startedAtRef.current == null) startedAtRef.current = clock.elapsedTime * 1000;
    const elapsed = clock.elapsedTime * 1000 - startedAtRef.current;
    const t = Math.min(1, elapsed / durationMs);
    setOpacity(easeInOutCubic(t));
  });

  return { opacity, transparent: true };
}
```

unmount 시 부모 (`MoleculeGroup`) 를 감싼 `withMoleculeFade` 가 1→0 보간(`setInterval` 샘플링, useFrame 비의존) + durationMs 후 실 unmount (`React.startTransition` + `setTimeout`). **(v0.2 정합)** 초안 명칭 `useMoleculeFadeWrapper` 는 hook 이 아닌 HOC 팩토리(반환 컴포넌트만 hook 사용)이므로 `use*` 접두사가 `react-hooks/rules-of-hooks` 의 top-level 호출 오탐을 유발 → HOC 관례명 `withMoleculeFade` 로 노출(파일명은 §7 그대로 `useMoleculeFade.ts`). 제네릭이 교차타입에서 `fadeOpacity` 를 역산 못 하므로 호출부는 외부 props 를 명시 타입 인자로 지정한다:

```ts
// src/viewport/animations/useMoleculeFade.ts
/** unmount 시 fade-out 후 실 unmount 시키는 HOC 팩토리. */
export function withMoleculeFade<P extends { readonly molId: MoleculeId }>(
  Component: React.ComponentType<P & { fadeOpacity: number }>,
  opts?: { durationMs?: number },
): React.ComponentType<P>;
// 사용: const FadedMoleculeGroup = withMoleculeFade<{ molId; transform }>(MoleculeGroup);
```

> **시각 런타임 갭 (v0.2 — Phase 14/15 인계)**: Scene 은 store `ids` 로 키잉하므로 `removeMolecule` 시 wrapper 가 즉시 unmount 되어 delayed-unmount 가 라이브에서 발화하지 않는다(격리 단위 테스트 §8.8 은 발화 검증). mount fade-in 의 `fadeOpacity` 도 instanced 머티리얼로 threading 안 됨. 즉 **본 Phase 는 fade 계약·훅·delayed-unmount 를 단위 검증 수준으로 제공**하고, Scene retained-id 렌더 + 렌더러 머티리얼 opacity threading 의 _라이브 결선/시각 회귀_ 는 Phase 14/15 (Phase 08 scene scope-cut 선례 + §2.2 a11y/시각 회귀 Phase 15 이연과 일관). §10/§11/§12 참조.

`MoleculeGroup` 컴포넌트가 이 wrapper 로 감싸진다. moleculeStore 에서 분자가 사라져도 wrapper 는 즉시 unmount 하지 않고, opacity 1→0 보간 후 unmount.

### 6.8 텍스트 입력 컨텍스트 분기 (D10)

```ts
export function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if (target.isContentEditable) return true;
  return false;
}
```

전역 단축키 listener:

```ts
function onGlobalKeyDown(e: KeyboardEvent): void {
  if (isTextInputTarget(e.target)) return; // D10 가드
  for (const binding of KEY_MAP) {
    if (binding.scope !== 'global') continue;
    if (binding.matches(e)) {
      e.preventDefault();
      dispatchAction(binding.action);
      return;
    }
  }
}
```

### 6.9 OrbitControls 토글 (D12)

§6.2.3 에서 이미 다룸. 추가로:

- `viewportApi.captureBlob` 호출 중 (Phase 13 export) controls 토글 _변화 없음_ — captureBlob 은 1프레임 강제 렌더만 (Phase 08 §6.10).
- 키보드 R (resetCamera) 이 controls.target 을 갱신 — drag 진행 중에는 R 무시 (drag != null 가드).

### 6.10 `useSelectionStaleGuard` 의 마운트 위치

Phase 08 §6.5.2 가 `<Viewport />` 안에서 이미 마운트. **본 Phase 는 추가 마운트 불요**. 본 Phase 의 모든 인터랙션 액션 (drag end, delete, undo/redo, addBond, removeBond) 이 moleculeStore 의 mutation 을 발생시키면 다음 microtask 안에 guard 가 selection 을 자동 정리한다. 본 Phase 의 액션 본문에 명시 호출은 없다 (Phase 08 의 약속 그대로).

---

## 7. 파일 / 모듈 레이아웃

```
src/viewport/
├── interactions/
│   ├── usePointerDrag.ts                 # 드래그 (D4, D12, P8)
│   ├── usePointerSelect.ts               # 클릭 선택 (D6)
│   ├── useViewportShortcuts.ts           # Viewport-focused 단축키 핸들러
│   ├── useKeyboardNav.ts                 # Tab cycle (D7) — useViewportShortcuts 가 호출
│   ├── useBondCreateFlow.ts              # 결합 생성 (D5)
│   ├── shortcuts.ts                      # KEY_MAP (D11), describeKey, installGlobalUndoShortcuts, isTextInputTarget
│   ├── textInputGuard.ts                 # D10 헬퍼
│   └── _focus.ts                         # <Viewport tabIndex=0> focus 관리
│   └── _focus.ts                         # <Viewport tabIndex=0> focus 관리 (preventBrowserTab 은 Phase 10/15 예약)
├── animations/
│   ├── useFadeOnMount.ts                 # D15 본 구현 (Phase 08 표면 재수출 — _shared/useFadeOnMount.ts)
│   ├── useMoleculeFade.ts                # withMoleculeFade HOC (delayed unmount, v0.2 개명)
│   ├── animationRegistry.ts              # 진행 중 애니메이션 cancel 관리 (R4)
│   └── easing.ts                         # easeInOutCubic/Out/In + fadeProgress/exitOpacity 순수 함수
                                          # NOTE: useReactionAnimationDriver / useBondTransition 은 D16 + §11 #2 에 따라 v1 미구현

# (v0.2 정합) undo 코어는 viewport 가 아니라 stores 레이어 — R3F 비의존 순수
# store 로직 + phase-10/11/13 가 stores 싱글톤으로 참조 (architecture §4.1).
src/stores/_shared/
├── undoable.ts                           # swappable `dispatcher` 싱글톤 + setUndoDispatcher
│                                         # + ambient group(beginUndoGroup/endUndoGroup/getCurrentUndoGroup)
│                                         # (Phase 07 인터페이스/액션 본문 불변, 내부 구현만 swap)
└── undo/
    ├── index.ts                          # 공개 경계: createUndoStack/useUndoStack/UndoStackOpts + UndoableDispatcher 재수출
    ├── undoStack.ts                      # createUndoStack (UndoStackController: +flush/clear) + useUndoStack 레지스트리
    ├── useUndoStack.ts                   # §5.3 권장(1) selector 훅 (Phase 11 Toolbar; Phase 10 가 context 로 대체)
    ├── snapshot.ts                       # readSnapshot / writeSnapshot
    └── types.ts                          # UndoSnapshot / UndoEntry / UndoStackState

# NOTE: 이전 plan 초안에 있던 reactionStore.lastReactantIds retrofit 은 D16 변경으로 제거.
# 본 Phase 는 reactionStore 를 retrofit 하지 않는다.

tests/unit/viewport/interactions/
├── usePointerDrag.test.ts
├── usePointerSelect.test.ts
├── useKeyboardNav.test.ts
├── useBondCreateFlow.test.ts
├── shortcuts.test.ts
└── textInputGuard.test.ts

tests/unit/viewport/animations/
├── useMoleculeFade.test.tsx
└── easing.test.ts                        # easing + fadeProgress/exitOpacity (useFadeOnMount 는 useFrame → Phase 15 visual)

tests/unit/viewport/
└── integration.test.tsx                  # §8.12 — Viewport 마운트/언마운트 와이어링 회귀 (jsdom scope-cut)

tests/unit/stores/undo/                   # (v0.2 정합) undo 테스트도 stores 레이어
├── undoStack.test.ts
├── snapshot.test.ts
└── integration.test.ts                   # §8.10 — 9 kind dispatcher 통과

# (본 Phase 는 reactionStore retrofit 없음 — D16 변경.)
```

### 7.1 레이어 가드 (Phase 08 §7.1 그대로 + 본 Phase 추가 분)

**(v0.2 정합)** undo 코어가 stores 레이어로 이전되어 외부 deep-import 는 기존 `@/stores/*` 배럴 가드(phase-07 §7)가 이미 차단한다 — viewport 쪽 undo 가드는 불요(제거). viewport 추가 가드는 `animationRegistry` 한 건만 유지:

```jsonc
{
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "patterns": [
          // (Phase 08 §7.1 의 모든 가드 유지)
          {
            "group": [
              "@/viewport/animations/animationRegistry",
              "**/viewport/animations/animationRegistry",
            ],
            "message": "animationRegistry 는 animations 내부 전용 (Phase 09 §7.1).",
          },
        ],
      },
    ],
  },
}
```

undo 내부(`snapshot`/`types`)는 `@/stores/_shared/undo` 내부 전용 — `@/stores/_shared/undo` index 가 `createUndoStack`/`useUndoStack`/`UndoStackOpts`/`UndoableDispatcher` 만 노출하고, 외부는 `@/stores` 배럴로 접근(phase-07 §7 가드가 deep-import 차단).

### 7.2 공개 경계

**(v0.2 정합)** `createUndoStack`/`useUndoStack` 은 viewport 가 아니라 **`@/stores`** 배럴(+ `@/stores/_shared/undo`) 로 노출:

```ts
// src/stores/index.ts (배럴) +
export { createUndoStack, clearActiveUndoStack, useUndoStack } from './_shared/undo';
export type { UndoStackOpts } from './_shared/undo';
export {
  dispatcher,
  setUndoDispatcher,
  resetUndoDispatcher,
  beginUndoGroup,
  endUndoGroup,
  getCurrentUndoGroup,
} from './_shared/undoable';

// src/viewport/index.ts (Phase 08 §7.2 export 유지) +
export { KEY_MAP, describeKey, type KeyBinding, type KeyActionId } from './interactions/shortcuts';
export type { BondCreateFlowApi, BondCreateFlowState } from './interactions/useBondCreateFlow';
export { isTextInputTarget } from './interactions/textInputGuard';
```

> phase-10 §6.6 은 `import { createUndoStack } from '@/stores/_shared/undo'` 를 쓴다 — 본 경로는 stores 내부 디렉터리 index 라 유효하나, phase-07 §7 의 `@/stores/*` deep-import 가드와의 정합은 **Phase 10 이 `@/stores` 배럴 경유로 정리**(인계 §12). `useFadeOnMount` / `withMoleculeFade` 등 `<Viewport />` 내부 전용 헬퍼는 barrel 미노출. (`useReactionAnimationDriver` 는 D16 에 따라 v1 미구현.) **(phase-10 정합)** `installGlobalUndoShortcuts` 는 phase-10 §5.3 `installAppShortcuts` 가 app 레이어에서 배럴 경유로 필요 → `@/viewport` barrel **노출** (초안의 "미노출" 갱신; Phase 09 가 Viewport 내부에서 호출하던 부분은 phase-10 §12.2 retrofit 으로 AppLayout 이관).

---

## 8. 테스트 계획

원칙: architecture §10 — 핵심 로직과 핵심 동작만. 본 Phase 의 핵심: (a) Undo 스택의 push/pop/group 합치기/FIFO drop, (b) snapshot 라운드트립 + 메모리 공유, (c) 드래그 평면 unproject 정확성, (d) 선택 단일/멀티 토글, (e) 키보드 네비 cycle, (f) 결합 생성 플로우, (g) 페이드 애니메이션 진행도, (h) 반응 crossfade trigger.

### 8.1 undoStack (`tests/unit/stores/undo/undoStack.test.ts`)

- `dispatchUndoable(meta1, m1)` 후 `canUndo === true`, `canRedo === false`.
- `undo()` 호출 → state 가 prev 로 복귀, `canRedo === true`, past 에서 entry 제거.
- `redo()` 호출 → next 로 복귀.
- 새 액션 dispatch 후 future 비워짐 (P7).
- group 같고 200 ms 안 → 합쳐져 entry 1개만 push.
- group 같고 200 ms 초과 → entry 2개.
- group null → 즉시 flush, 합치기 없음.
- 다른 group 의 액션 → 이전 group flush.
- capacity 50 초과 → 가장 오래된 drop.
- `undo()` 호출 시 pending flush 후 처리.

### 8.2 snapshot (`tests/unit/stores/undo/snapshot.test.ts`)

- `readSnapshot()` → `writeSnapshot()` 라운드트립 후 store state 동일.
- 같은 분자만 변경 시 변경 안 된 분자의 atoms/bonds 가 _동일 참조_ 보존 (immer 구조적 공유 검증).
- `writeSnapshot` 후 `useUiStore.selection` 무변경.
- 50 entry × 5 분자 메모리 측정 (`process.memoryUsage()` 또는 단순 ref 카운트) — 이론치 (변경된 가지만큼) 의 2배 이내.

### 8.3 usePointerDrag (`tests/unit/viewport/interactions/usePointerDrag.test.ts`)

- mock pointer 이벤트 시퀀스: down → move × 5 → up.
- pointerDown 시 `controls.enabled === false`, `positionSubscription.suspend` 호출.
- pointerMove 5회 후 `moveAtom` 5회 호출, group key `drag:${atomId}` 동일.
- pointerUp 시 `controls.enabled === true`, `resume` 호출.
- 200 ms 안에 다시 pointerDown 동일 atom → group 합치기 (entry 1개).
- atom 외 영역 클릭 → drag 시작 안 함.

### 8.4 usePointerSelect (`tests/unit/viewport/interactions/usePointerSelect.test.ts`)

- 일반 클릭 → 단일 선택 교체.
- Shift+클릭 동일 atom → 토글 (선택 해제).
- Shift+클릭 다른 atom → 추가.
- 빈 영역 클릭 (no-shift) → clearSelection.
- 빈 영역 클릭 (shift) → 보존.

### 8.5 useKeyboardNav (`tests/unit/viewport/interactions/useKeyboardNav.test.ts`)

- 분자 atomCount=5, 선택 없음, Tab → atomIndex 0 선택.
- 선택 atomIndex=2, Tab → 3, Shift+Tab → 1.
- atomIndex=4 (마지막), Tab → 0 (cycle).
- atomIndex=0, Shift+Tab → 4.
- active 분자 없으면 no-op.

### 8.6 useBondCreateFlow (`tests/unit/viewport/interactions/useBondCreateFlow.test.ts`)

- atom 2개 선택 (같은 분자) + B → `addBond` 호출, order=1.
- atom 2개 선택 (다른 분자) + B → `notify` 호출 (warn level), addBond 미호출.
- atom 1개 선택 + B → no-op.
- 이미 결합 있는 atom 쌍 + B → `setBondOrder` 호출 (1→2→3→1 cycle).
- `viewportApi.createBondFromSelection()` 동일 로직 — 성공 true, 실패 false.

### 8.7 shortcuts (`tests/unit/viewport/interactions/shortcuts.test.ts`)

- `KEY_MAP` 의 모든 binding 이 `KeyActionId` 와 1:1 일치.
- `Cmd+Z` (macOS) ≡ `Ctrl+Z` (Win/Linux) — `event.metaKey || event.ctrlKey` 통과.
- `Shift+Cmd+Z` 와 `Cmd+Y` 모두 redo 매칭.
- 텍스트 입력 안에서 Cmd+Z → 발화 안 함 (`isTextInputTarget` 가드).
- viewport-focused 키 (Tab/B/F) 가 global keydown 으로 들어와도 발화 안 함 (스코프 미스매치).

### 8.8 useFadeOnMount + useMoleculeFade (`tests/unit/viewport/animations/`)

- mount 직후 opacity 0, 75 ms 후 ≈ 0.5, 150 ms 후 ≥ 0.999.
- unmount 트리거 → opacity 1→0, 150 ms 후 실 unmount.
- mount 중 unmount 가 트리거되면 현재 opacity 에서 시작해 0 까지 (보간 단절 없음).
- easing 함수 단위 테스트 — easeInOutCubic(0)=0, (0.5)=0.5, (1)=1.

### 8.9 (예약) reaction trigger 애니메이션 — 본 Phase 미구현

D16 결정에 따라 본 Phase 는 별도 reaction-driver 테스트를 두지 않는다. moleculeStore 에 분자가 적재되는 시점의 fade-in 은 §8.8 의 `useFadeOnMount` 테스트가 커버. 향후 Phase 11/14 가 product 적재 + 명시적 crossfade 를 도입하면 그 Phase 의 테스트가 확장.

### 8.10 통합 — 9 액션 모두 dispatcher 통과 (`tests/unit/stores/undo/integration.test.ts`)

`UndoableActionKind` 9개 (atom.add/remove/move, bond.create/break/setOrder, molecule.create/replace/remove) 각각:

- 액션 호출 → dispatcher 의 push 발화 (spy 검증).
- undo() → prev 상태 복귀 (moleculeStore 스냅샷 비교).
- redo() → next 상태 복귀.
- `useSelectionStaleGuard` 가 atom 삭제 redo 후 selection 자동 정리.

### 8.11 (제거) reactionStore retrofit — D16 변경으로 본 Phase 영역에서 제외

### 8.12 컴포넌트 통합 (`tests/unit/viewport/integration.test.tsx`)

> **(v0.2 정합 — scope-cut)** jsdom 은 WebGL2 미지원 → `<Viewport />` 가 fallback 반환(Phase 08 `scene.test.tsx` 와 동일 선례). 실 scene/raycast/키보드의 E2E 는 Phase 15 Playwright. 본 단위 테스트는 **Phase 09 가 추가한 마운트/언마운트 와이어링 회귀** 만 가드: mount → `getActiveUndoDispatcher()` 가 placeholder 아님(createUndoStack 주입), unmount → flush+clear+reset 후 placeholder 복귀(R9). 아래 초안의 라이브 시나리오(클릭 선택/Tab/B/Cmd+Z)는 컨트롤러·훅 단위 테스트(§8.1–8.10)로 분해 검증되며, R3F 라이브 결선 검증은 Phase 15 인계:
>
> - ~~`<Viewport />` 마운트 + ethanol → atom 클릭 → selection~~ → Phase 15
> - ~~Tab / Shift+Tab cycle~~ → §8.5 (navAtom 단위)
> - ~~atom 2개 Shift-클릭 + B → addBond~~ → §8.6 (createBondFromSelection 단위)
> - ~~Cmd+Z / Cmd+Shift+Z snapshot 복원~~ → §8.1/§8.10 (undoStack + dispatcher 통합)

---

## 9. 리스크 및 대안

| ID      | 리스크                                                                                                                                                                                                                       | 대응                                                                                                                                                                                                             |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ---------------------------------------------- |
| **R1**  | snapshot 메모리 폭증 — 분자 수천 개 / atom 수만 개 시 50 entry × 깊은 복사 비용                                                                                                                                              | immer 구조적 공유 활용 (D1 + P6). 분자 수천 개는 architecture §1.4 비목표 (단백질 수준). 일반 사용 (수십 분자, 수백 atom) 은 600 KB 상한 (§6.1.6). 측정은 §8.2. 폭증 감지 시 Phase 14 가 메모리-기반 한도로 전환 |
| **R2**  | drag 중 분자 삭제 race — 다른 인터랙션 (예: Toolbar 의 removeMolecule) 이 drag 진행 중 분자를 삭제                                                                                                                           | drag 의 onPointerMove 가 `atomIdToIndex` 결과 -1 이면 즉시 drag 종료 (resume + controls 복구). useSelectionStaleGuard 가 selection 정리                                                                          |
| **R3**  | 키보드 포커스 trap — Tab 이 viewport 안에서 cycle 만 하고 페이지 외부 탭 이동 불가                                                                                                                                           | `<Viewport tabIndex={0}>` 가 Tab 을 _capture_ 하는 건 focus 일 때만. focus 이탈 (Esc + 다음 Tab) 로 페이지 탭 정상 동작. Esc 가 viewport focus 도 해제하는지 별도 결정 — 현재 미정 → 본 Phase §11 열린 질문 등재 |
| **R4**  | 애니메이션 진행 중 store 변경 — crossfade 도중 사용자가 분자 추가                                                                                                                                                            | animationRegistry 가 진행 중 fade 를 cancel 하고 새 분자는 useFadeOnMount 의 일반 mount fade-in 으로 진입. 시각상 자연스러움                                                                                     |
| **R5**  | 단축키 OS 차이 — macOS = Cmd, Win/Linux = Ctrl                                                                                                                                                                               | `event.metaKey                                                                                                                                                                                                   |     | event.ctrlKey` 분기. 사용자 지정 키맵은 비목표 |
| **R6**  | (제거) D16 변경으로 본 Phase 는 reaction-trigger crossfade 드라이버를 구현하지 않으며, reactant/product 분자 추적도 본 Phase 영역 밖. 사용자가 reactant 를 삭제하면 unmount fade (D15) 만 자연 발화 — fallback 시나리오 없음 |
| **R7**  | undo 후 selection 손실 (D14)                                                                                                                                                                                                 | architecture §3.8 의 비-undoable 약속. UX 안내 토스트 도입은 Phase 11 (§11 열린 질문)                                                                                                                            |
| **R8**  | drag 중 useFrame 안 setMatrixAt 갱신과 React 리렌더 충돌                                                                                                                                                                     | P8 의 suspend/resume 로 격리. Phase 08 §6.5.1 의 suspend hook 이 정확히 이 케이스용                                                                                                                              |
| **R9**  | undo dispatcher 의 module-level 싱글톤 — HMR 시 stale                                                                                                                                                                        | `<Viewport />` unmount 시 `dispatcher.flush() + dispatcher.clear()` 명시. dev 모드 HMR 가 `<Canvas>` 를 unmount → cascade 안전                                                                                   |
| **R10** | 다른 분자 atom 끼리 결합 생성 시도 — D5 가 거부하지만 사용자가 의도한 경우                                                                                                                                                   | 본 Phase v1 = 거부 + warn toast (i18n 키). 분자 합치기는 architecture §1.4 비목표 영역. Phase 14+ 가 사용자 요구 강하면 검토                                                                                     |
| **R11** | 키 binding 충돌 — Phase 10 패널이 본 Phase 와 같은 키 등록                                                                                                                                                                   | P9 + 우선순위 표 (§4.5) + Phase 10 가 본 Phase KEY_MAP import 의무 (§12 인계). ESLint 가드 추가는 어려움 — 코드 리뷰 가이드                                                                                      |
| **R12** | snapshot 의 _전역 reference_ 가 immer 의 freeze 를 풀어버릴 위험 — `setState((draft) => { draft.molecules = snap.molecules })` 가 frozen 객체 대입                                                                           | immer 5+ 가 이 패턴 지원 (replace mode). 단위 테스트 §8.2 가 mutation 후 store state 가 정상 frozen 인지 검증                                                                                                    |

---

## 10. 완료 기준 (Definition of Done)

본 Phase 의 완료 기준. **(v0.2 정합)** "단위/계약 수준" 과 "라이브 R3F 결선" 을 분리 표기 — 후자는 jsdom 미검증 영역으로 Phase 15 Playwright 인계(Phase 08 scene scope-cut 선례). `[x]` = 본 구현+테스트 충족.

- [x] `architecture.md` §3.8 의 7 동작이 모두 undoable, 3 비-undoable 영역 (반응 결과 / UI 상태 / 설정) 이 보호됨 (§8.10 통합 + §8.2 snapshot).
- [x] Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z, Cmd/Ctrl+Y 텍스트 입력 외 작동 (D10+D11α) — §8.7 (`installGlobalUndoShortcuts` + D10 가드).
- [x] Tab/Shift+Tab atom 순환 (D7) — §8.5 (`navAtom`).
- [x] Esc/Delete/Backspace/B/1·2·3·A/F/R viewport-focused 핸들러 (D11β) — KEY_MAP + `createViewportShortcutHandler` 단위.
- [x] 드래그 = `moveAtom` 디스패치 → Phase 08 `useAtomMatrixSubscription` 이 setMatrixAt 직접 갱신(React 리렌더 0회). OrbitControls disable + ambient group — §8.3 컨트롤러 단위. **라이브 R3F 메시 pointer-event 결선 = Phase 15** (§8.12 scope-cut).
- [x] 두 atom + B 결합 생성, 다른 분자 거부 (D5) — §8.6.
- [x] 결합 차수 변경 (D13) — 단일 결합 선택 시만 (`onBondOrderKey` 가드, §8.6/단위).
- [~] 분자 mount fade-in 0.15 s / unmount fade-out + delayed remove (D15) — **계약·훅·delayed-unmount 단위 검증 완료(§8.8)**. Scene retained-id 렌더 + 렌더러 머티리얼 opacity threading 의 _라이브 결선·시각 회귀_ 는 **Phase 14/15 인계**(§6.7 갭 노트). reaction-trigger crossfade 는 v1 미구현 (D16).
- [x] undo 스택 capacity=50, 그룹 합치기 200 ms, 새 액션 시 redo 비움 (D1+D2+D3+P7) — §8.1.
- [~] selector 안정성 — 드래그가 store→subscription 경로로 setMatrixAt(리렌더 0회) 설계 충족. 라이브 리렌더 0회 계측은 Phase 15.
- [x] Phase 07 swappable `dispatcher` 싱글톤 내부 구현이 `createUndoStack()` 으로 교체(식별자·인터페이스 불변, `setUndoDispatcher` 주입) — §8.10 + `tests/unit/viewport/integration.test.tsx`. **(v0.2)** createUndoStack 은 stores 레이어.
- [x] (제거) reactionStore retrofit — D16 변경으로 본 Phase 영역 외.
- [x] Phase 08 `ViewportApi` 의 `createBondFromSelection`/`canUndo`/`canRedo` stub 본문 실제 구현 교체 (인터페이스 불변 — §5.3).
- [x] ESLint 레이어 가드 (§7.1) 통과 — stores→viewport 위반 0 (undo 코어 stores 이전).
- [x] 신규 라이브러리 0개 (§3.2) — `zustand/vanilla` 는 기존 의존.
- [x] Phase 10 가 `KEY_MAP` import 로 패널 키 충돌 회피 가능 (인계 §12).

---

## 11. 열린 질문 (User Decision Required)

Plan 단계에서 D1–D17 + P1–P9 가 모두 확정되어 본 §11 은 **Phase 09 본 구현 이후로 미뤄진 항목** 만 보존한다.

1. **Esc 가 viewport focus 도 해제하는지** — 현재 Esc = clearSelection 만. focus 를 페이지 body 로 옮기는 보조 동작 필요성은 a11y 검증 시 (Phase 15) 결정.
2. **결합 단위 반응 애니메이션 + product → moleculeStore 적재 정책** — Phase 06 atom-map retrofit (`ReactionResult.atomMap`) + product 적재 파이프라인 결정 후 도입 (Phase 11 의 ReactionResult 패널 또는 Phase 14). 결정 시 본 Phase animations 모듈에 명시적 reaction-trigger crossfade 드라이버 추가 (D16 후속).
3. **드래그 throttle 임계** — Phase 14 가 측정 후 결정.
4. **박스 선택 / drag-drop 결합 생성 UX** — Phase 14+ 가 사용자 요구 강도에 따라 결정.
5. **Toolbar 단축키 도움말 표시 형식** — Phase 11 가 KEY_MAP 의 `i18nLabelKey` + `describeKey` 결과를 어떻게 패널에 그릴지 결정.
6. **사용자 지정 키맵** — 비목표 (Phase 14+ 검토).
7. **방향키 atom 좌표 미세 변위** — Phase 09 v1 미포함 (atomIndex Tab cycle 만). 사용자 요구 시 Phase 14+ 가 0.1 Å 이동 등 추가.
8. **undo 후 selection 복원 안내 토스트** — Phase 11 가 결정 (D14 의 UX 부수 효과).
9. **다른 분자 atom 결합 시도 거부 메시지의 i18n 문구** — Phase 11 가 채움 (`shortcuts.bondCreate.diffMolecule`).
10. **multi-hit raycast** — 분자 겹침 시 hit 우선순위 (앞→뒤? selection 보존?). Phase 14+ 가 도입 검토.
11. **product → moleculeStore 적재 정책** (D16 후속) — Phase 06 의 `ReactionResult.products` 가 reactionStore.lastResult 안에만 머무른다. ReactionResult 패널 (Phase 11) 이 (a) 자동 적재, (b) 사용자 명시 "적재" 버튼, (c) 미적재 (패널에서 정보만 표시) 중 어떤 정책을 가질지 결정. 결정에 따라 본 Phase animations 가 reaction-trigger crossfade 드라이버를 별도 details PR 로 추가 가능. **결정 전까지 architecture §6 의 "결합 변화 애니메이션" 약속은 mount/unmount 자연 fade 로만 충족**.
12. **(v0.2 신규) 인터랙션 컨트롤러의 라이브 R3F 결선** — 본 Phase 는 `createDragController` / `selectFromPick` / `createViewportShortcutHandler` 를 단위 검증 수준으로 제공한다. 이를 Phase 08 instanced 메시의 `onPointerDown/Move/Up` 합성 이벤트 + raycast(`getAtomIdFromIntersection`) 에 실제 결선하고, drag 의 per-molecule `useAtomMatrixSubscription` 핸들 라우팅을 마무리하는 작업은 jsdom 검증 불가 → **Phase 15 (Playwright E2E)** 가 결선+회귀. throttle 임계는 Phase 14(§11 #3).
13. **(v0.2 신규) fade 라이브 결선** — Scene 이 store `ids` 로 키잉하므로 `removeMolecule` 시 `withMoleculeFade` 가 즉시 unmount(라이브 fade-out 미발화). Scene retained-id 렌더(제거 후 durationMs 동안 잔존) + `fadeOpacity` → 렌더러 instanced 머티리얼 threading 은 **Phase 14(retained-id) / Phase 15(머티리얼·시각 회귀)** 인계. 본 Phase 는 계약/훅/delayed-unmount 단위 검증만(§8.8, §6.7 갭 노트).

---

## 12. 다음 Phase 로의 인계 (Hand-off)

| Phase                                      | 본 Phase 가 인계하는 것                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| **10 (UI Framework)**                      | (a) `KEY_MAP` 상수 import 의무 — 패널 단축키가 본 Phase 키와 충돌 안 하도록 회피. (b) ErrorBoundary 가 본 Phase 의 키보드/raycast 예외를 포착할 수 있도록 _런타임 예외_ 만 throw — 도메인 실패는 Result 패턴 (architecture §3.7). (c) `installGlobalUndoShortcuts()` 의 cleanup 계약 — Phase 10 의 앱 unmount 시 unsubscribe 호출. **(d, v0.2)** `createUndoStack` 은 `@/stores/_shared/undo` (stores 레이어). phase-10 §6.6 `AppLayout` 이 `React.useMemo(()=>createUndoStack(...))` 후 `setUndoDispatcher()` 로 주입 + `UndoableDispatcherProvider` context 노출 — 이때 phase-09 의 `<Viewport>` 마운트-시 주입 + `useUndoStack` 모듈-레지스트리는 **Phase 10 context 가 대체**(단일 인스턴스 보장). phase-10 의 `@/stores/_shared/undo` import 는 phase-07 §7 `@/stores/*` deep-import 가드와 정합되도록 `@/stores` 배럴 경유로 정리(§7.2 주). |
| **11 (UI Panels)**                         | (a) `KEY_MAP` + `describeKey` — Toolbar 의 단축키 도움말 (예: "Cmd+Z" 라벨). (b) `viewportApi.createBondFromSelection()` / `frameActive()` / `frameAll()` / `resetCamera()` — Toolbar 버튼 클릭 핸들러. (c) **`useUndoStack()` 훅 (§5.3 권장 (1))** — Toolbar 의 Undo/Redo 버튼이 React 반응성으로 활성/비활성 토글. `viewportApi.canUndo()` / `canRedo()` 는 imperative 보조용 (호출 시점 값). (d) `mapReactionErrorToKey` 와 함께 본 Phase 의 `shortcuts.bondCreate.diffMolecule` 토스트 메시지 i18n 채우기. (e) §11 #8 의 undo 후 selection 안내 토스트 도입 결정. (f) **product → moleculeStore 적재 정책 결정** (D16 의 후속) — ReactionResult 패널이 "적재" 버튼 또는 자동 적재 정책을 가질지. 결정 시 본 Phase animations 모듈에 명시적 reaction-trigger crossfade 드라이버 추가 (§11 #2).                                                 |
| **12 (Text Input)**                        | (a) `isTextInputTarget` — SMILES 입력 컴포넌트가 자체 input 요소를 가지면 본 Phase 의 D10 가드가 자동 통과. (b) Phase 09 의 단축키와 충돌 가능성 검토 — Phase 12 의 입력은 `<input>` / `<textarea>` 안이라 D10 가 자동 보호.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **13 (Export / Import)**                   | (a) export 직전 selection 보존 — Phase 13 가 captureBlob 호출 직전 selection 을 PNG annotation 에 포함하려면 본 Phase 의 selection slice 그대로 사용. (b) import 시 분자 ID 충돌 처리 — `replaceAll` 패턴 (Phase 07 §11 #1). 본 Phase 의 undo 스택은 import 후 _비워야 함_ — Phase 13 가 `dispatcher.clear()` 명시 호출. **(c, v0.2)** 본 Phase `createUndoStack` 반환은 `UndoStackController`(= `UndoableDispatcher` + `flush()`/`clear()`) — phase-13 §4.2 가 요구하는 `clear`/`flush` 는 이미 구체 컨트롤러에 존재. phase-13 의 retrofit 은 동결 `UndoableDispatcher` 인터페이스 + phase-07 placeholder 에 `clear`/`flush` 를 _추가_ 하는 부분만 남음(본 Phase 미선반영 — phase-13 영역).                                                                                                                                                      |     |
| **14 (Performance)**                       | (a) **드래그 throttle 임계 결정** (§11 #3). (b) **multi-hit raycast** 자리 (§11 #10). (c) **결합 단위 반응 애니메이션** — Phase 06 atom-map retrofit + 본 Phase animation 모듈에 결합 diff 시퀀스 추가 (§11 #2). (d) **박스 선택 / drag-drop UX** (§11 #4). (e) snapshot 메모리 측정 / 한도 정책 재검토 (R1). (f) Web Worker 분리 (RDKit / Reaction Engine) — 본 Phase 무영향 (메인 스레드 인터랙션과 분리). **(g, v0.2)** Scene retained-id 렌더 — `removeMolecule` 후 durationMs 동안 분자 element 잔존시켜 `withMoleculeFade` unmount fade-out 라이브 발화 (§11 #13).                                                                                                                                                                                                                                                                          |
| **15 (Testing & Polish)**                  | (a) **a11y axe 검증** — Tab/Esc/스코프 분기, ARIA 레이블 (architecture §3.5). (b) **키보드 회귀** — Playwright 시나리오 (architecture §10.3 #5 의 i18n + 추가 키보드 시나리오). (c) **CVD 모드 라벨 강제 on 검증** (Phase 08 인계). (d) §11 #1 의 Esc focus 해제 결정. (e) §11 #8 의 undo selection 토스트 결정. **(f, v0.2)** 인터랙션 컨트롤러(`createDragController`/`selectFromPick`/`createViewportShortcutHandler`) 의 **라이브 R3F 결선** — instanced 메시 pointer-event + raycast + per-molecule subscription 라우팅 — 및 fade `fadeOpacity` 머티리얼 threading 의 시각 회귀 E2E (§11 #12, #13; §8.12 scope-cut 인계).                                                                                                                                                                                                                    |
| **소급 수정 — Phase 07**                   | **(v0.2 정합)** `_shared/undoable.ts` 의 swappable 싱글톤 export 변수명을 `dispatcher` 로 확정(phase-07 §659–664 / phase-11 §1942 의 canonical 명칭) — 내부 구현이 `setUndoDispatcher()` 로 `createUndoStack()` 결과로 swap, 식별자·`UndoableDispatcher` 인터페이스·9개 액션 본문 불변(호출자 무변경). `undoable.ts` 에 ambient group API(`beginUndoGroup`/`endUndoGroup`/`getCurrentUndoGroup`) 추가 — Phase 07 액션 meta 불변(P4 vs §1.3 정합, drag 만 사용). createUndoStack 은 stores 레이어(`_shared/undo/`)로 신규 작성(소급 아님). **(D16 변경으로 reactionStore.lastReactantIds retrofit 제거.)** `phase07PlaceholderDispatcher` 는 호환 위해 유지.                                                                                                                                                                                       |
| **구현 교체 — Phase 08 (인터페이스 불변)** | `ViewportApi.createBondFromSelection` / `canUndo` / `canRedo` 의 Phase 08 stub 본문을 실제 구현으로 교체 (§5.3). 인터페이스는 Phase 08 §4.5 가 이미 소유 — 추가/retrofit 아님. 본 Phase 구현 PR 의 첫 커밋.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

---

_문서 버전: 0.2 (구현 정합)_
_작성일: 2026-04-26 (v0.1 초안) / 2026-05-18 (v0.2 — 본 구현과 정합)_

> **v0.2 변경 요약 (코드↔문서 모순 해소, 현실적 근거 기준):**
>
> 1. **undo 코어 위치**: `src/viewport/undo/` → **`src/stores/_shared/undo/`** (stores 레이어). 근거: `createUndoStack` 은 R3F/viewport 의존 0 인 순수 store snapshot 로직 → architecture §4.1 상 stores 가 정위치. 초안 §7 의 viewport 배치는 stores→viewport 위반을 유발했고 phase-10 §6.6 / phase-11 §1942 / phase-13 §4.2 가 이미 stores 싱글톤으로 참조 — 다수 문서·아키텍처 규칙에 코드를 맞춤. (§1.3, §4.2, §5.1, §7, §7.1, §7.2)
> 2. **dispatcher swap 메커니즘**: export 변수명 `dispatcher` (canonical), `setUndoDispatcher()` 주입. 식별자·인터페이스·Phase 07 액션 본문 불변 = phase-11 §1942 "export 시점 swap" 의도와 일치.
> 3. **moveAtom group seam (P4 vs §1.3)**: ambient group(`beginUndoGroup`/`endUndoGroup`)로 해소 — Phase 07 `moveAtom` meta·본문 불변 유지하며 drag stream D3 합치기 달성.
> 4. **writeSnapshot**: immer-draft 형 → partial-object 형(immer 미들웨어 무관 동일 결과 + R12 §8.2 경험 검증).
> 5. **`useMoleculeFadeWrapper` → `withMoleculeFade`**: hook 아닌 HOC 팩토리 → `rules-of-hooks` 정합.
> 6. **fade/인터랙션 라이브 결선 scope**: 본 Phase = 컨트롤러·훅·계약의 단위 검증. Scene retained-id 렌더 + 렌더러 머티리얼 opacity threading + instanced-메시 pointer-event 결선 = Phase 14/15 인계(§8.12 scope-cut, §10 `[~]`, §11 #12·#13, §12). Phase 08 scene scope-cut 선례와 일관.
>
> phase-10/11/13 문서는 이미 본 정합과 일치하므로 변경하지 않음. phase-07/08 의 인계 표기는 본 §12 + 각 문서 인계 행에서 정합.
