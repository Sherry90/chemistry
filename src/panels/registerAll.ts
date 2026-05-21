// Phase 11 §5.2 / D-PANELS-INDEX — 패널 정의 목록. panels→app/layout 은 상향
// 레이어 위반이므로 registerPanel 호출은 App.tsx(app 레이어)가 수행. 본 모듈은
// 정의 배열만 노출 (PanelRegistration = 구조적 타입 — @/app/layout import 회피;
// phase-10 PanelDefinition 과 동형).
import type { ComponentType } from 'react';
import type { PanelKey } from '@/stores';

export interface PanelRegistration {
  readonly key: PanelKey;
  readonly mode: 'docked' | 'modal';
  readonly i18nTitleKey: string;
  readonly load: () => Promise<{ default: ComponentType }>;
}

export const panelRegistrations: ReadonlyArray<PanelRegistration> = [
  {
    key: 'periodic-table',
    mode: 'modal',
    i18nTitleKey: 'panels:periodicTable.title',
    load: () => import('./PeriodicTable'),
  },
  {
    key: 'compound-browser',
    mode: 'modal',
    i18nTitleKey: 'panels:compoundBrowser.title',
    load: () => import('./CompoundBrowser'),
  },
  {
    key: 'conditions',
    mode: 'docked',
    i18nTitleKey: 'panels:conditions.title',
    load: () => import('./Conditions'),
  },
  {
    key: 'molecule-info',
    mode: 'docked',
    i18nTitleKey: 'panels:moleculeInfo.title',
    load: () => import('./MoleculeInfo'),
  },
  {
    key: 'reaction-result',
    mode: 'modal',
    i18nTitleKey: 'panels:reactionResult.title',
    load: () => import('./ReactionResult'),
  },
  {
    key: 'text-input',
    mode: 'modal',
    i18nTitleKey: 'panels:textInput.title',
    load: () => import('./TextInput'),
  },
];
