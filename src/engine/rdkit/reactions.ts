import type { Result } from '@/types/result';
import { err } from '@/types/result';
import type { ParsedMol } from '@/engine/rdkit/types';

// Phase 06 §5.5 — RDKit RunReactants 래퍼.
//
// ⚠️ DEFERRED: 번들 `@rdkit/rdkit` (MinimalLib, v2025.3.4-1.0.0) 은 반응 실행 API
// (`get_rxn` / `run_reactants` / `JSReaction` / `ChemicalReaction`) 를 노출하지 않는다
// (RDKit_minimal.{js,d.ts} 확인). 따라서 규칙 기반 매칭 엔진은 phase-06 v1 에서 제외되고
// RDKit 반응 API 확보 후 별도 phase 로 이관된다 (§9 리스크 / §11 열린 질문 / §12 hand-off).
//
// 본 래퍼는 "정직한 실패" 원칙 (arch §3.7) 에 따라 조용한 NoMatch 가 아닌 명시적
// 'Unavailable' 을 반환한다. predict 파이프라인은 v1 에서 이 경로를 호출하지 않는다.
export type RunReactantsError =
  | { readonly kind: 'Unavailable'; readonly detail: string }
  | { readonly kind: 'CompileFailed'; readonly rdkitMessage: string }
  | { readonly kind: 'NoMatch' }
  | { readonly kind: 'RdkitThrew'; readonly rdkitMessage: string };

export function runReactants(
  _rxnSmarts: string,
  _reactants: ReadonlyArray<ParsedMol>,
): Result<ReadonlyArray<ReadonlyArray<ParsedMol>>, RunReactantsError> {
  return err({
    kind: 'Unavailable',
    detail:
      'RDKit MinimalLib exposes no reaction API (run_reactants). Rule-based matching deferred to a post-RDKit-reaction phase — see phase-06 §9/§11/§12.',
  });
}

export function clearReactionCache(): void {
  // 컴파일 캐시 없음 (반응 API 부재). 인터페이스 호환용 no-op.
}
