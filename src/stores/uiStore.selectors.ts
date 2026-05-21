// Phase 07 §5.3 — uiStore selector helpers.
import type {
  CompoundSearchSlice,
  IoMode,
  Notification,
  PanelKey,
  TextInputSeed,
  UiStoreState,
} from './uiStore.types';

export const selectIsGloballyLoading = (s: UiStoreState): boolean => s.globalLoading.count > 0;
export const selectActivePanel = (s: UiStoreState): PanelKey | null => s.panels.active;
export const selectAtomLabelsOn = (s: UiStoreState): boolean => s.viewport.showAtomLabels;
export const selectBackgroundOverride = (s: UiStoreState): 'theme' | 'light' | 'dark' =>
  s.viewport.backgroundOverride;
export const selectNotifications = (s: UiStoreState): ReadonlyArray<Notification> =>
  s.notifications;
export const selectCompoundSearch = (s: UiStoreState): CompoundSearchSlice => s.compoundSearch;
export const selectSelection = (s: UiStoreState): UiStoreState['selection'] => s.selection;

// Phase 11 §6.13 retrofit — undo selection 토스트 단일 관찰자용.
export const selectHasSelection = (s: UiStoreState): boolean =>
  s.selection.atomIds.length > 0 || s.selection.bondIds.length > 0;

// Phase 12 §4.5 / §5.3 — text-input 패널 슬롯 selectors.
export const selectIsTextInputOpen = (s: UiStoreState): boolean => s.panels.isTextInputOpen;
export const selectTextInputInitial = (s: UiStoreState): TextInputSeed | null =>
  s.panels.textInputInitial;

// Phase 13 §4.1 / §5.4 — io 패널 슬롯 selectors.
export const selectIsIoOpen = (s: UiStoreState): boolean => s.panels.isIoOpen;
export const selectIoInitialMode = (s: UiStoreState): IoMode | null => s.panels.ioInitialMode;
