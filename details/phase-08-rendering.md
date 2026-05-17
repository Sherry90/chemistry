# Phase 08 — 3D Rendering Engine (R3F)

> 본 문서는 `architecture.md` §13 의 Phase 08 상세 설계서다. 코드 작성은 모든 details 문서의 검토가 끝난 뒤에만 시작한다.
>
> **선행 문서**: `architecture.md` (특히 §3.1 ⑤, §3.3, §3.5, §3.10, §6, §9.1–9.2, §12), `details/phase-01-foundation.md`, `details/phase-02-element-data.md`, `details/phase-03-chemistry-engine.md`, `details/phase-04-compound-data-pipeline.md`, `details/phase-05-runtime-data-layer.md`, `details/phase-06-reaction-engine.md`, `details/phase-07-state-management.md`.

---

## 1. 목적 (Purpose)

Phase 07 가 동결한 selector 면을 화면 픽셀로 잇는 **단일 lazy chunk** 를 구축한다. 본 Phase 의 핵심 약속은 다음 네 가지다.

1. **Ball-and-stick 한 갈래 완성** — `architecture.md` §3.1 ⑤ 의 약속 (단일 변형 시작 + 유니온 확장 가능) 을 그대로 구현. 구/실린더 인스턴싱, 결합 차수의 다중 cylinder 표현, 두 색 분할까지 이번 Phase 에서 완성한다.
2. **§3.10 뷰포트 디폴트 충족** — 라벨 기본 off, 호버/선택 툴팁, 등각 3/4 카메라, 다중 cylinder 결합, 테마 연동 배경. `uiStore.viewport` 와 `settingsStore.theme` selector 만으로 모든 표시 옵션이 결정된다.
3. **Phase 09 가 인수할 인터페이스 동결** — _원자/결합 안정 ID_, _intersection → AtomId 사이드카 매핑_, _`OrbitControls.enabled` 토글_, _`useAtomMatrixSubscription` 훅_, _`atomIdToIndex` 번역 헬퍼_ 다섯 표면을 본 Phase 가 동결한다. Phase 09 (Interactions) 는 본 Phase 의 표면을 _읽기_ 만 하고 인터랙션 로직을 추가한다.
4. **60 fps @ 수백 atom 예산 (`architecture.md` §9.2)** — InstancedMesh 풀 (원소별 1 풀 + 결합 1 풀) + `subscribeWithSelector` 기반 직접 `setMatrixAt` 갱신으로 React 리렌더 회피. 그림자/FOG 비활성, `dpr [1, 2]` 클램프. LOD _임계값 튜닝_ 은 Phase 14 가 인수하지만, **분기 지점 (segments / 결합 line 치환)** 은 본 Phase 가 제공한다.

본 Phase 는 `architecture.md` §12 의 열린 질문 중 **(없음)** 을 닫지 않는다. 본 Phase 는 신규 화학 도메인 결정을 도입하지 않으며, Phase 01·03·07 이 동결한 도메인을 화면으로 옮기는 _표시 계층_ 이다. 단 두 가지 경미한 retrofit (§3.1 표) 만이 본 Phase 가 도메인에 가하는 변경이다.

---

## 2. 범위 (Scope)

### 2.1 포함

- **`<Viewport apiRef />` 진입 컴포넌트** — `<Canvas>` 마운트 + lazy chunk 경계 + WebGL2 가드. `apiRef` 로 imperative `ViewportApi` 노출 (D14).
- **Scene 합성** — `Lighting` (ambient + key + fill), `Camera` (등각 3/4), `Background` (테마/오버라이드 색), drei `OrbitControls` (default `enabled = true`).
- **다중 분자 레이아웃** — `computeMoleculeLayout(molecules)` 순수 결정함수 (D2). state 무보관, 분자 목록만 입력.
- **Atom 렌더러** — 원소별 InstancedMesh 풀 (실 사용 원소만 lazy 생성, P4 의 auto-grow). 색·반지름은 Phase 02 `Element` 메타에서 도출 (`cpkColorHex`, `covalentRadiusPm`).
- **Bond 렌더러** — cylinder 단일 풀. 단일 1 cyl / 이중 평행 2 / 삼중 평행 3, aromatic = 단일 + dashed inner (D3). 두 색 분할 = mid-bond cylinder 2개 (D4, P7).
- **원자 라벨 + 호버 툴팁** — drei `Text` 빌보드 (`uiStore.viewport.showAtomLabels` on 시), drei `Html` 툴팁 (R3F `onPointerOver` 단건 hover, D10). `settingsStore.cvdMode` on 이면 라벨 강제 on.
- **상태 구독 패턴** — 분자 추가/삭제: selector 기반 React 리렌더. 좌표 이동: `subscribeWithSelector` 외부 구독 → `mesh.setMatrixAt` 직접 갱신 (D8).
- **Picking 사이드카** — InstancedMesh 풀 별 `instanceIdToAtomId: Array<AtomId>` 보관. `getAtomIdFromIntersection(it)` 가 풀 식별 후 슬롯 → AtomId 매핑 (D9a). Phase 09 raycast 의 안정 후크.
- **카메라 자동/수동 프레이밍** — 첫 분자 mount 시 `frameActive`, 그 외에는 `viewportApi.frameActive()` / `frameAll()` / `resetCamera()` 명시 호출 (D13).
- **Imperative API (`ViewportApi`)** — `frameActive`, `frameAll`, `resetCamera`, `captureBlob`, `getRenderer` (D13, D14).
- **WebGL2 가드** — `detectWebGL2()` 순수 함수. 미지원 시 `<Viewport />` 가 throw 없이 placeholder 반환 (D6).
- **테스트** — Vitest 순수 함수 + `@react-three/test-renderer` 컴포넌트 (D12).

### 2.2 비포함 (다른 Phase / 비목표)

- **클릭/드래그 raycast 인터랙션** → Phase 09. 본 Phase 는 `getAtomIdFromIntersection` 후크와 `OrbitControls.enabled` 토글까지만 제공.
- **결합 생성/분리 인터랙션** → Phase 09.
- **결합 변화 애니메이션 / 분자 등장·퇴장 트랜지션** → Phase 09 의 `viewport/animations/`. 본 Phase 의 mount/unmount fade hook (0.15 s opacity) 도 Phase 09 가 본 구현 인수.
- **키보드 원자 네비** → Phase 09 (Tab/방향키 + uiStore.selection 갱신).
- **호버 슬라이스(전역 hover state)** — 본 Phase 는 _로컬 `useState`_ 만 사용 (D10). 전역 hover 가 필요해지면 Phase 09 가 uiStore 확장.
- **Undo/Redo 본 구현** → Phase 09 가 swappable `dispatcher` 싱글톤 내부 구현을 `createUndoStack()` (stores `_shared/undo/`) 으로 swap (phase-09 §5.1, v0.2 정합).
- **Web Worker 분리 / WASM off-thread** → Phase 14.
- **LOD _임계값 튜닝_** — 분기 지점은 본 Phase 가 노출, 임계값 + drawcall 측정은 Phase 14.
- **PNG/SDF/JSON export 본 구현** → Phase 13. 본 Phase 는 `viewportApi.captureBlob` 진입점만 제공 (D14).
- **시각 회귀 (Playwright + 픽셀 diff)** → Phase 15.
- **WebGL2 미지원 fallback 페이지 UI** → Phase 10/15. 본 Phase 는 detector + 가드 placeholder 까지만 (D6, `architecture.md` §12 R5).
- **i18n 실제 문구** — 본 Phase 는 i18n 키 (`viewport.tooltip.*`, `viewport.fallback.*`) 만 정의. 한·영 문구는 Phase 11 패널 통합 시 채움.

### 2.3 명시적 비결정 (후속 결정)

- **LOD 전환 임계값** — `LOD_THRESHOLDS = { atomCountForLowSegments: number; atomCountForLineBonds: number }` 인터페이스만 동결. 구체 수치는 Phase 14 의 drawcall 측정 후 결정.
- **분자 정렬 키** — `computeMoleculeLayout` 의 분자 순서가 무엇인지 (`priority` 오름차순? `atomCount`? `addedAt`?) 는 본 Phase 가 _기본 = `addedAt` (moleculeStore.ids 순서)_ 로 두되, Phase 11 의 CompoundBrowser 가 정렬 토글을 도입할 가능성을 §11 에 등재.
- **Aromatic dashed 표현의 정확한 셰이더** — drei `Line` (선) vs cylinder + 텍스처 dash 둘 중 하나. 본 Phase 는 _drei `Line`_ 을 디폴트로 두되, 시각 검증 (§8.5 + Phase 15) 후 변경 가능. 인터페이스 (`renderAromaticOverlay(bondId)`) 만 동결.
- **호버 슬라이스 위치 (uiStore vs viewport-local)** — 본 Phase = local. Phase 09 가 multi-hit + 전역 hover 가 필요하다 판단하면 uiStore 확장. 본 Phase §11 에 등재.

---

## 3. 의존성 (Dependencies)

### 3.1 선행 Phase

| Phase                  | 본 Phase 가 사용하는 자산                                                                                                                                                                                                                                                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 (Foundation)        | `Brand<T, K>`, `Result<T, E>`, `Logger`, i18n 네임스페이스 (`common`, `chemistry`), 타입 strict 옵션, **신규**: `Atom.id` / `Bond.id` retrofit (§3.1 retrofit 표)                                                                                                                                                                                                    |
| 02 (Element Data)      | `getElement(n)` / `Element.cpkColorHex` / `Element.covalentRadiusPm` / `Element.vdwRadiusPm` / `Element.symbol`. 본 Phase 의 `colors.ts` / `radii.ts` 가 직접 호출                                                                                                                                                                                                   |
| 03 (Chemistry Engine)  | `Molecule` / `Atom` / `Bond` / `BondOrder`, `Atom.position` (Å, 오른손 좌표), `engine/parser/toDomain.ts` 가 Phase 01 `createAtomId`/`createBondId` 로 채운 `Atom.id` / `Bond.id` (CD1, 선행 완료 — 소비만)                                                                                                                                                          |
| 04 (Compound Pipeline) | 직접 import 없음. 단 §3.1 retrofit 표의 D1 부속 결정 (compound JSON 에 atom/bond ID **저장 안 함**) 이 Phase 04 §"청크 파일 스키마" 와 일관                                                                                                                                                                                                                          |
| 05 (Runtime Data)      | 직접 import 없음 (Phase 07 경유)                                                                                                                                                                                                                                                                                                                                     |
| 06 (Reaction Engine)   | 직접 import 없음 (Phase 07 경유). 단 반응 결과 분자도 본 Phase 가 동일하게 렌더                                                                                                                                                                                                                                                                                      |
| 07 (Stores)            | `useMoleculeStore` / `useUiStore` / `useSettingsStore` 훅, `selectActiveMolecule` / `selectMoleculeIds` / `selectMoleculeById` / `selectAtomLabelsOn` / `selectBackgroundOverride` / `selectTheme` / `selectRenderMode` / `selectIsCvdOn` selector, **`subscribeWithSelector` 외부 구독** (Phase 07 hand-off §12), `MoleculeId` Brand, `UndoableActionKind` (참고만) |

본 Phase 는 **`src/stores`** 만 import 한다 (P1). `engine` / `services` / `data` 직접 import 금지 — `architecture.md` §4.1 의존 방향 다이어그램 그대로. 다만 **`src/chemistry/elements`** 의 _순수 타입/조회 함수_ 는 stores 와 같은 깊이의 도메인 자산이므로 viewport 의 `_shared/colors.ts` / `_shared/radii.ts` 가 직접 import 한다 (`src/data/elements` 정적 JSON 은 `src/chemistry/elements/registry.ts` 가 흡수하므로, viewport 는 chemistry 만 본다 — Phase 02 §5.1 의 공개 면 그대로). ESLint `no-restricted-imports` 로 `engine` / `services` / `data` 차단.

### 3.2 외부 라이브러리

| 라이브러리                           | 용도                                                                                                                | 비고                                                                                                                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `three` (Phase 01 도입)              | WebGL 추상화 본체 — `InstancedMesh`, `BufferGeometry`, `Object3D`, `Box3`, `Vector3`, `Quaternion`, `WebGLRenderer` | architecture §2 명시                                                                                                                                                                                                           |
| `@react-three/fiber` (Phase 01 도입) | React-three 통합 — `<Canvas>`, `useThree`, `useFrame`, `extend`                                                     | architecture §2 명시                                                                                                                                                                                                           |
| `@react-three/drei` (Phase 01 도입)  | 헬퍼 — `OrbitControls`, `Html`, `Text`, `Line`, `Bounds` (선택), `Stats` (개발 only)                                | architecture §2 명시. 본 Phase 의 모든 헬퍼 요구를 cover                                                                                                                                                                       |
| `@react-three/test-renderer`         | 컴포넌트 테스트                                                                                                     | **신규 추가** (devDependency only). 근거: §8.5 의 scene 그래프 스냅샷 테스트가 jsdom + WebGL2 부재 환경에서 동작. 패키지는 `react-three-fiber` 의 공식 testing 동반자. 번들 미포함 (devDep) — `architecture.md` §9.1 예산 무관 |

**런타임 신규 라이브러리는 0개.** drei 가 OrbitControls / Html / Text / Line / Edges 등 본 Phase 가 필요한 모든 헬퍼를 cover 한다. dashed bond (D3) 도 drei `Line` (`segments + dashed`) 으로 충분.

### 3.3 결정 사항 (Plan 단계에서 모두 확정)

| ID      | 질문                                   | 확정 답                                                                                                                                                                                                                                                                                                                                                                                                                                 | 본문 영향                                      |
| ------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---- |
| **D1**  | 원자/결합 안정 ID 전략                 | `Atom.id: AtomId`, `Bond.id: BondId` 는 **Phase 01 `@/chemistry/compounds/ids` 가 이미 정의** (CD1 — 본 Phase 의 retrofit 아님). `engine/parser/toDomain.ts` 가 Phase 01 `createAtomId()` / `createBondId()` 로 채움 (Phase 03 §4.5). 본 Phase 는 소비만 한다. 뷰포트 ID 는 prefix-disambiguated composite `${MoleculeId}::a:${AtomId}` / `${MoleculeId}::b:${BondId}` (`viewportIdForAtom` / `viewportIdForBond` / `parseViewportId`). | §4.1, §6.5 selection stale 처리                |
| **D1a** | D1 의 Phase 07 액션 시그니처 영향      | **Phase 07 액션 시그니처 무변경** (index-based 그대로). Viewport 가 `atomIdToIndex(molecule, atomId): number` 로 픽킹/드래그 후크에서 한 번만 번역. stale AtomId 는 viewport selector 가 검사 후 `uiStore.clearSelection` 발화.                                                                                                                                                                                                         | §5.5 atomIdToIndex, §6.5 stale 처리            |
| **D1b** | Phase 04 compound JSON 의 atom/bond ID | **저장하지 않음**. ID 는 `addFromCompound(cid)` 가 moleculeStore 에 적재할 때 매번 생성. compound JSON 스냅샷 결정성 + 동일 CID 두 번 적재 시 selection 충돌 회피. Phase 04 §"청크 파일 스키마" 무변경                                                                                                                                                                                                                                  | §3.1 retrofit                                  |
| **D2**  | 다중 분자 공간 배치                    | **순수 계산 레이아웃** (state 없음). `computeMoleculeLayout(molecules): ReadonlyMap<MoleculeId, MoleculeLayoutTransform>` 결정함수. 각 분자 BBox 정렬 후 grid 배치 (≤3: 가로 1열, >3: ⌈√n⌉ × ⌈√n⌉). 간격 = `max(BBox.x) + GROUP_PADDING_ANGSTROM`                                                                                                                                                                                       | §6.4                                           |
| **D3**  | 결합 차수 시각 표현                    | 단일 1 cyl / 이중 평행 2 / 삼중 평행 3 (architecture §3.10 그대로). aromatic = 단일 cyl + drei `Line` 의 dashed inner (`renderAromaticOverlay`). Phase 14 가 셰이더 교체 가능                                                                                                                                                                                                                                                           | §6.3                                           |
| **D4**  | 결합 색상 분할                         | 결합당 cylinder 2개 (mid-bond split). 양 끝 원소 색이 같으면 1 cyl 로 최적화 (P7 와 별개)                                                                                                                                                                                                                                                                                                                                               | §6.3                                           |
| **D5**  | 카메라 컨트롤                          | drei `OrbitControls` (default `enabled: true`). Phase 09 가 마우스 이벤트 가로채는 동안 `enabled: false` 토글 가능                                                                                                                                                                                                                                                                                                                      | §6.1                                           |
| **D6**  | WebGL2 감지 + fallback                 | `detectWebGL2(): WebGLDetectResult` 순수 함수. `<Viewport />` 가 결과 ok=false 면 `null` 또는 children prop (`fallback?: React.ReactNode`) 반환. 페이지 UI 는 Phase 10/15                                                                                                                                                                                                                                                               | §5.1, §6.11                                    |
| **D7**  | `<Canvas>` 마운트 위치                 | `viewport/` 는 _lazy chunk_. `React.lazy(() => import('@/viewport'))`. 마운트 위치는 Phase 10                                                                                                                                                                                                                                                                                                                                           | §6.11 lazy 경계                                |
| **D8**  | 상태 구독 — React vs useFrame          | 분자 추가/삭제: selector 기반 React 리렌더 (분자 수 작음). 원자 좌표 이동: `subscribeWithSelector` 외부 구독 → `setMatrixAt` 직접 + `instanceMatrix.needsUpdate = true` (React 리렌더 0회)                                                                                                                                                                                                                                              | §6.2, §6.5                                     |
| **D9**  | InstancedMesh 분할 단위                | **원소별** 풀 (사용된 원소만 lazy 생성). 결합은 단일 cylinder 풀. 머티리얼 균질 + drawcall 최소                                                                                                                                                                                                                                                                                                                                         | §6.2                                           |
| **D9a** | instanceId → AtomId 역매핑             | 풀 별 `instanceIdToAtomId: Array<AtomId>` 사이드카. `setMatrixAt(slot, m)` 호출 시 `instanceIdToAtomId[slot] = atomId` 동시 갱신. atom 삭제 시 **tail-swap** 으로 슬롯 압축 (별도 free-list 불요). `getAtomIdFromIntersection(it)` 이 `it.object.userData.kind === 'atomPool'` 분기 후 매핑                                                                                                                                             | §6.2                                           |
| **D10** | 호버 툴팁                              | `<Viewport />` 내 로컬 `useState<HoverState>`. R3F `onPointerOver` / `onPointerOut` 단건 처리 + drei `Html` 툴팁. 멀티 hit / 전역 hover 는 Phase 09                                                                                                                                                                                                                                                                                     | §6.7                                           |
| **D11** | 분자 등장/퇴장 트랜지션                | 본 Phase 미포함. mount/unmount 깜빡임 회피용 0.15 s opacity 페이드 hook (`useFadeOnMount`) 만 노출. Phase 09 가 결합 변화 애니메이션과 함께 본 구현                                                                                                                                                                                                                                                                                     | §5.7                                           |
| **D12** | 테스트 환경                            | Vitest + jsdom: layout / ID / colors / WebGL2 detector. `@react-three/test-renderer`: scene 그래프 스냅샷 (§8.5). Visual diff 는 Phase 15 Playwright                                                                                                                                                                                                                                                                                    | §8                                             |
| **D13** | 카메라 자동 프레이밍                   | **첫 분자 mount (0→1) 시 자동 `frameActive`**. 이후 add/remove 는 카메라 보존. 사용자 명시 트리거 (`Frame Active` / `Frame All` / `Reset View`) 는 Phase 11 Toolbar 가 `viewportApi.*` 호출. activeId 변경만으로는 자동 재프레이밍 X                                                                                                                                                                                                    | §6.9                                           |
| **D14** | PNG export 를 위한 Canvas 외부 접근    | `<Viewport apiRef={ref} />` imperative `ViewportApi`. `captureBlob({ format, dpr? }): Promise<Blob>` / `getRenderer(): THREE.WebGLRenderer                                                                                                                                                                                                                                                                                              | null`등. 내부`useImperativeHandle` 로 ref 주입 | §5.2 |

선결정 사항 P-표 — 자유도 없는 항목:

| ID     | 결정                                                                                                                                                            | 근거                            |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **P1** | `viewport/` 는 `@/stores` + `@/chemistry/*` 만 import. `@/engine/*`, `@/services/*`, `@/data/*` 직접 import 금지. ESLint `no-restricted-imports` 로 강제        | architecture §4.1 의존 방향     |
| **P2** | `viewport/` 는 React/R3F/three.js 에 의존하는 도메인 외 레이어 (panels 와 동급). 도메인/엔진/서비스는 의존 금지                                                 | 동상                            |
| **P3** | Three.js 좌표 단위 = Å (Phase 03 §4.5 의 `Atom.position` 그대로). 카메라 거리 = 분자 BBox 대각 × 2.5 디폴트                                                     | Phase 03 좌표 보존              |
| **P4** | InstancedMesh instance 한도 초과 (capacity 64 시작, 임계 시 ×2) — `geometry.dispose()` 후 재생성 (three.js 는 in-place resize 불가)                             | three.js 권장                   |
| **P5** | `subscribeWithSelector` 외부 구독은 컴포넌트 unmount 시 반드시 unsub. `useEffect` cleanup 으로 강제                                                             | React 메모리 누수 방지          |
| **P6** | shadow map 비활성, FOG 비활성, `dpr: [1, 2]` 클램프, `gl.outputColorSpace = SRGBColorSpace`                                                                     | architecture §9.2 60 fps 예산   |
| **P7** | 결합당 cylinder 2개 (D4) — atomCount > `LOD_THRESHOLDS.atomCountForLineBonds` 시 1 cyl + per-vertex color (Phase 14 가 임계 수치 결정)                          | LOD hook                        |
| **P8** | `<Viewport />` 는 lazy chunk 의 _디폴트 export_. 모듈 분리 보장을 위해 `index.ts` 에서 named re-export 만 (Phase 14 번들 분석에서 viewport 청크 단일 검증 가능) | architecture §9.1 코드 스플리팅 |

#### 3.1 retrofit 표 (도메인 영향)

D1 의 단 한 가지 변경이 다음 파일들에 _추가성_ (additive) 으로 흡수된다.

| 파일                                          | 변경                                                                                                                                                                                                                                                    | 영향 범위                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/chemistry/compounds/{ids,types}.ts`      | **변경 없음** — `AtomId`/`BondId` brand 와 `Atom.id`/`Bond.id` 필드는 Phase 01 이 이미 정의 (CD1). 본 Phase 는 소비만 함                                                                                                                                | Phase 01 (이미 완료)                                                               |
| `src/engine/parser/toDomain.ts`               | `Atom.id = createAtomId()` / `Bond.id = createBondId()` (`@/chemistry/compounds/ids`) 채움. 동일 SMILES 의 두 호출은 의도적으로 다른 ID (분자 인스턴스 식별) — 이미 Phase 03 §4.5 가 규정                                                               | Phase 03 (이미 완료)                                                               |
| `src/data/compounds/*.json` (Phase 04 청크)   | **변경 없음**. ID 는 저장하지 않으며, `addFromCompound(cid)` 가 적재 시 채움 (D1b)                                                                                                                                                                      | Phase 04 무영향                                                                    |
| `src/stores/moleculeStore.ts` (액션 시그니처) | **변경 없음**. `moveAtom(id, atomIndex, …)` 등 9 개 액션 그대로 (D1a)                                                                                                                                                                                   | Phase 07 §10 DoD 보존                                                              |
| `src/stores/uiStore.ts` (`selection.atomIds`) | 의미 명세 보강: `string` 은 _composite ViewportId_ (`${MoleculeId}::a:${AtomId}` / `${MoleculeId}::b:${BondId}`, prefix 분기) 라는 _문서적_ 명시 (런타임 타입은 `string` 그대로 — 직렬화/persist 단순성). `viewport/ids/viewportId.ts` 가 encode/decode | Phase 07 §4.4 의 코멘트 보강 (본 retrofit 으로 _완료_ — phase-07 갱신본 §4.4 참조) |

본 retrofit 은 코드 변경 PR 단위로 묶을 때 **Phase 08 구현 PR 의 첫 커밋** 으로 들어간다 (선행 Phase 의 별도 수정 PR 불요). 이는 Phase 04 가 `Compound` 타입을 retrofit 할 때 사용한 패턴과 동일하다 (phase-04 §"Phase 03 (소급 수정)").

---

## 4. 데이터 모델 / 타입

### 4.1 ID / 식별자 (`src/viewport/_shared/types.ts` — Phase 01 식별 모델 소비)

`AtomId` / `BondId` / `MoleculeId` 와 `Atom.id` / `Bond.id` 는 **Phase 01 `@/chemistry/compounds/{ids,types}` 가 이미 정의** (CD1 — 본 Phase 의 retrofit/재정의 아님). 본 Phase 는 그대로 import 해 소비한다. 참고용 (Phase 01 정의 형태):

```ts
// (Phase 01 @/chemistry/compounds/ids — 재게시, 본 Phase 정의 아님)
//   type AtomId = Brand<string, 'AtomId'>;  type BondId = Brand<string, 'BondId'>;
//   type MoleculeId = Brand<string, 'MoleculeId'>;
// (Phase 01 @/chemistry/compounds/types — Phase 03 §4.5 확정본)
//   interface Atom { readonly id: AtomId; readonly elementNumber: ElementNumber;
//                    readonly position: Vec3; readonly formalCharge: number;
//                    readonly implicitHCount: number; /* isotope? Phase 03 §4.5 */ }
//   interface Bond { readonly id: BondId; readonly aAtomId: AtomId;   // ★ AtomId 참조 (인덱스 아님, CD1)
//                    readonly bAtomId: AtomId; readonly order: BondOrder; }

// src/viewport/_shared/types.ts
import type { AtomId, BondId, MoleculeId } from '@/chemistry/compounds/ids'; // CD1

/**
 * 뷰포트가 외부에 노출하는 composite ID. uiStore.selection 에 저장되는 형태.
 *
 * 형식: `${MoleculeId}::a:${AtomId}` (atom) 또는 `${MoleculeId}::b:${BondId}` (bond).
 * prefix 분기 (`a:` / `b:`) 가 atom/bond 구분을 캐리한다 — `parseViewportId` 가 이 prefix 로 kind 결정.
 */
export type ViewportAtomId = `${string}::a:${string}`;
export type ViewportBondId = `${string}::b:${string}`;

export type ViewportId =
  | { readonly kind: 'atom'; readonly molId: MoleculeId; readonly atomId: AtomId }
  | { readonly kind: 'bond'; readonly molId: MoleculeId; readonly bondId: BondId };
```

`ViewportAtomId` / `ViewportBondId` 는 **template literal 타입** 이지만 런타임에는 `string`. `uiStore.selection.atomIds: ReadonlyArray<string>` 와 즉시 호환 (Phase 07 §4.4). 인코딩/디코딩은 §5.4 의 `viewportIdFor*` / `parseViewportId` 가 담당. `MoleculeId` / `AtomId` / `BondId` 는 모두 Phase 01 `create*Id()` (crypto.randomUUID 기반) 결과 (`[0-9a-f-]+`) 라 `:` 충돌 없음.

### 4.2 Layout 타입 (`src/viewport/scene/layout.ts`)

```ts
export interface MoleculeLayoutTransform {
  /** Å 단위 그룹 평행이동 (분자 BBox 중심을 원점으로 정렬한 뒤 적용). */
  readonly translation: readonly [number, number, number];
  /** 회전·스케일은 본 Phase 미사용. Phase 09+ 확장 시 기본 단위. */
  readonly rotationQuaternion?: readonly [number, number, number, number];
  readonly scale?: number;
}

export interface MoleculeBBox {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
  readonly center: readonly [number, number, number];
  readonly diagonal: number; // Å, 카메라 거리 산출용
}
```

### 4.3 LOD / 렌더 모드 (`src/viewport/_shared/types.ts`)

```ts
export type LodLevel = 'high' | 'low';

export interface LodThresholds {
  /** 이 값 이상이면 sphere segments 다운, bond cylinder segments 다운. */
  readonly atomCountForLowSegments: number;
  /** 이 값 이상이면 결합을 line 으로 치환 (`THREE.Line` / drei `Line`). */
  readonly atomCountForLineBonds: number;
}

/** Phase 14 가 튜닝, 본 Phase 는 보수적 디폴트. */
export const DEFAULT_LOD_THRESHOLDS: LodThresholds = {
  atomCountForLowSegments: 300,
  atomCountForLineBonds: 1500,
};

/** RenderMode — settingsStore 에서 가져옴. 본 Phase 는 ball-and-stick 한 갈래만. */
export type RenderMode = 'ball-and-stick'; // Phase 07 의 RenderMode 동일 별칭
```

### 4.4 Background / 테마 해상 (`src/viewport/scene/Background.tsx`)

```ts
/** uiStore.viewport.backgroundOverride + settingsStore.theme 결합 결과. */
export type BackgroundResolved =
  | { readonly mode: 'theme-light'; readonly hex: '#FFFFFF' }
  | { readonly mode: 'theme-dark'; readonly hex: '#0E1116' }
  | { readonly mode: 'override-light'; readonly hex: '#FFFFFF' }
  | { readonly mode: 'override-dark'; readonly hex: '#0E1116' };

export const THEME_LIGHT_BG: '#FFFFFF' = '#FFFFFF';
export const THEME_DARK_BG: '#0E1116' = '#0E1116';
```

### 4.5 ViewportApi (`src/viewport/_shared/types.ts`)

```ts
import type * as THREE from 'three';

export interface CaptureBlobOptions {
  readonly format: 'png'; // v1 PNG 전용. 'jpeg'|'webp' 확장은 **Phase 13 이 자기 §12.1 의 Phase-08 retrofit 으로 소유** (본 Phase 는 widen 하지 않음)
  readonly dpr?: number; // 미지정 시 현재 dpr
  readonly transparentBackground?: boolean; // 디폴트 false. true 가능 — Canvas 가 alpha:true 프레임버퍼이므로 투명 PNG 지원 (§5.1)
}

export interface ViewportApi {
  /** 활성 분자 (uiStore activeId 기준) BBox 에 맞춰 카메라/타겟 갱신. */
  frameActive(): void;
  /** 모든 분자 통합 BBox 에 맞춰. */
  frameAll(): void;
  /** 카메라를 본 Phase 의 디폴트 (등각 3/4 + activeId BBox*2.5) 로 리셋. */
  resetCamera(): void;
  /** PNG Blob 캡처. 내부적으로 1프레임 강제 렌더 후 toBlob. */
  captureBlob(opts: CaptureBlobOptions): Promise<Blob>;
  /** 외부에서 three 객체에 접근해야 할 때 (Phase 14 진단 등). */
  getRenderer(): THREE.WebGLRenderer | null;

  // ── Phase 09 가 retrofit 으로 채울 placeholder ──
  // 본 Phase 는 인터페이스 시그니처만 동결하며 구현은 Phase 09 §5.3 에서 본 구현으로 채운다.
  // (선택적 메서드로 두지 않는 이유: Phase 11 Toolbar 가 이 표면을 안정적으로 호출 가능해야 하므로
  //  본 Phase 의 placeholder 구현은 항상 false 반환 / no-op 으로 초기 마운트 가능.)

  /** Undo 가능 여부. Phase 07 placeholder 단계에서는 항상 false. Phase 09 가 본 구현. */
  canUndo: () => boolean;
  /** Redo 가능 여부. Phase 07 placeholder 단계에서는 항상 false. Phase 09 가 본 구현. */
  canRedo: () => boolean;
  /**
   * 현재 selection (uiStore.selection.atomIds 2개) 으로부터 결합 생성을 시도.
   * 성공 = true. 본 Phase 는 stub (false 반환), Phase 09 §6.4 가 본 구현.
   */
  createBondFromSelection: () => boolean;
}
```

> **인터페이스 마감 규약 (소유권 동결)**: `ViewportApi` 인터페이스 전체 — 위 3개 placeholder 메서드 (`canUndo`, `canRedo`, `createBondFromSelection`) 포함 — 는 **본 Phase 08 이 정의·소유**하며 stub 구현으로 마운트 가능하다 (인터페이스 호환으로 Phase 11 Toolbar 가 본 Phase 종료 시점부터 컴파일됨). **Phase 09 는 인터페이스에 멤버를 추가(retrofit)하지 않는다 — 이미 본 Phase 가 선언함.** Phase 09 는 오직 stub _본문_ 을 실제 구현으로 교체하며 시그니처·인터페이스는 불변 (phase-09 §5.3/§10/§12 가 이 표현을 따른다).

### 4.6 InstancedMesh 풀 (`src/viewport/renderers/AtomInstances.tsx` 내부)

```ts
import type * as THREE from 'three';
import type { ElementNumber } from '@/chemistry/elements/types';

/**
 * D9 + D9a — 원소별 InstancedMesh 풀의 내부 표상.
 * 외부에 직접 노출되지 않으며, useAtomMatrixSubscription 와 getAtomIdFromIntersection 의 안쪽에서만 사용.
 */
export interface AtomInstancePool {
  readonly element: ElementNumber;
  readonly mesh: THREE.InstancedMesh;
  /** 슬롯 인덱스 (0..used-1) → AtomId. used..capacity-1 영역은 미사용 (lazy). */
  readonly instanceIdToAtomId: AtomId[];
  /** atomId → slot 역인덱스. setMatrixAt 시 O(1). */
  readonly atomIdToSlot: Map<AtomId, number>;
  /** 현재 capacity (geometry instance 한도). 초과 시 ×2 grow (P4). */
  capacity: number;
  /** 현재 사용 중 슬롯 수 = mesh.count. */
  used: number;
}

/**
 * 슬롯 운영은 **tail-only allocation + tail-swap on remove** 로 단순화 (§8.7 의 단위 테스트가 강제).
 * 별도 free-list 자료구조 없음 — 항상 슬롯 [0, used) 만 활용 가능 영역.
 */

/** mesh.userData 에 박는 식별자 — picking 분기. */
export type AtomPoolUserData = {
  readonly kind: 'atomPool';
  readonly element: ElementNumber;
  readonly molId: MoleculeId;
};
export type BondPoolUserData = {
  readonly kind: 'bondPool';
  readonly molId: MoleculeId;
};
```

결합 풀도 동일 구조 (`BondInstancePool`) — 다만 `instanceIdToAtomId` 대신 `instanceIdToBondId: BondId[]`, `bondIdToSlot: Map<BondId, number>`. 결합당 cylinder 가 1~3개 (`order` 에 따라) 또는 2개 (mid-split D4) 이므로, **풀 슬롯은 cylinder 단위** 이고 _논리적 BondId_ 는 여러 슬롯에 매핑된다 (`bondIdToSlots: Map<BondId, ReadonlyArray<number>>` — `order` 와 split 여부에 따라 2~6개).

### 4.7 HoverState (로컬, D10)

```ts
// src/viewport/Viewport.tsx 의 로컬 useState
export interface HoverState {
  readonly molId: MoleculeId;
  readonly atomId: AtomId;
  /** 화면 픽셀 좌표 — drei Html 의 절대 위치 위로 정렬. */
  readonly screen: readonly [number, number];
}
```

### 4.8 WebGL 가능성 (`src/viewport/capability/webgl2.ts`)

```ts
export type WebGLDetectResult =
  | { readonly ok: true; readonly maxTextureSize: number }
  | {
      readonly ok: false;
      readonly reason:
        | 'no-webgl2'
        | 'no-wasm' // architecture §3.3 에서 필수 — RDKit 동반 보호 차원에서 본 Phase 에서도 검사
        | 'context-creation-failed';
    };

export function detectWebGL2(): WebGLDetectResult;
```

---

## 5. 퍼블릭 API / 인터페이스

본 Phase 의 외부 면은 **`src/viewport/index.ts` 한 모듈** 의 named/default export 다. 다른 레이어(`app`, `panels`, `components`) 는 항상 `from '@/viewport'` 한 줄로 사용한다.

### 5.1 `<Viewport />` (default export)

```ts
// src/viewport/Viewport.tsx
export interface ViewportProps {
  /** imperative API — Phase 11 Toolbar / Phase 13 export 가 사용. */
  readonly apiRef?: React.Ref<ViewportApi>;
  /** WebGL2 미지원 시 표시할 노드. 미지정 시 null 반환 (Phase 10 가 fallback 페이지를 둘러쌈). */
  readonly fallback?: React.ReactNode;
  /** 외부에서 className 주입 (Phase 10 레이아웃이 사이즈 결정). */
  readonly className?: string;
}

const Viewport: React.FC<ViewportProps>;
export default Viewport;
```

내부 마운트:

1. `detectWebGL2()` → ok=false 면 `fallback ?? null` 반환.
2. ok=true 면 `<Canvas dpr={[1, 2]} flat shadows={false} gl={{ antialias: true, alpha: true }}>` 마운트. **`alpha: true`** 는 `captureBlob({ transparentBackground: true })` (§4.5, Phase 13 PNG export) 가 투명 배경을 만들 수 있도록 프레임버퍼에 알파 채널을 확보하기 위함. 평상시 배경색은 `<Background />` (§ Scene) 가 불투명하게 칠하므로 시각적 차이는 없다.
3. Canvas 안에 `<Scene />` (Lighting / Camera / OrbitControls / Molecules 컨테이너) 을 둔다.
4. `apiRef` 는 Canvas 안 child (`<ViewportApiBridge />`) 가 `useImperativeHandle` 로 채움.

### 5.2 `ViewportApi` (D14)

§4.5 그대로. `captureBlob` 의 동작은 §6.10 에서 상세.

### 5.3 Layout 함수

```ts
// src/viewport/scene/layout.ts
export function computeMoleculeLayout(
  molecules: ReadonlyArray<Molecule>,
): ReadonlyMap<MoleculeId, MoleculeLayoutTransform>;

export function computeBBox(molecule: Molecule): MoleculeBBox;

export function computeAggregateBBox(
  molecules: ReadonlyArray<{ molecule: Molecule; transform: MoleculeLayoutTransform }>,
): MoleculeBBox;
```

순수 함수, state 무관. `useMemo` 로 분자 ID 리스트 + 각 분자 atom count 변화에 반응.

### 5.4 ID 인코더/디코더

```ts
// src/viewport/ids/viewportId.ts
import type { MoleculeId } from '@/stores/_shared/types';

export function viewportIdForAtom(molId: MoleculeId, atomId: AtomId): ViewportAtomId;
export function viewportIdForBond(molId: MoleculeId, bondId: BondId): ViewportBondId;

/** 실패 시 null (불린 검증 포함). 형식: `${molId}::${atomId|bondId}` */
export function parseViewportId(s: string): ViewportId | null;

/** uiStore.selection.atomIds 의 string[] 을 viewport-side 로 디코드. */
export function parseSelectedAtoms(
  atomIds: ReadonlyArray<string>,
): ReadonlyArray<{ molId: MoleculeId; atomId: AtomId }>;
```

### 5.5 ID ↔ index 번역 (D1a)

```ts
// src/viewport/ids/lookup.ts
export function atomIdToIndex(molecule: Molecule, atomId: AtomId): number;
// 미발견 시 -1. 호출자가 -1 분기를 명시적으로 처리해야 한다.

export function bondIdToIndex(molecule: Molecule, bondId: BondId): number;

/** 인덱스 기반 atom → AtomId. removeAtom 직후 selection 보정용. */
export function atomIndexToId(molecule: Molecule, index: number): AtomId | null;
```

`atomIdToIndex` 는 단순 선형 탐색 (`molecule.atoms.findIndex`). 분자 atom 수 < 1000 이라 해시 인덱스 미설정. 1000+ 분자 도입 시 Phase 14 가 인덱스 캐시 추가 검토.

### 5.6 Position subscription 훅

```ts
// src/viewport/subscriptions/usePositionSubscription.ts
import type { MoleculeId } from '@/stores/_shared/types';
import type * as THREE from 'three';

export interface PositionSubscriptionHandle {
  /** Phase 09 의 드래그 시작 시 잠시 비활성화 (드래그 자체가 setMatrixAt 을 직접 호출하므로). */
  readonly suspend: () => void;
  readonly resume: () => void;
}

/**
 * moleculeStore 의 `molecules[molId].atoms[*].position` 변화를 구독해
 * InstancedMesh 풀의 .setMatrixAt 만 직접 갱신 (React 리렌더 없음).
 *
 * 컴포넌트 unmount 시 자동 unsubscribe (P5).
 */
export function useAtomMatrixSubscription(molId: MoleculeId): PositionSubscriptionHandle;
```

### 5.7 fade hook (D11)

```ts
// src/viewport/_shared/useFadeOnMount.ts
export interface UseFadeOnMountOpts {
  readonly durationMs?: number; // 기본 150
  readonly onCompleted?: () => void;
}

/** group.material.opacity 0→1. unmount 시 1→0 후 실제 unmount (Phase 09 가 본 구현 인수). */
export function useFadeOnMount(opts?: UseFadeOnMountOpts): {
  readonly opacity: number;
  readonly transparent: true;
};
```

### 5.8 Picking 후크

```ts
// src/viewport/ids/picking.ts
import type * as THREE from 'three';

export type PickedTarget =
  | { readonly kind: 'atom'; readonly molId: MoleculeId; readonly atomId: AtomId }
  | { readonly kind: 'bond'; readonly molId: MoleculeId; readonly bondId: BondId };

/**
 * R3F `intersection` (또는 three.js `THREE.Intersection`) 으로부터 도메인 식별자 도출.
 * `intersection.object.userData.kind` 가 'atomPool'/'bondPool' 일 때만 매핑, 아니면 null.
 */
export function getAtomIdFromIntersection(intersection: THREE.Intersection): PickedTarget | null;
```

### 5.9 WebGL2 detector

```ts
// src/viewport/capability/webgl2.ts
export function detectWebGL2(): WebGLDetectResult;
```

### 5.10 selector 면 (Phase 07 위에 본 Phase 가 추가)

본 Phase 는 새 selector 를 추가하지 않는다. Phase 07 §5 의 selector 만 사용한다. 단 _조합 selector_ (composition) 는 viewport 내부 헬퍼로 둔다 (`src/viewport/subscriptions/selectors.ts`):

```ts
export const selectAtomCountAcrossAll = (s: MoleculeStoreState): number =>
  s.ids.reduce((acc, id) => acc + (s.molecules[id]?.atoms.length ?? 0), 0);

/** computeMoleculeLayout 입력용 — 안정 참조 (immer 가 분자 추가/삭제 시에만 새 배열). */
export const selectMoleculesArray = (s: MoleculeStoreState): ReadonlyArray<Molecule> =>
  s.ids.map((id) => s.molecules[id]).filter((m): m is Molecule => Boolean(m));
```

---

## 6. 핵심 로직 / 전략

### 6.1 Scene 합성 (`src/viewport/scene/Scene.tsx`)

```
<Scene>
  <Background />              {/* gl.setClearColor 또는 <color attach="background"/> */}
  <Lighting />                {/* ambient(0.5) + key directional(0.8 from +1,+2,+1) + fill(0.3 from -1,-1,-1) */}
  <Camera />                  {/* PerspectiveCamera 35° FOV, 등각 3/4 (1, 0.8, 1) 정규화 */}
  <OrbitControls
    enabled={controlsEnabled}             // Phase 09 가 토글
    enableDamping
    dampingFactor={0.08}
    makeDefault                            // useThree().controls 로 Phase 09 가 접근
  />
  <Suspense fallback={null}>
    {moleculeIds.map(id => <MoleculeGroup key={id} molId={id} />)}
  </Suspense>
  <ViewportApiBridge ref={apiRef} />        {/* useThree + useImperativeHandle */}
</Scene>
```

- 그림자 / FOG / 톤매핑 (`gl.toneMapping`) 은 모두 비활성 (P6). 색은 sRGB 출력만 보장 (`gl.outputColorSpace = SRGBColorSpace`).
- `controlsEnabled` 는 본 Phase 디폴트 `true`. Phase 09 의 드래그 시작 시 false 토글, 종료 시 true 복귀 (Phase 09 §“카메라 충돌 방지”).
- `makeDefault` 로 OrbitControls 를 R3F 의 기본 controls 로 등록. Phase 09 가 `useThree(s => s.controls)` 로 접근.

### 6.2 Atom InstancedMesh 풀 운영 (D9 + D9a + P4)

#### 6.2.1 풀 자료구조

각 분자 (`MoleculeGroup`) 는 그 분자 안에서 사용된 원소별로 `AtomInstancePool` 한 개씩 보유. 풀 자료구조는 §4.6 그대로.

#### 6.2.2 슬롯 할당 알고리즘 (tail-only allocation + tail-swap)

별도 free-list 없음. 항상 슬롯 [0, used) 만 활용 영역. 삭제 시 tail-swap 으로 hole 발생 차단.

**할당 (atom 추가)**:

```pseudo
allocSlot(pool, atomId) -> slot:
  if pool.atomIdToSlot.has(atomId):
    return pool.atomIdToSlot.get(atomId)        // 동일 atomId 재할당 — 기존 슬롯 반환
  if pool.used == pool.capacity:
    grow(pool, pool.capacity * 2)
  slot = pool.used
  pool.used += 1
  pool.instanceIdToAtomId[slot] = atomId
  pool.atomIdToSlot.set(atomId, slot)
  pool.mesh.count = pool.used
  return slot
```

**해제 (atom 삭제) — tail-swap**:

```pseudo
freeSlot(pool, atomId):
  slot = pool.atomIdToSlot.get(atomId)
  if slot === undefined: return                   // 이미 없음
  lastSlot = pool.used - 1
  if slot < lastSlot:
    // tail-swap: 마지막 슬롯의 instance 데이터를 이쪽으로 옮긴다
    matrix = readMatrix(pool.mesh, lastSlot)
    pool.mesh.setMatrixAt(slot, matrix)
    movedAtomId = pool.instanceIdToAtomId[lastSlot]
    pool.instanceIdToAtomId[slot] = movedAtomId
    pool.atomIdToSlot.set(movedAtomId, slot)
  pool.instanceIdToAtomId[lastSlot] = undefined  // 명시 비우기 (디버그 용)
  pool.atomIdToSlot.delete(atomId)
  pool.used -= 1
  pool.mesh.count = pool.used
  pool.mesh.instanceMatrix.needsUpdate = true
```

**좌표 갱신 (좌표 이동)**:

```pseudo
setAtomMatrix(pool, atomId, position):
  slot = pool.atomIdToSlot.get(atomId)
  if slot === undefined:
    slot = allocSlot(pool, atomId)
  buildMatrix(matrix, position, scale = covalentRadiusOf(pool.element))
  pool.mesh.setMatrixAt(slot, matrix)
  pool.mesh.instanceMatrix.needsUpdate = true
```

#### 6.2.3 Capacity 증설 (P4)

`grow(pool, newCapacity)` 는 three.js 가 InstancedMesh in-place resize 를 지원하지 않으므로:

1. 새 `THREE.InstancedMesh(geometry, material, newCapacity)` 생성
2. `for (let s = 0; s < pool.used; s++) newMesh.setMatrixAt(s, oldMesh.getMatrixAt(s))`
3. `oldMesh.geometry.dispose()` / `oldMesh.dispose()` 후 부모 group 에서 replace
4. `pool.mesh = newMesh`, `pool.capacity = newCapacity`

초기 capacity = 64. 64 / 128 / 256 / … 로 ×2 grow. 분자 atom 수가 capacity 미만이면 dispose/recreate 비용 무.

#### 6.2.4 picking 분기 (D9a)

`mesh.userData = { kind: 'atomPool', element, molId } satisfies AtomPoolUserData` 를 풀 생성 시 박는다. `getAtomIdFromIntersection(it)`:

```ts
export function getAtomIdFromIntersection(it: THREE.Intersection): PickedTarget | null {
  const ud = it.object.userData as Partial<AtomPoolUserData | BondPoolUserData>;
  if (ud.kind === 'atomPool' && it.instanceId != null) {
    const pool = atomPoolRegistry.find(ud.molId, ud.element);
    const atomId = pool?.instanceIdToAtomId[it.instanceId];
    return atomId ? { kind: 'atom', molId: ud.molId, atomId } : null;
  }
  if (ud.kind === 'bondPool' && it.instanceId != null) {
    const pool = bondPoolRegistry.find(ud.molId);
    const bondId = pool?.instanceIdToBondId[it.instanceId];
    return bondId ? { kind: 'bond', molId: ud.molId, bondId } : null;
  }
  return null;
}
```

`atomPoolRegistry` 는 `MoleculeGroup` 마운트 시 등록 / unmount 시 제거하는 모듈-레벨 `Map<string, AtomInstancePool>` (`${molId}::${element}` 키). Phase 09 raycast 도 동일 레지스트리 조회로 충돌 없이 동작.

### 6.3 Bond cylinder 변환 + 색 분할 + 차수 표현

#### 6.3.1 cylinder 1개의 변환 (axis quaternion)

세그먼트 시작점 `A`, 끝점 `B`, 길이 `L = |B − A|`. cylinder 기본 축은 +Y, 길이 1, 반경 1 의 표준 geometry. instance matrix:

```
T = translation((A + B) / 2)
R = quaternionBetween(yAxis, normalize(B - A))
S = scale(BOND_RADIUS_ANGSTROM, L, BOND_RADIUS_ANGSTROM)
M = T · R · S
```

순수 함수 `bondTransform(a: Vec3, b: Vec3, radius: number, length: number): THREE.Matrix4` 가 위 합성을 수행. 단위 테스트는 ethene/water 기준값 (§8.4).

#### 6.3.2 두 색 분할 (D4)

원자 A, B 가 서로 다른 원소면 cylinder 2개:

- 첫 cylinder: midpoint `M = (A + B) / 2` 까지. 색 = element(A) CPK.
- 두 번째 cylinder: midpoint M 부터 B 까지. 색 = element(B) CPK.

**실제 구현**: 결합 풀의 `instanceColor` (three.js `InstancedBufferAttribute('color', 3)`) 에 cylinder 단위 색 저장. shader 는 `gl_FragColor = vColor * lighting(uv)`. material 은 `MeshStandardMaterial` (vertexColors=true) 단일 인스턴스 — 색이 instance 별로 다른 경우 InstancedBufferAttribute 표준 패턴.

같은 원소 A=B 면 1 cyl 로 (P7 의 `atomCountForLineBonds` 미만 한정 최적화). 다중 결합도 동일 — 각 평행 cylinder 가 mid-split 적용.

#### 6.3.3 결합 차수별 평행 변위 (D3)

`order ∈ {1, 2, 3, 'aromatic'}`:

- `1`: 단일 cyl (A→B 직선)
- `2`: 평행 cyl 2개. 변위 벡터 `d = perpendicular(axis) * BOND_PARALLEL_OFFSET`. cyl 위치 = `M ± d/2`.
- `3`: 평행 cyl 3개. 중앙 0, 양쪽 `±d`.
- `'aromatic'`: 단일 cyl + drei `Line` 의 dashed inner (반대편 atom 연결, 결합 길이의 70%, dashSize=0.05, gapSize=0.03). `renderAromaticOverlay(bondId)` 가 Line 컴포넌트 반환. _주의_: aromatic ring 전체에 단일 inner circle 을 그리는 대안도 있으나, 본 Phase 는 결합 단위 단순 dashed 를 채택 (구현 단순 + ring 검출 무관). Phase 14 가 ring-aware 로 교체 가능.

`perpendicular(axis)` 는 axis 와 카메라 right vector 의 외적 정규화. 매 프레임 카메라 회전에 따라 갱신 (drei `Billboard` 비사용 — 평행 결합은 carbon-ring 평면감 유지를 위해 _카메라가 아니라_ ring 평면 기준이 더 자연스럽지만, ring 검출은 RDKit 영역. 본 Phase 는 카메라 right 벡터 기준으로 단순 구현. Phase 14 또는 Phase 11 의 분자 정보 패널 도입 시 ring-plane 정보를 받으면 교체).

#### 6.3.4 결합 풀 슬롯 운영

결합 1개당 cylinder 슬롯 수:
| order | cyl 수 (mid-split 기본) | 같은 원소면 |
|-------|------------------------|-------------|
| 1 | 2 | 1 |
| 2 | 4 | 2 |
| 3 | 6 | 3 |
| aromatic | 2 + 1 (Line) | 1 + 1 (Line) |

`bondIdToSlots: Map<BondId, ReadonlyArray<number>>` 로 BondId → 점유 슬롯들. 차수 변경 (Phase 07 의 `setBondOrder`) 은 모든 슬롯 free 후 재할당.

### 6.4 Multi-molecule layout (D2)

`computeMoleculeLayout(molecules)`:

```pseudo
sorted = molecules                             // 입력 순서 그대로 사용. moleculeStore.ids 가 이미 안정 정렬 (Phase 07 §4.2 P3) — 본 함수는 정렬을 다시 가하지 않는다 (§11 #4 가 정렬 정책 변경을 결정하면 그때 인계)
n = sorted.length
if n === 0: return Map()
if n === 1: return Map([[sorted[0].id, { translation: [0, 0, 0] }]])

// 각 분자의 BBox center 정렬 (개별 분자 내부 좌표는 0 중심으로 평행이동)
bboxes = sorted.map(m => computeBBox(m))
maxDim = max(bboxes.map(b => b.diagonal))     // 가장 큰 분자 기준 간격

cols = n <= 3 ? n : ceil(sqrt(n))
rows = ceil(n / cols)
cellW = maxDim + GROUP_PADDING_ANGSTROM       // 예: 4 Å
cellH = cellW

result = Map()
for i in 0..n-1:
  col = i % cols
  row = floor(i / cols)
  bbox = bboxes[i]
  // 분자 내부 BBox center 를 셀 중심에 정렬
  tx = (col - (cols - 1) / 2) * cellW - bbox.center.x
  ty = 0
  tz = (row - (rows - 1) / 2) * cellH - bbox.center.z
  result.set(sorted[i].id, { translation: [tx, ty, tz] })

return result
```

- 결정성: 입력 분자 수 + 각 BBox 만의 함수. `useMemo` 로 `selectMoleculesArray` 변화에 반응.
- 입력 순서는 `moleculeStore.ids` 가 보존. 정렬 정책 (priority/atomCount/addedAt) 변경은 §11 열린 질문.
- 회전·스케일 미사용. Phase 09+ 가 사용자 수동 배치를 도입할 때 `groupTransform` 슬라이스 추가.

### 6.5 Position subscription + selection stale 처리 (D8 + D1a)

#### 6.5.1 좌표 구독

```ts
// useAtomMatrixSubscription(molId): PositionSubscriptionHandle
const suspendedRef = useRef(false);

useEffect(() => {
  const unsub = useMoleculeStore.subscribe(
    (s) => s.molecules[molId],
    (mol, prevMol) => {
      if (suspendedRef.current) return; // Phase 09 의 드래그 중 일시정지
      if (!mol || !prevMol || mol === prevMol) return;
      // atom 수 변화는 상위 React 리렌더가 처리 (allocSlot/freeSlot 호출 발화)
      // 여기서는 동일 atomId 의 position 변경만 처리
      for (const a of mol.atoms) {
        const prev = prevMol.atoms.find((p) => p.id === a.id);
        if (prev && prev.position !== a.position) {
          const pool = atomPoolRegistry.find(molId, a.element);
          if (pool) setAtomMatrix(pool, a.id, a.position);
        }
      }
    },
    { fireImmediately: false, equalityFn: Object.is },
  );
  return () => unsub(); // P5 — 반드시 unsub
}, [molId]);

return {
  suspend: () => {
    suspendedRef.current = true;
  },
  resume: () => {
    suspendedRef.current = false;
  },
};
```

- `Object.is` 비교가 아니라 **얕은 (shallow) atom array 비교** + **deep position diff** 가 필요. 위 코드는 의도 표현. 실제 구현은 `prevMol === mol` ref-equal 가 흔하므로 (immer 가 변경된 분자만 새 객체) 필터를 한 단계 더 추가:
  ```ts
  if (mol === prevMol) return;
  ```
- `atom 추가/삭제` 도 동일 구독에서 캐치 가능하지만, 슬롯 alloc/free 는 React 트리 상위에서 (상위 컴포넌트가 atoms 배열 길이 변화로 리렌더) 처리하는 게 자연스럽다. 본 hook 은 _position 만_ 갱신하는 빠른 경로.

#### 6.5.2 selection stale 처리 (D1a)

```ts
// src/viewport/subscriptions/selectionGuard.ts
export function useSelectionStaleGuard() {
  useEffect(() => {
    const unsub = useMoleculeStore.subscribe(
      (s) => s.molecules,
      (mols) => {
        const sel = useUiStore.getState().selection;
        const liveAtomIds = sel.atomIds.filter((sid) => {
          const parsed = parseViewportId(sid);
          if (!parsed || parsed.kind !== 'atom') return false;
          const m = mols[parsed.molId];
          return m?.atoms.some((a) => a.id === parsed.atomId) ?? false;
        });
        const liveBondIds = sel.bondIds.filter((sid) => {
          const parsed = parseViewportId(sid);
          if (!parsed || parsed.kind !== 'bond') return false;
          const m = mols[parsed.molId];
          return m?.bonds.some((b) => b.id === parsed.bondId) ?? false;
        });
        if (
          liveAtomIds.length !== sel.atomIds.length ||
          liveBondIds.length !== sel.bondIds.length
        ) {
          useUiStore.getState().actions.setSelection({
            atomIds: liveAtomIds,
            bondIds: liveBondIds,
          });
        }
      },
    );
    return () => unsub();
  }, []);
}
```

- `<Viewport />` 마운트 시 한 번 등록. atom/bond 삭제로 stale 이 된 selection 을 자동 정리.
- `useUiStore.getState()` cross-store 호출은 본 Phase 가 _\_crossStore 의 정식 통로 외_ 에서 사용하는 유일한 예외. **이유**: Phase 07 의 `_crossStore` 는 stores 내부 격리 통로이고, viewport 의 stale 검사는 _반응성 무관_ (재 dispatch 가 아니라 상태 정리). Phase 07 §6.6 의 P1 에 의해 viewport→stores 호출은 액션을 통해서만 — `actions.setSelection` 호출이 그 통로다. `getState()` 호출은 selection 의 _현재 값_ 을 읽는 단순 read 로, Phase 07 §8.2 에서 컴포넌트 레벨이 selector 로 구독하는 것의 등가 (subscribe 콜백 안에서 selector 호출).
- Phase 09 가 본격 raycast 도입 시 본 hook 을 그대로 활용하거나, 인터랙션 액션 안에서 stale 검증 후 dispatch 로 옮길 수 있다.

### 6.6 Background / 테마 해상

`<Background />` 가:

1. `selectTheme(s)` (`'light' | 'dark' | 'system'`) 와 `selectBackgroundOverride(s)` (`'theme' | 'light' | 'dark'`) 를 selector 로 구독
2. `system` 일 때는 `window.matchMedia('(prefers-color-scheme: dark)')` 로 해석 (Phase 01 의 동일 로직 재사용 가능 — `src/utils/theme.ts` 가 이미 동일 함수 노출 가정. 미존재면 본 Phase 가 작은 헬퍼 추가 후 Phase 01 §11 `현 추론기 보강` 에 인계)
3. 결과를 `BackgroundResolved` 로 도출 → `<color attach="background" args={[hex]} />`

**우선순위 (architecture §3.10 의 "테마 연동 + 토글 독립 오버라이드"):**

```ts
function resolveBackground(theme: Theme, override: BackgroundOverride): BackgroundResolved {
  // 1순위: 사용자가 명시적으로 override 를 'light' / 'dark' 로 선택했으면 theme 무시.
  if (override === 'light') return BackgroundResolved.light;
  if (override === 'dark') return BackgroundResolved.dark;

  // 2순위: override === 'theme' (디폴트) 이면 settingsStore.theme 을 따른다.
  //        'system' 은 OS prefers-color-scheme 으로 한 번 더 분기.
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? BackgroundResolved.dark : BackgroundResolved.light;
  }
  return theme === 'dark' ? BackgroundResolved.dark : BackgroundResolved.light;
}
```

- 우선순위 요약: `uiStore.viewport.backgroundOverride` (light/dark 명시) > `settingsStore.theme` (system 시 OS 감지) > 기본 light.
- override === 'theme' 의 의미: "오버라이드 없음, theme 을 따라간다" — 현 UI 상태와 사용자 의도 일치.
- `prefers-color-scheme` 변경 이벤트 (`mediaQueryList.addEventListener('change', ...)`) 는 `<Background />` 안에서 useEffect 로 구독, 변경 시 React 리렌더 발화.

테마 전환 시 React 리렌더가 `<color>` prop 을 갱신 → R3F 가 즉시 반영.

### 6.7 라벨 / 호버 툴팁 (D10)

#### 6.7.1 원자 라벨

`<AtomLabels molecule={...} />` 컴포넌트:

- `selectAtomLabelsOn(uiStore)` 또는 `selectIsCvdOn(settingsStore)` 가 true 면 모든 atom 위에 drei `<Text>` 빌보드 표시 (`text = element.symbol`)
- 색은 배경 대비 자동 (light bg → black, dark bg → white). `BackgroundResolved` 에서 도출
- 폰트 크기 = `0.5 Å` (Å 좌표계 기준 — 카메라 줌에 따라 자연스럽게 변화). 거리 LOD 임계 (Phase 14) 후보

#### 6.7.2 호버 툴팁

`<MoleculeGroup>` 의 `<AtomInstances>` 가 R3F `onPointerOver` / `onPointerOut` 핸들러를 mesh 에 부착:

```tsx
<instancedMesh
  onPointerOver={(e) => {
    e.stopPropagation();
    const id = getAtomIdFromIntersection(e);
    if (id?.kind === 'atom') {
      setHover({ molId: id.molId, atomId: id.atomId, screen: [e.clientX, e.clientY] });
    }
  }}
  onPointerOut={() => setHover(null)}
  …
/>
```

`<HoverTooltip hover={hover} />` 가 drei `<Html occlude position={…}>` 로 atom 좌표 위에 픽셀 툴팁 렌더. 내용 = `${symbol} (${element.nameKo} / ${element.nameEn})` + 포말전하 + 임플리시트 H 수.

**OrbitControls 충돌**: `e.stopPropagation()` 로 instance pointer 이벤트가 OrbitControls 까지 전파되지 않게 함. drag 시작은 controls 가 받고, hover 는 instance 가 받는다.

#### 6.7.3 CVD 강제 on

`selectIsCvdOn` true → `<AtomLabels alwaysOn />` 강제. architecture §3.5 의 “색약 모드 on 시 원소 라벨을 강제 on” 그대로.

### 6.8 RenderMode 단일 분기

`<MoleculeGroup>` 안:

```tsx
const mode = useSettingsStore(selectRenderMode);
switch (mode) {
  case 'ball-and-stick':
    return <BallAndStickRenderer molecule={…} />;
  // 향후 'space-filling' / 'wireframe' 케이스 추가 시 단지 새 분기 + 새 컴포넌트.
  // 본 Phase 는 ball-and-stick 만 구현.
  default: {
    // exhaustive check — 새 RenderMode 가 추가되면 여기서 컴파일 에러가 나도록 강제.
    // (return null fallback 은 의도적으로 두지 않음 — 런타임에 도달했다면 RenderMode 유니온이
    //  확장되었는데 본 switch 가 미갱신된 상태이며, 이는 *실패-빠르게* 가 안전하다.)
    const _exhaustive: never = mode;
    throw new Error(`Unimplemented RenderMode: ${String(_exhaustive)}`);
  }
}
```

`switch` 의 `never` 분기가 _컴파일타임 에러_ 로 미구현 분기를 강제한다 (`return null` 같은 silent fallback 을 두면 컴파일은 통과하나 사용자에게 빈 분자가 보이는 묵음 버그가 발생). architecture §3.1 ⑤ 의 "중단 없이 확장" 그대로.

### 6.9 카메라 자동/수동 프레이밍 (D13)

#### 6.9.1 디폴트 카메라 (`<Camera />`)

```ts
const DEFAULT_CAMERA_DIR = normalize([1, 0.8, 1]);   // 등각 3/4
const DEFAULT_FOV = 35;                              // deg

function placeCamera(camera, target, bbox):
  distance = max(bbox.diagonal * 2.5, MIN_CAMERA_DISTANCE)
  camera.position = target + DEFAULT_CAMERA_DIR * distance
  camera.up = (0, 1, 0)
  camera.lookAt(target)
  controls.target = target
  controls.update()
```

#### 6.9.2 자동 프레이밍 (첫 분자만)

```ts
useEffect(() => {
  const unsub = useMoleculeStore.subscribe(
    (s) => ({ count: s.ids.length, activeId: s.activeId }),
    ({ count, activeId }, prev) => {
      if (prev.count === 0 && count === 1 && activeId) {
        viewportApi.frameActive();
      }
    },
    { equalityFn: shallow },
  );
  return () => unsub();
}, []);
```

이후 add/remove 는 카메라 보존. activeId 변경만으로는 자동 재프레이밍 X.

#### 6.9.3 수동 트리거

`viewportApi.frameActive()` / `frameAll()` / `resetCamera()` 를 Phase 11 Toolbar 가 버튼 클릭 핸들러에서 호출.

- `frameActive()`: `activeId` 의 분자 BBox + 해당 분자의 `MoleculeLayoutTransform.translation` 을 적용한 월드-스페이스 BBox 에 `placeCamera`.
- `frameAll()`: `computeAggregateBBox` 결과에 `placeCamera`.
- `resetCamera()`: `frameActive()` 와 동일하지만 OrbitControls 의 회전/줌 도 함께 리셋 (`controls.reset()` 호출).

### 6.10 captureBlob (PNG export 진입점, D14)

```ts
// ViewportApiBridge 안
const { gl, scene, camera } = useThree();

const captureBlob: ViewportApi['captureBlob'] = async (opts) => {
  const prevDpr = gl.getPixelRatio();
  if (opts.dpr) gl.setPixelRatio(opts.dpr);
  const prevClear = new THREE.Color();
  gl.getClearColor(prevClear);
  const prevAlpha = gl.getClearAlpha();
  if (opts.transparentBackground) gl.setClearColor(0x000000, 0);

  // 1프레임 강제 렌더 (R3F 의 frameloop demand 모드라도)
  gl.render(scene, camera);

  const blob: Blob = await new Promise((resolve, reject) => {
    gl.domElement.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
      'image/png',
    );
  });

  // 복원
  gl.setPixelRatio(prevDpr);
  gl.setClearColor(prevClear, prevAlpha);
  gl.render(scene, camera);

  return blob;
};
```

- Phase 13 의 PNG export 가 `viewportApi.captureBlob({ format: 'png' })` 한 줄 호출로 끝나도록 표면 동결.
- `dpr` 옵션은 export 해상도 조절 (예: 화면이 2× DPR 인데 4K 캡처를 위해 `dpr: 4`).
- `transparentBackground` 는 Phase 13 의 사용자 옵션 후보. 본 Phase 는 토글만 노출.

### 6.11 WebGL2 가드 + dispose (HMR 안전)

#### 6.11.1 detectWebGL2 구현

```ts
export function detectWebGL2(): WebGLDetectResult {
  if (typeof WebAssembly === 'undefined') {
    return { ok: false, reason: 'no-wasm' };
  }
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  if (!gl) {
    canvas.remove();
    return { ok: false, reason: 'no-webgl2' };
  }
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  const lose = gl.getExtension('WEBGL_lose_context');
  lose?.loseContext();
  canvas.remove();
  return { ok: true, maxTextureSize };
}
```

- `<Viewport />` 마운트 직전 1회 호출. 결과는 모듈-레벨 캐시 (재호출 비용 제거).
- Phase 03 의 `RdkitInitErrorCode.UnsupportedEnvironment` 와 동일 정신 — 본 Phase 는 자체 reason 코드 (`no-webgl2` / `no-wasm` / `context-creation-failed`) 만 보고하고, 사용자 안내 페이지는 Phase 10/15.

#### 6.11.2 HMR / dispose

R3F + drei 컴포넌트는 unmount 시 자동 dispose 가 일반적이지만, `InstancedMesh` 의 `geometry` / `material` 은 명시적 dispose 가 필요할 수 있다 (특히 capacity grow 때 생성한 옛 mesh). 본 Phase 의 풀 `grow()` 가 옛 mesh 를 명시 dispose 한다 (§6.2.3 ③). Vite HMR 이 모듈 교체로 풀 인스턴스를 폐기할 때는 R3F 의 `<Canvas>` 가 unmount 되며 children dispose 가 cascade 된다. 추가 위험은 atomPoolRegistry 의 모듈-레벨 Map 이 stale entry 를 보유할 가능성 — `MoleculeGroup` unmount 시 `atomPoolRegistry.deleteAll(molId)` 를 명시 호출한다.

**HMR 안전 추가 가드** (`<Viewport />` 본체에 추가):

```tsx
// src/viewport/Viewport.tsx 안
useEffect(() => {
  return () => {
    // <Canvas> 자체가 unmount 되어 모든 children dispose 가 cascade 되었더라도,
    // 모듈-레벨 atomPoolRegistry 는 모듈이 살아있는 한 stale entry 를 가질 수 있다.
    // Vite HMR 이 viewport 모듈 자체를 교체하면 새 모듈이 fresh registry 를 갖지만,
    // 이전 registry 의 mesh 는 GC 대상이므로 명시적 dispose 가 메모리 누수 방지.
    atomPoolRegistry.clearAll();
  };
}, []);
```

이는 `MoleculeGroup` 의 `deleteAll(molId)` 를 _전체_ 로 확장한 안전망이며, 정상 마운트/언마운트 시에는 이미 `deleteAll` 이 호출되어 있어 추가 dispose 비용 없음.

### 6.12 LOD 훅 (분기 지점만, 임계값은 Phase 14)

```ts
// src/viewport/_shared/lod.ts
import { DEFAULT_LOD_THRESHOLDS } from './types';

export function pickLodLevel(
  totalAtomCount: number,
  thresholds: LodThresholds = DEFAULT_LOD_THRESHOLDS,
): LodLevel {
  return totalAtomCount >= thresholds.atomCountForLowSegments ? 'low' : 'high';
}

/** LOD 별 sphere geometry 반환 (캐시). */
export function sphereGeometryFor(level: LodLevel): THREE.SphereGeometry {
  // high: SphereGeometry(1, 24, 16). low: SphereGeometry(1, 12, 8)
}

export function cylinderGeometryFor(level: LodLevel): THREE.CylinderGeometry {
  // high: CylinderGeometry(1, 1, 1, 16). low: CylinderGeometry(1, 1, 1, 8)
}

export function shouldUseLineBonds(
  totalAtomCount: number,
  thresholds: LodThresholds = DEFAULT_LOD_THRESHOLDS,
): boolean {
  return totalAtomCount >= thresholds.atomCountForLineBonds;
}
```

`<MoleculeGroup>` 가 `selectAtomCountAcrossAll` 변화에 따라 LOD 재선택 (분자 추가/삭제는 자주 일어나지 않으므로 React 리렌더 비용 무시 가능). Phase 14 가 `LOD_THRESHOLDS` 의 실수치를 측정 후 결정.

---

## 7. 파일 / 모듈 레이아웃

```
src/viewport/
├── index.ts                              # barrel — default Viewport + named exports
├── Viewport.tsx                          # <Canvas> 진입 + WebGL2 가드 + apiRef bridge (D14)
├── capability/
│   ├── webgl2.ts                         # detectWebGL2()
│   └── webgl2.test.ts
├── scene/
│   ├── Scene.tsx                         # 조명/카메라/Controls/Molecules 컨테이너
│   ├── Lighting.tsx                      # ambient + key + fill
│   ├── Camera.tsx                        # 등각 3/4 셋업 + frameActive/frameAll/reset
│   ├── Background.tsx                    # 테마/오버라이드 색
│   ├── ViewportApiBridge.tsx             # useThree + useImperativeHandle (apiRef)
│   └── layout.ts                         # computeMoleculeLayout / computeBBox / computeAggregateBBox
├── renderers/
│   ├── MoleculeGroup.tsx                 # 한 분자의 atoms/bonds 컨테이너 + RenderMode 분기 (§6.8)
│   ├── ball-and-stick/
│   │   ├── BallAndStickRenderer.tsx      # 본 Phase 의 단일 갈래
│   │   ├── AtomInstances.tsx             # 원소별 InstancedMesh 풀
│   │   ├── BondInstances.tsx             # 결합 cylinder 풀
│   │   ├── AromaticOverlay.tsx           # drei Line dashed (D3)
│   │   ├── AtomLabels.tsx                # drei Text 빌보드
│   │   └── HoverTooltip.tsx              # drei Html
│   └── geometry/
│       ├── sphereGeometry.ts             # LOD 별 SphereGeometry 캐시
│       ├── cylinderGeometry.ts           # LOD 별 CylinderGeometry 캐시
│       └── bondTransform.ts              # axis quaternion + mid-split (순수)
├── ids/
│   ├── viewportId.ts                     # encode/decode composite ID
│   ├── viewportId.test.ts
│   ├── lookup.ts                         # atomIdToIndex / bondIdToIndex / atomIndexToId (D1a)
│   ├── lookup.test.ts
│   ├── picking.ts                        # getAtomIdFromIntersection (D9a)
│   └── picking.test.ts
├── subscriptions/
│   ├── usePositionSubscription.ts        # subscribeWithSelector → setMatrixAt
│   ├── selectionGuard.ts                 # useSelectionStaleGuard (§6.5.2)
│   └── selectors.ts                      # selectAtomCountAcrossAll / selectMoleculesArray
├── _shared/
│   ├── colors.ts                         # CPK / 결합 색 (Phase 02 element 위)
│   ├── radii.ts                          # covalentRadius → Å 환산
│   ├── constants.ts                      # BOND_RADIUS_ANGSTROM / GROUP_PADDING_ANGSTROM / MIN_CAMERA_DISTANCE 등
│   ├── lod.ts                            # pickLodLevel / sphereGeometryFor / shouldUseLineBonds
│   ├── useFadeOnMount.ts                 # D11 hook
│   ├── poolRegistry.ts                   # atomPoolRegistry / bondPoolRegistry — 모듈-레벨 Map
│   └── types.ts                          # ViewportAtomId / MoleculeLayoutTransform / ViewportApi …

tests/unit/viewport/
├── layout.test.ts                        # computeMoleculeLayout 결정성/안정성
├── viewportId.test.ts                    # encode/decode 라운드트립
├── lookup.test.ts                        # atomIdToIndex / atomIndexToId
├── picking.test.ts                       # getAtomIdFromIntersection 분기
├── webgl2.test.ts                        # WebGL2 detector
├── colors.test.ts                        # CPK 매핑 + 결합 split
├── bondTransform.test.ts                 # cylinder 축/길이/회전
├── lod.test.ts                           # 임계값 분기
├── poolRegistry.test.ts                  # alloc/free/grow + tail-swap
├── scene.test.tsx                        # @react-three/test-renderer scene 그래프
└── selection-guard.test.ts               # stale AtomId 자동 정리
```

### 7.1 레이어 가드 (ESLint)

```jsonc
// .eslintrc 의 가드 추가분 (Phase 01 §6 가드와 동일 패턴)
{
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "patterns": [
          {
            "group": ["@/engine/*", "@/services/*", "@/data/*"],
            "message": "viewport 는 stores 와 chemistry 만 import 할 수 있습니다 (architecture §4.1).",
          },
          {
            "group": ["@/panels/*", "@/app/*"],
            "message": "viewport 는 UI 상위 레이어를 import 할 수 없습니다.",
          },
          {
            "group": ["@/viewport/_shared/poolRegistry"],
            "message": "poolRegistry 는 viewport 내부 전용입니다 (외부에서 직접 변경 금지).",
          },
        ],
      },
    ],
  },
}
```

### 7.2 공개 경계 (`src/viewport/index.ts`)

```ts
// default
export { default } from './Viewport';

// named (다른 레이어가 사용)
export { computeMoleculeLayout, computeBBox } from './scene/layout';
export { detectWebGL2 } from './capability/webgl2';
export {
  viewportIdForAtom,
  viewportIdForBond,
  parseViewportId,
  parseSelectedAtoms,
} from './ids/viewportId';
export { atomIdToIndex, bondIdToIndex, atomIndexToId } from './ids/lookup';
export { getAtomIdFromIntersection, type PickedTarget } from './ids/picking';
export { useAtomMatrixSubscription } from './subscriptions/usePositionSubscription';
export { DEFAULT_LOD_THRESHOLDS, type LodThresholds } from './_shared/types';
export type { ViewportApi, ViewportProps, CaptureBlobOptions } from './_shared/types';
```

`poolRegistry`, `useSelectionStaleGuard`, 로컬 `HoverState` 등은 _내부 전용_ — barrel 미노출.

---

## 8. 테스트 계획

원칙: `architecture.md` §10 “모든 함수를 테스트하지 않는다. 핵심 로직과 핵심 동작만.” 본 Phase 의 핵심 동작은 (a) 안정 ID 라운드트립, (b) layout 결정성, (c) bond 변환 수치 정확성, (d) InstancedMesh 풀 운영 (alloc/free/grow + tail-swap), (e) picking 사이드카, (f) selection stale 정리, (g) WebGL2 가드, (h) scene 그래프 합성.

### 8.1 layout (`tests/unit/viewport/layout.test.ts`)

- 빈 배열 → 빈 Map.
- 단일 분자 → translation `[0, 0, 0]`.
- 2 분자 → 가로 1열, 셀 너비 = `max(BBox.diagonal) + GROUP_PADDING`.
- 4 분자 → 2×2 grid.
- BBox center 가 0 이 아닌 분자 → 셀 중심에 정렬되도록 translation 보정.
- 동일 입력 두 번 호출 → 동일 결과 (결정성).
- 입력 순서 보존 (moleculeStore.ids 순서).

### 8.2 viewportId (`tests/unit/viewport/viewportId.test.ts`)

- `viewportIdForAtom(molId, atomId) → "${molId}::a:${atomId}"`.
- `viewportIdForBond(molId, bondId) → "${molId}::b:${bondId}"`.
- `parseViewportId("uuid::a:atomUuid")` → `{ kind: 'atom', molId, atomId }`. prefix `a:` / `b:` 분기로 kind 결정 (§4.1 그대로).
- 잘못된 형식 (`::` 부재, prefix 부재, prefix 가 `a` / `b` 외 값) → null.
- `parseSelectedAtoms` 라운드트립 (uiStore 의 `selection.atomIds: string[]` 디코드).

### 8.3 colors (`tests/unit/viewport/colors.test.ts`)

- `cpkColorOf(elementNumber)` → `Element.cpkColorHex` 그대로.
- 결합 mid-split 색: 카본(C, #909090) - 산소(O, #FF0D0D) 결합 → cyl 1 색 `#909090`, cyl 2 색 `#FF0D0D`.
- 동일 원소 (C-C) → 1 cyl 모드 활성, 색 `#909090`.

### 8.4 bondTransform (`tests/unit/viewport/bondTransform.test.ts`)

대표 케이스 수치 검증:

| 분자               | 결합                              | 기댓값                                                              |
| ------------------ | --------------------------------- | ------------------------------------------------------------------- |
| H2O (OH 결합)      | O(0,0,0) - H(0.96, 0, 0)          | length=0.96, mid=(0.48, 0, 0), axis 회전 = +Y → +X (90° z)          |
| CH4 의 C-H         | C(0,0,0) - H(0.629, 0.629, 0.629) | length=√(3·0.629²) ≈ 1.089, axis 정규화 = (1,1,1)/√3                |
| ethene (C=C)       | C(0,0,0) - C(1.34, 0, 0)          | order=2 → cyl 4개 (mid-split × 2 평행). 평행 변위 d 가 axis 와 수직 |
| benzene (aromatic) | C-C aromatic                      | order='aromatic' → cyl 2개 (mid-split) + Line dashed                |

`bondTransform` 은 `THREE.Matrix4` 를 반환. 테스트는 행렬 원소를 epsilon 비교 (`≤ 1e-6`).

### 8.5 scene (`tests/unit/viewport/scene.test.tsx`)

- `@react-three/test-renderer` 로 `<Viewport />` 렌더 (jsdom + WebGL2 mock — `detectWebGL2` 가 `{ ok: true }` 반환하도록 vitest mock).
- moleculeStore 에 ethanol 1분자 prefill → scene 그래프에 `instancedMesh` 노드 (atoms + bonds) 존재.
- atom 2개 추가 → 풀 `mesh.count` 가 2 증가.
- atom 1개 삭제 → `mesh.count` 1 감소 + tail-swap 으로 유지 atom 의 매트릭스 보존.
- bond 차수 변경 (`setBondOrder(id, idx, 2)`) → 결합 풀 슬롯 재할당, instanceMatrix 갱신.
- 라벨 토글 (`uiStore.toggleAtomLabels(true)`) → `<Text>` 노드 N개 등장.

### 8.6 picking (`tests/unit/viewport/picking.test.ts`)

- mock `THREE.Intersection` (`object.userData = { kind: 'atomPool', element: 6, molId }`, `instanceId = 0`) → `getAtomIdFromIntersection` 가 atomId 반환.
- userData.kind 가 다른 값 → null.
- `instanceId = undefined` → null.
- 풀에 atomId 없는 슬롯 (free 후) → null.

### 8.7 poolRegistry (`tests/unit/viewport/poolRegistry.test.ts`)

- alloc 100회 → capacity 64 → 128 grow 1회. used = 100.
- free 50개 (random 인덱스) → tail-swap 후 used = 50, 모든 슬롯 [0, 50) 이 유효 (hole 없음).
- 동일 atomId 두 번 alloc → 두 번째는 기존 슬롯 반환 (`atomIdToSlot.get` 분기, §6.2.2 의 멱등성 보장).
- tail-swap 후 picking 정확성 — free 직후 `getAtomIdFromIntersection` 이 모든 잔존 atom 에 대해 올바른 atomId 반환.
- 분자 unmount → `atomPoolRegistry.deleteAll(molId)` 호출 후 풀 부재. HMR 시 stale 잔존 0.

### 8.8 selection guard (`tests/unit/viewport/selection-guard.test.ts`)

- `<Viewport />` 마운트 + moleculeStore 에 mol 1, atom selected.
- `moleculeStore.removeAtom(molId, idx)` 호출 → atom 사라짐.
- `useSelectionStaleGuard` 가 **다음 마이크로태스크** 안에 `uiStore.setSelection({ atomIds: [], bondIds: ... })` 호출.
- 검증: `useUiStore.getState().selection.atomIds` 가 stale id 미포함.

### 8.9 WebGL2 detector (`tests/unit/viewport/webgl2.test.ts`)

- jsdom 의 기본은 WebGL2 미지원 → `{ ok: false, reason: 'no-webgl2' }`.
- `globalThis.WebAssembly` 삭제 mock → `{ ok: false, reason: 'no-wasm' }`.
- (mock canvas.getContext 가 fake gl2 context 반환) → `{ ok: true, maxTextureSize: ... }`.

### 8.10 통합 시나리오 (`tests/unit/viewport/integration.test.tsx`)

- “moleculeStore 에 분자 추가 → Viewport scene 그래프 갱신 → 좌표 이동 → setMatrixAt 호출 → React 리렌더 0회” 시퀀스.
- `vi.spyOn(React, 'createElement')` 로 리렌더 카운트 측정 (좌표 이동 시 0).

### 8.11 LOD 분기 (`tests/unit/viewport/lod.test.ts`)

`pickLodLevel` 의 임계값 분기 검증 (수치 자체는 Phase 14 가 튜닝하나 _분기 동작_ 은 본 Phase 가 보장):

- `pickLodLevel(299, DEFAULT_LOD_THRESHOLDS) === 'high'` (segments 24/16 사용)
- `pickLodLevel(300, DEFAULT_LOD_THRESHOLDS) === 'low'` (segments 12/8)
- `pickLodLevel(301)` → `'low'`
- `pickLodLevel(0)` → `'high'` (빈 분자도 안전)
- 결합 line 치환 임계 (`atomCountForLineBonds = 1500`) 도 동일 시나리오 — `1499 → cylinder`, `1500 → line bonds` (해당 분기는 `<BondInstances>` 내부 hook 이 결정, 별도 unit test).

이 테스트는 Phase 14 가 임계값을 변경하면 `DEFAULT_LOD_THRESHOLDS` 상수 갱신만으로 통과 — 본 Phase 의 분기 로직이 임계값에 의존하지 않음을 보장.

---

## 9. 리스크 및 대안

| ID  | 리스크                                                                                                                             | 대응                                                                                                                                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `@react-three/test-renderer` 가 drei 의 일부 컴포넌트 (Html, Text) 를 jsdom 에서 정확히 재현하지 못해 §8.5 테스트가 false-negative | 본 Phase 는 컴포넌트 _존재 + 핵심 props_ 까지만 검증. 시각 정확성은 Phase 15 Playwright                                                                                                                                                                         |
| R2  | InstancedMesh `grow` 가 instanceMatrix 의 _모든 슬롯_ 을 새 mesh 에 복사할 때 누락 → atom 잘못 표시                                | §6.2.3 ②의 복사 루프를 단위 테스트로 검증 (`tests/unit/viewport/poolRegistry.test.ts`). grow 직후 모든 atom 의 picking 정확성도 검증                                                                                                                            |
| R3  | immer draft 갱신과 instanceMatrix 직접 갱신의 _순서_ 가 어긋나 한 프레임 동안 stale 표시                                           | `useAtomMatrixSubscription` 이 `subscribeWithSelector` listener 안에서 _동기적으로_ `setMatrixAt + needsUpdate` 호출. R3F 의 다음 `useFrame` 직전에 commit 되어 1프레임 stale 가능성은 있음 — Phase 15 시각 회귀로 감지. 근본적으로는 OK (다음 frame 에서 정상) |
| R4  | drei version drift — `OrbitControls`, `Html`, `Text` 의 props 가 minor 업데이트에 변경                                             | `package.json` 의 drei 버전 핀 (Phase 01 ~ Phase 14 동안 minor lock). 업데이트는 별도 PR + 시각 회귀 검증                                                                                                                                                       |
| R5  | OrbitControls vs Phase 09 드래그 충돌 — 양쪽이 mouse-down 을 받아 의도치 않은 카메라 회전                                          | 본 Phase 가 `controlsEnabled` prop 노출 + Phase 09 의 드래그 시작 시 false 토글. R3F event 의 `e.stopPropagation()` 로 instance 이벤트가 controls 까지 못 감                                                                                                    |
| R6  | dpr 변동 (사용자가 외부 모니터 ↔ 내부 디스플레이 이동) → 라벨/툴팁 가독성 변동                                                     | `dpr: [1, 2]` 클램프 + `<Text>` 폰트 크기를 Å 단위 (좌표계 기준) 로 두어 dpr 무관. drei `<Html>` 은 픽셀 단위인데 OS 전반의 zoom 에 자연 적응                                                                                                                   |
| R7  | hover slice 위치 결정 (local vs uiStore) 변경 시 Phase 09 가 본 Phase API 를 수정 요청                                             | §11 에 등재 + `HoverState` 를 _내부 타입_ 으로 두어 외부 노출 0. Phase 09 가 uiStore 확장 시 본 Phase 의 `<HoverTooltip>` 만 props 1개 추가                                                                                                                     |
| R8  | aromatic dashed (D3) 의 시각이 “결합이 끊긴 것처럼” 보일 위험                                                                      | drei `Line` 의 `dashSize: 0.05`, `gapSize: 0.03` 로 짧은 패턴. Phase 11 의 분자 정보 패널이 “aromatic” 배지로 보강                                                                                                                                              |
| R9  | `captureBlob` 시 1프레임 강제 렌더가 OrbitControls 의 회전 진행 중에 호출되면 시점이 살짝 어긋남                                   | Phase 13 의 export 액션이 `controls.update()` 직후 호출 + `captureBlob` 내부도 `gl.render` 1회 강제. 사용자 회전 중 export 는 Phase 11 UI 가 디스에이블                                                                                                         |
| R10 | `parseViewportId` 가 `MoleculeId` (UUID) 안의 `:` / `::` 같은 문자에 fragile                                                       | `crypto.randomUUID()` 결과는 `[0-9a-f-]` 만 사용 — 충돌 안전. AtomId 도 동일. 다만 미래 변경 (예: human-readable ID) 에 대비해 §8.2 에서 prefix 분기 (`a:` / `b:`) 검증                                                                                         |
| R11 | 모듈-레벨 `atomPoolRegistry` 가 HMR 시 stale 잔존 → atom 중복 표시                                                                 | `MoleculeGroup` unmount 시 `deleteAll(molId)` 명시 호출 (§6.11.2). HMR 환경 (Vite) 에서 `<Canvas>` 는 unmount 가 cascade — 안전                                                                                                                                 |
| R12 | `selectAtomCountAcrossAll` 이 LOD 변경 외에도 다른 selector 와 동시 갱신 → 풀 재생성                                               | LOD 는 현재 임계 미만에서는 high 고정. 임계 근처 진동 (oscillation) 을 막기 위한 hysteresis (들어가는 임계 ≠ 나오는 임계) 는 Phase 14                                                                                                                           |

---

## 10. 완료 기준 (Definition of Done)

본 Phase 는 다음 모든 항목이 만족될 때 완료로 간주한다.

- [ ] `<Viewport />` 가 `@/viewport` default export 로 lazy chunk 분리되어 import (Phase 14 번들 분석 회귀 테스트 자리는 §12 Phase 14 인계).
- [ ] Phase 07 의 selector 만 사용해 ethanol / water / benzene 이 화면에 ball-and-stick 으로 표시됨 (수동 dev 서버 검증 + §8.5 컴포넌트 테스트).
- [ ] 분자 다수 (≥ 2) 가 `computeMoleculeLayout` 결과대로 겹치지 않게 자동 배치됨 (§8.1 결정성 + 시각 검증).
- [ ] `architecture.md` §3.10 디폴트 충족: 라벨 off (toggle 가능), 호버 툴팁 표시, 결합 다중 cylinder, 등각 3/4 카메라, 테마 연동 배경 (uiStore 오버라이드 가능).
- [ ] 좌표 변경 (`moveAtom`) 시 React 리렌더 0회 (§8.10 통합 테스트 — `vi.spy` 로 `React.createElement` 카운트).
- [ ] WebGL2 미지원 환경 (jsdom 디폴트) 에서 `<Viewport />` 가 throw 없이 `fallback ?? null` 반환 (§8.9).
- [ ] `getAtomIdFromIntersection` 이 atom 추가/삭제 후에도 정확한 atomId 반환 (tail-swap 검증 §8.7).
- [ ] `useSelectionStaleGuard` 가 atom/bond 삭제 후 selection 자동 정리 (§8.8).
- [ ] `viewportApi.captureBlob({ format: 'png' })` 가 PNG Blob 반환 (Phase 13 가 본 진입점만 호출).
- [ ] `viewportApi.frameActive()` / `frameAll()` / `resetCamera()` 가 OrbitControls target/position 갱신.
- [ ] D1 — `Atom.id`/`Bond.id` (Phase 01 정의, CD1) 와 Phase 03 `toDomain.ts` 의 `createAtomId`/`createBondId` 채움이 존재하고 본 Phase 가 이를 소비, 기존 단위 테스트 그린 (본 Phase 는 retrofit 하지 않음).
- [ ] ESLint 레이어 가드 (§7.1) 가 `engine`/`services`/`data` 직접 import 를 차단.
- [ ] 신규 라이브러리 추가 0개 (devDep `@react-three/test-renderer` 1개만, §3.2).
- [ ] Phase 09 가 본 Phase 의 표면 (`getAtomIdFromIntersection`, `useAtomMatrixSubscription`, `controlsEnabled` 토글, `atomIdToIndex`) 만으로 인터랙션 본 구현을 시작 가능 (계약 동결 — §12 표).

---

## 11. 열린 질문 (User Decision Required)

Plan 단계에서 D1..D14 + P1..P8 가 모두 확정되어 본 §11 은 **Phase 08 본 구현 이후로 미뤄진 항목** 만 보존한다.

1. **LOD 임계 수치** — `LOD_THRESHOLDS.atomCountForLowSegments` (디폴트 300) 와 `atomCountForLineBonds` (디폴트 1500) 의 실 측정값 결정. Phase 14 가 drawcall/FPS 측정 후 결정.
2. **Aromatic dashed 표현 정밀도** — 결합 단위 dashed 를 ring-aware (전체 ring 이 단일 dashed circle) 로 교체할지. Phase 14 또는 Phase 11 분자 정보 패널 도입 시 ring 검출 결과를 받아 결정.
3. **호버 슬라이스 위치** — 본 Phase = local. Phase 09 가 multi-hit / 키보드 hover 도입 시 uiStore.viewport.hover 슬라이스로 승격할지. Phase 09 §“선택 모델” 에서 결정.
4. **분자 정렬 키** — `computeMoleculeLayout` 의 입력 순서가 현재는 `moleculeStore.ids` 그대로. priority/atomCount/addedAt 정렬 토글은 Phase 11 CompoundBrowser 가 도입할지. Phase 11 §“분자 패널” 에서 결정.
5. **CPK 색 보조 패턴 (CVD)** — `architecture.md` §3.5 의 “라벨/패턴 병행”. 라벨 강제 on 외에 _원자 표면 패턴_ (격자/줄무늬 등) 도입 여부. Phase 15 가 결정.
6. **`captureBlob` 의 `transparentBackground`** — Phase 13 의 사용자 옵션 후보. 본 Phase 는 토글만 노출, 실제 UI 노출 여부는 Phase 13.
7. **wireframe / space-filling 렌더 모드 도입 시점** — 본 Phase 의 분기 지점은 동결. 실 추가는 Phase 14+ 또는 사용자 요청 시.
8. **D9a 의 `bondPoolRegistry` 의 풀 분할 전략** — 현재는 분자당 단일 풀. atom 색이 풀 단위로 균질이 아니라 instanceColor 로 분기되므로 분자 통합 단일 풀 (전체 분자 통합) 도 가능. drawcall 추가 감소 vs picking 분기 복잡도 trade-off — Phase 14 측정 후 결정.

---

## 12. 다음 Phase 로의 인계 (Hand-off)

| Phase                        | 본 Phase 가 인계하는 것                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **09 (Interactions)**        | (a) `getAtomIdFromIntersection(intersection)` — D9a 의 사이드카 기반 raycast 후크. (b) `useAtomMatrixSubscription(molId)` 의 `suspend()` / `resume()` — suspend/resume 계약. **(v0.2 정합)** Phase 09 드래그는 `setMatrixAt` 을 _직접_ 호출하지 않고 매 mousemove `moveAtom` 디스패치 → 본 구독이 그 변화를 받아 setMatrixAt(React 리렌더 0회). 따라서 실 경로는 구독을 suspend 하지 않으며(suspend 시 시각 갱신 정지), suspend/resume 은 컨트롤러 API 표면·테스트 계약으로만 보존. 라이브 per-molecule 핸들 라우팅은 Phase 15. (c) `<OrbitControls enabled={…}>` 토글 인터페이스 — Phase 09 가 `useThree(s => s.controls)` 로 접근 후 enabled 변경. (d) `atomIdToIndex(molecule, atomId)` / `bondIdToIndex` 번역 헬퍼 — Phase 07 액션 호출 직전 사용. (e) `useSelectionStaleGuard` — Phase 09 의 인터랙션 액션 내부에 통합 가능 (`setSelection` 발화 자리 합류). (f) `useFadeOnMount` — 분자 mount/unmount 트랜지션 본 구현 자리. (g) Undoable swap — Phase 07 의 swappable `dispatcher` 싱글톤 내부 구현을 `createUndoStack()` (stores `_shared/undo/`, v0.2 정합) 으로 `setUndoDispatcher()` 주입; 본 Phase 의 `ViewportApiBridge` 의 `canUndo`/`canRedo` 는 `dispatcher` 위임, 액션 본문 불변. |
| **10 (UI Framework)**        | (a) `<Viewport apiRef={ref} fallback={…} className={…} />` 의 lazy chunk + suspense fallback 자리 — Phase 10 의 앱 레이아웃이 `React.lazy(() => import('@/viewport'))` 로 마운트. (b) `detectWebGL2()` — Phase 10 의 부트스트랩 단계가 호출 후 ok=false 면 안내 페이지로 라우팅 (architecture §12 R5). (c) `apiRef` 의 형태 (`ViewportApi`) 동결 — Phase 10 의 Toolbar 슬롯이 ref 를 보관.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **11 (UI Panels)**           | (a) `parseViewportId` / `viewportIdForAtom` — MoleculeInfo 패널이 selection 의 atomId 를 디코드. (b) `viewportApi.frameActive()` / `frameAll()` / `resetCamera()` — Toolbar 의 “Frame Active” / “Frame All” / “Reset View” 버튼 핸들러. (c) 분자 정렬 키 결정 (§11 #4) — CompoundBrowser 의 분자 추가 순서가 `computeMoleculeLayout` 입력. (d) Aromatic ring 정보 (§11 #2) — 분자 정보 패널이 RDKit 의 ring 검출 결과를 받으면 `<AromaticOverlay>` 의 prop 으로 전달 가능.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **12 (Text Input)**          | 직접 의존 없음. SMILES 입력 → moleculeStore.addFromSmiles → 분자 추가 → 본 Phase 의 React 리렌더 cascade 로 자동 표시. 텍스트 입력 패널은 Phase 11/12 가 본 Phase 의 표면을 _읽지 않는다_ (스토어 경유).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **13 (Export / Import)**     | (a) `viewportApi.captureBlob({ format: 'png', dpr?, transparentBackground? })` — PNG export 의 정식 진입점. (b) `viewportApi.getRenderer()` — 진단/고급 옵션 자리 (Phase 13 미사용 시 unused). (c) JSON export 는 Phase 07 의 `selectMoleculeSnapshot` 사용 — 본 Phase 무관. (d) SDF export 는 Phase 03 의 `toSdfBlock(molecule)` — 본 Phase 무관.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **14 (Performance)**         | (a) `LOD_THRESHOLDS` 임계 수치 결정 (§11 #1). (b) drawcall 분포 측정 — `<Stats />` (drei dev only) 또는 `Spector.js` 통합 자리. (c) atom 풀 통합 (§11 #8) 검토 — instanceColor 단일 풀로 통합 시 drawcall 감소 가능. (d) `dpr` 정책 튜닝 — `[1, 2]` 가 너무 빡빡하면 `[1, 1.5]`. (e) Web Worker 분리 — RDKit 호출이 메인 스레드에 머무는 한 본 Phase 의 useFrame 은 영향 없음. RDKit Worker 화 시 본 Phase 무영향. (f) P7 의 1-cylinder fallback 활성화 — 결합 풀의 색을 vertexColors → instanceColor 단일 cylinder.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **15 (Testing & Polish)**    | (a) Playwright + 픽셀 회귀 — 시각 정확성 검증 (R1). (b) CVD 모드 라벨 강제 on 검증. (c) WebGL2 미지원 안내 페이지의 i18n 문구 (`viewport.fallback.*`). (d) 키보드 접근 (architecture §3.5) — Phase 09 가 인수했지만 Phase 15 가 회귀 검증. (e) 색약 패턴 보조 (§11 #5) 도입 결정.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **04 (소급 수정)**           | **변경 없음** (D1b). compound JSON 청크 스키마 무영향. 단 ID 가 저장되지 않는다는 결정을 Phase 04 §"청크 파일 스키마" 의 코멘트로 명시 (선택적 보강).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **01 / 03 (소급 수정 없음)** | `Atom.id`/`Bond.id` (Phase 01 `@/chemistry/compounds/ids`+`types.ts`, CD1) 와 Phase 03 `toDomain.ts` 의 `createAtomId`/`createBondId` 채움은 **선행 Phase 가 이미 완료** — 본 Phase 는 retrofit 커밋 없이 소비만 한다. (CD1 로 식별 모델이 Phase 01 로 상향되어 종전의 "Phase 08 첫 커밋 retrofit" 패턴은 폐기.)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

---

_문서 버전: 0.1 (초안)_
_작성일: 2026-04-26_
