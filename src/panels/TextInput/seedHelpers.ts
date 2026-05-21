// Phase 12 §6.8 / D-DIATOMIC-LOOKUP — 원소 → 모달 입력 seed (formula 형태) panel-local 룩업.
import type { Element } from '@/chemistry/elements/types';

const DIATOMIC_HOMONUCLEAR: ReadonlySet<string> = new Set(['H', 'N', 'O', 'F', 'Cl', 'Br', 'I']);

/**
 * 원소 → 모달 입력 seed (formula 형태). 이원자 동핵 분자 (H₂, N₂, O₂, F₂, Cl₂, Br₂, I₂) 는 "X2".
 * 노블가스 / 금속 / 그 외 = 단일 원소 표기 (e.g., "He", "Na", "Fe").
 *
 * 본 룩업은 panel-local (phase-02 의 standardState 필드는 'gas/liquid/solid/unknown' 만 제공
 * — diatomic 플래그 부재). phase-02 retrofit 회피 (data 모듈 슬림 유지).
 */
export function getElementInitialFormula(element: Element): string {
  if (DIATOMIC_HOMONUCLEAR.has(element.symbol)) return `${element.symbol}2`;
  return element.symbol;
}
