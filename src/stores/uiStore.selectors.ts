// Phase 07 §5.3 — uiStore selector helpers.
import type { CompoundSearchSlice, Notification, PanelKey, UiStoreState } from './uiStore.types';

export const selectIsGloballyLoading = (s: UiStoreState): boolean => s.globalLoading.count > 0;
export const selectActivePanel = (s: UiStoreState): PanelKey | null => s.panels.active;
export const selectAtomLabelsOn = (s: UiStoreState): boolean => s.viewport.showAtomLabels;
export const selectBackgroundOverride = (s: UiStoreState): 'theme' | 'light' | 'dark' =>
  s.viewport.backgroundOverride;
export const selectNotifications = (s: UiStoreState): ReadonlyArray<Notification> =>
  s.notifications;
export const selectCompoundSearch = (s: UiStoreState): CompoundSearchSlice => s.compoundSearch;
export const selectSelection = (s: UiStoreState): UiStoreState['selection'] => s.selection;
