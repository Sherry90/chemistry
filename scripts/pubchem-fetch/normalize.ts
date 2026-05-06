// Thin wrapper — delegates to the shared src/engine/pubchem/normalize.ts
// so both the build script and the runtime share the same NORMALIZE_SCHEMA_VERSION.
export {
  NORMALIZE_SCHEMA_VERSION,
  normalizeSynonyms,
  normalizeMolecularWeight,
  toSearchTokens,
  normalizeCompound,
} from '../../src/engine/pubchem/normalize.js';

export type {
  PubchemProperties,
  PubchemSynonymList,
  PhysicalCurationEntry,
  NormalizeInput,
} from '../../src/engine/pubchem/normalize.js';
