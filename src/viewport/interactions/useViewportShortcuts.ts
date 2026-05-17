// Phase 09 §5.5 / §6.5 (D11 β / D13) — Viewport-focused 단축키 핸들러.
// <Viewport tabIndex=0 onKeyDown> 가 위임. global 스코프(undo/redo)는
// installGlobalUndoShortcuts 가 별도 처리 (§6.8).
import type * as React from 'react';
import { useMoleculeStore, useUiStore } from '@/stores';
import type { BondOrder } from '@/chemistry/bonds/types';
import { KEY_MAP, type KeyActionId } from './shortcuts';
import { navAtom } from './useKeyboardNav';
import { createBondFromSelection } from './useBondCreateFlow';
import { parseViewportId } from '../ids/viewportId';
import { atomIdToIndex, bondIdToIndex } from '../ids/lookup';

export interface ViewportShortcutDeps {
  readonly frameActive: () => void;
  readonly resetCamera: () => void;
}

// §6.5.3 — bond 우선(atom 보존), 매 iteration index 재계산(CD1 stable ID 안전).
function onDelete(): void {
  const sel = useUiStore.getState().selection;
  for (const sid of sel.bondIds) {
    const p = parseViewportId(sid);
    if (!p || p.kind !== 'bond') continue;
    const mol = useMoleculeStore.getState().molecules[p.molId];
    if (!mol) continue;
    const idx = bondIdToIndex(mol, p.bondId);
    if (idx >= 0) useMoleculeStore.getState().actions.removeBond(p.molId, idx);
  }
  for (const sid of sel.atomIds) {
    const p = parseViewportId(sid);
    if (!p || p.kind !== 'atom') continue;
    const mol = useMoleculeStore.getState().molecules[p.molId];
    if (!mol) continue;
    const idx = atomIdToIndex(mol, p.atomId);
    if (idx >= 0) useMoleculeStore.getState().actions.removeAtom(p.molId, idx);
  }
}

// §6.5.2 (D13) — 선택 결합이 정확히 1개일 때만.
function onBondOrderKey(order: BondOrder): void {
  const sel = useUiStore.getState().selection;
  if (sel.bondIds.length !== 1) return;
  const p = parseViewportId(sel.bondIds[0]!);
  if (!p || p.kind !== 'bond') return;
  const mol = useMoleculeStore.getState().molecules[p.molId];
  if (!mol) return;
  const idx = bondIdToIndex(mol, p.bondId);
  if (idx < 0) return;
  useMoleculeStore.getState().actions.setBondOrder(p.molId, idx, order);
}

function runAction(action: KeyActionId, deps: ViewportShortcutDeps): void {
  switch (action) {
    case 'navAtomNext':
      return navAtom(1);
    case 'navAtomPrev':
      return navAtom(-1);
    case 'clearSelection':
      return useUiStore.getState().actions.clearSelection();
    case 'deleteSelection':
      return onDelete();
    case 'createBondFromSelection':
      void createBondFromSelection();
      return;
    case 'setBondOrder1':
      return onBondOrderKey(1);
    case 'setBondOrder2':
      return onBondOrderKey(2);
    case 'setBondOrder3':
      return onBondOrderKey(3);
    case 'setBondOrderAromatic':
      return onBondOrderKey('aromatic');
    case 'frameActive':
      return deps.frameActive();
    case 'resetCamera':
      return deps.resetCamera();
    case 'undo':
    case 'redo':
      return; // global 스코프 — 본 핸들러 비처리
  }
}

/** <Viewport> onKeyDown 핸들러 생성 (frame/reset 는 viewportApi 위임). */
export function createViewportShortcutHandler(
  deps: ViewportShortcutDeps,
): (e: React.KeyboardEvent | KeyboardEvent) => void {
  return (e) => {
    const native = ('nativeEvent' in e ? e.nativeEvent : e) as KeyboardEvent;
    for (const b of KEY_MAP) {
      if (b.scope !== 'viewport') continue;
      if (b.matches(native)) {
        e.preventDefault();
        runAction(b.action, deps);
        return;
      }
    }
  };
}

export function useViewportShortcuts(deps: ViewportShortcutDeps): (e: React.KeyboardEvent) => void {
  return createViewportShortcutHandler(deps);
}
