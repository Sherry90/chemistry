import type { Compound } from '@/chemistry/compounds/types';
import type { Result } from '@/types/result';
import type { PubChemError } from './errors';

export interface LookupOptions {
  readonly signal?: AbortSignal;
}

export type LookupResult = Result<Compound, PubChemError>;

// Re-export for convenience
export type { Compound };
