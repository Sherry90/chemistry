# Phase 14 — Performance Optimization

> 본 문서는 `architecture.md` §13 의 Phase 14 상세 설계서다. 코드 작성은 모든 details 문서의 검토가 끝난 뒤에만 시작한다.
>
> **선행 문서**: `architecture.md` (특히 §1.3 ⑥ 결합 변화 애니메이션, §3.1 렌더 모드, §3.2 성능 예산, §3.9 배포, §9.1–9.3 성능, §12 #4 RDKit 메인 스레드, §13 의존 Phase), `details/phase-03-chemistry-engine.md`, `details/phase-07-state-management.md`, `details/phase-08-rendering.md`, `details/phase-09-interactions.md`, `details/phase-10-ui-framework.md`, `details/phase-11-ui-panels.md`, `details/phase-12-text-input.md`, `details/phase-13-export-import.md`.

---

## 1. 목적 (Purpose)

본 Phase 는 다음을 완성한다.

1. **번들 분석 및 코드 스플리팅 검증** — `rollup-plugin-visualizer` (devDep) 도입. `vite.config.ts` `manualChunks` 튜닝으로 청크 경계를 명시적으로 관리. `size-check.mjs` 스크립트로 **초기 번들 < 500 KB gzip** + 뷰포트 lazy 분리를 CI 에서 자동 검증. `architecture.md` §3.2 / §9.1 의 "코드 스플리팅 필수" 약속의 _경로 닫음_.

2. **LOD (Level of Detail) 구현** — `architecture.md` §9.2 의 "LOD: Phase 14 제공" + Phase 08 §2.3 / P7 가 _보수적 디폴트_ `{ atomCountForLowSegments: 300, atomCountForLineBonds: 1500 }` 로 넘긴 `LodThresholds` 구체 수치를 §6.2 벤치마크 후 확정. Phase 08 의 2단계 `LodLevel('high'|'low')` 를 **3단계** `'high'|'medium'|'line'` 로 확장. `atomCountForLowSegments` 초과 시 sphere/cylinder segments 다운그레이드, `atomCountForLineBonds` 초과 시 결합을 `THREE.LineSegments` 로 치환.

3. **RDKit 메인 스레드 차단 측정 및 Web Worker 분리 결정** — `architecture.md` §12 #4 + Phase 03 D6 의 "실제 Worker 이동 결정은 Phase 14 의 성능 측정 결과에 따른다" 약속 이행. `performance.mark()` 기반 blocking 측정 → blocking > 100 ms 면 Worker 분리 구현, 이하면 메인 스레드 유지 결론 문서화.

4. **확장 렌더 모드 구현** — `architecture.md` §3.1 의 "도입 시점 Phase 14+ 결정" 을 본 Phase 에서 결정하고 구현. **Space-filling**(vdW 반지름 구체), **Wireframe**(결합을 선으로), **Stick**(원자 구체 없이 실린더만) 세 모드를 v1 에 포함. **Surface** 는 post-v1 비목표로 최종 확정. Phase 11 Toolbar 의 "준비 중" 비활성 버튼을 활성화하는 settingsStore / viewport retrofit.

5. **Aromatic bond 시각 표현 확정** — Phase 08 §2.3 의 "drei `Line` 디폴트로 두되 Phase 14 확정" 약속 이행. `renderAromaticOverlay` 구현 **변경 없음** 으로 최종 확정. 향후 교체가 필요한 경우의 수정 경로를 명시.

6. **배포 설정** — `architecture.md` §3.9 의 "Phase 14/15 에서 결정" 약속 이행. **GitHub Pages** 확정 + `vite.config.ts` `base` 경로 설정 + GitHub Actions CI/CD workflow 신규 작성.

7. **Phase 13 §2.2 인계 항목 닫음 또는 post-v1 최종 확정** — SDF Import, drag-and-drop, zod, Cmd+S / Cmd+O, PNG annotation, reactionStore 직렬화의 v1 포함/비목표 여부를 본 Phase 에서 확정.

8. **bond-level interpolation 애니메이션 post-v1 공식 확정** — `architecture.md` §1.3 ⑥ 의 Phase 14+ 결정 항목. v1 범위 외임을 본 Phase 에서 공식 닫음.

본 Phase 는 `architecture.md` §12 의 열린 질문 중 **#4 (RDKit 메인 스레드 차단)** 를 닫는다 (측정 결과 문서화 + 조건부 Worker 구현). **#1 / #2 / #3 / #5 / #6** 은 본 Phase 영역 외.

---

## 2. 범위 (Scope)

### 2.1 포함

#### 번들 분석 및 최적화

- **`rollup-plugin-visualizer` 도입** (devDependency). `vite.config.ts` `plugins` 에 `visualizer({ gzipSize: true, brotliSize: true, filename: 'dist/stats.html', template: 'treemap' })` 추가. 빌드 시 `dist/stats.html` 생성.
- **`vite.config.ts` `build.rollupOptions.output.manualChunks`** 명시적 설정:
  - `vendor-react`: `react`, `react-dom`, `react-i18next`, `i18next`, 관련 peer
  - `vendor-three`: `three`, `@react-three/fiber`, `@react-three/drei`
  - `vendor-radix`: `@radix-ui/*` 전체
  - `vendor-state`: `zustand`, `immer`
  - 각 `panels/*` lazy chunk 는 Vite 자동 분할 유지
- **`size-check.mjs` 스크립트** (`scripts/size-check.mjs` 신규). Node.js 로 `dist/assets/` 를 순회, gzip 측정, 임계값 초과 시 `process.exit(1)`. `package.json` 에 `"size-check": "node scripts/size-check.mjs"` 추가. CI 파이프라인에 통합.
- **초기 bundle 목표**: `vendor-react` + `vendor-radix` + `vendor-state` + app index + element data 합산 < **500 KB gzip**. `vendor-three` 는 lazy (viewport chunk 와 함께) — 초기 합산 제외.

#### LOD (Level of Detail) 구현

- **`LodLevel` 3단계 확장** — Phase 08 의 `'high' | 'low'` → `'high' | 'medium' | 'line'`.
- **`LOD_THRESHOLDS` 확정** — Phase 08 의 `DEFAULT_LOD_THRESHOLDS({ 300, 1500 })` 를 §6.2 벤치마크 후 `LOD_THRESHOLDS` 로 대체. 잠정값: `{ atomCountForLowSegments: 100, atomCountForLineBonds: 500 }`.
- **`useLodLevel` 훅** (`src/viewport/renderers/lod/useLodLevel.ts`) — 뷰포트 전체 원자 수 합산 → `LodLevel` 반환.
- **`LodContext`** (`src/viewport/renderers/lod/LodContext.tsx`) — `<LodProvider>` 가 `<Scene/>` 상위에 마운트, 하위 렌더러에 동일 `LodLevel` 전달.
- **AtomInstances LOD geometry 분기** — `LodLevel` 별 sphere segments 표:

  | LodLevel | Sphere radialSeg | Sphere heightSeg | Cylinder radialSeg |
  | -------- | ---------------- | ---------------- | ------------------ |
  | `high`   | 16               | 8                | 8                  |
  | `medium` | 8                | 4                | 4                  |
  | `line`   | 6                | 3                | — (line 치환)      |

  geometry 교체는 `LodLevel` 변경 시 `useEffect` 로 `geometry.dispose()` 후 신규 `SphereGeometry` 재생성 (Phase 08 P4 패턴).

- **`<LineBonds/>` 컴포넌트** (`src/viewport/renderers/LineBonds.tsx`) — `THREE.LineSegments` + `LineBasicMaterial({ vertexColors: true })`. 분자 결합 → `[v0.x, v0.y, v0.z, v1.x, v1.y, v1.z, ...]` 인터리빙 position buffer + CPK 색 color buffer. 원자 위치 갱신은 Phase 08 D8 패턴 (`subscribeWithSelector` → `geometry.attributes.position.needsUpdate = true`) 으로 React 리렌더 0회.
- **BondInstances 분기** — `lodLevel === 'line'` 또는 `renderMode === 'wireframe'` 시 기존 cylinder BondInstances 대신 `<LineBonds/>` 마운트.

#### RDKit Web Worker 분리 (조건부)

- **§6.3 의 측정 절차** 를 Phase 14 구현 착수 전 수행. blocking > 100 ms 조건 충족 시에만 하기 구현 진행.
- **`workerMessages.ts`** (`src/engine/rdkit/workerMessages.ts`) — `WorkerRequest` / `WorkerResponse` 유니온 타입.
- **`worker.ts`** (`src/engine/rdkit/worker.ts`) — Vite Worker script. RDKit WASM 초기화 + 메시지 dispatch + `READY` 신호.
- **`RdkitWorkerClient`** (`src/engine/rdkit/workerClient.ts`) — `RdkitBackend` 인터페이스 구현. pending Map + READY 이전 queue, 초기화 완료 후 flush.
- **`service.ts` retrofit** — `getOrCreateRdkitBackend()` 내부에서 `SHOULD_USE_WORKER` 플래그 기준 `RdkitWorkerClient` 또는 `RdkitDirectBackend` 선택. 시그니처 무변경 (호출부 투명 전환).

#### 확장 렌더 모드

- **`RenderMode` 유니온 확장**: `'ball-and-stick' | 'space-filling' | 'wireframe' | 'stick'`.
- **Space-filling**: `AtomInstances` 의 반지름 소스를 `vdwRadiusPm * PM_TO_ANGSTROM * SPACE_FILLING_SCALE` 로 변경. `BondInstances` 비표시 (React 조건 렌더).
- **Wireframe**: `AtomInstances` 비마운트, `<LineBonds/>` 마운트 (lodLevel 무관).
- **Stick**: `AtomInstances` 비마운트, cylinder `BondInstances` 마운트 (LOD 기준 segment 다운그레이드 적용).
- **Toolbar retrofit** (Phase 11 `Toolbar/RenderModeGroup` 수정) — `'space-filling'`, `'wireframe'`, `'stick'` 버튼 `disabled` / `aria-disabled` 제거. `'surface'` 버튼은 **영구 비활성** 유지.
- **i18n 키 채움** — `panels.toolbar.renderMode.{spaceFilling,wireframe,stick}.{label,tooltip}` 한·영 임시 문구 추가 (Phase 15 최종 폴리싱).

#### `CaptureBlobOptions.format` 확장 (Phase 13 §D3 완성)

Phase 08 의 `format: 'png'` → `'png' | 'jpeg' | 'webp'` 유니온 확장. Phase 13 `<PngExportPane/>` 의 format 탭 UI 와 정합. `captureBlob` 내부에서 `mimeType` + JPEG quality 분기 처리.

#### 배포 설정

- **`vite.config.ts` `base` 경로**: production 빌드 시 `'/{레포명}/'` (GitHub Pages 경로), development 시 `'/'`.
- **`.github/workflows/deploy.yml`** 신규 생성: `main` push 시 `pnpm install → typecheck → lint → test → build → size-check → gh-pages deploy`.
- **PR 시나리오**: `build` job 만 실행 (빌드 + 검증), `deploy` job 은 `main` push 시에만.
- **`public/` raw 파일 참조**: `import.meta.env.BASE_URL` 접두사 사용 여부 기존 코드에서 확인.

#### Phase 13 §2.2 인계 항목 최종 처리

| 항목                            | Phase 14 결정                              |
| ------------------------------- | ------------------------------------------ |
| SDF Import                      | **post-v1** 비목표 확정                    |
| PDB / MOL / XYZ Import/Export   | **post-v1** 비목표 확정                    |
| drag-and-drop file input        | **post-v1** 비목표 확정                    |
| 사용자 명시 파일명 입력         | **post-v1** 비목표 확정                    |
| reactionStore.lastResult 직렬화 | **post-v1** 비목표 확정                    |
| PNG annotation (ruler/label)    | **post-v1** 비목표 확정                    |
| zod 도입                        | **post-v1** — hand-written 검증 유지       |
| Cmd+S / Cmd+O 단축키            | **post-v1** — 브라우저 충돌, Phase 15 이후 |
| 다중 파일 zip export            | **post-v1** 비목표 확정                    |

#### bond-level crossfade 애니메이션 공식 비목표 확정

`architecture.md` §1.3 ⑥ 의 "결합 단위 보간(create/break crossfade)은 v1 비목표" — **post-v1 비목표로 최종 확정**. Phase 15 이후에도 사용자 명시 요청 없으면 구현하지 않음.

### 2.2 비포함

| 항목                                                                                                                        | 인계 / 확정                      |
| --------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Surface 렌더 모드                                                                                                           | **post-v1 비목표 최종 확정**     |
| bond-level crossfade 애니메이션                                                                                             | **post-v1 비목표 최종 확정**     |
| SDF Import / drag-and-drop / zod                                                                                            | §2.1 표 참조 — **post-v1 확정**  |
| E2E Playwright 시나리오                                                                                                     | Phase 15                         |
| 접근성 자동 검증 (axe)                                                                                                      | Phase 15                         |
| i18n 문구 최종 폴리싱                                                                                                       | Phase 15                         |
| WebGL2 fallback 페이지 완성                                                                                                 | Phase 15                         |
| CVD 모드 완성 (Phase 08 §2.2 인계)                                                                                          | Phase 15                         |
| **(v0.2)** fade 라이브 결선 (Scene retained-id + 렌더러 fadeOpacity threading; phase-09 §11 #13)                            | Phase 15 (시각 회귀 동반)        |
| **(v0.2)** 인터랙션 컨트롤러 라이브 R3F 결선 (drag/select pointer-event + raycast + per-mol subscription; phase-09 §11 #12) | Phase 15 (Playwright E2E)        |
| **(v0.2)** multi-hit raycast / 박스 선택 (phase-09 §11 #4·#10)                                                              | Phase 15 인벤토리 (post-v1 검토) |
| ΔH 값 확장                                                                                                                  | **비목표** (architecture §1.4)   |
| 클라우드 저장 / URL 공유                                                                                                    | **비목표** (architecture §3.9)   |
| 서버 런타임 / SSR                                                                                                           | **비목표**                       |

### 2.3 명시적 비결정 (Phase 14 구현 시 확정)

| 영역                                   | 사유                                              | 결정 시점                     |
| -------------------------------------- | ------------------------------------------------- | ----------------------------- |
| `LOD_THRESHOLDS` 구체 수치 (100 / 500) | §6.2 벤치마크 전까지 잠정. 실측 후 §4.1 최종 기입 | Phase 14 구현 시 §6.2 수행 후 |
| `SHOULD_USE_WORKER` 값                 | §6.3 blocking 측정 전까지 미결                    | Phase 14 구현 시 §6.3 수행 후 |
| GitHub Pages `base` 경로 구체 값       | 실제 레포명에 따라 `/chemistry/` 조정 가능        | Phase 14 구현 시              |
| LOD hysteresis 수치 (±10 원자)         | R3 리스크 대응 필요 여부는 실측 후 결정           | Phase 14 구현 시              |

---

## 3. 의존성 (Dependencies)

### 3.1 선행 Phase (직접 import / retrofit 대상)

| Phase                     | 본 Phase 가 사용하는 것                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **08 (Rendering)**        | `LodThresholds` / `DEFAULT_LOD_THRESHOLDS` (→ `LOD_THRESHOLDS` 로 교체). `LodLevel` 타입 (`'high'\|'low'` → `'high'\|'medium'\|'line'` 확장). `RenderMode` 유니온 확장 (settingsStore — phase-07). **`CaptureBlobOptions.format` widen 은 본 Phase 가 하지 않는다 — phase-13 §12.1 이 소유** (phase-13 이 jpeg/webp export 를 위해 먼저 필요로 하므로). `AtomInstances` / `BondInstances` 에 `lodLevel` + `renderMode` props 추가. Phase 08 P7 LOD branch 조건. Phase 08 §2.3 비결정 (aromatic shader + LOD 임계값) 닫음. `ViewportApi.getRenderer()` — 성능 진단용. Phase 08 P8 의 viewport chunk 단일성을 §6.1 에서 검증. |
| **03 (Chemistry Engine)** | Worker 분리 결정 시: `RdkitBackend` 인터페이스 경계 활용. `service.ts` 의 `getOrCreateRdkitBackend()` 내부 분기 retrofit. Phase 03 D6 의 "Web Worker 경계 준비, 실제 분리는 Phase 14 결정" 닫음.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **07 (Stores)**           | `settingsStore` 의 `renderMode: RenderMode` 유니온 확장 (`ball-and-stick` → 4종). `selectRenderMode` selector 시그니처 무변경. `setRenderMode(mode: RenderMode)` 액션 시그니처 무변경 (유니온 폭만 확장).                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **09 (Interactions)**     | KEY_MAP 에 `'stats-toggle'` 1 건 추가 (D10 — `Shift+F`, 개발 전용 `<Stats/>` 토글). 기존 Phase 09 키 충돌 없음 확인.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **11 (UI Panels)**        | Toolbar `RenderModeGroup` 의 `'space-filling'` / `'wireframe'` / `'stick'` 버튼 `disabled` 해제 (Phase 11 §6.9 retrofit). `'surface'` 버튼 `aria-disabled="true"` 유지. `lucide-react` 아이콘 추가 없음.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **13 (Export/Import)**    | Phase 13 §D3 의 미완 항목 닫음: `CaptureBlobOptions.format` 에 `'jpeg'                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 'webp'` 추가. Phase 13 §2.2 의 비포함 항목 최종 처리 (§2.1 표). |

본 Phase 는 `src/stores` + `src/chemistry/*` + `src/engine/rdkit/*` (Worker 분리 시) 만 import. `src/services/*` / `src/data/*` 직접 import 금지 — architecture §4.1 의존 방향 그대로.

### 3.2 외부 라이브러리

| 라이브러리                 | 버전 | 용도                            | gzip 영향    | devDep 여부 | 대안 거절                                               |
| -------------------------- | ---- | ------------------------------- | ------------ | ----------- | ------------------------------------------------------- |
| `rollup-plugin-visualizer` | ^5.x | 번들 시각화 (`dist/stats.html`) | 런타임 **0** | **devDep**  | Vite `--reporter` 텍스트만으로 청크 내부 구성 파악 불가 |

**런타임 신규 라이브러리 0개.** Web Worker 분리는 브라우저 네이티브 `Worker` 생성자 사용.

번들 예산 영향:

- `rollup-plugin-visualizer`: devDep → 번들 미포함.
- `LOD_THRESHOLDS` / `useLodLevel` / `LineBonds` 등: `viewport/` lazy chunk 내부 → 초기 bundle 영향 0.
- `RdkitWorkerClient` (Worker 분리 시): 메인 스레드 bundle 에 ~1–2 KB gzip (Worker 생성자 래퍼). Worker script 자체는 별도 lazy chunk.
- 신규 render mode 컴포넌트 (`LineBonds`, 조건 렌더 분기): `viewport/` lazy chunk 내 +3–5 KB gzip 추정.

### 3.3 결정 사항

#### 선결정 사항 (P-table)

| ID     | 내용                                                                                                                                                                                                                                       | 출처                               |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| **P1** | `viewport/` 는 `@/stores` + `@/chemistry/*` 만 import. `RdkitWorkerClient` 는 `src/engine/rdkit/workerClient.ts` 에 위치 (engine 레이어). viewport 는 `engine/rdkit/service.ts` 의 `getOrCreateRdkitBackend()` 만 호출 — 기존과 동일 경로. | architecture §4.1                  |
| **P2** | LOD 는 _분자별 LOD_ 가 아닌 **뷰포트 전체 원자 수** 기준 단일 `LodLevel`. 개별 분자의 서로 다른 품질 표현은 시각 일관성 파괴.                                                                                                              | Phase 08 §2.3                      |
| **P3** | `performance.mark()` / `performance.measure()` 는 **개발/테스트 빌드** 에서만 활성화 (`if (import.meta.env.DEV)`). 프로덕션 overhead 0.                                                                                                    | architecture §3.4 (코딩 원칙)      |
| **P4** | LOD `geometry` 교체 시 `geometry.dispose()` 후 재생성. React 리렌더 1 회 허용 (전환 빈도 낮음).                                                                                                                                            | Phase 08 P4                        |
| **P5** | `RenderMode` 유니온은 `settingsStore.ts` + `src/viewport/_shared/types.ts` 양쪽에서 동일 타입 참조. Phase 07 §3.1 타입 정의 위치 규약 유지.                                                                                                | Phase 07 §3.1                      |
| **P6** | GitHub Pages 배포는 `main` 브랜치 push 시에만. PR 에서는 build + check job 만 실행.                                                                                                                                                        | architecture §3.9                  |
| **P7** | `'surface'` 는 `RenderMode` 유니온에 **추가하지 않는다**. 향후 추가 시 타입 유니온 확장 + Phase 15 이후 구현.                                                                                                                              | architecture §3.1 (Surface 후순위) |
| **P8** | `<Stats/>` (drei) 는 **개발 빌드 전용**. production bundle 에 미포함. Vite 의 tree-shaking 으로 자동 제거 가능하나, `import.meta.env.DEV` 조건부 dynamic import 로 명시적 분리.                                                            | architecture §9.2 + D10            |

#### 본 Phase 결정 (D-table)

| ID      | 질문                             | 확정 답                                                                                                                                                                                                              | 본문 영향  |
| ------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **D1**  | LOD 레벨 수                      | **3단계** (`high \| medium \| line`). Phase 08 2단계 확장.                                                                                                                                                           | §4.1, §6.2 |
| **D2**  | LOD 전환 단위                    | **뷰포트 전체 원자 수** 합산 단일 기준. P2 정합.                                                                                                                                                                     | §5.1, §6.2 |
| **D3**  | Web Worker 적용 조건             | **blocking > 100 ms** (architecture §3.2 상호작용 응답 예산 기준). §6.3 측정 결과로 결정.                                                                                                                            | §6.3       |
| **D4**  | Space-filling 결합 표시          | **결합 숨김** (React 조건 렌더). vdW 구체만.                                                                                                                                                                         | §6.4       |
| **D5**  | Wireframe 원자 표시              | **원자 구체 숨김**. 결합을 `<LineBonds/>` 로 표시. 원자 라벨은 `uiStore.viewport.showAtomLabels` 동일 적용.                                                                                                          | §6.4       |
| **D6**  | Stick 원자 표시                  | **원자 구체 숨김**, 실린더 결합 유지. LOD segment 다운그레이드 적용.                                                                                                                                                 | §6.4       |
| **D7**  | Surface 모드                     | **post-v1 비목표 최종 확정**. `RenderMode` 유니온 미추가. Toolbar 버튼 영구 비활성.                                                                                                                                  | §2.2       |
| **D8**  | Aromatic dashed shader           | **Phase 08 drei Line 유지 확정**. 셰이더 교체 없음. 교체 필요 시 `renderAromaticOverlay` 함수 내부만 수정 가능.                                                                                                      | §6.5       |
| **D9**  | 배포 플랫폼                      | **GitHub Pages**. `vite.config.ts` `base` + `deploy.yml`.                                                                                                                                                            | §6.6       |
| **D10** | FPS Stats 단축키                 | **`Shift+F`** → drei `<Stats/>` toggle (개발 전용). Phase 09 KEY_MAP `'stats-toggle'` 추가 (minor retrofit).                                                                                                         | §7.2       |
| **D11** | `CaptureBlobOptions.format` 확장 | **`'png' \| 'jpeg' \| 'webp'`**. Phase 08 의 `'png'` 리터럴 → 유니온. JPEG: `transparentBackground` 무시, WebP: 허용.                                                                                                | §4.3, §5.2 |
| **D12** | size-check 임계값                | 초기 bundle 합산 < 500 KB gzip. `vendor-three` + viewport chunk < 400 KB gzip. 개별 panel chunk < 40 KB gzip.                                                                                                        | §6.1       |
| **D13** | LOD hysteresis                   | **±10 원자 buffer** 적용. `high→medium` 전환: `total ≥ threshold + 10`, `medium→high` 전환: `total ≤ threshold - 10`. `medium→line` / `line→medium` 동일 ±10. oscillation 방지.                                      | §6.2, R3   |
| **D14** | Worker script 위치               | **`src/engine/rdkit/worker.ts`** (Vite Worker import URL 기준). `workerClient.ts` 가 `new URL('./worker.ts', import.meta.url)` 로 참조.                                                                              | §7.1       |
| **D15** | LineBonds picking                | `lodLevel === 'line'` 또는 `renderMode === 'wireframe'` 시 **결합 picking 비활성화**. 원자 picking 은 InstancedMesh 로 유지. **viewport 내부 `useBondPickingEnabled()` 훅으로 판정 — uiStore retrofit 없음** (§6.4). | §6.4, R2   |

---

## 4. 데이터 모델 / 타입

### 4.1 LOD 타입 확장 (`src/viewport/_shared/types.ts` retrofit)

```ts
// Phase 08 의 'high' | 'low' → 3단계 확장
export type LodLevel = 'high' | 'medium' | 'line';

export interface LodThresholds {
  /**
   * high → medium 전환 경계 (뷰포트 전체 원자 수).
   * 이상이면 sphere/cylinder segments 다운그레이드.
   */
  readonly atomCountForLowSegments: number;
  /**
   * medium → line 전환 경계 (뷰포트 전체 원자 수).
   * 이상이면 결합을 THREE.LineSegments 로 치환.
   */
  readonly atomCountForLineBonds: number;
}

/**
 * Phase 08 의 DEFAULT_LOD_THRESHOLDS (보수적 { 300, 1500 }) 를
 * Phase 14 §6.2 벤치마크 결과로 대체.
 * 구현 시 아래 값을 벤치마크 결과로 최종 기입.
 */
export const LOD_THRESHOLDS: LodThresholds = {
  atomCountForLowSegments: 100, // §6.2 측정 후 최종 확정
  atomCountForLineBonds: 500, // §6.2 측정 후 최종 확정
};

/** @deprecated Phase 14 가 LOD_THRESHOLDS 로 대체. 하위 호환용 별칭만 유지. */
export const DEFAULT_LOD_THRESHOLDS: LodThresholds = LOD_THRESHOLDS;
```

**Segments 표** (LOD 레벨 별):

| LodLevel | atomCount 범위      | Sphere radialSeg | Sphere heightSeg | Cylinder radialSeg |
| -------- | ------------------- | ---------------- | ---------------- | ------------------ |
| `high`   | < low 임계          | 16               | 8                | 8                  |
| `medium` | low ≤ x < line 임계 | 8                | 4                | 4                  |
| `line`   | ≥ line 임계         | 6                | 3                | — (LineBonds)      |

> `line` 레벨에서도 원자 구체는 _소형 구체_ 로 유지 (segments 6/3). 완전 제거 시 원자 picking 불가. `'wireframe'` / `'stick'` render mode 에서는 AtomInstances 를 React 조건 렌더로 비마운트 (§6.4 참조).

### 4.2 RenderMode 확장 (`src/viewport/_shared/types.ts` + `src/stores/settingsStore.ts` retrofit)

```ts
export type RenderMode =
  | 'ball-and-stick' // ← Phase 08 (기존 한 갈래, 기본값)
  | 'space-filling' // ← Phase 14 신규: vdW 반지름 구체, 결합 숨김
  | 'wireframe' // ← Phase 14 신규: 결합을 선으로, 원자 구체 숨김
  | 'stick'; // ← Phase 14 신규: 실린더 결합, 원자 구체 숨김
// 'surface' — post-v1 비목표. 타입에 추가하지 않음 (P7).
```

`settingsStore` 의 기본값: `renderMode: 'ball-and-stick'` (변경 없음).
`setRenderMode(mode: RenderMode)` 액션 시그니처 무변경.

### 4.3 CaptureBlobOptions 확장 (`src/viewport/_shared/types.ts` retrofit)

```ts
// Phase 08 원본: format: 'png'
// Phase 14 retrofit: 유니온으로 확장
export interface CaptureBlobOptions {
  /** 출력 포맷. JPEG 은 투명 배경 미지원. */
  readonly format: 'png' | 'jpeg' | 'webp';
  /** 미지정 시 window.devicePixelRatio. */
  readonly dpr?: number;
  /** 배경 투명 여부. format='jpeg' 시 무시됨 (D11 / D-FORMATS). */
  readonly transparentBackground?: boolean;
}
```

Phase 13 `<PngExportPane/>` 의 format 탭 (`png | jpeg | webp`) 과 정합. Phase 08 의 `{ format: 'png' }` 호출부는 리터럴이 `'png' | 'jpeg' | 'webp'` 서브타입이므로 TypeScript 에러 없음.

### 4.4 Web Worker 메시지 프로토콜 (`src/engine/rdkit/workerMessages.ts` — 조건부)

Worker 분리 구현 시에만 작성 (§6.3 측정 결과 `SHOULD_USE_WORKER = true` 시):

```ts
export type WorkerRequestKind =
  | 'PARSE_SMILES'
  | 'PARSE_FORMULA'
  | 'PARSE_INCHI'
  | 'EMBED_3D'
  | 'TO_SDF_BLOCK';

export interface WorkerRequest {
  /** 요청-응답 매칭용 고유 ID. */
  readonly id: string;
  readonly kind: WorkerRequestKind;
  /** kind 별 직렬화 가능한 payload. */
  readonly payload: unknown;
}

export type WorkerResponse =
  | { readonly type: 'READY' }
  | {
      readonly type: 'RESULT';
      readonly id: string;
      readonly ok: true;
      readonly value: unknown;
    }
  | {
      readonly type: 'RESULT';
      readonly id: string;
      readonly ok: false;
      readonly error: { readonly kind: string; readonly message: string };
    };
```

### 4.5 성능 마크 유틸 (`src/utils/perf/perfMarks.ts` — 신규)

```ts
/** 개발 모드에서만 performance.mark 를 발화. 프로덕션에서 no-op. */
const IS_DEV = import.meta.env.DEV;

export function markStart(label: string): void {
  if (IS_DEV) performance.mark(`${label}:start`);
}

export function markEnd(label: string): void {
  if (!IS_DEV) return;
  performance.mark(`${label}:end`);
  performance.measure(label, `${label}:start`, `${label}:end`);
  const entries = performance.getEntriesByName(label, 'measure');
  const last = entries[entries.length - 1];
  if (last && last.duration > 50) {
    console.warn(`[perf] ${label}: ${last.duration.toFixed(1)} ms (> 50 ms 예산 초과)`);
  }
}
```

Phase 03 `parseSMILES` / `embedMolecule` 호출 전후에서 사용. §6.3 의 측정 절차에 활용.

---

## 5. 퍼블릭 API / 인터페이스

### 5.1 `useLodLevel` 훅 + `getLodLevel` 순수 함수

```ts
// src/viewport/renderers/lod/useLodLevel.ts

/**
 * 순수 함수 — 테스트 용이성을 위해 훅과 분리 export.
 * D13 의 hysteresis 를 포함한다.
 */
export function getLodLevel(
  currentLevel: LodLevel,
  totalAtomCount: number,
  thresholds: LodThresholds = LOD_THRESHOLDS,
): LodLevel {
  const { atomCountForLowSegments: lowSeg, atomCountForLineBonds: lineBond } = thresholds;

  // hysteresis buffer = 10 (D13)
  const H = 10;

  if (currentLevel === 'high') {
    if (totalAtomCount >= lowSeg + H) return 'medium';
  } else if (currentLevel === 'medium') {
    if (totalAtomCount < lowSeg - H) return 'high';
    if (totalAtomCount >= lineBond + H) return 'line';
  } else {
    // 'line'
    if (totalAtomCount < lineBond - H) return 'medium';
  }
  return currentLevel;
}

/** React hook — 뷰포트 전체 원자 수 기반 LodLevel 반환. */
export function useLodLevel(): LodLevel;
```

훅 내부:

```ts
export function useLodLevel(): LodLevel {
  const molecules = useMoleculeStore(selectAllMolecules);
  const [level, setLevel] = useState<LodLevel>('high');

  useEffect(() => {
    const total = molecules.reduce((sum, m) => sum + m.atoms.length, 0);
    setLevel((prev) => getLodLevel(prev, total));
  }, [molecules]);

  return level;
}
```

### 5.2 `LodContext` + `LodProvider`

```ts
// src/viewport/renderers/lod/LodContext.tsx
export const LodContext = React.createContext<LodLevel>('high');

export function LodProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const level = useLodLevel();
  return <LodContext.Provider value={level}>{children}</LodContext.Provider>;
}
```

`<Scene/>` 의 `<Canvas>` 내부 최상위에 `<LodProvider>` 마운트. 하위의 `AtomInstances` / `BondInstances` 는 `useContext(LodContext)` 로 동일 level 수신 (단일 계산, 두 렌더러 동기화).

### 5.3 `<LineBonds/>` 컴포넌트 인터페이스

```ts
// src/viewport/renderers/LineBonds.tsx

export interface LineBondsProps {
  /** 렌더 대상 분자 목록. */
  molecules: ReadonlyArray<Molecule>;
  /**
   * AtomId → 현재 3D 위치 Map.
   * Phase 08 D8 패턴: subscribeWithSelector 외부 구독으로 직접 갱신.
   */
  atomPositionMap: ReadonlyMap<AtomId, readonly [number, number, number]>;
}

export function LineBonds(props: LineBondsProps): JSX.Element;
```

### 5.4 `AtomInstances` / `BondInstances` props 확장

```ts
// Phase 08 원본 props 에 아래 두 필드 추가 (retrofit)

interface AtomInstancesProps {
  // ... 기존 ...
  lodLevel: LodLevel; // ← 신규 (LodContext 에서 주입)
  renderMode: RenderMode; // ← 신규 (settingsStore 에서 주입)
}

interface BondInstancesProps {
  // ... 기존 ...
  lodLevel: LodLevel; // ← 신규
  renderMode: RenderMode; // ← 신규
}
```

`<Scene/>` 이 `useContext(LodContext)` + `useSettingsStore(selectRenderMode)` 결과를 두 렌더러에 전달.

### 5.5 `ViewportApi.captureBlob` 시그니처 (Phase 08 retrofit)

```ts
// Phase 08 원본: captureBlob(opts: { format: 'png'; ... }): Promise<Blob>
// Phase 14 retrofit:
captureBlob(opts: CaptureBlobOptions): Promise<Blob>;
// CaptureBlobOptions.format = 'png' | 'jpeg' | 'webp' (§4.3)
```

Phase 13 의 `<PngExportPane/>` 호출부 (`viewportApi.captureBlob({ format, dpr, transparentBackground })`) 는 시그니처 확장으로 그대로 동작 (타입 에러 없음).

### 5.6 `getOrCreateRdkitBackend` (Phase 03 retrofit — Worker 분리 시)

```ts
// src/engine/rdkit/service.ts
// 시그니처 무변경 — Worker 분기는 내부 구현
export function getOrCreateRdkitBackend(): RdkitBackend;
```

호출부 (Phase 03 의 `parseSMILES`, `embedMolecule` 등) 는 변경 없음. 내부에서 `SHOULD_USE_WORKER` 기준으로 `RdkitWorkerClient` 또는 `RdkitDirectBackend` 를 반환.

---

## 6. 알고리즘 / 핵심 로직

### 6.1 번들 분석 및 최적화 절차

#### rollup-plugin-visualizer 설정

```ts
// vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      open: false, // CI 환경에서 브라우저 자동 열기 방지
      gzipSize: true,
      brotliSize: true,
      filename: 'dist/stats.html',
      template: 'treemap',
    }),
  ],
  base: process.env.NODE_ENV === 'production' ? '/chemistry/' : '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (
            id.includes('node_modules/react') ||
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react-i18next') ||
            id.includes('node_modules/i18next')
          ) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/three') || id.includes('node_modules/@react-three/')) {
            return 'vendor-three';
          }
          if (id.includes('node_modules/@radix-ui/')) {
            return 'vendor-radix';
          }
          if (id.includes('node_modules/zustand') || id.includes('node_modules/immer')) {
            return 'vendor-state';
          }
          // 나머지: Vite 기본 분할 (panels/* lazy chunk 자동)
        },
      },
    },
    sourcemap: process.env.NODE_ENV !== 'production',
  },
  worker: {
    format: 'es', // Vite Worker script ES module 형식 (D14)
  },
});
```

#### size-check.mjs 스크립트

```js
// scripts/size-check.mjs
import { readdirSync, readFileSync, statSync } from 'fs';
import { gzipSync } from 'zlib';
import { resolve } from 'path';

const DIST_ASSETS = resolve(process.cwd(), 'dist/assets');

const THRESHOLDS = {
  initial: 500 * 1024, // 500 KB — 초기 chunk 합계
  viewport: 400 * 1024, // 400 KB — vendor-three + viewport lazy chunk
  panel: 40 * 1024, // 40 KB — 개별 panel chunk
};

// INITIAL_CHUNK_PATTERNS: vendor-react, vendor-radix, vendor-state, index (app shell)
// LAZY_VENDOR_PATTERNS: vendor-three
// PANEL_PATTERNS: panels/*

function getGzipSize(filePath) {
  const content = readFileSync(filePath);
  return gzipSync(content).length;
}

let failed = false;
let initialTotal = 0;

for (const file of readdirSync(DIST_ASSETS)) {
  if (!file.endsWith('.js')) continue;
  const size = getGzipSize(resolve(DIST_ASSETS, file));
  const isInitial = /^(vendor-react|vendor-radix|vendor-state|index)/.test(file);
  const isPanel = /panel/.test(file);

  if (isInitial) {
    initialTotal += size;
    console.log(`[initial] ${file}: ${(size / 1024).toFixed(1)} KB gzip`);
  }
  if (isPanel && size > THRESHOLDS.panel) {
    console.error(
      `[FAIL] Panel chunk too large: ${file} = ${(size / 1024).toFixed(1)} KB > ${THRESHOLDS.panel / 1024} KB`,
    );
    failed = true;
  }
}

console.log(`\n[initial total] ${(initialTotal / 1024).toFixed(1)} KB gzip`);
if (initialTotal > THRESHOLDS.initial) {
  console.error(
    `[FAIL] Initial bundle exceeds ${THRESHOLDS.initial / 1024} KB: actual = ${(initialTotal / 1024).toFixed(1)} KB`,
  );
  failed = true;
} else {
  console.log('[PASS] Initial bundle within budget');
}

process.exit(failed ? 1 : 0);
```

#### 예상 번들 구성

```
vendor-react:   ~45 KB gzip  (react + react-dom + i18next 계열)
vendor-radix:   ~50 KB gzip  (radix-ui 전체)
vendor-state:   ~10 KB gzip  (zustand + immer)
app index:      ~30 KB gzip  (app shell + layout + i18n + element data)
─────────────────────────────────────────────────────────────
초기 합계:     ~135 KB gzip  ✓ (< 500 KB 예산 대폭 여유)

vendor-three:  ~280 KB gzip  (three.js + r3f + drei) — lazy (viewport 와 묶임)
viewport:      ~25 KB gzip   (scene + renderers + LOD) — lazy
panels/*:      각 ~5–15 KB   — lazy
rdkit-worker:  ~3 KB gzip    (WorkerClient 래퍼) — lazy (Worker 분리 시)
```

### 6.2 LOD 임계값 벤치마크 절차

**목적**: Phase 08 의 보수적 디폴트 `{ 300, 1500 }` 을 실측 기반 `{ 100, 500 }` 으로 검증/확정.

**측정 환경**: Chrome DevTools Performance + drei `<Stats>` overlay (개발 빌드, `Shift+F`).

**테스트 분자 집합**:

| ID  | 분자                                  | 원자 수 | 메모                           |
| --- | ------------------------------------- | ------- | ------------------------------ |
| M1  | 물 (`O`)                              | 3       | 최소 기준                      |
| M2  | 아스피린 (`CC(=O)Oc1ccccc1C(=O)O`)    | 21      | 일반 소분자                    |
| M3  | 카페인 (`Cn1cnc2c1c(=O)n(C)c(=O)n2C`) | 24      | 방향족 포함                    |
| M4  | 합성 체인 100 원자                    | 100     | `atomCountForLowSegments` 후보 |
| M5  | 합성 체인 200 원자                    | 200     | 중간 규모                      |
| M6  | 합성 체인 500 원자                    | 500     | `atomCountForLineBonds` 후보   |
| M7  | 합성 체인 1000 원자                   | 1000    | 대규모                         |

**측정 지표**:

1. **FPS**: drei `<Stats>` 5초 평균 (`Shift+F` 토글).
2. **Draw calls**: `viewportApi.getRenderer()?.info.render.calls` 콘솔 조회.
3. **Frame time**: Chrome DevTools > Performance > CPU Throttling 4x 에서 frame 시간.

**의사 절차**:

```
1. LOD_THRESHOLDS 를 임시로 { Infinity, Infinity } (LOD 비활성) 설정
2. M1 → M7 순서로 로드, 각 FPS 기록 (fps_base)
3. atomCountForLowSegments 후보 탐색:
   - { 50, Infinity } → 50원자 이상부터 medium. FPS 변화 측정.
   - { 100, Infinity } → 동일.
   - 60 fps 미만 발생 지점 바로 아래를 임계값으로 설정.
4. atomCountForLineBonds 후보 탐색:
   - { 확정 low, 300 } → 300원자 이상부터 line. FPS 측정.
   - { 확정 low, 500 } → 동일.
   - 55 fps 달성 지점을 임계값으로 설정.
5. D13 의 hysteresis ±10 적용 후 oscillation 여부 확인.
6. §4.1 의 LOD_THRESHOLDS 최종값 기입.
```

**FPS 달성 불가 시 추가 조치**:

- `atomCountForLineBonds` 를 500 → 300 으로 낮춤.
- `dpr` 클램프 `[1, 1.5]` 로 낮춤 (Phase 08 P6 의 `[1, 2]` 조정).
- InstancedMesh 초기 capacity 64 → 32 로 낮춤 (첫 resize 지연 최소화).

### 6.3 Web Worker 분리 결정 절차

**측정 구현**:

```ts
// src/engine/rdkit/__tests__/blocking.bench.ts (Vitest bench)
import { bench, describe } from 'vitest';
import { markStart, markEnd } from '@/utils/perf/perfMarks';
import { getOrCreateRdkitBackend } from '@/engine/rdkit/service';

const CASES = [
  ['small-10', 'CCCCCCCCCC'],
  ['medium-21', 'CC(=O)Oc1ccccc1C(=O)O'], // aspirin
  ['large-100', 'C'.repeat(100)], // 합성 SMILES
  ['large-200', 'C'.repeat(200)],
] as const;

describe('RDKit main-thread blocking', () => {
  for (const [name, smiles] of CASES) {
    bench(`parse + embed ${name}`, async () => {
      const backend = getOrCreateRdkitBackend();
      markStart(`rdkit-${name}`);
      const parsed = await backend.parseSMILES(smiles);
      if (parsed.ok) await backend.embedMolecule(parsed.value, 'ETKDG');
      markEnd(`rdkit-${name}`);
    });
  }
});
```

**결정 기준**:

- 모든 케이스 < 50 ms → `SHOULD_USE_WORKER = false`. 메인 스레드 유지 결론 기록.
- 100원자 이상 케이스 > 100 ms → `SHOULD_USE_WORKER = true`. Worker 구현 진행.
- 50–100 ms → 사용자 체감 판단 (대화상자가 열려 있는 경우만 blocking — 허용 가능성 검토).

**Worker 구현 (SHOULD_USE_WORKER = true 시)**:

```ts
// src/engine/rdkit/workerClient.ts
import type { RdkitBackend } from './types';
import type { WorkerRequest, WorkerResponse } from './workerMessages';

export class RdkitWorkerClient implements RdkitBackend {
  private readonly worker: Worker;
  private readonly pending = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: unknown) => void }
  >();
  private ready = false;
  private queue: WorkerRequest[] = [];

  constructor() {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.addEventListener('message', (ev: MessageEvent<WorkerResponse>) => {
      const msg = ev.data;
      if (msg.type === 'READY') {
        this.ready = true;
        for (const req of this.queue) this.worker.postMessage(req);
        this.queue = [];
        return;
      }
      const entry = this.pending.get(msg.id);
      if (!entry) return;
      this.pending.delete(msg.id);
      msg.ok
        ? entry.resolve(msg.value)
        : entry.reject(new Error(`${msg.error.kind}: ${msg.error.message}`));
    });
    this.worker.addEventListener('error', (ev) => {
      // Worker 충돌 — 모든 pending 을 reject
      for (const entry of this.pending.values()) {
        entry.reject(new Error(`Worker crashed: ${ev.message}`));
      }
      this.pending.clear();
    });
  }

  private send<T>(req: WorkerRequest): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.set(req.id, {
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      if (this.ready) this.worker.postMessage(req);
      else this.queue.push(req);
    });
  }

  terminate(): void {
    this.worker.terminate();
  }

  // RdkitBackend 메서드들: Phase 03 인터페이스 그대로 구현
  // parseSMILES(smiles): Promise<Result<...>>
  // embedMolecule(molblock, algo): Promise<Result<...>>
  // toSdfBlock(mol): string  // 이것만 동기 호출 → Worker 로 이동 필요 여부 별도 판단
  // ...
}
```

```ts
// src/engine/rdkit/service.ts (retrofit)

// Phase 14 §6.3 측정 후 결정. 측정 전에는 false 로 초기화.
const SHOULD_USE_WORKER: boolean = false; // ← Phase 14 구현 시 §6.3 수행 후 최종 기입

let _backend: RdkitBackend | null = null;

export function getOrCreateRdkitBackend(): RdkitBackend {
  if (!_backend) {
    _backend = SHOULD_USE_WORKER ? new RdkitWorkerClient() : new RdkitDirectBackend();
  }
  return _backend;
}
```

> `toSdfBlock(mol)` 은 Phase 13 의 SDF export 경로에서 동기 호출됨 (Phase 03 §5.3). Worker 분리 시 이 메서드만 동기/비동기 혼용 문제가 생길 수 있으므로: Worker 분리 구현 시 `toSdfBlock` 을 `Promise<string>` 반환으로 변경하거나, Worker 외부에서 동기 계산하는 별도 `RdkitDirectBackend` 인스턴스를 유지하는 방법 중 하나를 선택. Phase 14 구현 시 결정.

### 6.4 확장 렌더 모드 구현

#### Scene 레벨 조건 렌더 (`src/viewport/scene/Scene.tsx` retrofit)

```tsx
const renderMode = useSettingsStore(selectRenderMode);
const lod = useContext(LodContext); // LodProvider 가 상위에 마운트된 경우

// 원자 구체 표시 여부
const showAtoms = renderMode !== 'wireframe' && renderMode !== 'stick';
// 결합 표시 여부 (space-filling 은 결합 없음)
const showBonds = renderMode !== 'space-filling';
// 결합을 선으로 표시 (wireframe 또는 line LOD)
const useLine = renderMode === 'wireframe' || lod === 'line';

return (
  <LodProvider>
    {showAtoms && <AtomInstances molecules={molecules} lodLevel={lod} renderMode={renderMode} />}
    {showBonds &&
      (useLine ? (
        <LineBonds molecules={molecules} atomPositionMap={atomPositionMap} />
      ) : (
        <BondInstances molecules={molecules} lodLevel={lod} renderMode={renderMode} />
      ))}
    <AromaticOverlayInstances /> {/* aromatic dashed — renderMode 무관 표시 */}
  </LodProvider>
);
```

> `AromaticOverlayInstances` 는 `renderMode === 'space-filling'` 에서도 표시. 연구자 시각화에서 방향족 구조 정보가 중요하므로 모든 모드에서 유지.

#### AtomInstances LOD + Space-filling radius

```tsx
// src/viewport/renderers/AtomInstances.tsx (retrofit)

const lod = props.lodLevel;
const renderMode = props.renderMode;

// LOD 별 sphere geometry (useMemo — lod 변경 시 재생성)
const sphereArgs = useMemo((): [number, number, number] => {
  if (lod === 'high') return [1, 16, 8];
  if (lod === 'medium') return [1, 8, 4];
  return [1, 6, 3]; // 'line'
}, [lod]);

// 반지름 소스 (renderMode 별)
const getAtomRadius = useCallback(
  (el: Element): number => {
    if (renderMode === 'space-filling') {
      return el.vdwRadiusPm * PM_TO_ANGSTROM * SPACE_FILLING_SCALE;
    }
    return el.covalentRadiusPm * PM_TO_ANGSTROM * BALL_STICK_SCALE;
  },
  [renderMode],
);

// LOD geometry 교체 시 InstancedMesh 재생성 (P4)
useEffect(() => {
  for (const pool of poolRef.current.values()) {
    const newGeo = new THREE.SphereGeometry(...sphereArgs);
    pool.mesh.geometry.dispose();
    pool.mesh.geometry = newGeo;
  }
}, [sphereArgs]);
```

상수:

```ts
const PM_TO_ANGSTROM = 0.01; // 1 pm = 0.01 Å
const BALL_STICK_SCALE = 0.8; // 공유반지름 × 0.8 (Phase 08 기존 비율 유지)
const SPACE_FILLING_SCALE = 1.0; // vdW 반지름 그대로 (비율 조정 없음)
```

#### LineBonds 구현

```tsx
// src/viewport/renderers/LineBonds.tsx (신규)

export function LineBonds({ molecules, atomPositionMap }: LineBondsProps): JSX.Element {
  const geometryRef = useRef(new THREE.BufferGeometry());
  const materialRef = useRef(new THREE.LineBasicMaterial({ vertexColors: true }));
  const lineRef = useRef<THREE.LineSegments>(null);

  // 분자 / 결합 변경 시 버퍼 재구성
  useEffect(() => {
    const positions: number[] = [];
    const colors: number[] = [];

    for (const mol of molecules) {
      // CD1: 도메인 Bond 는 원자를 AtomId 로 참조 (배열 인덱스 아님). atom 조회는 id 기반.
      const atomById = new Map(mol.atoms.map((a) => [a.id, a]));
      for (const bond of mol.bonds) {
        const a0 = atomById.get(bond.aAtomId);
        const a1 = atomById.get(bond.bAtomId);
        if (!a0 || !a1) continue;

        const p0 = atomPositionMap.get(a0.id);
        const p1 = atomPositionMap.get(a1.id);
        if (!p0 || !p1) continue;

        const c0 = cpkColorRgb(a0.element); // [r, g, b] 0..1
        const c1 = cpkColorRgb(a1.element);

        positions.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2]);
        colors.push(c0[0], c0[1], c0[2], c1[0], c1[1], c1[2]);
      }
    }

    geometryRef.current.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometryRef.current.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometryRef.current.computeBoundingSphere();
  }, [molecules, atomPositionMap]);

  // 원자 위치 실시간 갱신 — subscribeWithSelector 외부 구독 (Phase 08 D8 패턴)
  useEffect(() => {
    return subscribeWithSelector(useMoleculeStore, selectAtomPositionsFlat, (positions) => {
      // positions 맵을 position buffer 에 직접 기입
      const attr = geometryRef.current.attributes.position;
      if (!attr) return;
      // ... bond index → atom position 매핑 후 attr.set(...) ...
      attr.needsUpdate = true;
      geometryRef.current.computeBoundingSphere();
    });
  }, [molecules]);

  return (
    <lineSegments ref={lineRef} geometry={geometryRef.current} material={materialRef.current} />
  );
}
```

#### Picking 비활성화 (D15)

`lodLevel` 은 `uiStore` 가 **아니라** `viewport/` 내부 상태(`LodContext`)이고 `renderMode` 는 `settingsStore` 소속이다. 따라서 uiStore selector 가 아닌 **viewport 내부 가드 훅**으로 처리한다 (uiStore 에 `viewport.lodLevel`/`bondPickingEnabled` 필드를 추가하지 않음 — 오염 방지, Phase 09 interaction guard 패턴과 동일):

```ts
// src/viewport/interactions/useBondPickingEnabled.ts (신규 — viewport 내부)
import { useLodLevel } from '@/viewport/renderers/lod/useLodLevel';
import { useSettingsStore, selectRenderMode } from '@/stores';

export function useBondPickingEnabled(): boolean {
  const lodLevel = useLodLevel(); // 'high' | 'medium' | 'line'
  const renderMode = useSettingsStore(selectRenderMode); // RenderMode (CD2 외 — settingsStore)
  return lodLevel !== 'line' && renderMode !== 'wireframe';
}
```

결합 picking 핸들러(Phase 09 interaction)가 이 훅의 false 시 bond raycast 를 건너뛴다. D15 의 "`uiStore.interaction.bondPickingEnabled` 파생 상태 추가" 표현은 본 구현으로 대체 — **uiStore retrofit 없음** (D15 표 문구도 그에 맞춰 읽는다).

### 6.5 Aromatic Bond Shader 확정 및 성능 검증

#### Aromatic bond 확정

Phase 08 §2.3 의 미결 사항: "drei `Line` 의 dashed inner (`renderAromaticOverlay`) 디폴트로 두되, Phase 14 확정 or 교체 가능".

**Phase 14 결정**: **변경 없음 — drei `Line` 유지 확정**. 사유:

1. Phase 08 의 `renderAromaticOverlay(bondId)` 구현이 이미 drei `Line` segments + `dashed: true` 로 동작.
2. cylinder + texture dash 대안은 추가 성능 비용 (geometry 복잡도) 및 추가 구현 시간 대비 시각 개선이 marginal.
3. Phase 15 에서 Playwright 시각 회귀 테스트 추가 후, 사용자 피드백에 따라 필요 시 `renderAromaticOverlay` 내부만 교체 가능.

변경이 필요한 경우의 경로:

```ts
// src/viewport/renderers/BondInstances.tsx (또는 AromaticOverlayInstances.tsx)
// renderAromaticOverlay(bondId) 내부만 수정:
// 현재: <Line points={[v0, v1]} dashed dashSize={0.05} gapSize={0.03} lineWidth={1} />
// 교체 후보: cylinder + MeshStandardMaterial + alphaMap(dash texture)
```

#### FPS 최종 검증 절차

```
환경: Chrome + drei Stats (Shift+F), CPU 4x throttling
기준 분자: 500 원자 합성 체인 (LOD medium 레벨)

1. pnpm run dev
2. 500 원자 분자 로드
3. Shift+F → Stats 패널 열기
4. 5초간 평균 FPS 측정 → 목표: ≥ 55 fps
5. 분자를 1000 원자로 교체 (LOD line 레벨 전환 확인)
6. FPS 재측정 → 목표: ≥ 30 fps
7. OrbitControls 드래그 테스트 → 드래그 응답 < 100 ms 확인
```

#### Lighthouse FCP 측정 절차

```
1. pnpm run build
2. pnpm run preview   (Vite preview = 정적 서빙, base = '/')
3. Chrome DevTools > Lighthouse
   - 카테고리: Performance
   - 디바이스: Mobile (Slow 4G)
4. First Contentful Paint < 3000 ms 확인
5. 미달 시: §6.1 manualChunks 재검토, React.lazy 경계 확인,
   element data preload hint 추가 (Phase 01 의 i18n 파일 preload 패턴 참조)
```

### 6.6 GitHub Pages 배포 설정

#### vite.config.ts 배포 경로

```ts
// vite.config.ts — base 경로 설정
const REPO_NAME = 'chemistry'; // 실제 GitHub 레포명으로 조정

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? `/${REPO_NAME}/` : '/',
  // ...
});
```

`public/` 디렉토리 내 raw 파일을 `fetch()` 로 참조하는 코드 확인:

```ts
// 기존: fetch('/locales/ko.json')          — ❌ GitHub Pages 404
// 수정: fetch(import.meta.env.BASE_URL + 'locales/ko.json')  — ✓
```

Phase 01 의 i18n 초기화 (`i18next-http-backend`) 에 `loadPath: import.meta.env.BASE_URL + 'locales/{{lng}}/{{ns}}.json'` 이 있는지 확인. 없으면 Phase 14 에서 retrofit.

#### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Build, Test and Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm run typecheck

      - name: Lint
        run: pnpm run lint

      - name: Test
        run: pnpm run test

      - name: Build
        run: pnpm run build
        env:
          NODE_ENV: production

      - name: Size check
        run: pnpm run size-check

      - name: Upload dist artifact
        uses: actions/upload-artifact@v4
        if: github.ref == 'refs/heads/main'
        with:
          name: dist
          path: dist/
          retention-days: 1

  deploy:
    needs: build-and-test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    permissions:
      contents: write
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist/

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
          force_orphan: true
```

> Phase 01 에서 작성된 기존 CI 파일 (`.github/workflows/ci.yml`) 이 있으면 `build-and-test` job 과 중복 제거. 기존 파일을 `deploy.yml` 로 통합하거나 두 파일 공존 허용 (job 중복 실행 주의).

---

## 7. 파일 / 모듈 레이아웃

### 7.1 신규 파일

```
src/
├── viewport/
│   └── renderers/
│       ├── lod/
│       │   ├── useLodLevel.ts          ← LOD 레벨 훅 + getLodLevel 순수 함수
│       │   └── LodContext.tsx          ← LodContext + LodProvider
│       └── LineBonds.tsx               ← THREE.LineSegments 결합 렌더러
│
├── engine/
│   └── rdkit/
│       ├── workerMessages.ts           ← Worker 메시지 타입 (조건부)
│       ├── worker.ts                   ← Vite Worker script (조건부)
│       └── workerClient.ts             ← RdkitWorkerClient (조건부)
│
├── utils/
│   └── perf/
│       └── perfMarks.ts                ← performance.mark 래퍼 (dev only)
│
scripts/
└── size-check.mjs                      ← 번들 크기 검증 Node.js 스크립트

.github/
└── workflows/
    └── deploy.yml                      ← CI/CD + GitHub Pages 배포
```

### 7.2 수정 파일 (retrofit)

```
src/
├── viewport/
│   ├── _shared/
│   │   └── types.ts
│   │       LodLevel: 'high'|'medium'|'line' (2→3단계)
│   │       LodThresholds: LOD_THRESHOLDS 확정값 기입
│   │       RenderMode: 4종 유니온
│   │       CaptureBlobOptions.format: 'png'|'jpeg'|'webp'
│   │       DEFAULT_LOD_THRESHOLDS: @deprecated 별칭
│   │
│   ├── renderers/
│   │   ├── AtomInstances.tsx
│   │   │   lodLevel + renderMode props 추가
│   │   │   sphere segments LOD 분기 (useMemo)
│   │   │   space-filling: vdW radius 사용
│   │   │   geometry.dispose() + 재생성 (useEffect)
│   │   │
│   │   └── BondInstances.tsx
│   │       lodLevel + renderMode props 추가
│   │       LineBonds 조건 분기 (useLine 판정)
│   │       cylinder segments LOD 분기
│   │
│   └── scene/
│       └── Scene.tsx
│           LodProvider 마운트
│           showAtoms / showBonds / useLine 조건 렌더
│           captureBlob format 확장 (내부 mimeType 분기)
│
├── stores/
│   └── settingsStore.ts
│       RenderMode 유니온 4종으로 확장
│
├── engine/
│   └── rdkit/
│       └── service.ts
│           SHOULD_USE_WORKER 상수 추가
│           getOrCreateRdkitBackend: Worker 분기 (조건부)
│
├── panels/
│   └── Toolbar/
│       RenderModeGroup.tsx (또는 해당 위치)
│           'space-filling' / 'wireframe' / 'stick' 버튼 disabled 해제
│           'surface' 버튼 aria-disabled="true" 유지
│
├── i18n/
│   └── resources/{ko,en}/panels.json
│       panels.toolbar.renderMode.{spaceFilling,wireframe,stick}.{label,tooltip} 채움
│
vite.config.ts
    plugins: visualizer 추가
    base: production/development 분기
    build.rollupOptions.output.manualChunks: 4 vendor 청크
    worker.format: 'es'

package.json
    scripts."size-check": "node scripts/size-check.mjs"
```

### 7.3 Phase 09 KEY_MAP retrofit (minor)

```ts
// src/viewport/interactions/keymap.ts (phase-09 §4.5 KEY_MAP 추가)
'stats-toggle': { key: 'F', shift: true, description: 'FPS Stats 토글 (개발 전용)' }
```

`import.meta.env.DEV` 조건부 — 프로덕션 빌드에서 KEY_MAP 에서 제외 (tree-shake 또는 조건 분기).

---

## 8. 테스트 계획

### 8.1 유닛 테스트 (Vitest)

**`getLodLevel` 경계값 테스트**:

```ts
// tests/unit/lod.test.ts
import { getLodLevel } from '@/viewport/renderers/lod/useLodLevel';
import { LOD_THRESHOLDS } from '@/viewport/_shared/types';

const { atomCountForLowSegments: LOW, atomCountForLineBonds: LINE } = LOD_THRESHOLDS;

describe('getLodLevel', () => {
  test('high: 임계 미만', () => expect(getLodLevel('high', LOW - 1)).toBe('high'));
  test('high: 임계 + hysteresis 미만 (hysteresis 미작동)', () =>
    expect(getLodLevel('high', LOW + 9)).toBe('high'));
  test('high → medium: 임계 + hysteresis 이상', () =>
    expect(getLodLevel('high', LOW + 10)).toBe('medium'));
  test('medium → high: 임계 - hysteresis 이하', () =>
    expect(getLodLevel('medium', LOW - 10)).toBe('high'));
  test('medium → line: line 임계 + hysteresis 이상', () =>
    expect(getLodLevel('medium', LINE + 10)).toBe('line'));
  test('line → medium: line 임계 - hysteresis 이하', () =>
    expect(getLodLevel('line', LINE - 10)).toBe('medium'));
  test('line: line 임계 ± 9 이내 (hysteresis 미작동)', () =>
    expect(getLodLevel('line', LINE + 5)).toBe('line'));
});
```

**`size-check.mjs` 로직 테스트**:

```js
// scripts/__tests__/size-check.test.mjs
// mock dist/ 폴더 생성 후:
// - 초기 bundle 합계 < 500 KB → exit 0 확인
// - 초기 bundle 합계 > 500 KB → exit 1 확인
// - panel chunk > 40 KB → exit 1 확인
```

**RDKit blocking 측정**:

```ts
// tests/unit/rdkit-blocking.bench.ts (Vitest bench)
// §6.3 의 측정 케이스. CI 에서 warn 출력 확인 (test failure 아님).
```

**`RdkitWorkerClient` 단위 테스트 (Worker 분리 시)**:

```ts
// tests/unit/rdkit-worker.test.ts
// mock Worker 로 READY + RESULT 메시지 시뮬레이션
// - READY 이전 요청 → queue 에 쌓임 → READY 후 flush 확인
// - RESULT ok: true → resolve 확인
// - RESULT ok: false → reject 확인
// - Worker 오류 이벤트 → pending 전체 reject 확인
```

### 8.2 컴포넌트 테스트 (@react-three/test-renderer)

**LOD scene 스냅샷**:

```ts
// tests/component/lod.test.tsx
import { act, create } from '@react-three/test-renderer';

test('high LOD: sphere segments 16', async () => {
  // 10 원자 분자 로드 → Scene 렌더 → AtomInstances mesh geometry.parameters 확인
  const renderer = await create(<MockScene molecules={[small10AtomMolecule]} />);
  const geom = renderer.scene.findAll(/* SphereGeometry */)[0];
  expect(geom.widthSegments).toBe(16);
});

test('medium LOD: sphere segments 8', async () => {
  // 150 원자 분자 → LodLevel = 'medium' → segments 8 확인
});

test('line LOD: LineBonds 렌더 확인', async () => {
  // 600 원자 분자 → LodLevel = 'line' → LineSegments 존재 확인, BondInstances 없음 확인
});
```

**RenderMode scene 스냅샷**:

```ts
test('space-filling: BondInstances 없음', async () => {
  /* ... */
});
test('wireframe: AtomInstances 없음, LineBonds 있음', async () => {
  /* ... */
});
test('stick: AtomInstances 없음, BondInstances(cylinder) 있음', async () => {
  /* ... */
});
```

### 8.3 컴포넌트 테스트 (@testing-library/react)

**Toolbar RenderMode 버튼 활성화 검증**:

```ts
// tests/component/toolbar-rendermode.test.tsx
test('space-filling 버튼 클릭 가능', () => {
  render(<Toolbar />);
  const btn = screen.getByRole('button', { name: /space-filling/i });
  expect(btn).not.toBeDisabled();
  expect(btn).not.toHaveAttribute('aria-disabled', 'true');
});

test('surface 버튼 비활성 유지', () => {
  const btn = screen.getByRole('button', { name: /surface/i });
  expect(btn).toHaveAttribute('aria-disabled', 'true');
});
```

### 8.4 번들 크기 CI 검증

```
pnpm run build && pnpm run size-check → exit 0 확인 (CI 필수 게이트)
```

`deploy.yml` 의 `build-and-test` job 에서 `size-check` step 이 실패하면 `deploy` job 미실행.

### 8.5 성능 수동 검증

Phase 14 구현 완료 후 아래 수동 검증 수행 (결과를 PR description 에 기록):

| 검증 항목      | 방법                         | 목표          |
| -------------- | ---------------------------- | ------------- |
| FCP            | Lighthouse (Mobile, Slow 4G) | < 3000 ms     |
| FPS @ 500원자  | drei Stats + CPU 4x          | ≥ 55 fps      |
| FPS @ 1000원자 | drei Stats + CPU 4x          | ≥ 30 fps      |
| 번들 초기 합계 | size-check.mjs               | < 500 KB gzip |
| 드래그 응답    | Chrome Performance Timeline  | < 100 ms      |

---

## 9. 리스크 및 대안

### R1. Worker WASM 초기화 추가 지연

**리스크**: Worker 생성 + WASM 초기화가 기존 main thread lazy-init 보다 더 늦어질 수 있음 (Worker spawn overhead + 별도 WASM 다운로드 경로).

**대응**:

- `RdkitWorkerClient` constructor 에서 Worker 즉시 spawn (앱 마운트 시 — SMILES 입력 이전에 미리).
- WASM preload hint: Vite 의 `build.rollupOptions.output.assetFileNames` + HTML `<link rel="modulepreload">` 생성 (`vite-plugin-html` 또는 `@vite/plugin-legacy`).
- READY 이전 요청은 queue 에 보관 (§6.3 `RdkitWorkerClient.queue`) — blocking 없이 처리.

### R2. LineBonds Picking 불가

**리스크**: `THREE.LineSegments` 의 raycast `linePrecision` 이 WebGL 선 굵기 1px 기준으로 작아 결합 클릭 감지 어려움.

**대응 (D15)**:

- `lodLevel === 'line'` 또는 `renderMode === 'wireframe'` 시 viewport 내부 결합 picking 핸들러에서 조기 반환. Phase 09 의 `isTextInputTarget` 가드 패턴 동일.
- 원자 picking (InstancedMesh raycast) 은 `line` 레벨에서도 유지 (`AtomInstances` 는 `line` 레벨에서도 소형 구체 마운트, §6.4).
- 사용자 안내: Tooltip "이 뷰에서는 결합 선택이 비활성화됩니다." (i18n key `viewport.tooltip.bondPickingDisabled`).

### R3. LOD 전환 시각 점프 (oscillation)

**리스크**: 총 원자 수가 threshold 근방을 오가면 (분자 추가/삭제 반복) LOD 전환이 눈에 띔.

**대응 (D13)**:

- hysteresis buffer ±10 원자 적용. `getLodLevel` 의 `currentLevel` 파라미터로 이전 레벨 유지.
- 그래도 부족하면 `useDeferredValue` 로 LOD 결정을 React 낮은 우선순위로 처리 (180 ms 지연 허용).

### R4. Space-filling 원자 겹침 혼란

**리스크**: vdW 반지름이 공유반지름보다 크므로 인접 원자 구체가 겹쳐 보임. 의도된 동작이나 처음 보는 사용자에게 혼란.

**대응**:

- Toolbar 의 `'space-filling'` 버튼 tooltip 에 설명 추가: `panels.toolbar.renderMode.spaceFilling.tooltip` = "vdW 반지름 기준. 인접 원자 구체 겹침은 정상 표현입니다." (한·영).
- Phase 15 에서 첫 진입 시 안내 메시지 (`notify`) 추가 여부 검토.

### R5. GitHub Pages base 경로 이슈

**리스크**: 앱 내부 hardcoded 절대 경로 (`fetch('/locales/...')` 등) 가 Pages 배포 후 404.

**대응**:

- Vite `base` 설정 적용 범위: 번들 내 에셋 URL 은 자동 prefix. `fetch()` 등 런타임 문자열은 `import.meta.env.BASE_URL` 수동 prefix 필요.
- Phase 01 의 i18n 설정 (`i18next-http-backend.loadPath`) 확인 — `import.meta.env.BASE_URL` 적용 여부 검토.
- `public/` 디렉토리 파일 참조 전수 조사 후 수정.

### R6. vendor chunk 분리 후 waterfall

**리스크**: `manualChunks` 로 vendor 를 분리하면 초기 로드 시 병렬 chunk fetch 수가 늘어나 HTTP/1.1 환경에서 waterfall.

**대응**:

- GitHub Pages 는 HTTP/2 지원 → 멀티플렉싱으로 병렬 fetch 정상.
- Vite 의 `modulepreload` polyfill (기본 활성) 이 `<link rel="modulepreload">` 를 `index.html` 에 자동 삽입 — 브라우저가 미리 병렬 로딩.

### R7. `toSdfBlock` 동기 API 와 Worker 비동기 경계 충돌

**리스크**: Phase 03 의 `toSdfBlock(mol): string` 은 동기 API. Worker 분리 시 비동기로 변경하면 Phase 13 의 SDF export 경로가 영향.

**대응 (§6.3 note 참조)**:

- Worker 분리 구현 시 `toSdfBlock` 만 별도 `RdkitDirectBackend` 인스턴스로 동기 처리 (WASM 이 로드된 후 직접 호출). 이 경우 `RdkitDirectBackend` 를 앱 생명주기 내내 유지 (메모리 ~10 MB 추가).
- 또는 `toSdfBlock` 을 `Promise<string>` 으로 변경하고 Phase 13 `<SdfExportPane/>` 를 `async` 로 전환 — Phase 13 §3.1 (선행 의존) retrofit 필요. 구현 복잡도 大.
- **권장**: 첫 번째 옵션 (직접 동기 인스턴스 유지). Phase 14 구현 시 최종 결정.

---

## 10. 완료 기준 (Definition of Done)

### DoD-1. 번들 분석 완료

- [ ] `pnpm run build` 성공. `dist/stats.html` 생성.
- [ ] `pnpm run size-check` exit code 0.
- [ ] 초기 bundle gzip 합산 < 500 KB (size-check 통과).
- [ ] `vendor-three` + `viewport` 청크가 lazy (초기 bundle 미포함) 확인.
- [ ] 어떤 panel 청크도 초기 bundle 에 포함되지 않음.

### DoD-2. LOD 구현 완료

- [ ] `getLodLevel` 단위 테스트 7 케이스 (경계값 + hysteresis 포함) 통과.
- [ ] `LOD_THRESHOLDS` §6.2 벤치마크 수행 후 최종값 기입.
- [ ] 총 원자 수 < `atomCountForLowSegments`: sphere segments 16, cylinder 8 확인.
- [ ] 총 원자 수 ≥ `atomCountForLowSegments`: sphere segments 8, cylinder 4 확인.
- [ ] 총 원자 수 ≥ `atomCountForLineBonds`: `<LineBonds/>` 렌더 + `BondInstances` 비마운트 확인.
- [ ] LOD 전환 후 FPS ≥ 목표치 (§8.5 수동 검증 기록).
- [ ] hysteresis 적용 — threshold 근방 oscillation 없음 육안 확인.

### DoD-3. RDKit blocking 결정 문서화

- [ ] §6.3 측정 절차 수행 완료.
- [ ] `SHOULD_USE_WORKER` 값 (`true` / `false`) 이 `service.ts` 에 최종 기입.
- [ ] Worker 구현 시: `workerMessages.ts` / `worker.ts` / `workerClient.ts` 작성 + `RdkitWorkerClient` 단위 테스트 (mock Worker) 통과.
- [ ] 메인 스레드 유지 결정 시: §6.3 결론 1 문단 (측정 수치 포함) 작성.

### DoD-4. 확장 렌더 모드 구현 완료

- [ ] `RenderMode` 타입: `'ball-and-stick' | 'space-filling' | 'wireframe' | 'stick'`.
- [ ] Space-filling: vdW radius 사용 + BondInstances 비표시 시각 확인.
- [ ] Wireframe: AtomInstances 비표시 + LineBonds 렌더 시각 확인.
- [ ] Stick: AtomInstances 비표시 + 실린더 BondInstances 렌더 시각 확인.
- [ ] Toolbar `'space-filling'` / `'wireframe'` / `'stick'` 버튼 클릭 가능 (aria-disabled 없음).
- [ ] Toolbar `'surface'` 버튼 `aria-disabled="true"` 유지.
- [ ] 각 렌더 모드에서 원자 라벨 토글 정상 동작.
- [ ] `line` LOD 또는 `wireframe` 모드에서 결합 picking 비활성화 확인.

### DoD-5. Aromatic bond shader 확정

- [ ] Phase 08 의 `renderAromaticOverlay` 구현 변경 없음 — 코드 차이 없음.
- [ ] 벤젠 (`c1ccccc1`) 시각화 시 dashed inner line 표시 확인.
- [ ] 본 문서 §6.5 에 "drei Line 유지 확정 — 이유 기록" 완료.

### DoD-6. CaptureBlobOptions format 확장

- [ ] `captureBlob({ format: 'jpeg', dpr: 2 })` → JPEG Blob 반환, 다운로드 파일 확장자 `.jpg` 또는 `.jpeg`.
- [ ] `captureBlob({ format: 'webp' })` → WebP Blob 반환.
- [ ] Phase 13 `<PngExportPane/>` 의 format 탭 (png/jpeg/webp) 전환 후 다운로드 파일 포맷 정합.
- [ ] `format: 'jpeg'` + `transparentBackground: true` → 투명 무시 (배경색 유지).

### DoD-7. 성능 예산 달성

- [ ] Lighthouse FCP < 3000 ms (Mobile, Slow 4G).
- [ ] FPS ≥ 55 @ 500 원자 (LOD medium, CPU 4x).
- [ ] FPS ≥ 30 @ 1000 원자 (LOD line, CPU 4x).
- [ ] 드래그 응답 < 100 ms (Performance Timeline 확인).

### DoD-8. 배포 설정 완료

- [ ] `vite.config.ts` `base`: production = `'/{레포명}/'`, development = `'/'`.
- [ ] `public/` 파일 참조에 `import.meta.env.BASE_URL` 적용 확인.
- [ ] `.github/workflows/deploy.yml` 존재.
- [ ] `main` 브랜치 push → GitHub Actions `build-and-test` + `deploy` job 성공.
- [ ] GitHub Pages URL 에서 앱 정상 로드 확인 (FCP 기준 포함).

### DoD-9. 인계 항목 공식 처리

- [ ] SDF Import / drag-and-drop / zod / Cmd+S/O / PNG annotation / reactionStore 직렬화 → **post-v1** 확정 기록 (§2.1 표 완성).
- [ ] bond-level crossfade 애니메이션 → **post-v1** 확정.
- [ ] Surface 렌더 모드 → **post-v1** 확정 (`RenderMode` 유니온 미포함).
- [ ] architecture.md 의 모든 "Phase 14+" 참조 항목이 본 문서에서 처리됨 (§1 목적 8항 참조).

### DoD-10. 타입 체크 / 린트 / 테스트 통과

- [ ] `pnpm run typecheck` 오류 0.
- [ ] `pnpm run lint` 오류 0.
- [ ] `pnpm run test` (Vitest) 전체 통과.
- [ ] CI `build-and-test` job 성공 (PR 기준).

---

_문서 버전: 0.2 (구현 정합)_
_v0.2 (2026-05-18): forward 정합 — 코드 미변경, phase-14 미구현._

> **v0.2 변경 요약:**
>
> 1. §2.2 비포함에 phase-09 §11 #12·#13·#4·#10 의 라이브 결선(fade Scene retained-id + 렌더러 fadeOpacity threading, drag/select R3F pointer-event 결선, multi-hit/박스 선택) → **Phase 15** 명시 라우팅 (초안은 phase-09 가 "Phase 14+" 로 모호 인계 → phase-14 §2 perf-only 스코프와 불일치였음).
> 2. 드래그 throttle 임계(phase-09 §11 #3) 측정·결정은 본 Phase perf 스코프에 포함(§6.x 벤치마크 절차로 처리; 별도 §2.1 행 불요).
> 3. undo/rrp/fade 식별자·경로 drift 없음(본 Phase 는 LOD/번들/Worker 중심 — 검증 완료).
