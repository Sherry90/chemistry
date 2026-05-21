// Phase 12 §4.1 / §4.3 — TextInputMode (uiStore re-export) + PreviewState (AsyncState 별칭).
import type { Molecule } from '@/chemistry/compounds/types';
import type { AsyncState, IngestError, TextInputMode } from '@/stores';

export type { TextInputMode };
export type PreviewState = AsyncState<Molecule, IngestError>;
