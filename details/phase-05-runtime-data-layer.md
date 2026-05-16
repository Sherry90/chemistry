# Phase 05 — Runtime Data Layer (PubChem)

> 이 문서는 `architecture.md` §13 **Phase 05** 의 상세 설계서이다. Phase 01(공용 타입·`Result`·logger), Phase 03(브라우저 RDKit 서비스·`RdkitBackend` 인터페이스), Phase 04(빌드타임 매니페스트·청크·`Compound` 확장 필드) 의 산출물을 전제로 한다.
>
> 본 문서는 **설계 기술**이다. 실제 PubChem 런타임 호출·IndexedDB 어댑터·서비스 코드는 모든 details 승인 후 작성한다.

---

## 1. 목적 (Purpose)

`architecture.md` §5.2 가 정의한 **"번들 내 화합물 부족 시 `services/pubchem` 이 PubChem API 호출 → IndexedDB 캐시에 저장"** 경로를 상세 설계한다. Phase 04 가 빌드타임에 약 2500 종의 큐레이션 매니페스트를 구축했으므로, 본 Phase 의 책임은 **매니페스트 miss 가 발생한 사용자 쿼리(이름·CID·InChIKey) 의 런타임 폴백** 과 그 결과의 **세션 간 영속 캐시** 이다.

이 Phase 가 끝나면:

- 사용자가 매니페스트에 없는 화합물을 입력했을 때 PubChem PUG REST 가 호출되어 `Compound` 가 반환된다.
- 반환된 `Compound` 는 IndexedDB 에 영속되어 차후 동일 CID 조회는 네트워크를 거치지 않는다.
- **불변식**: 매니페스트에 있는 CID 는 런타임에서 PubChem 을 호출하지 않는다 (D10).
- 모든 공개 API 가 `AbortSignal` 을 첫 파라미터부터 수용한다.
- `architecture.md` §3.7 이 본 Phase 에 위임한 **재시도 정책 (지수 백오프 등)** 이 명시적으로 결정된다.
- Phase 04 의 정규화 로직(`normalize`) 이 빌드타임/런타임 공용 모듈 `src/engine/pubchem/normalize.ts` 로 승격되어 동일 CID 가 어느 경로에서든 동일한 `Compound` 로 해석된다 (드리프트 방지).

---

## 2. 범위 (Scope)

### 2.1 포함

- **PubChem 런타임 클라이언트** (`src/services/pubchem/`):
  - 토큰 버킷 기반 rate-limited fetch (브라우저 한 탭 내 공용)
  - 지수 백오프 재시도 + `Retry-After` 존중
  - 개별 요청 타임아웃 (10 s)
  - `AbortSignal` 전파 (사용자 signal + timeout signal 결합)
  - 엔드포인트 래퍼: CID/이름/InChIKey 진입, 속성 배치, 3D SDF
  - `zod` 기반 응답 스키마 검증 (런타임 boundary)
- **공용 정규화 모듈** (`src/engine/pubchem/normalize.ts`, D1):
  - PubChem 응답 + SDF → `Compound` 매핑
  - 빌드타임(Phase 04 `scripts/pubchem-fetch/`) 과 런타임(Phase 05 `services/pubchem/`) 이 공동 import
  - `RdkitBackend` (Phase 03 §6.8) 주입형 — 브라우저/Node 양 환경에서 동작
- **IndexedDB 캐시 어댑터** (`src/services/cache/`):
  - `idb` 기반 DB 오픈·업그레이드 콜백 체인
  - Compound 전용 store + secondary index (`by-inchi-key`, `by-last-accessed`)
  - LRU 제거, TTL 만료, schemaVersion 기반 무효화
  - 트랜잭션 원자성 보장
  - `onBlocking`/`onBlocked` 콜백을 통한 다탭 충돌 통보
- **에러 판별 유니온** (`src/services/pubchem/errors.ts`):
  - `PubChemError = Network | HttpStatus | Schema | Timeout | RateLimited | NotFound | RdkitFailed | Aborted`
- **In-flight 중복 요청 dedup**:
  - 동일 CID 동시 호출 시 단일 fetch 공유
- **공개 서비스 API**:
  - `getCompoundByCid` / `getCompoundByInchiKey` / `resolveCompoundByName`
- **공용 정규화의 Phase 04 retrofit** (D1, §6.8):
  - Phase 04 구현 시점에 import 경로가 본 Phase 가 정한 위치를 따른다.

### 2.2 비포함 (다른 Phase / 비목표)

| 항목                                                    | 이관 대상                                              |
| ------------------------------------------------------- | ------------------------------------------------------ |
| 매니페스트 자체 (정적 데이터·청크 로더)                 | Phase 04 (`data/compounds/index.ts`)                   |
| 화합물 검색 UI / 자동완성                               | Phase 11 (CompoundBrowser 패널)                        |
| moleculeStore 의 `loadCompound` 액션                    | Phase 07 (Stores)                                      |
| UI 로딩 스피너 / 에러 toast 문구                        | Phase 07 + Phase 11                                    |
| 반응 규칙 런타임 로드                                   | Phase 06 (Reaction Engine)                             |
| 사용자 편집 분자 / 세션 영속화                          | Phase 07 / Phase 13 (Export)                           |
| 풀 PWA / Service Worker 오프라인 모드                   | 비목표 (캐시 읽기가 오프라인에서 동작하는 것만 보장)   |
| BroadcastChannel 기반 다탭 공유 rate limit              | Phase 14 (계측 후 필요성 결정)                         |
| 캐시 강제 새로고침 / 매니페스트 우회 API                | 비목표 (D10 불변식 위반)                               |
| PubChem PUG View Section 파싱 (녹는점 등 물성 스크래핑) | 비목표 — Phase 04 와 동일하게 런타임에서는 물성 미수집 |
| Service Worker 캐시 / HTTP 캐시 헤더 활용               | 비목표 — IndexedDB 가 단일 캐시 계층                   |

---

## 3. 의존성 (Dependencies)

### 3.1 선행 Phase

- **Phase 01** — `Result<T, E>`, `ok` / `err` 헬퍼, `Compound` 기본 타입(Phase 04 가 확장), `Atom` / `Bond` / `Molecule`, `logger`
- **Phase 03** — 브라우저 `getRdkit()` 및 `RdkitBackend` 인터페이스 (§6.8). 사용 메서드: `RdkitBackend.parseSmiles`, `RdkitBackend.toCanonical`, `RdkitBackend.embed`, `RdkitBackend.parseSdfBlock`. 본 Phase 는 개별 함수를 직접 호출하지 않고 **`RdkitBackend` 인터페이스를 통해서만** 호출한다 (D1 공용화 전제).
- **Phase 04** — `Compound` 확장 필드 (`category`, `priority`, `properties`, `coordinateSource`, `synonyms`, `inchiKey`, `iupacName`), `CompoundCategory` 유니온, `CompoundProperties` 타입. 매니페스트 진입 함수 `findCompoundByCid`, `findCompoundByInchiKey`, `searchCompoundManifest`.

### 3.2 외부 라이브러리

| 라이브러리                                                                   | 용도                                                                                                                                                                                                                                                                                                                                                                                                                   | 라이선스 / 비고 |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| **`idb`**                                                                    | IndexedDB 의 Promise/타입 친화 래퍼. architecture §2 가 권장.                                                                                                                                                                                                                                                                                                                                                          | ISC             |
| **`zod`**                                                                    | PubChem 응답 스키마 검증. **Phase 04 §3.2 에서 "빌드타임 전용" 으로 도입된 것을 본 Phase 가 "런타임까지 확장"** 한다. 번들 영향 ~12 KB gzip (초기 번들 500 KB 예산의 2.4%). 수동 type guard 대비 단일 스키마 소스화 + 명확한 에러 issue 트리가 D6 의 `Schema` variant 와 직접 결합되는 이득이 더 크다. architecture §2 의 "스택 외 라이브러리는 각 Phase 상세 설계에서 근거와 함께 명시" 규칙에 따른 명시적 범위 확장. | MIT             |
| 브라우저 내장 `fetch` / `AbortController` / `AbortSignal.any` / `setTimeout` | HTTP 클라이언트 + 개별 요청 타임아웃 결합. 추가 의존성 없음.                                                                                                                                                                                                                                                                                                                                                           | —               |
| **테스트 한정** — `msw`, `fake-indexeddb`                                    | 유닛 테스트 (mock PubChem, in-memory IDB)                                                                                                                                                                                                                                                                                                                                                                              | MIT             |

> Phase 04 의 빌드타임 zod 사용과 **동일 버전을 고정**한다. 런타임 zod 가 빌드타임보다 새로운 버전을 사용하면 동일 스키마 코드가 환경별로 다른 동작을 보일 위험이 있다.

### 3.3 결정 필요 사항 (사용자 확인)

| #       | 결정                                                                                                                         | 기본안                                                                                                                                                                                                                                                                                                                                                                                |
| ------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1**  | **`normalize()` 소재** — PubChem 응답 → `Compound` 매핑 로직을 빌드타임(Phase 04) 과 런타임(Phase 05) 에서 어떻게 공유하는가 | **(A) 공용 추출**: `src/engine/pubchem/normalize.ts` 로 승격. Phase 04 스크립트와 Phase 05 서비스가 공동 import. 대안 (B) 중복 구현은 동일 CID 가 환경별로 다른 `Compound` 로 해석되는 드리프트 위험을 남기므로 비채택. Phase 04 의 `RdkitBackend` 패턴(§6.4/§6.8) 이 이미 "환경 추상화 + 공용 로직" 경로를 확립했음                                                                  |
| **D2**  | **캐시 저장 단위** — 정규화된 `Compound` vs 원시 PubChem JSON                                                                | **정규화된 `Compound` + `schemaVersion: number`**. 읽기 시 현재 버전과 불일치면 stale → 재호출. 빠른 읽기 + normalize 변경 시 선택적 무효화 가능                                                                                                                                                                                                                                      |
| **D3**  | **동시성 범위** — 탭별 토큰 버킷 vs BroadcastChannel 공유                                                                    | **탭별 per-tab 버킷**. 용량 5, 리필률 4 tokens/sec (Phase 04 D7 과 동일 안전여유). 다탭 충돌은 PubChem 측 429 재시도로 흡수. 공유 버킷은 Phase 14 로 이관                                                                                                                                                                                                                             |
| **D4**  | **TTL / 캐시 용량**                                                                                                          | **TTL 90일, 기본 상한 1000 엔트리**. 초과 시 LRU 로 가장 오래된 것부터 제거. PubChem 레코드는 거의 불변이므로 보수적 TTL. Phase 14 에서 계측 후 조정                                                                                                                                                                                                                                  |
| **D5**  | **캐시 키 스페이스**                                                                                                         | `cid` 가 **primary key (keyPath: `value.cid`)**, `inchiKey` 가 **secondary index (`by-inchi-key`, unique)**, `lastAccessedAt` 가 **LRU 정렬 인덱스 (`by-last-accessed`)**. 이름 쿼리는 "name → cid 해소 → cid 조회" 의 2단계로 처리                                                                                                                                                   |
| **D6**  | **에러 분류 (architecture §3.7 요구)**                                                                                       | 판별 유니온 `PubChemError = Network \| HttpStatus \| Schema \| Timeout \| RateLimited \| NotFound \| RdkitFailed \| Aborted`. `NotFound` 는 **HTTP 404** 와 **HTTP 200 + `{ Fault: { Code: "PUGREST.NotFound" } }`** 두 패턴을 단일 variant 로 정규화                                                                                                                                 |
| **D7**  | **재시도 정책 (architecture §3.7 Phase 05 지정)**                                                                            | **지수 백오프**: 1 s → 2 s → 4 s (각 ±20% jitter), 최대 3회 재시도, 개별 요청 타임아웃 10 s. 재시도 대상: `Network`, `Timeout`, `RateLimited(429, Retry-After 존중)`, `HttpStatus` 의 **5xx 전체**(502/503/504). 즉시 실패: `NotFound`, `Schema`, 그 외 4xx, `Aborted`. 전체 최악 시나리오: 초기 1회 + 재시도 3회 = `10 s × 4 + backoff (1+2+4) = 47 s` 상한 (§6.3 와 일치)           |
| **D8**  | **첫 요청에서 RDKit lazy init**                                                                                              | 서비스 공개 API 는 **RDKit init 대기를 포함한 단일 Promise** 로 노출. 서비스가 `readiness.rdkitLoading` 관찰용 훅을 제공하여 Phase 07 스토어 / Phase 11 UI 가 스피너 표시 가능                                                                                                                                                                                                        |
| **D9**  | **AbortSignal 지원**                                                                                                         | **모든 서비스 공개 API 가 `opts: { signal?: AbortSignal }` 를 첫 도입부터 수용**. abort 시 in-flight fetch 취소 + 캐시 쓰기 스킵 (atomic — 일부 쓰기 금지). RDKit WASM 작업은 중간 취소 불가 — §6.4 의 제약사항으로 명시                                                                                                                                                              |
| **D10** | **`CID in manifest` 불변식**                                                                                                 | **`getCompoundByCid(cid)` 와 `getCompoundByInchiKey(key)` 는 매니페스트 hit 시 PubChem 호출 금지**. **`resolveCompoundByName(name)` 은 매니페스트 `searchCompoundManifest` miss 시 PubChem `name→cid` 호출 — 본 불변식의 예외**. 매니페스트가 정답(authoritative) 인 이유는 Phase 04 가 큐레이팅한 우선순위·이름·청크 분배가 런타임 조회로 오버라이드되면 결정성 보장이 무너지기 때문 |
| **D11** | **IndexedDB 스키마 버전 / 업그레이드 계약**                                                                                  | `DB_NAME: 'chemistry-app'`, **`DB_VERSION: 1`**. `idb.openDB` 의 `upgrade(db, oldVersion, newVersion, tx)` 콜백에서 `switch (oldVersion)` 로 v0→v1, v1→v2, ... 순차 마이그레이션. 본 Phase 는 v0→v1 경로(`compounds` store + 2개 인덱스 생성) 만 구현. 후속 Phase(반응 히스토리 등) 가 store 추가 시 v2, v3 으로 올린다                                                               |

본 문서 승인 시 기본안 채택. 수정·반대 의견은 §11 열린 질문에서 제기.

---

## 4. 데이터 모델 / 타입

### 4.1 캐시 레코드

```ts
// src/services/cache/schema.ts

import type { Compound } from '@/chemistry/compounds/types';

/** normalize 로직 변경 시 수동 bump (§6.5). 1 부터 시작. */
export const NORMALIZE_SCHEMA_VERSION = 1 as const;

export interface CacheRecord<T> {
  readonly value: T;
  /** epoch ms — 캐시 진입 시각. TTL 비교 용 */
  readonly cachedAt: number;
  /** 마지막 read 시각. LRU 인덱스 키. */
  readonly lastAccessedAt: number;
  /** 정규화 스키마 버전. 불일치 시 stale 취급 */
  readonly schemaVersion: number;
}

export type CachedCompound = CacheRecord<Compound>;
```

### 4.2 IndexedDB 스키마 (v1)

```ts
// src/services/cache/schema.ts (cont'd)

import type { DBSchema } from 'idb';

export interface AppDbSchema extends DBSchema {
  compounds: {
    /** keyPath: 'value.cid' — 본 Phase 가 캐시하는 모든 엔트리는 cid 가 존재 */
    key: number;
    value: CachedCompound;
    indexes: {
      /** unique. InChIKey 진입 시 O(1) 역조회 */
      'by-inchi-key': string;
      /** non-unique. LRU 제거를 위한 정렬 키 */
      'by-last-accessed': number;
    };
  };
  // 후속 Phase 가 추가할 store 들은 v2, v3 으로 올리며 이 인터페이스에 확장 필드로 추가.
}

export const DB_NAME = 'chemistry-app';
export const DB_VERSION = 1;
```

> `compounds` store 는 `keyPath: 'value.cid'` 로 설정. 본 Phase 가 캐시에 쓰는 `Compound` 는 **반드시 `cid !== null`** 이며, `null cid` 인 사용자 생성 분자(Phase 07) 는 본 캐시에 진입하지 않는다. `value.inchiKey` 가 `null` 인 화합물은 `by-inchi-key` 인덱스에서 제외된다 (idb 의 nullable index 동작 — `unique` 제약은 비-null 키에만 적용).

### 4.3 에러 판별 유니온 (D6)

```ts
// src/services/pubchem/errors.ts

import type { ZodIssue } from 'zod';

export type PubChemError =
  | { readonly kind: 'Network'; readonly cause: string; readonly retryable: true }
  | { readonly kind: 'Timeout'; readonly elapsedMs: number; readonly retryable: true }
  | { readonly kind: 'RateLimited'; readonly retryAfterMs: number | null; readonly retryable: true }
  | {
      readonly kind: 'HttpStatus';
      readonly status: number;
      readonly bodyExcerpt: string | null;
      readonly retryable: boolean;
    }
  | { readonly kind: 'Schema'; readonly issues: ReadonlyArray<ZodIssue>; readonly retryable: false }
  | {
      readonly kind: 'NotFound';
      readonly query: {
        readonly type: 'cid' | 'name' | 'inchiKey';
        readonly value: string | number;
      };
      readonly retryable: false;
    }
  | { readonly kind: 'RdkitFailed'; readonly reason: string; readonly retryable: false }
  | { readonly kind: 'Aborted'; readonly retryable: false };
```

- `retryable` 은 **상위 레이어가 에러를 받은 시점에 재시도 버튼을 노출할지의 힌트**. 서비스 내부의 자동 재시도(§6.3) 는 이 필드와 독립적으로 D7 의 정책 표를 따른다.
- `HttpStatus.retryable` 은 `status >= 500 || status === 429` 인 경우 `true`. 4xx 일반은 `false`.
- `RateLimited.retryAfterMs` 는 `Retry-After` 헤더(초 단위) 를 ms 로 변환 후 60 s 로 클램프한 값. 헤더 부재 시 `null` — 이때 백오프 곡선 그대로 사용. 헤더 존재 시 §6.3 의 우선순위 정책에 따라 _첫 재시도_ delay 가 이 값과 정확히 같음.

### 4.4 서비스 입출력 타입

```ts
// src/services/pubchem/types.ts

import type { Compound } from '@/chemistry/compounds/types';
import type { Result } from '@/types/result';
import type { PubChemError } from './errors';

export interface LookupOptions {
  readonly signal?: AbortSignal;
  // 의도적으로 force-refresh / bypass-manifest 옵션 부재 (D10 불변식)
}

export type LookupResult = Result<Compound, PubChemError>;
```

### 4.5 Readiness 옵저버 (D8)

```ts
// src/services/pubchem/readiness.ts

export interface ReadinessSnapshot {
  /** RDKit WASM 이 현재 로드 중인지 */
  readonly rdkitLoading: boolean;
  /** 현재 in-flight PubChem 요청 수 */
  readonly inflightRequests: number;
}

export type ReadinessListener = (snap: ReadinessSnapshot) => void;

export function subscribeReadiness(listener: ReadinessListener): () => void;
export function getReadinessSnapshot(): ReadinessSnapshot;
```

- 옵저버 패턴 (subscribe → unsubscribe). UI 계층(Phase 07/11) 이 React Hook 으로 래핑.

---

## 5. 퍼블릭 API / 인터페이스

`src/services/pubchem/index.ts` 와 `src/services/cache/index.ts` 가 유일한 외부 경계. 그 외 파일(`client.ts`, `endpoints.ts`, `db.ts` 등) 은 ESLint `no-restricted-imports` 로 외부 import 차단.

### 5.1 PubChem 서비스 (`src/services/pubchem/index.ts`)

```ts
import type { Compound } from '@/chemistry/compounds/types';
import type { LookupOptions, LookupResult } from './types';
export type { PubChemError } from './errors';
export { subscribeReadiness, getReadinessSnapshot } from './readiness';

/**
 * CID 로 화합물 조회. 매니페스트 → 캐시 → 네트워크 순.
 * 매니페스트에 있으면 PubChem 호출 절대 없음 (D10).
 */
export function getCompoundByCid(cid: number, opts?: LookupOptions): Promise<LookupResult>;

/**
 * InChIKey 로 화합물 조회. 매니페스트 by-inchi-key 인덱스 → 캐시 → 네트워크.
 */
export function getCompoundByInchiKey(
  inchiKey: string,
  opts?: LookupOptions,
): Promise<LookupResult>;

/**
 * 이름으로 화합물 조회. 매니페스트 검색 토큰 → (miss 시) PubChem name→cid →
 * getCompoundByCid 위임. 다중 CID 반환 시 첫 번째 채택 + warning 로그 (R8).
 */
export function resolveCompoundByName(name: string, opts?: LookupOptions): Promise<LookupResult>;
```

> 세 함수 모두 **항상 `Promise<LookupResult>`** 를 반환한다. throw 는 프로그래밍 오류(불변식 위반: 예 — 음수 CID 입력) 한정이며, 외부 실패는 모두 `Result.err` 로 표현된다 (architecture §3.7).

### 5.2 캐시 서비스 (`src/services/cache/index.ts`)

```ts
import type { IDBPDatabase } from 'idb';
import type { Compound } from '@/chemistry/compounds/types';
import type { AppDbSchema } from './schema';

export interface OpenDbOptions {
  /**
   * 다른 탭이 이전 버전 DB 를 점유해 본 탭의 업그레이드가 블로킹될 때 호출.
   * Phase 11 (UI) 가 toast 로 "다른 탭을 닫아주세요" 를 표시하는 브리지 지점.
   * 콜백 인자는 없으며, 호출 자체가 이벤트.
   *
   * **lifecycle**: 본 탭이 `idb.openDB(name, NEW_VERSION)` 을 호출 → 다른 탭이 OLD_VERSION 의
   * IDBDatabase 를 점유 중이라면 IndexedDB 트랜잭션 매니저가 본 탭의 upgrade 트랜잭션을 *대기* 시키고
   * 본 콜백을 발화. 콜백 발화 시점부터 다른 탭이 자신의 connection 을 close 할 때까지 본 탭의
   * `openDB` Promise 는 pending. 권장 UI 응답: i18n key `error.idb.blocking` ("다른 탭에서 화학
   * 시뮬레이션 플랫폼을 사용 중입니다. 그 탭을 닫으시면 자동으로 진행됩니다") + 재시도 버튼.
   */
  readonly onBlocking?: () => void;
  /**
   * 본 탭이 이미 열어둔 DB 가 다른 탭의 새 버전 열림을 차단하고 있을 때 호출.
   * UI 가 "이 탭을 새로고침해 주세요" 를 안내한다.
   *
   * **lifecycle**: 본 탭이 OLD_VERSION 으로 DB 를 열어둔 상태에서, 다른 탭이 NEW_VERSION 으로
   * `openDB` 시도 → 다른 탭의 호출이 본 탭의 connection 으로 인해 blocked 되어 있음을 본 탭의
   * `versionchange` 이벤트로 알림. 이때 본 콜백 발화. 본 탭이 connection 을 close 하면 다른 탭의
   * upgrade 가 진행. 권장 UI 응답: i18n key `error.idb.blocked` ("새 버전이 설치되었습니다. 이 탭을
   * 새로고침해 주세요") + 재로드 버튼 (`window.location.reload()`).
   *
   * **두 콜백의 구분 요약**:
   *   - `onBlocking`: 내가 *원하는* 새 버전 열림이 *남이 가진* 옛 버전에 막힘 → "남에게 양보 요청".
   *   - `onBlocked`: 내가 *가진* 옛 버전이 *남의* 새 버전 열림을 막고 있음 → "내가 양보해야 함".
   */
  readonly onBlocked?: () => void;
}

export function openAppDb(opts?: OpenDbOptions): Promise<IDBPDatabase<AppDbSchema>>;

export interface CompoundCache {
  get(cid: number): Promise<Compound | null>;
  getByInchiKey(key: string): Promise<Compound | null>;
  /** Compound 를 캐시에 기록. 기존 엔트리는 덮어쓴다. evictLru 는 호출자가 별도 호출. */
  put(compound: Compound): Promise<void>;
  /** lastAccessedAt 갱신. LRU 정렬 갱신 용. */
  touch(cid: number): Promise<void>;
  /** maxEntries 초과분을 가장 오래된 lastAccessedAt 부터 제거. 반환: 제거 개수. */
  evictLru(maxEntries: number): Promise<number>;
  /** 사용자 설정 또는 테스트에서 호출. 모든 compound 엔트리 제거 (다른 store 영향 없음). */
  clear(): Promise<void>;
}

export const compoundCache: CompoundCache;
```

- `openAppDb` 는 **싱글톤** 으로 동작 — 두 번째 호출은 첫 번째의 Promise 를 공유. 명시적 close 는 비목표 (탭 종료 시 브라우저가 자동 close).
- `onBlocking` / `onBlocked` 는 **services 가 DOM 에 의존하지 않고 UI 로 신호를 보내는 콜백 주입 패턴**. architecture §4.1 의 "services → UI 방향 import 금지" 규칙은 import 방향에 대한 것이며, 콜백 주입은 호출 방향이 정상(UI → services 이 콜백을 등록) 이므로 위반 아님.

### 5.3 공용 정규화 (`src/engine/pubchem/normalize.ts`, D1)

```ts
import type { Compound } from '@/chemistry/compounds/types';
import type { Result } from '@/types/result';
import type { RdkitBackend } from '@/engine/rdkit/backend'; // Phase 03 §6.8

export const NORMALIZE_SCHEMA_VERSION = 1 as const;

export interface PubChemPropertyRow {
  readonly CID: number;
  readonly MolecularFormula: string;
  readonly MolecularWeight: string | number;
  readonly CanonicalSMILES?: string;
  readonly IsomericSMILES?: string;
  readonly InChI?: string;
  readonly InChIKey?: string;
  readonly IUPACName?: string;
  readonly XLogP?: number | string;
  readonly Complexity?: number | string;
}

export type NormalizeError =
  | { readonly kind: 'SmilesParseFailed'; readonly cid: number; readonly detail: string }
  | { readonly kind: 'EmbedFailed'; readonly cid: number; readonly detail: string }
  | { readonly kind: 'SdfParseFailed'; readonly cid: number; readonly detail: string }
  | { readonly kind: 'MissingRequiredField'; readonly cid: number; readonly field: string };

export interface NormalizeOptions {
  readonly rdkit: RdkitBackend;
  /** Phase 04 빌드타임은 false (수동 큐레이션 ko-names 등을 후처리에서 적용),
   *  Phase 05 런타임은 true (즉시 사용 가능한 Compound 반환). */
  readonly fillRuntimeDefaults: boolean;
}

/**
 * PubChem 속성 응답 + (선택) 3D SDF 블록 → Compound.
 * 빌드타임/런타임 공용. RdkitBackend 주입을 통해 환경 독립.
 */
export function normalizePubChemResponse(
  row: PubChemPropertyRow,
  sdf: string | null,
  opts: NormalizeOptions,
): Result<Compound, NormalizeError>;
```

- `fillRuntimeDefaults: true` 일 때:
  - **`provenance: 'runtime-fetch'`** — 런타임 PubChem fetch 결과임을 나타내는 **명시적 판별 필드** (Phase 01 `CompoundProvenance`). UI(Phase 11) 는 이 필드로 "런타임 조회된 분자" 를 식별한다 (category/priority placeholder 패턴 추론 금지).
  - `category: 'inorganic-common'` (표시용 기본값일 뿐 판별 용도 아님 — 실제 무기물과 구분은 `provenance` 로)
  - `priority: 9999` (낮은 우선순위 — 검색 시 매니페스트 엔트리보다 뒤로)
  - `properties.{meltingPointK, boilingPointK, densityGPerCm3, logP}: null`
  - `properties.standardState: 'unknown'`, `properties.waterSolubility: 'unknown'`
  - `synonyms: []` (런타임에서는 별도 fetch 비용 회피, 필요 시 §11 Q4 결정에 따라 확장)
  - `defaultMolecule`: 직렬화 인덱스 형태를 Phase 01 `indexToId` 로 복원, `Molecule.id` 는 `moleculeIdForCid(cid)` (Phase 04 §4.4 와 동일 규약)
- `fillRuntimeDefaults: false` (Phase 04 빌드타임) 일 때는 `provenance: 'manifest'`.
- `fillRuntimeDefaults: false` 일 때 (Phase 04 빌드타임):
  - 위 필드들은 `null` / undefined 로 두어, 후처리 단계 (`assignPriorityAndCategory`, `applyKoreanNames`, `physical/curated.tsv` 머지) 에서 채움.

---

## 6. 핵심 로직 / 전략

### 6.1 조회 흐름 — CID 진입

```
getCompoundByCid(cid)
  │
  ▼ [manifest lookup — Phase 04 findCompoundByCid(cid)]
  ├── hit → return Compound  (네트워크 금지, D10)
  ▼ miss
  ▼ [in-flight dedup map check]
  ├── 기존 Promise 있음 → 같은 Promise 공유 반환
  ▼
  [cache.get(cid) — IndexedDB by primary key]
  ├── hit + schemaVersion match + cachedAt 90일 이내 → cache.touch(cid) → return Compound
  ├── hit + schemaVersion mismatch OR TTL 만료 → stale, 네트워크로 진행
  ▼ cache miss / stale
  │
  ▼ [token bucket await]
  ▼ [parallel fetch — combined AbortSignal]
  │   ├── GET /compound/cid/{cid}/property/...   (10 s timeout)
  │   └── GET /compound/cid/{cid}/SDF?record_type=3d  (10 s timeout, 404 허용)
  ▼
  [zod schema validation on property response]
  ├── 실패 → PubChemError('Schema', issues)
  ▼
  [engine/pubchem/normalize(row, sdf, { rdkit, fillRuntimeDefaults: true })]
  ├── SmilesParseFailed → PubChemError('RdkitFailed', detail)
  ├── EmbedFailed       → PubChemError('RdkitFailed', detail)
  ▼
  [signal.aborted 확인]
  ├── true → PubChemError('Aborted'), 캐시 쓰기 스킵
  ▼
  [cache.put(compound) — readwrite tx 내에서 evictLru(D4 상한) 동시 수행]
  ▼
  return Compound
```

### 6.1.1 변형 플로우 — Name 진입 (D10 예외 경로)

```
resolveCompoundByName(name)
  │
  ▼ [normalize: trim, NFC, 좌우 공백 제거]
  ▼ [manifest.searchCompoundManifest({ query, limit: 1 }) — Phase 04 §5.3]
  ├── 최상위 결과의 점수 ≥ 60 (토큰 접두 일치 이상) → 해당 cid 채택
  │     → getCompoundByCid(cid) 위임 — D10 불변식 안에서 처리
  ▼ 매니페스트 miss 또는 점수 < 60
  ▼ [cache 검색 — name 인덱스 없으므로 SKIP, 직접 PubChem 진입]
  ▼ [GET /compound/name/{name}/cids/JSON]
  ├── HTTP 404 → PubChemError('NotFound', { type: 'name', value: name })
  ├── 200 + Fault.Code === 'PUGREST.NotFound' → 동상
  ├── 200 + IdentifierList.CID = [c1, c2, ...] → 첫 번째 c1 채택, len > 1 이면 logger.warn (R8)
  ▼
  getCompoundByCid(c1, opts) — 이후는 CID 플로우
```

### 6.1.2 변형 플로우 — InChIKey 진입

```
getCompoundByInchiKey(key)
  │
  ▼ [정규화: 대문자, 27자 형식 검증]
  ├── 형식 위반 → PubChemError('NotFound', { type: 'inchiKey', value: key })
  ▼ [manifest.findCompoundByInchiKey(key) — Phase 04 §5.2]
  ├── hit → return Compound (D10)
  ▼ miss
  ▼ [cache.getByInchiKey(key) — by-inchi-key index]
  ├── hit + 유효 → cache.touch(cid) → return Compound
  ▼ miss
  ▼ [GET /compound/inchikey/{key}/cids/JSON]
  ├── 404 / Fault → PubChemError('NotFound', ...)
  ▼ getCompoundByCid(c1, opts) — CID 플로우
```

### 6.2 Rate limit (D3)

- **토큰 버킷 (탭별)**:
  - 용량: 5
  - 리필률: 4 tokens / sec (즉, ~250 ms 마다 +1, 최대 5 까지 누적)
  - 모든 PubChem HTTP 호출이 **요청 직전 1 토큰 소비**
  - 토큰 부족 시 `await` 로 대기 (대기 큐는 FIFO)
- **캐시 히트 / 매니페스트 히트는 토큰 비소비** (네트워크 미발생).
- **AbortSignal 처리**: 대기 큐에서 abort 발생 시 큐에서 제거 + 즉시 `Aborted` variant 반환.
- 다탭 간 공유는 비목표 (D3). 다탭이 동시에 PubChem 을 두드리면 5+5 토큰이지만 PubChem 은 IP 기준으로 5 req/s 이므로 일부 호출이 429 를 받게 되며, 본 Phase 의 재시도 정책 (D7) 이 흡수한다.

### 6.3 재시도 정책 (D7)

```
retry attempt:  0    1    2    3
delay (base):   0    1s   2s   4s
delay (jitter): 0    ±20% ±20% ±20%
```

- **`Retry-After` 헤더 우선순위**: `RateLimited (429)` 응답에 `Retry-After` 헤더가 있으면:
  - **첫 재시도**: `delay = headerValueMs` (지수 백오프 base 무시, 헤더 값 그대로 사용. 서버가 명시적으로 요청한 대기 시간을 _그대로 존중_).
  - **이후 재시도**: 헤더 값이 한 번 적용된 뒤에는 다시 받지 않는 한 표준 지수 백오프 곡선 (1s → 2s → 4s) 으로 진입. 만약 후속 응답에 또 다른 `Retry-After` 가 오면 그 시점부터 다시 헤더 값 적용.
  - 헤더 부재 시: 처음부터 표준 백오프 (1s/2s/4s).
  - 안전 가드: `headerValueMs > 60_000` 이면 `60_000` 으로 클램프 (악의적/오작동 서버로부터 보호). `RateLimited.retryAfterMs` 필드에 클램프 후 값 기록.
  - 기존 `max(headerValueMs, baseDelayMs)` 표현은 폐기 — 명시적 우선순위 (헤더 > base) 로 대체.
- 재시도 가능한 에러 종류:
  - `Network` (TCP/DNS/CORS preflight 실패)
  - `Timeout` (10 s 초과)
  - `RateLimited` (HTTP 429)
  - `HttpStatus` 의 5xx (502/503/504 포함)
- 재시도 불가:
  - `NotFound`, `Schema`, `Aborted`, `RdkitFailed`, 그 외 4xx
- 재시도 카운터는 단일 PubChem 호출 단위 — 매 endpoint 마다 독립.
- **최악 시나리오 상한**: 단일 호출 = 10 s × 4 (3 retry) + backoff (1+2+4) ≈ 47 s. 단, jitter 와 Retry-After 영향으로 변동.

### 6.4 AbortSignal 전파 (D9) 와 RDKit WASM 제약

- `LookupOptions.signal` 을 fetch 의 두 곳에 결합:
  ```ts
  const timeoutSignal = AbortSignal.timeout(10_000);
  const combined = AbortSignal.any([opts.signal, timeoutSignal].filter(Boolean));
  fetch(url, { signal: combined });
  ```
  (런타임이 `AbortSignal.any` 를 미지원하면 polyfill 또는 수동 결합 헬퍼 사용 — 구현 단계에서 브라우저 호환성 매트릭스 확인.)
- **RDKit WASM 호출 제약**: `RdkitBackend.parseSmiles` / `RdkitBackend.embed` / `RdkitBackend.toCanonical` / SDF 파서는 WASM 경계를 넘어선 동기 작업이며, **JS 표준은 WASM 함수 중간 취소를 지원하지 않는다**. 따라서:
  - 본 Phase 는 RDKit 작업을 **시작하기 전** 에 `signal.aborted` 를 확인하여 시작 자체를 스킵.
  - 이미 시작된 RDKit 작업은 **완료까지 대기**.
  - 작업 완료 후 **`cache.put` 직전** 에 다시 `signal.aborted` 확인하여 캐시 쓰기 스킵 + `Aborted` 반환.
  - architecture §3.2 "상호작용 응답 < 100 ms" 기준에 RDKit 단일 분자 처리(~수십 ms) 는 부합하므로 UX 영향 경미. 거대 분자 처리 시 지연이 체감되면 Phase 14 에서 Web Worker 분리 검토 (architecture §12 Q4).
- **In-flight dedup**: `Map<number /* cid */, Promise<LookupResult>>` 를 모듈 스코프에 보관.
  - `getCompoundByCid(cid)` 진입 시 캐시 miss 가 확정된 후 맵을 확인. 기존 Promise 가 있으면 그것을 공유.
  - 첫 호출자가 abort 되어도 다른 대기자들의 signal 이 살아있으면 fetch/RDKit 경로는 **계속 진행** (이미 토큰 소비됨).
  - 모든 대기자가 abort 되면 fetch 자체는 진행 중 단계라면 abort 시도. 이미 RDKit 단계라면 완료 후 캐시 쓰기는 진행하되 (다른 호출자에게 이득), 각 호출은 자신의 signal 기준으로 `Aborted` 반환.
  - Promise 완료(성공/실패) 시 dedup 맵에서 해당 cid 엔트리 제거.

### 6.5 캐시 쓰기 원자성 및 `schemaVersion` 관리

- IndexedDB `readwrite` 트랜잭션 단위:
  ```ts
  const tx = db.transaction('compounds', 'readwrite');
  await tx.store.put(record);
  if (countAfterPut > maxEntries) {
    // by-last-accessed 인덱스 cursor 로 가장 오래된 N 개 삭제
  }
  await tx.done;
  ```
- 트랜잭션 내 부분 실패는 IDB 가 자동 롤백 → 다음 조회 시 재시도 흐름 진입.
- **`schemaVersion` 증분 규칙**:
  - `engine/pubchem/normalize` 의 **시그니처 또는 매핑 동작이 변경되는 PR** 에서 `NORMALIZE_SCHEMA_VERSION` 상수를 수동으로 +1.
  - 자동 감지가 불가능하므로, **테스트에서 normalize 입출력 스냅샷이 깨질 때 동일 PR 에 상수 bump 가 포함되어 있어야 그린** 인 안전장치(`tests/unit/engine/pubchem/normalize-snapshot.test.ts`) 를 둔다. 스냅샷 갱신만 하고 상수를 올리지 않으면 별도 가드 테스트(`schemaVersion-guard.test.ts`) 가 실패.
  - 캐시 read 경로: `record.schemaVersion !== NORMALIZE_SCHEMA_VERSION` 이면 stale → `null` 반환 → 상위 로직이 네트워크 fetch 진입.

### 6.6 LRU 제거 알고리즘

- `compounds.put(record)` 후 `compounds.count()` 가 D4 상한(1000) 을 초과하면 즉시 같은 트랜잭션 내에서 `evictLru(maxEntries)` 호출.
- `evictLru(maxEntries)`:
  1. `by-last-accessed` 인덱스에서 오름차순 cursor 열기.
  2. 현재 `count - maxEntries` 만큼 cursor 의 primary key 를 수집.
  3. `compounds.delete(...)` 일괄 실행.
- `lastAccessedAt` 갱신은 `get` 성공 시 `touch(cid)` 가 별도 트랜잭션으로 수행 (write 트랜잭션 비용을 매 read 마다 부담하지 않으려면 디바운스 또는 in-memory hint 도 가능 — 기본안은 즉시 갱신, Phase 14 계측 후 조정).

### 6.7 브라우저 RDKit 경로 (D8)

- 매니페스트 hit 경로는 **RDKit 불요** (이미 청크 JSON 에 canonical SMILES + 3D 좌표 포함, Phase 04 §4.4).
- 캐시 hit 경로도 **RDKit 불요** (이미 정규화된 `Compound` 가 직렬화되어 있음).
- 네트워크 fetch 경로에서만 `getRdkit()` 호출 (Phase 03 의 브라우저 lazy init).
- **로딩 신호**:
  - `readiness.rdkitLoading: boolean` 을 RDKit init Promise 의 시작/완료에 맞춰 토글.
  - `readiness.inflightRequests: number` 은 fetch 호출 시작 시 +1, 완료 시 -1.
  - Phase 07 스토어 / Phase 11 UI 가 `subscribeReadiness` 로 구독하여 스피너·진행 표시.
- 테스트에서는 `RdkitBackend` mock 주입으로 RDKit 의존 없이 normalize 단독 테스트 가능.

### 6.8 D1 normalize 추출 — Phase 04 retrofit

- **이동 대상**: Phase 04 §6.1 의 `scripts/pubchem-fetch/normalize.ts` 모듈 → `src/engine/pubchem/normalize.ts`.
- **변경 내용 (의미 보존, 순수 위치/주입 형태 변경)**:
  1. `RdkitBackend` 의존을 함수 인자(`opts.rdkit`) 로 명시 — Phase 04 의 Node 구현은 `NodeRdkitBackend` 주입, Phase 05 의 브라우저는 Phase 03 기본 백엔드 주입.
  2. `fillRuntimeDefaults: boolean` 분기 추가 (§5.3 참고) — Phase 04 빌드타임은 `false`, Phase 05 런타임은 `true`.
  3. `NORMALIZE_SCHEMA_VERSION` 상수 export.
- **호출자 측 변경**:
  - Phase 04 `scripts/pubchem-fetch/index.ts` 가 새 경로를 import.
  - Phase 04 의 후처리 (`applyKoreanNames`, `assignPriorityAndCategory`, `physical/curated.tsv` 머지) 는 그대로 유지 — `fillRuntimeDefaults: false` 가 반환한 `null` placeholder 위에 후처리 단계가 큐레이션 데이터를 주입하는 흐름.
- **테스트 영향**: Phase 04 의 normalize 유닛 테스트(`tests/unit/scripts/pubchem-fetch/normalize.test.ts`) 가 새 모듈 경로에서 동일 케이스로 통과하는지 검증 → DoD #7.
- **타이밍**: Phase 04 가 아직 코드로 구현되지 않았으므로, 실제 retrofit 은 다음 두 시나리오 중 하나로 처리.
  - (a) Phase 04 구현 PR 이 본 Phase 보다 먼저 진행되면, Phase 04 구현자가 처음부터 `src/engine/pubchem/normalize.ts` 에 모듈을 두고 `scripts/pubchem-fetch/` 가 import 한다 (Phase 05 설계가 전제).
  - (b) Phase 05 구현 PR 이 먼저 진행되면 본 Phase 가 모듈을 신설하고 Phase 04 구현은 자연스럽게 import.
- Phase 04 문서 본문은 **수정하지 않는다** (이미 승인된 문서의 무결성 보존). 경로 계약은 본 문서 §6.8 이 단일 권위.

### 6.8.1 PubChem 엔드포인트 계약 (런타임 축약본, Phase 04 §6.3 과 정합)

| 용도           | 엔드포인트                                                                                                                                        | 응답 형식                                                                        | 재시도 / 특이 처리                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 속성 배치      | `GET /compound/cid/{cid}/property/MolecularFormula,MolecularWeight,CanonicalSMILES,IsomericSMILES,InChI,InChIKey,IUPACName,XLogP,Complexity/JSON` | `{ PropertyTable: { Properties: [PubChemPropertyRow] } }`                        | 5xx / 429 재시도. 200 + `Fault.Code === 'PUGREST.NotFound'` 는 `NotFound`                                                  |
| 이름 → CID     | `GET /compound/name/{encodedName}/cids/JSON`                                                                                                      | `{ IdentifierList: { CID: [number, ...] } }` 또는 `{ Fault: { Code, Message } }` | 5xx / 429 재시도. 다중 CID 첫 번째 채택 + warn                                                                             |
| InChIKey → CID | `GET /compound/inchikey/{key}/cids/JSON`                                                                                                          | 동상                                                                             | 5xx / 429 재시도                                                                                                           |
| 3D SDF         | `GET /compound/cid/{cid}/SDF?record_type=3d`                                                                                                      | `text/plain` SDF blob 또는 HTTP 404                                              | 5xx / 429 재시도. 404 는 **재시도 없이** `coordinateSource: 'rdkit-etkdg'` 폴백 트리거 (`RdkitBackend.embed` 로 좌표 생성) |

> **물성 미수집**: Phase 04 §6.3 과 동일하게 **녹는점/끓는점/밀도/상태/용해도** 는 PubChem REST 의 단일 속성으로 제공되지 않으며, 본 Phase 도 PUG View Section 파싱을 비목표로 둔다. 런타임 fetch 로 만든 `Compound.properties` 의 해당 필드는 모두 `null`/`'unknown'`. 사용자가 매니페스트 외 화합물의 정확한 물성을 원하면 Phase 04 시드에 추가 후 재실행이 정규 경로 — UI(Phase 11) 가 이를 안내.

### 6.9 매니페스트 / 캐시 / 네트워크 의존 방향

- `services/pubchem` → `data/compounds` (Phase 04 의 `findCompoundByCid` 등) 호출. architecture §4.1 의 레이어 다이어그램에서 `services` 는 `data` 의 상위가 아니지만, Phase 04 §5 의 "data/compounds/index.ts 의 공개 API 를 호출할 수 있는 레이어는 services/_, stores/_, panels/\*, ..." 명시에 따라 정상.
- `services/pubchem` → `engine/pubchem` (정규화) → `chemistry/compounds` (타입). 모두 하위 방향이므로 다이어그램 정합.
- `services/pubchem` → `services/cache` 는 동일 레이어 내 모듈 참조 (architecture §4.1 "동일 레이어 내 모듈 간 참조 허용, 순환 의존 금지"). `services/cache` 는 `services/pubchem` 을 import 하지 않는다 — 단방향.
- `services/cache` → `idb` 외부 라이브러리. `idb` 직접 import 는 **`services/cache/` 외부에서 금지** (ESLint `no-restricted-imports`).

### 6.10 로깅

- Phase 01 `logger` 사용. 레벨 정책:
  - `debug`: 매니페스트 hit / miss, 캐시 hit / miss, 토큰 버킷 대기 시작 / 종료, in-flight dedup hit
  - `info`: 네트워크 fetch 시작 / 성공 (CID 단위), 캐시 evictLru 결과 (제거 개수)
  - `warn`: 재시도 1회 이상 발생, 다중 CID 응답 (R8), schemaVersion 불일치로 stale 판정, IDB blocked / blocking 이벤트
  - `error`: 최종 실패 (재시도 후에도 실패한 PubChemError)
- 로그 메타에 포함: `cid`, `endpoint`, `attempt`, `elapsedMs`, `errorKind`. 사용자 입력 문자열(`name`) 은 포함되지만 **개인 식별 정보가 아님** (화학 도메인 특성상 민감 문자열 부재).

---

## 7. 파일 / 모듈 레이아웃

```
src/
├── engine/
│   └── pubchem/
│       └── normalize.ts          # D1 공용 정규화 (Phase 04 와 공유)
└── services/
    ├── pubchem/
    │   ├── index.ts              # 공개 API: getCompoundByCid 등 + readiness re-export
    │   ├── client.ts             # rate-limited fetch + 재시도 + AbortSignal 결합
    │   ├── endpoints.ts          # URL 빌더, encodeURIComponent
    │   ├── schemas.ts            # zod 스키마 (PropertyTable, Fault, IdentifierList, SDF 헤더)
    │   ├── errors.ts             # PubChemError 판별 유니온 + retryable 헬퍼
    │   ├── tokenBucket.ts        # D3 탭별 토큰 버킷 (FIFO 대기 큐)
    │   ├── inflightDedup.ts      # Map<cid, Promise<LookupResult>> 캐시
    │   ├── readiness.ts          # subscribeReadiness, getReadinessSnapshot
    │   ├── types.ts              # LookupOptions, LookupResult
    │   └── __fixtures__/
    │       └── pubchem-responses/  # MSW 픽스처 (water, benzene, NaCl 등)
    └── cache/
        ├── index.ts              # 공개 API: openAppDb, compoundCache
        ├── db.ts                 # idb openDB + upgrade(v0→v1) + 싱글톤
        ├── schema.ts             # AppDbSchema, DB_NAME, DB_VERSION, CacheRecord
        ├── compoundStore.ts      # compoundCache 의 실제 구현
        └── errors.ts             # CacheError (QuotaExceeded, BlockedUpgrade 등)
```

### 7.1 레이어 가드

- `idb` 직접 import 는 **`services/cache/` 내부에서만 허용**. ESLint `no-restricted-imports` 로 다른 디렉터리에서의 `import { openDB } from 'idb'` 차단.
- `services/pubchem/`, `services/cache/` 의 비공개 모듈(`client.ts`, `db.ts` 등) 은 **각 디렉터리 외부 import 금지** — 외부는 `index.ts` 만 사용 (Phase 04 §7.1 패턴 답습).
- `engine/pubchem/normalize.ts` 는 **DOM / IndexedDB / fetch 의존 금지** — 순수 함수, Node + 브라우저 양쪽에서 동작.
- `chemistry/*` 는 `services/*`, `data/*` 모두 import 금지 (architecture §4.1 다이어그램 — chemistry 가 최하위).

### 7.2 코드 스플리팅

- `services/cache` 모듈은 `services/pubchem` 이 **dynamic import** 하여 별도 lazy chunk 로 분리. 매니페스트 hit 경로(가장 빈번) 는 IndexedDB 코드를 로드하지 않는다.
- 구현 예:
  ```ts
  // src/services/pubchem/index.ts
  let cachePromise: Promise<typeof import('@/services/cache')> | null = null;
  function getCache() {
    if (!cachePromise) cachePromise = import('@/services/cache');
    return cachePromise;
  }
  ```
- `services/pubchem` 도 자체적으로 **첫 매니페스트 miss 시점까지 lazy** — `panels/*` 가 dynamic import 로 진입 (Phase 11 책임).

---

## 8. 테스트 계획

### 8.1 유닛 — `engine/pubchem/normalize`

`tests/unit/engine/pubchem/normalize.test.ts`:

1. **Phase 04 케이스 회귀**: 물(CID 962), 벤젠(CID 241), NaCl(CID 5234) 의 PubChem 응답 픽스처 → 기존 빌드타임 결과(Phase 04 의 normalize 테스트 fixture) 와 byte-identical (단 `priority`/`category`/`name.ko` 등 후처리 필드는 미체크).
2. **`fillRuntimeDefaults: true`**: 동일 입력으로 호출 시 `provenance === 'runtime-fetch'`, `priority === 9999`, `properties.standardState === 'unknown'`. (`fillRuntimeDefaults: false` → `provenance === 'manifest'`.)
3. **SmilesParseFailed**: 의도적으로 망가진 SMILES → `Result.err('SmilesParseFailed')`.
4. **EmbedFailed**: SDF 없이 RDKit embed mock 이 reject 하는 케이스 → `EmbedFailed`.
5. **SDF 파싱**: 정상 SDF 블록 → `coordinateSource: 'pubchem-3d'`, 좌표가 SDF 와 일치 (RMSD < 1e-6).
6. **schemaVersion-guard**: normalize 의 출력 스냅샷이 변경된 PR 인데 `NORMALIZE_SCHEMA_VERSION` 이 그대로면 별도 가드 테스트 실패.

### 8.2 유닛 — `services/cache`

`tests/unit/services/cache/`:

`fake-indexeddb` 로 in-memory DB. 각 테스트 종료 시 DB 제거 (`indexedDB.deleteDatabase`).

1. **put → get round-trip**: Compound 저장 후 `cache.get(cid)` 로 동일 객체 반환 (구조적 동등).
2. **getByInchiKey 인덱스 동작**: 저장 후 `cache.getByInchiKey('XLYO...')` 가 동일 Compound.
3. **schemaVersion mismatch → null**: 직접 IDB 에 `schemaVersion: 0` 레코드 삽입 후 `cache.get(cid)` 가 `null` 반환.
4. **TTL 만료**: `cachedAt` 을 `Date.now() - 91 * 24 * 3600 * 1000` 로 직접 삽입 → `cache.get` null.
5. **LRU 제거**: 1001 개 엔트리 삽입 후 `evictLru(1000)` 호출 → 1개 제거. 가장 오래된 `lastAccessedAt` 엔트리가 제거 대상인지 검증.
6. **touch 갱신**: get 후 `lastAccessedAt` 이 갱신되어 LRU 순서가 바뀌는지.
7. **upgrade idempotency**: `openAppDb` 를 두 번 호출해도 스키마(스토어, 인덱스) 변동 없음.
8. **onBlocking 콜백**: 직접 v0 DB 를 열어둔 상태에서 v1 openDB 호출 → `onBlocking` 가 호출됨 (fake-indexeddb 가 blocking 시뮬 가능한지 확인, 어려우면 통합 테스트로 이관).

### 8.3 유닛 — `services/pubchem`

`tests/unit/services/pubchem/`:

MSW 로 PubChem 엔드포인트 mock. fake timers 로 백오프 / rate limit 시간 가속.

1. **Rate limit (D3)**: 6 개 동시 요청 → 5 개 즉시, 6번째 ~250 ms 대기. 토큰 버킷 동작 검증.
2. **재시도 — 429 Retry-After**: 첫 응답 429 + `Retry-After: 1` → 1 s 대기 후 200 → 성공. fetch 호출 횟수 = 2.
3. **재시도 — 5xx**: 503 → 1 s → 503 → 2 s → 200. 호출 = 3.
4. **재시도 한도 초과**: 4번 연속 503 → `PubChemError('HttpStatus', 503)` 반환. 호출 = 4.
5. **AbortSignal — fetch in-flight**: signal abort 시 즉시 `Aborted`, 캐시 미쓰기 검증.
6. **AbortSignal — RDKit 단계**: RDKit mock 이 ~50 ms 소요 동안 abort → 완료 후 캐시 쓰기 스킵, `Aborted` 반환.
7. **In-flight dedup**: 동일 CID 동시 2회 호출 → fetch handler 호출 = 1.
8. **D10 매니페스트 우선**: CID 962 (Water, 매니페스트 존재) 요청 → MSW handler 호출 = **0**.
9. **Name → 다중 CID**: handler 가 `[1, 2, 3]` 반환 → 첫 번째 채택 + `logger.warn` 발생.
10. **NotFound 정규화**: HTTP 404 와 200+`Fault.Code: PUGREST.NotFound` 두 케이스 모두 `kind: 'NotFound'`.
11. **Schema 실패**: handler 가 형식 망가진 JSON 반환 → `kind: 'Schema'`, `issues` 배열 비어있지 않음.
12. **3D SDF 404 폴백**: SDF 엔드포인트만 404 → `RdkitBackend.embed` 경로로 진입, 결과 `coordinateSource: 'rdkit-etkdg'`.

### 8.4 통합 — 전체 플로우 (Vitest + jsdom + fake-indexeddb + MSW)

`tests/integration/runtime-data-layer.test.ts`:

1. **매니페스트 miss → 캐시 miss → 네트워크 → 캐시 hit**:
   - 임의 CID (예: 매니페스트에 없는 CID 임의 고정값) 를 요청.
   - 첫 호출: MSW handler 호출 1회 → Compound 반환. cache.put 발생 검증.
   - 두 번째 호출 (같은 cid): handler 호출 = 0, 동일 Compound 반환.
2. **세션 재시작 시뮬레이션**: 첫 세션이 캐시에 저장 → 모듈 reset → 두 번째 세션에서 같은 CID 요청 → 네트워크 호출 0회 (영속 캐시 동작).
3. **schemaVersion bump 시뮬레이션**: 캐시에 v=1 레코드 저장 → `NORMALIZE_SCHEMA_VERSION` 을 v=2 로 mock 교체 → 같은 CID 요청 → 네트워크 호출 1회 (재호출 흐름).

### 8.5 에러 분류 테스트

`tests/unit/services/pubchem/errors.test.ts`:

- D6 의 8개 variant (`Network`, `HttpStatus`, `Schema`, `Timeout`, `RateLimited`, `NotFound`, `RdkitFailed`, `Aborted`) 를 mock 으로 유발하고 각 `kind` / `retryable` / 부속 필드를 검증.
- 타입 차원: `switch (err.kind) { ... }` 가 exhaustive 체크 통과 (TypeScript `never` 분기).

### 8.6 번들 분석

`tests/build/services-bundle.test.ts` (Phase 04 §8.5 패턴 답습):

1. `pnpm build` 후 `dist/assets/` 에서 `services/cache` 가 **별도 lazy chunk** 로 분리됨 (해시된 파일).
2. 초기 번들(`index-*.js`) 에 `idb` 라이브러리 코드가 포함되지 않음 (grep check).
3. 매니페스트만 사용하는 코드 경로(예: 주기율표 진입) 만 import 한 가상 엔트리포인트 빌드 시 IndexedDB 관련 코드 0 byte.

### 8.7 레이어 가드 검증

- `services/pubchem/client.ts` 를 `services/cache/` 외부에서 import 하면 `pnpm lint` 실패 (수동 1회 확인).
- `idb` 를 `panels/` 또는 `viewport/` 에서 import 하면 lint 실패.
- `engine/pubchem/normalize.ts` 가 `window` / `IDBDatabase` / `fetch` 토큰을 사용하면 lint 실패 (`no-restricted-globals`).

---

## 9. 리스크 및 대안

| #   | 리스크                                                                 | 영향 | 완화                                                                                                                                                   |
| --- | ---------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | PubChem CORS 정책 변경 (현재는 허용)                                   | 중   | 공식 문서 기준. 변경 감지 시 Phase 14 에서 사용자 측 프록시 또는 백엔드 도입 검토 — 본 Phase 는 직접 호출 가정                                         |
| R2  | IndexedDB 할당량 초과 (사파리 1 GB / 임시 모드 더 적음)                | 중   | D4 의 1000 엔트리 상한 + LRU. `QuotaExceededError` 포착 시 `evictLru(maxEntries / 2)` 강제 후 재시도. 그래도 실패면 `CacheError('QuotaExceeded')` 반환 |
| R3  | 사용자 시스템 시계 변경 → TTL 신뢰성 손실                              | 하   | `cachedAt` TTL 은 2차 방어. 1차는 `schemaVersion` 불일치. 또한 미래 시각으로 설정된 레코드는 `cachedAt > Date.now()` 검증으로 stale 처리               |
| R4  | RDKit 런타임 lazy init 첫 조회 지연 (수백 ms~1 s)                      | 중   | D8: 서비스가 `readiness.rdkitLoading` 노출. Phase 07/11 가 스피너 표시. 거대 분자 처리 시 Phase 14 Web Worker 분리 (architecture §12 Q4)               |
| R5  | Phase 04 retrofit (D1) 이 빌드타임 테스트를 깨트림                     | 중   | DoD #7 — Phase 04 normalize 테스트가 새 import 경로에서 그린 유지. 의미 변경 없는 위치/주입 형태 변경만                                                |
| R6  | 동일 CID 동시 중복 요청 (예: 사용자가 빠르게 같은 화합물을 두 번 클릭) | 하   | §6.4 in-flight dedup — Map<cid, Promise>                                                                                                               |
| R7  | 네트워크 불안정 환경에서 재시도 3회 후에도 실패                        | 중   | 최종 `PubChemError` 반환 → Phase 07 스토어가 에러 상태 노출 → Phase 11 UI 가 "재시도" 버튼 표시                                                        |
| R8  | 동일 이름의 다중 CID 응답 (PubChem 이 배열 반환)                       | 중   | `resolveCompoundByName` 은 첫 번째 CID 채택 + warn. 사용자가 다른 동의어를 원하면 Phase 11 가 "여러 결과" 표시 (Q4 결정 필요)                          |
| R9  | IndexedDB 버전 충돌 (다른 탭이 이전 버전 점유)                         | 하   | `onBlocking` 콜백 → Phase 11 가 "다른 탭을 닫아주세요" toast. 자동 해결 불가능한 경우 사용자 안내가 한계                                               |
| R10 | RDKit canonical SMILES 가 PubChem `IsomericSMILES` 과 토큰 순서 차이   | 하   | Phase 04 §6.5 와 동일 — 저장 SMILES 는 RDKit canonical 로 통일, PubChem 원문은 캐시 미보관                                                             |
| R11 | PubChem `Fault` 응답 외에 다른 에러 객체 형식 (드물게 발생)            | 하   | zod 스키마가 미식별 응답을 `Schema` 에러로 분류. 새 케이스 발견 시 fixture 추가 + 스키마 보강                                                          |
| R12 | 동시에 여러 CID 를 fetch 할 때 토큰 버킷이 직렬화시켜 체감 지연        | 하   | 4 req/s 평균 + 5 버스트. 현실적 사용량(사용자가 한 번에 수십 개 조회) 에 충분. 대량 사용은 비목표 (UI 가 페이징)                                       |
| R13 | `AbortSignal.any` 가 구형 브라우저 미지원                              | 하   | architecture §3.3 의 "최신 Chromium/FF/Safari 최근 2개 버전" 범위에서는 지원. 미지원 시 polyfill 또는 수동 합성 헬퍼 추가                              |

---

## 10. 완료 기준 (Definition of Done)

1. `pnpm typecheck && pnpm lint && pnpm test -- --run` 전부 통과.
2. `services/pubchem/index.ts` 의 3개 공개 함수 (`getCompoundByCid`, `getCompoundByInchiKey`, `resolveCompoundByName`) 가 D9 의 `LookupOptions { signal? }` 시그니처로 노출되며, 모두 `Promise<LookupResult>` 반환.
3. **D6 의 8개 에러 variant 가 모두 유발·분류됨** (§8.5 통과). `switch (err.kind)` 가 TypeScript exhaustive check 를 통과.
4. **D10 불변식 테스트 통과** (§8.3 #8) — 매니페스트에 있는 CID 요청 시 MSW PubChem 핸들러 호출 횟수 = 0.
5. **In-flight dedup 테스트 통과** (§8.3 #7) — 동일 CID 동시 2회 호출 시 fetch 호출 = 1.
6. **재시도 정책 (D7) 테스트 통과** — 429 / 5xx / Retry-After / 한도 초과 4종 시나리오 모두 검증 (§8.3 #2~#4).
7. **Phase 04 retrofit (D1) 완료** — `engine/pubchem/normalize.ts` 모듈 존재, Phase 04 빌드타임 호출자가 새 경로 import, Phase 04 normalize 유닛 테스트가 새 모듈에서 그린 (§8.1 #1).
8. **`fake-indexeddb` 기반 캐시 테스트 통과** (§8.2) — put/get/touch/evictLru/schemaVersion mismatch/TTL 모두 검증.
9. **IndexedDB 스키마 v1 문서화** — `db.ts` 주석에 v0→v1 업그레이드 경로 + v2 이후 확장 계약 명시. `DB_VERSION` 상수가 `1`.
10. **`pnpm build` 결과에서 `services/cache` 가 별도 lazy chunk** 로 분리 (§8.6 #1) — 매니페스트만 사용하는 초기 로드에서 IndexedDB 코드 미포함.
11. **레이어 가드** — `idb` 를 `services/cache/` 외부에서 import 하면 lint 실패 (§8.7).
12. **architecture §3.7 요구 충족 명시** — 본 문서 §6.3 (재시도 정책), §6.7 (에러 분류), §6.10 (로깅 레벨) 이 architecture §3.7 의 4개 항목과 1:1 매핑됨을 PR 설명에 기재.
13. **Schema 동기 검증** (phase-04 §10 #13 의 짝): CI step `scripts/check-schema-version.ts` 가 `compounds.meta.json.normalizeSchemaVersion` 과 `src/engine/pubchem/normalize.ts` 의 `NORMALIZE_SCHEMA_VERSION` 상수가 일치함을 확인. 일치 실패 시 CI 실패. `tests/unit/engine/pubchem/normalize-snapshot.test.ts` 의 스냅샷이 갱신된 PR 에서 본 상수가 같이 bump 되지 않으면 별도 가드 테스트(`schemaVersion-guard.test.ts`) 가 실패.

---

## 11. 열린 질문 (User Decision Required)

1. **D1–D11 기본안 수용 여부**.
   - 특히 **D1 (normalize 추출)** 은 Phase 04 승인 문서의 §6.1 / §7 에 명시된 모듈 경로에 영향. 본 문서 §6.8 이 새 경로를 단일 권위로 정한다는 데에 동의가 필요. Phase 04 본문은 미수정 (이미 승인된 설계의 무결성 보존).
   - ~~`RdkitBackend.parseSdfBlock` 인터페이스 승격~~ — **해소됨**: phase-03 §6.8 이 갱신되어 `parseSdfBlock` 이 `RdkitBackend` 의 필수 메서드로 정식 명문화됨. 본 Phase 의 브라우저 RDKit 백엔드와 phase-04 의 Node 백엔드는 모두 동일 인터페이스를 구현한다.
2. **D4 TTL 90 일 / 상한 1000 엔트리** 가 적절한지. 사용자의 예상 사용 패턴 — 수업 중 20–30 분자 vs 연구자 수백 분자 — 에 따라 조정 가능. Phase 14 계측 후 변경 여지.
3. **D8 의 RDKit lazy init 대기**: 서비스 내부에서 투명하게 처리하고 `readiness` 만 옵저버로 노출 (기본안) vs 전용 `prepareRdkit()` API 를 별도로 노출하여 UI 가 사전 워밍업 트리거. 후자는 Phase 11 의 "분자 입력 패널 진입 시 RDKit 워밍업" UX 를 명시적으로 만들 수 있음.
4. **이름 → 다중 CID 케이스 (R8) 의 UX 정책**: 첫 번째 자동 채택 (기본안) vs 사용자에게 동의어 선택지 제공 (서비스 API 가 `Compound[]` 또는 `CompoundCandidate[]` 를 반환하는 형태로 변경). 후자는 본 Phase 의 API 시그니처를 바꾸므로 현 결정이 필요.
5. **캐시 수동 비우기**: `compoundCache.clear()` 를 `settingsStore` (Phase 07) 에서 노출할지. 노출하면 사용자가 캐시 손상 시 자가 복구 가능. 기본안: **노출**.
6. **CORS preflight 비용**: PubChem 이 OPTIONS 를 매번 받지는 않지만 캐시되지 않은 환경에서 첫 요청이 ~수십 ms 추가될 수 있음. 본 Phase 에서 별도 측정 / 완화는 비목표. Phase 14 에서 계측.
7. **CI 에서 PubChem 실호출 스모크 테스트 여부**: Phase 04 Q6 와 동일 — 본 Phase 도 기본 mock. 월 1회 cron 으로 실호출 1–2 케이스 (예: water, benzene) 의 응답 형식 변동 감지 여부.

---

## 12. 다음 Phase 로의 인계 (Hand-off)

- **Phase 06 (Reaction Engine)**:
  - 반응물 해소 시 `services/pubchem.getCompoundByCid` / `resolveCompoundByName` 호출 가능. 단, 반응 규칙 매칭 자체는 매니페스트와 사용자 입력 분자만으로 충분한 케이스가 대부분 — 런타임 fetch 는 보조.
- **Phase 07 (Stores)**:
  - `moleculeStore.loadCompound(cid, { signal })` 가 본 Phase 서비스를 호출. 로딩/에러 상태(`pending`, `lastError`)를 selector 로 노출.
  - `moleculeStore.loadCompoundByName(query, { signal })` 는 `resolveCompoundByName` 호출.
  - `subscribeReadiness` 를 스토어 초기화 시 등록하여 `pending.rdkitLoading` 을 selector 로 노출.
  - **`settingsStore.clearCache()`** 액션 (Q5 결정 시) — `compoundCache.clear()` 호출.
  - 에러 분류 (D6) 별로 사용자 메시지를 i18n 리소스에 매핑 (`error.network`, `error.rateLimited`, `error.notFound`, ...).
- **Phase 08 (Rendering)**:
  - 반환된 `Compound.defaultMolecule.atoms[].position` 을 그대로 소비. 매니페스트와 런타임 fetch 의 `Compound` 가 동일 타입이므로 분기 불요.
  - `coordinateSource` 가 `'rdkit-etkdg'` 인 경우 (3D SDF 404 폴백) 도 동일하게 처리 — 표시/디버그 분기 불요.
- **Phase 11 (Panels — CompoundBrowser / MoleculeInfo)**:
  - 검색창: 1차 `searchCompoundManifest` (Phase 04, 동기), 2차 `resolveCompoundByName` (본 Phase, 비동기). UI 가 두 단계의 상태(즉시 결과 vs 로딩) 를 분리 표시.
  - "런타임 조회된 분자" 라벨: `Compound.provenance === 'runtime-fetch'` 로 식별 (Phase 01 판별 필드 — placeholder 패턴 추론 불필요, Phase 11 추가 결정 없음).
  - IDB blocking 안내 toast: `openAppDb({ onBlocking: () => toast.warn('다른 탭을 닫아주세요') })` 등록.
- **Phase 13 (Export / Import)**:
  - 캐시된 `Compound` 를 그대로 `toSdfBlock` (Phase 03) 으로 SDF export 가능.
  - JSON import 시 동일 CID 가 캐시에 있으면 충돌 정책: import 우선 (사용자 의도) 또는 캐시 우선 — Phase 13 결정.
- **Phase 14 (Performance)**:
  - 다탭 BroadcastChannel rate limit 필요성 계측 (D3 후속).
  - IndexedDB quota 관찰. TTL/상한 조정.
  - RDKit 작업의 Web Worker 분리 (architecture §12 Q4 + 본 Phase R4).
  - `services/cache` lazy chunk 분리 후 첫 사용자 조회의 추가 로드 비용 측정.
- **Phase 04 (소급 — 문서 + 구현 양측, 본 Phase 가 단일 권위)**:
  - **문서 차원**: Phase 04 본문 미수정. 모듈 경로 계약은 본 문서 §6.8 의 "Phase 04 가 아직 코드로 구현되지 않았으므로 retrofit 은 implementation 시점에 자연스럽게 흡수" 로 처리.
  - **구현 차원**: Phase 04 또는 Phase 05 둘 중 먼저 구현되는 PR 이 `src/engine/pubchem/normalize.ts` 모듈을 신설하고, 나머지 PR 이 import 한다. 두 PR 은 모두 §6.8 의 시그니처를 따른다.
  - **`RdkitBackend.parseSdfBlock`** 은 phase-03 §6.8 갱신으로 인터페이스 필수 메서드가 됨. Phase 04 의 Node 백엔드와 본 Phase 의 브라우저 백엔드 모두 이 메서드를 구현한다.
- **Phase 03 (간접 — 본 Phase 가 변경 요구하지 않음)**:
  - Phase 03 의 브라우저 `getRdkit()` 와 `RdkitBackend` 인터페이스 (`parseSmiles` / `parseInchi` / `parseSdfBlock` / `embed` / `toCanonical`) 를 그대로 사용. 본 Phase 는 `createMainThreadRdkitBackend(getRdkit)` 로 백엔드를 구성한다.

---

_문서 버전: 0.1 (초안)_
_작성일: 2026-04-25_
