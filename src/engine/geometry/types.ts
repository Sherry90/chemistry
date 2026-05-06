export const EMBED_SEED_PRIMARY = 0xc0ffee;
export const EMBED_MAX_RETRIES = 2;
export const EMBED_DEFAULT_TIMEOUT_MS = 4000;

export interface EmbedOptions {
  readonly seed: number;
  readonly maxIters: number;
  readonly useRandomCoords: boolean;
  readonly optimize: 'none' | 'uff' | 'mmff94';
  readonly timeoutMs: number;
}

export const DEFAULT_EMBED_OPTIONS: EmbedOptions = {
  seed: EMBED_SEED_PRIMARY,
  maxIters: 200,
  useRandomCoords: true,
  optimize: 'none',
  timeoutMs: EMBED_DEFAULT_TIMEOUT_MS,
};

export type EmbedErrorCode =
  | 'RdkitNotReady'
  | 'EmbedTimeout'
  | 'EmbedFailed'
  | 'InvalidMolecule'
  | 'IonHandlingFailed'
  | 'InternalError';

export interface EmbedError {
  readonly code: EmbedErrorCode;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}
