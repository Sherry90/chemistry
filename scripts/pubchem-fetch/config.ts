import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const PUBCHEM_BASE_URL = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';

/** Token bucket: capacity 5, refill rate 4/s (20% margin below 5/s official limit) */
export const RATE_BUCKET_CAPACITY = 5;
export const RATE_REFILL_PER_SEC = 4;

/** Max chunk file size (uncompressed bytes) before shard split */
export const CHUNK_SIZE_LIMIT_BYTES = 150 * 1024;

/** Max synonyms per compound */
export const MAX_SYNONYMS = 5;

/** Exponential backoff: initial delay ms, max delay ms, max retries */
export const BACKOFF_INITIAL_MS = 1000;
export const BACKOFF_MAX_MS = 16000;
export const BACKOFF_MAX_RETRIES = 3;

/** 3D embedding retries (primary seed + 2 random) */
export const EMBED_MAX_RETRIES = 3;

export const SEEDS_DIR = resolve(__dirname, 'seeds');
export const KO_NAMES_FILE = resolve(__dirname, 'ko-names', 'curated.tsv');
export const PHYSICAL_FILE = resolve(__dirname, 'physical', 'curated.tsv');
export const CACHE_DIR = resolve(__dirname, '../../.cache/pubchem');
export const OUT_DIR = resolve(__dirname, '../../src/data/compounds');
export const CHUNKS_DIR = resolve(OUT_DIR, 'chunks');
export const FORMULA_MAP_GENERATED_PATH = resolve(
  __dirname,
  '../../src/engine/parser/formula-map.generated.ts',
);
