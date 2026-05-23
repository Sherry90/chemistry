// Phase 15 §6.1 — E2E 백도어. URL `?e2e=1` 인 경우만 `window.__e2e__` 로
// 스토어 액션을 노출 (Playwright `page.evaluate` 가 호출). 평시 production
// 빌드에서는 전체 if-블록이 dead code (URLSearchParams 검사 후 분기 미진입).
import { useUiStore } from '@/stores';
import type { PanelKey } from '@/stores';

declare global {
  interface Window {
    __e2e__?: {
      readonly setActivePanel: (key: PanelKey | null) => void;
    };
  }
}

export function installE2EBackdoor(): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  if (params.get('e2e') !== '1') return;
  window.__e2e__ = {
    setActivePanel(key) {
      useUiStore.getState().actions.setActivePanel(key);
    },
  };
}
