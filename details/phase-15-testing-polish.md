# Phase 15 — Testing & Polish (v1 Release Gate)

> 본 문서는 `architecture.md` §13 의 Phase 15 상세 설계서다. **마지막 Phase** —
> 모든 선행 Phase(01–14)에 의존하며, 전 Phase 가 "Phase 15 인계"로 미룬 항목을
> 단일 인벤토리·완료기준(v1 릴리스 게이트)으로 통합한다. 신규 기능 없음 —
> 검증 / 완성 / 정리 전용.
>
> **선행 문서**: `architecture.md` (§3.5 접근성, §3.7 에러경계, §3.9 배포, §3.10
> 뷰포트 기본값, §10 테스트 전략, §11 i18n, §13), `details/phase-01..14-*.md`
> (각 §11 열린 질문 / §12 인계 표의 "Phase 15" 행).

---

## 1. 목적 (Purpose)

1. **E2E 검증** — Playwright 도입(`playwright` devDependency + config + CI). jsdom
   에서 scope-cut 된 라이브 동작(R3F scene/raycast/드래그/선택/키보드, 리사이즈,
   모달 focus, 테마 토글, export/import)을 실제 브라우저에서 회귀.
2. **fade / 인터랙션 라이브 결선** — phase-09 가 단위 검증 수준으로 남긴 두 갭의
   _실 결선_ 마감: (a) Scene retained-id 렌더 + 렌더러 `fadeOpacity` 머티리얼
   threading (mount/unmount fade 라이브 발화), (b) `createDragController` /
   `selectFromPick` / `createViewportShortcutHandler` 의 R3F instanced-mesh
   pointer-event + raycast + per-molecule subscription 결선.
3. **접근성 검증** — `@axe-core/playwright` 자동 검사(모든 Radix primitive +
   AppLayout + WebGL2FallbackPage), CVD 안전 팔레트 확정(`theme.css` `.cvd`),
   색약 모드 시 원소 라벨 강제 on.
4. **i18n 완성** — 전 Phase 가 추가한 i18n *키*의 한·영 최종 문구 채움 +
   미사용/누락 키 검출 스크립트, `<html lang>` ↔ `settingsStore.locale` 동기.
5. **번들 예산 게이트** — `< 500 KB gzip` 초기 번들 실측 검증(phase-14 의
   `size-check.mjs` + `dist/stats.html`), 코드 분할(panels/viewport/RDKit lazy)
   확인. CI 통합.
6. **에러경계 / 폴리싱 마감** — `<AppErrorBoundary>` i18n 부팅 실패 시뮬레이션,
   viewport/component 보조 경계 도입 여부 최종 결정, WebGL2 fallback 페이지
   시각·문구 완성.
7. **배포 / 호스팅 확정** — phase-14 의 `deploy.yml` 기반 호스팅 타깃(예:
   GitHub Pages) 최종 선택 + `base` 경로 검증 + 호스팅 독립성 확인.
8. **잔여 UX 결정 닫음** — phase-09 §11 #1(Esc focus 해제), §11 #8(undo selection
   안내 토스트) 등 a11y 검증 결과에 따른 결정.

---

## 2. 범위 (Scope)

### 2.1 포함

- **Playwright 인프라**: `playwright` + `@playwright/test` + `@axe-core/playwright`
  (devDependency, 번들 무관 — architecture §9.1 예산 무관), `playwright.config.ts`,
  `tests/e2e/` 시나리오, CI 워크플로 `e2e` job(주요 PR/릴리스 트리거 — §10.3).
- **§5 E2E 시나리오 카탈로그** 전수 구현(phase-08/09/10/13 + architecture §10.3
  통합).
- **fade 라이브 결선**(phase-09 §11 #13 / phase-14 §2.2): `Scene` 이 store
  `ids` 외에 _퇴장 중_ 분자 id 를 durationMs 동안 retain → `withMoleculeFade`
  의 delayed-unmount 가 라이브 발화. 렌더러(`BallAndStickRenderer`/instanced
  머티리얼)가 `fadeOpacity` 를 transparent opacity 로 threading. 시각 회귀
  포함.
- **인터랙션 라이브 결선**(phase-09 §11 #12): 컨트롤러를 Phase 08 instanced
  메시의 `onPointerDown/Move/Up` + `getAtomIdFromIntersection` raycast 에 결선,
  drag 의 per-molecule `useAtomMatrixSubscription` 핸들 라우팅 마감. 단위
  컨트롤러 로직(phase-09 §8.x)은 그대로 — 결선·E2E 만 추가.
- **a11y**: `@axe-core/playwright` 자동 스캔, 키보드 회귀(PanelGroup resize
  handle / Dialog focus trap / Tabs/Slider 키 nav / Tab atom cycle / Esc),
  CVD 안전 팔레트 확정(`theme.css` `.cvd` 변수 실값) + `settingsStore.cvdMode`
  → `<html class="cvd">` + 라벨 강제 on(architecture §3.5/§3.10, phase-08 §2.2,
  phase-10 D9/D16).
- **i18n 완성**: 전 Phase 가 임시/키만 둔 문구(`app.webgl2Unsupported.*`,
  `app.panelError.*`, `common.loading.*`, `panels.toolbar.renderMode.*`,
  `shortcuts.*`, `panels.*` 등) 한·영 최종 문구. 누락/미사용 키 검출 스크립트
  (`scripts/i18n-check.mjs` — 키 집합 ↔ 코드 사용 diff). `<html lang>` 동기.
- **번들 게이트**: phase-14 의 `size-check.mjs` 임계 검증을 릴리스 게이트로
  승격(CI 필수 step), `dist/stats.html` 수동 검토 체크리스트.
- **에러경계 마감**: i18n 부팅 실패(리소스 로드 실패) 시뮬레이션 →
  `<AppErrorBoundary>` 정적 영문 fallback 정상(D15/R3). viewport/component
  보조 경계 추가 도입 여부 **최종 결정**(architecture §3.7 — phase-10 이
  PanelErrorBoundary 4슬롯 도입; 추가 세분화 필요성 axe/실사용 후 판단).
- **배포**: phase-14 `deploy.yml` 기반 호스팅 타깃 확정 + `base` 경로 + 정적
  호스팅 독립성(절대경로 의존 0) 검증.
- **잔여 UX 결정**: phase-09 §11 #1(Esc 가 viewport focus 도 해제?),
  §11 #8(undo 후 selection 손실 안내 토스트 도입?) — a11y 결과 기반 확정.

### 2.2 비포함 — post-v1 비목표 (어느 Phase 도 구현하지 않음, 확정)

| 항목                                                             | 사유 / 출처                                                                                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **반응 규칙 매칭 엔진**                                          | 번들 RDKit MinimalLib 에 Reaction API(`RunReactants`) 부재 → phase-06 §2 가 v1 휴리스틱 전용 확정. 메모리 `project_rdkit_no_reaction_api`. |
| **bond-level crossfade 애니메이션**                              | architecture §1.3 ⑥ / phase-14 §2.2 — post-v1 비목표 확정 (mount/unmount fade 로 충족).                                                    |
| **박스 선택 / drag-drop 결합 생성 / multi-hit raycast**          | phase-09 §11 #4·#10 — post-v1 검토 항목. v1 미구현.                                                                                        |
| **Surface 렌더 모드**                                            | architecture §3.1 / phase-14 P7 — 타입 유니온 미추가, post-v1.                                                                             |
| **SDF/PDB/MOL/XYZ Import, drag-drop 파일, zod, 다중 zip export** | phase-14 §2.2 — post-v1 확정.                                                                                                              |
| **클라우드 저장 / URL 공유 / 서버 런타임 / PWA offline**         | architecture §3.6/§3.9 — 비목표.                                                                                                           |
| **모바일/태블릿 반응형**                                         | architecture desktop-first; <1024px 안내 텍스트만(phase-10 R5).                                                                            |

### 2.3 명시적 비결정 (본 Phase 가 닫음)

- 호스팅 타깃(GitHub Pages vs 사내 CDN 등) — §6.7 에서 확정.
- viewport/component 보조 ErrorBoundary 세분화 — §6.6 에서 결정.
- phase-09 §11 #1 / #8 — §6.4/§6.5 에서 결정.

---

## 3. 의존성 (Dependencies)

### 3.1 선행 Phase

**전 Phase (01–14)** — 본 Phase 는 전체 구현체를 검증·결선·완성한다. 직접
retrofit 대상: phase-08 `Scene`/`BallAndStickRenderer`(fade threading + retained-id),
phase-09 인터랙션 컨트롤러(R3F 결선), phase-10 `theme.css`(.cvd 실값) /
i18n 리소스, phase-14 `size-check`/`deploy.yml`(릴리스 게이트 승격).

### 3.2 외부 라이브러리 (architecture §2 / §66 — 본 Phase 신규)

| 라이브러리             | 용도                | 비고                                                                     |
| ---------------------- | ------------------- | ------------------------------------------------------------------------ |
| `@playwright/test`     | E2E 러너 + 브라우저 | devDependency. architecture §2 가 Phase 15 착수 시 설치 명시. 번들 무관. |
| `@axe-core/playwright` | a11y 자동 스캔      | devDependency.                                                           |

신규 런타임 의존 **0** (모두 devDependency — 초기 번들 예산 무관).

### 3.3 결정 사항 (P-표)

| ID     | 내용                                                                                                              | 출처                            |
| ------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **P1** | E2E 는 핵심 시나리오만(architecture §10.3) — 전수 자동화 비목표. CI 는 유닛/컴포넌트 필수, E2E 는 주요 PR/릴리스. | architecture §10.3/§10.4        |
| **P2** | fade/인터랙션 라이브 결선은 phase-09 단위 컨트롤러/훅 **재구현 금지** — 결선+E2E 만. 단위 로직 동결.              | phase-09 §11 #12·#13            |
| **P3** | i18n *키*는 선행 Phase 가 이미 정의 — 본 Phase 는 *문구*만. 키 추가 시 해당 도메인 Phase 책임이었음(소급 금지).   | architecture §11, phase-01 §5.1 |
| **P4** | 번들 게이트 로직은 phase-14 `size-check.mjs` 재사용 — 본 Phase 는 릴리스 게이트로 *승격*만.                       | phase-14 §2.1                   |
| **P5** | CVD 팔레트는 `theme.css` `.cvd` 변수 _값_ 교체만(D9 비파괴) — tailwind config / 컴포넌트 변경 0.                  | phase-10 D9/R4                  |

---

## 4. 통합 인벤토리 (전 Phase → Phase 15 인계 항목)

| #   | 항목                                                          | 출처                                            | 수용 기준 (DoD 연결)                                   |
| --- | ------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------ |
| I1  | Playwright 도입 + config + CI `e2e` job                       | arch §2/§10.3, phase-01 §2.2                    | `pnpm e2e` 통과, CI 트리거 동작                        |
| I2  | E2E 시나리오 카탈로그(§5) 전수                                | phase-08/09/10/13 §8.x, arch §10.3              | §5 표 전 항목 green                                    |
| I3  | fade 라이브 결선(Scene retained-id + `fadeOpacity` threading) | phase-09 §11 #13, §6.7; phase-14 §2.2           | 분자 추가→fade-in, 삭제→fade-out 후 unmount (E2E 시각) |
| I4  | 인터랙션 라이브 결선(drag/select/keyboard R3F)                | phase-09 §11 #12, §8.12                         | E2E: atom 클릭 선택/드래그/Tab/B/Cmd+Z 동작            |
| I5  | a11y axe 자동 검증                                            | arch §3.5, phase-09 §12(15a), phase-10 §8.4     | axe 0 critical/serious                                 |
| I6  | CVD 안전 팔레트 + 라벨 강제 on                                | arch §3.5/§3.10, phase-08 §2.2, phase-10 D9/D16 | `.cvd` 실값, cvdMode 시 라벨 on, 대비 기준 통과        |
| I7  | i18n 문구 완성 + 누락/미사용 검출                             | arch §11, phase-01 §5.1, phase-10/14 임시문구   | 키 100% 한·영, `i18n-check` 0 누락                     |
| I8  | `<html lang>` ↔ locale 동기                                   | arch §11, phase-09 §12(15f)                     | locale 토글 시 lang 속성 변경                          |
| I9  | 번들 < 500 KB gzip 릴리스 게이트                              | phase-10 §3.2, phase-14 §2.1/§10                | `size-check` CI 필수 통과                              |
| I10 | `<AppErrorBoundary>` i18n 부팅실패 검증                       | phase-10 D15/R3                                 | 리소스 로드 실패 시 정적 영문 fallback                 |
| I11 | viewport/component 보조경계 도입 결정                         | arch §3.7                                       | 결정 + (도입 시) 구현/테스트                           |
| I12 | WebGL2 fallback 페이지 문구·시각 완성                         | phase-10 D5, phase-14 §2.2                      | i18n 완성 + E2E E4                                     |
| I13 | 배포/호스팅 타깃 확정 + base 경로                             | arch §3.9, phase-14 배포절                      | 정적 배포 성공, 호스팅 독립                            |
| I14 | phase-09 §11 #1(Esc focus) / #8(undo toast) 결정              | phase-09 §11                                    | 결정 문서화 + (필요 시) 구현                           |
| I15 | scene/§8.12 jsdom scope-cut 의 E2E 해소                       | phase-08 §8.5, phase-09 §8.12, phase-10 §8.4    | 해당 시나리오 §5 에 포함·green                         |

---

## 5. E2E 시나리오 카탈로그 (`tests/e2e/`)

architecture §10.3 핵심 5 + 각 Phase scope-cut 통합. 핵심만 — 전수 자동화 아님(P1).

| ID  | 시나리오                          | 출처                      | 검증                                                                        |
| --- | --------------------------------- | ------------------------- | --------------------------------------------------------------------------- |
| S1  | SMILES → 3D                       | arch §10.3#1, phase-12    | 입력→파싱→분자 표시 + mount fade-in (I3)                                    |
| S2  | 원소/원자 선택                    | arch §10.3#2, phase-09    | atom 클릭→selection, Shift-멀티, Esc clear                                  |
| S3  | 반응 설정 → 결과                  | arch §10.3#3, phase-06/11 | 조건 슬라이더 + run → ReactionResult(실험적 배지) + "작업공간 추가"→fade-in |
| S4  | PNG export                        | arch §10.3#4, phase-13    | export 모달 → Blob 생성                                                     |
| S5  | i18n 한/영 전환                   | arch §10.3#5              | 토글 → 문구 + `<html lang>` 변경 (I7/I8)                                    |
| S6  | 사이드패널 마우스/키보드 리사이즈 | phase-10 E1/E2            | rrp v4 handle 드래그 + ←/→                                                  |
| S7  | 패널 active + 단축키 스코프       | phase-10 E3, phase-09 D10 | Cmd+Z viewport-focus 시 undo, input focus 시 native                         |
| S8  | WebGL2 미지원 fallback            | phase-10 E4, I12          | mock → fallback 페이지, sidepanel 정상                                      |
| S9  | 라이트↔다크 + CVD 토글            | phase-10 E5, I6           | `<html>` class + computed 색 + 라벨 강제 on                                 |
| S10 | Modal 열림/닫힘 + focus 복원      | phase-10 E6               | Esc → trigger focus 복원                                                    |
| S11 | atom 드래그 + Undo/Redo           | phase-09 §8.12, I4        | 드래그 이동 → Cmd+Z 복원 (라이브 R3F)                                       |
| S12 | 결합 생성(B) + 차수(1/2/3/A)      | phase-09 §8.12, I4        | 2 atom + B → addBond, fade                                                  |
| S13 | JSON export/import 라운드트립     | phase-13                  | export→import→동일 분자, dispatcher.clear()                                 |
| S14 | aromatic/결합 차수 시각 회귀      | phase-08 §8.5, I3         | 픽셀 diff(드리 Line vs cylinder)                                            |

각 시나리오 끝에 `@axe-core/playwright` 스캔 1회(I5) 부착.

---

## 6. 핵심 전략

### 6.1 Playwright 설정

`playwright.config.ts`: chromium(WebGL2 on) 기본, `webServer` = `pnpm preview`
(prod 빌드 — 번들 게이트와 동일 산출물). `tests/e2e/` 스펙. CI `e2e` job 은
`build` 후 실행, 실패 시 릴리스 차단.

### 6.2 fade 라이브 결선 (I3)

`Scene` 에 `useRetainedMoleculeIds(storeIds, durationMs)` — store 에서 빠진 id 를
durationMs 동안 잔존 집합에 유지하여 `withMoleculeFade` wrapper 가 마운트 유지 →
delayed-unmount 발화. `BallAndStickRenderer`/instanced 머티리얼이 wrapper 의
`fadeOpacity` 를 `material.opacity`(transparent) 로 곱 적용. phase-09 의
`withMoleculeFade`/`useFadeOnMount`/`easing` 단위 로직 **변경 0** — 결선만.

### 6.3 인터랙션 라이브 결선 (I4)

Phase 08 `AtomInstances`/`BondInstances` 의 R3F `onPointerDown/Move/Up` 에
`createDragController`/`selectFromPick` 연결, `getAtomIdFromIntersection` 으로
raycast 결과 → 컨트롤러. drag 의 per-molecule `useAtomMatrixSubscription` 핸들을
`Scene`/`MoleculeGroup` 경유로 컨트롤러에 주입(현재 no-op handle 교체).
`createViewportShortcutHandler` 는 `<Viewport tabIndex=0>` 에 이미 결선됨(phase-09)
— E2E 로 라이브 검증만.

### 6.4 a11y / CVD (I5/I6)

`@axe-core/playwright` 를 §5 각 시나리오에 부착. CVD: `theme.css` `.cvd` 변수에
색약 안전 실값 확정(blue-orange-cyan 계열, 명도 분리), `settingsStore.cvdMode`
토글이 `<html class="cvd">` + `selectAtomLabelsOn` 강제 true(architecture §3.5).

### 6.5 i18n 완성 (I7/I8)

`scripts/i18n-check.mjs`: `src/i18n/resources/{ko,en}/*.json` 키 합집합 ↔ 코드
`t('...')` 사용 집합 diff → 누락/미사용 보고(CI 경고). 전 Phase 임시 문구 →
최종 한·영. `<html lang>` 은 `I18nProvider`/`settingsStore.locale` 구독으로 동기.

### 6.6 에러경계 결정 (I10/I11)

i18n 리소스 로드 강제 실패 mock → `<AppErrorBoundary>` 정적 영문 fallback 확인.
phase-10 의 4슬롯 `<PanelErrorBoundary>` 로 충분한지 axe/실사용 후 판단 —
추가 세분화 미도입을 기본값으로(필요 입증 시에만 도입). 결정 §10 DoD 기록.

### 6.7 배포/호스팅 (I13)

phase-14 `deploy.yml` + `vite base` 전제 위에 호스팅 타깃 확정(기본 GitHub
Pages). 절대경로 의존 0 / `import.meta.env.BASE_URL` 사용 검증. 호스팅
독립성(다른 정적 호스트로 이전 가능) 확인.

---

## 7. 파일/모듈 레이아웃

```
playwright.config.ts                         (신규)
tests/e2e/                                   (시나리오 S1–S14)
  ├── _fixtures.ts                           (공통 setup, axe helper)
  ├── smiles-to-3d.spec.ts … etc
scripts/i18n-check.mjs                        (신규 — 키 diff)
src/viewport/scene/Scene.tsx                  (retrofit: retained-id)
src/viewport/renderers/ball-and-stick/*       (retrofit: fadeOpacity threading)
src/viewport/renderers/MoleculeGroup.tsx      (retrofit: subscription handle 라우팅)
src/app/layout/styles/theme.css               (retrofit: .cvd 실값)
src/i18n/resources/{ko,en}/*.json             (문구 완성)
.github/workflows/*.yml                        (retrofit: e2e job + size-check 게이트 승격)
```

> 모든 src retrofit 은 **인터페이스 불변** — phase-08/09 단위 테스트가 회귀 가드.

---

## 8. 테스트 계획

- 본 Phase 산출물 자체가 테스트(E2E) — §5 카탈로그가 곧 테스트 계획.
- 기존 유닛/컴포넌트(418+) 회귀 유지(retrofit 후 `pnpm typecheck && lint &&
vitest run` green).
- `scripts/i18n-check.mjs` / `scripts/size-check.mjs` 는 CI step.

## 9. 리스크

| ID  | 리스크                                              | 대응                                                            |
| --- | --------------------------------------------------- | --------------------------------------------------------------- |
| R1  | E2E flakiness (WebGL/타이밍)                        | `webServer` prod 빌드 고정, 명시 `waitFor`, 시각 diff 임계 여유 |
| R2  | fade/인터랙션 결선이 phase-08/09 단위 테스트 깨뜨림 | 인터페이스 불변 원칙(P2) + retrofit 후 전 유닛 재실행           |
| R3  | CVD 팔레트 대비 기준 미달                           | axe + 수동 대비 측정, `.cvd` 값 반복 조정(비파괴)               |
| R4  | 번들 게이트 초과                                    | phase-14 manualChunks 재튜닝, lazy 경계 점검                    |
| R5  | Playwright CI 시간                                  | 핵심 시나리오만(P1), e2e job 은 주요 PR/릴리스 한정             |

## 10. 완료 기준 (Definition of Done = v1 릴리스 게이트)

- [ ] `playwright` 인프라 + §5 S1–S14 green, CI `e2e` job 동작 (I1/I2/I15)
- [ ] fade 라이브: 분자 추가 fade-in / 삭제 fade-out+delayed-unmount (I3)
- [ ] 인터랙션 라이브: 클릭선택/드래그/Tab/B/Cmd+Z E2E green (I4)
- [ ] `@axe-core/playwright` 0 critical/serious (I5)
- [ ] CVD 안전 팔레트 확정 + cvdMode 라벨 강제 on (I6)
- [ ] i18n 키 100% 한·영, `i18n-check` 0 누락/미사용, `<html lang>` 동기 (I7/I8)
- [ ] 초기 번들 < 500 KB gzip, `size-check` CI 필수 (I9)
- [ ] AppErrorBoundary i18n 부팅실패 정적 영문 fallback (I10)
- [ ] 보조 ErrorBoundary 세분화 도입 여부 결정·기록 (I11)
- [ ] WebGL2 fallback 페이지 문구·시각 완성 (I12)
- [ ] 정적 배포 성공 + 호스팅 독립 + base 경로 검증 (I13)
- [ ] phase-09 §11 #1(Esc focus) / #8(undo toast) 결정·기록 (I14)
- [ ] 전 유닛/컴포넌트 테스트 회귀 green (retrofit 무영향)
- [ ] §2.2 post-v1 비목표 목록 최종 확정·문서화 (rule-engine 등)

## 11. 열린 질문 (User Decision Required)

1. 호스팅 타깃 — GitHub Pages(기본) vs 사내 CDN/Vercel/Netlify (배포 직전 확정).
2. 보조 ErrorBoundary 세분화 — axe/실사용 결과 따라 사용자 확정.
3. phase-09 §11 #1 Esc focus 해제 / #8 undo selection 토스트 — a11y 결과 기반.
4. post-v1 항목 중 사용자 강력 요구 시 우선순위 재조정(기본: 전부 post-v1 유지).

## 12. 다음 Phase 로의 인계 (Hand-off)

**없음 — 최종 Phase.** 본 Phase DoD 충족 = **v1 릴리스**. post-v1 항목(§2.2)은
별도 로드맵에서 사용자 요구에 따라 신규 Phase 로 기획.

---

_문서 버전: 0.1 (작성) — 2026-05-18_
_작성 경위: phase-15 상세 문서 부재(architecture §13 은 15 Phase 명시했으나
`details/phase-15-*.md` 미존재)로 전 Phase 의 "Phase 15 인계" 항목이 무주공산이던
로드맵 결함을 해소하기 위해, 감사 결과를 단일 v1 릴리스 게이트로 통합 작성._
