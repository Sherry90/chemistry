# Chemistry Simulation Platform

웹 기반 화학 시뮬레이션 플랫폼. 주기율표 탐색, SMILES 기반 3D 분자 렌더링, 반응 예측을 제공한다.

## 개발 환경

**요구사항**: Node.js 20+, pnpm 10+

```bash
# 의존성 설치
pnpm install

# 개발 서버 실행 (http://localhost:5173)
pnpm dev

# 타입 검사
pnpm typecheck

# 린트
pnpm lint

# 테스트
pnpm test

# 프로덕션 빌드
pnpm build
```

## 기술 스택

- **프레임워크**: React 18 + TypeScript (strict)
- **빌드**: Vite 6
- **스타일**: Tailwind CSS
- **3D 렌더링**: React Three Fiber + three.js (Phase 08)
- **화학 엔진**: RDKit.js WASM (Phase 03)
- **상태 관리**: Zustand (Phase 07)
- **국제화**: react-i18next (한국어/영어)

## 라이선스

MIT
