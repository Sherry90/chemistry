// Phase 09 §7 — <Viewport tabIndex=0> focus 관리.
// viewport-focused 스코프(β, D11) 키는 포커스된 컨테이너의 onKeyDown 합성
// 이벤트로만 위임된다. 본 모듈은 그 컨테이너의 포커스 props 를 제공.
import type * as React from 'react';

/** <Viewport> 컨테이너를 키보드 포커스 가능하게 (P3/P9 — focus 일 때만 β 키 발화). */
export const VIEWPORT_TABINDEX = 0;

export interface ViewportFocusProps {
  readonly tabIndex: number;
  readonly role: 'application';
}

/**
 * 포커스 가능 컨테이너에 spread. `role="application"` 은 보조기술이 단축키를
 * 가로채지 않고 컨테이너에 위임하도록 한다 (a11y 세부는 Phase 15).
 */
export function viewportFocusProps(): ViewportFocusProps {
  return { tabIndex: VIEWPORT_TABINDEX, role: 'application' };
}

/**
 * Tab 브라우저 기본 focus 이동 차단 (R3). 현재 본 Phase 에서는 Tab
 * preventDefault 가 createViewportShortcutHandler 내부에서 처리되어 미사용 —
 * Phase 10(패널 focus 관리)/Phase 15(a11y) 가 focus trap 정책 결정 시 재사용 예약.
 */
export function preventBrowserTab(e: React.KeyboardEvent | KeyboardEvent): void {
  if (e.key === 'Tab') e.preventDefault();
}
