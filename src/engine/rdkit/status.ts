// Phase 12 §6.10 / §7.2 / §7.3 / §12.1 — thin read-only status module.
// panels/TextInput 만 본 모듈을 직접 import (ESLint zone except). 동작 함수
// (parseSmiles, toMoleculeWith3D 등) 는 본 모듈에 없음 → P1 우회 불가.
export { getRdkitStatus, onRdkitStatusChange } from './service';
export type { RdkitStatus, RdkitInitError, RdkitInitErrorCode } from './types';
