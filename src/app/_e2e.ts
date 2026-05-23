// Phase 15 §6.1 — E2E 백도어. URL `?e2e=1` 인 경우만 `window.__e2e__` 로
// 스토어 액션을 노출 (Playwright `page.evaluate` 가 호출). 평시 production
// 빌드에서는 전체 if-블록이 dead code (URLSearchParams 검사 후 분기 미진입).
//
// Phase 15 §5 (S2/S6-S12) 확장 — selection getter/setter, molecule positions,
// CVD/theme/locale 토글. 모든 노출은 store actions/state 직접 read/write 만 —
// 실제 사용자 행동 경로 (UI) 를 우회하지 *않으며* 단지 raycast/픽셀단위 드래그가
// Playwright 에서 불가능한 부분만 가린다.
import { useUiStore, useMoleculeStore, useSettingsStore } from '@/stores';
import type { PanelKey, Theme, Locale } from '@/stores';

interface E2EMoleculeSnapshot {
  readonly id: string;
  readonly atomCount: number;
  readonly bondCount: number;
  readonly atomPositions: ReadonlyArray<{
    readonly id: string;
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }>;
}

declare global {
  interface Window {
    __e2e__?: {
      readonly setActivePanel: (key: PanelKey | null) => void;
      // ── 선택 (S2/S11/S12) ──
      readonly getSelection: () => {
        readonly atomIds: ReadonlyArray<string>;
        readonly bondIds: ReadonlyArray<string>;
      };
      readonly setSelection: (sel: {
        atomIds?: ReadonlyArray<string>;
        bondIds?: ReadonlyArray<string>;
      }) => void;
      readonly clearSelection: () => void;
      // ── 분자 검사 (S11/S12) ──
      readonly getMolecules: () => ReadonlyArray<E2EMoleculeSnapshot>;
      readonly moveAtom: (
        molId: string,
        atomIndex: number,
        position: readonly [number, number, number],
      ) => void;
      // ── 표시/접근 (S9) ──
      readonly toggleCvdMode: (on: boolean) => void;
      readonly setTheme: (theme: Theme) => void;
      readonly setLocale: (locale: Locale) => void;
      readonly isCvdOn: () => boolean;
      readonly getTheme: () => Theme;
      readonly getAtomLabelsOn: () => boolean;
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
    getSelection() {
      const sel = useUiStore.getState().selection;
      return { atomIds: sel.atomIds, bondIds: sel.bondIds };
    },
    setSelection(sel) {
      useUiStore.getState().actions.setSelection(sel);
    },
    clearSelection() {
      useUiStore.getState().actions.clearSelection();
    },
    getMolecules() {
      const st = useMoleculeStore.getState();
      return st.ids.map((id) => {
        const m = st.molecules[id]!;
        return {
          id: m.id,
          atomCount: m.atoms.length,
          bondCount: m.bonds.length,
          atomPositions: m.atoms.map((a) => ({
            id: a.id,
            x: a.position.x,
            y: a.position.y,
            z: a.position.z,
          })),
        };
      });
    },
    moveAtom(molId, atomIndex, position) {
      useMoleculeStore.getState().actions.moveAtom(molId as never, atomIndex, position);
    },
    toggleCvdMode(on) {
      useSettingsStore.getState().actions.toggleCvdMode(on);
    },
    setTheme(theme) {
      useSettingsStore.getState().actions.setTheme(theme);
    },
    setLocale(locale) {
      useSettingsStore.getState().actions.setLocale(locale);
    },
    isCvdOn() {
      return useSettingsStore.getState().cvdMode;
    },
    getTheme() {
      return useSettingsStore.getState().theme;
    },
    getAtomLabelsOn() {
      return useUiStore.getState().viewport.showAtomLabels;
    },
  };
}
