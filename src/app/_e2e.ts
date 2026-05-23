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
      readonly togglePanel: (
        key: 'compound-browser' | 'periodic-table' | 'reaction-result' | 'text-input' | 'io',
        open: boolean,
      ) => void;
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
      // ── canvas raycast 검증 (A — hotfix) ──
      readonly getCameraMatrix: () => readonly number[] | null;
      readonly projectAtomToScreen: (
        molId: string,
        atomIndex: number,
      ) => { readonly x: number; readonly y: number } | null;
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
    togglePanel(key, open) {
      const a = useUiStore.getState().actions;
      switch (key) {
        case 'compound-browser':
          a.toggleCompoundBrowser(open);
          return;
        case 'periodic-table':
          a.togglePeriodicTable(open);
          return;
        case 'reaction-result':
          a.toggleReactionResult(open);
          return;
        case 'text-input':
          a.toggleTextInput(open);
          return;
        case 'io':
          a.toggleIo(open);
          return;
      }
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
    getCameraMatrix() {
      const t = window.__e2e_three__;
      if (!t) return null;
      // viewMatrix 안정성 polling 용. matrixWorld 16 element flat.
      t.camera.updateMatrixWorld();
      return Array.from(t.camera.matrixWorld.elements);
    },
    projectAtomToScreen(molId, atomIndex) {
      const t = window.__e2e_three__;
      if (!t) return null;
      const st = useMoleculeStore.getState();
      const m = st.molecules[molId as never];
      if (!m) return null;
      const a = m.atoms[atomIndex];
      if (!a) return null;
      // Scene 의 MoleculeGroup transform 도 반영 — layout.get(molId)?.translation.
      // 단일 분자 케이스는 (0,0,0). 멀티-mol 케이스는 layout module 동일 결과 재계산.
      // Phase 15 hotfix A — 단일 분자 가정 (멀티 mol 별도 spec).
      const pos = a.position;
      // dynamic three import — module top 에서 import 시 vite 평시 번들 영향.
      // Camera 가 이미 THREE.Camera 인스턴스 → vec.project(camera) 직접 호출.
      const v = { x: pos.x, y: pos.y, z: pos.z } as { x: number; y: number; z: number };
      // NDC 좌표로 project.
      const cam = t.camera as unknown as {
        matrixWorldInverse: { elements: number[] };
        projectionMatrix: { elements: number[] };
      };
      // 수동 4x4 곱 (three.js Vector3.project 동등 — three import 회피).
      const projectVec = (vx: number, vy: number, vz: number): [number, number, number] => {
        const mvw = cam.matrixWorldInverse.elements;
        const mp = cam.projectionMatrix.elements;
        // view = matrixWorldInverse * (vx, vy, vz, 1)
        const ex = mvw[0]! * vx + mvw[4]! * vy + mvw[8]! * vz + mvw[12]!;
        const ey = mvw[1]! * vx + mvw[5]! * vy + mvw[9]! * vz + mvw[13]!;
        const ez = mvw[2]! * vx + mvw[6]! * vy + mvw[10]! * vz + mvw[14]!;
        const ew = mvw[3]! * vx + mvw[7]! * vy + mvw[11]! * vz + mvw[15]!;
        // proj = projectionMatrix * (ex, ey, ez, ew)
        const px = mp[0]! * ex + mp[4]! * ey + mp[8]! * ez + mp[12]! * ew;
        const py = mp[1]! * ex + mp[5]! * ey + mp[9]! * ez + mp[13]! * ew;
        const pz = mp[2]! * ex + mp[6]! * ey + mp[10]! * ez + mp[14]! * ew;
        const pw = mp[3]! * ex + mp[7]! * ey + mp[11]! * ez + mp[15]! * ew;
        return [px / pw, py / pw, pz / pw];
      };
      const [ndcX, ndcY] = projectVec(v.x, v.y, v.z);
      const rect = t.gl.domElement.getBoundingClientRect();
      // NDC (-1..1) → CSS pixel.
      const x = ((ndcX + 1) / 2) * rect.width + rect.left;
      const y = ((-ndcY + 1) / 2) * rect.height + rect.top;
      return { x, y };
    },
  };
}
