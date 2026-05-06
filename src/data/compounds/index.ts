import type { Compound } from '@/chemistry/compounds/types';
import type { CompoundCategory } from '@/chemistry/compounds/categories';
import manifestJson from './manifest.json';

export interface ManifestEntry {
  readonly cid: number;
  readonly name: { readonly ko: string | null; readonly en: string };
  readonly formula: string;
  readonly inchiKey: string;
  readonly category: CompoundCategory;
  readonly chunk: string;
  readonly priority: number;
  readonly molecularWeight: number;
  readonly searchTokens: ReadonlyArray<string>;
}

export interface CategoryEntry {
  readonly chunks: ReadonlyArray<string>;
  readonly count: number;
}

export interface CompoundManifest {
  readonly version: string;
  readonly totalCompounds: number;
  readonly categories: Readonly<Record<CompoundCategory, CategoryEntry>>;
  readonly entries: ReadonlyArray<ManifestEntry>;
}

export interface CompoundSearchOptions {
  readonly query: string;
  readonly categories?: ReadonlyArray<CompoundCategory>;
  readonly limit?: number;
}

let manifestCache: CompoundManifest | null = null;

const chunkCache = new Map<string, Promise<ReadonlyArray<Compound>>>();

// Vite resolves all matching paths at build time → each file becomes a lazy chunk.
const chunkLoaders = import.meta.glob<{ default: ReadonlyArray<Compound> }>('./chunks/*.json');

const loaderByChunk = new Map(
  Object.entries(chunkLoaders).map(([path, loader]) => {
    const name = path.replace('./chunks/', '');
    return [name, loader] as const;
  }),
);

export function getCompoundManifest(): CompoundManifest {
  if (!manifestCache) {
    manifestCache = Object.freeze(manifestJson) as unknown as CompoundManifest;
  }
  return manifestCache;
}

export function loadCompoundChunk(chunk: string): Promise<ReadonlyArray<Compound>> {
  let p = chunkCache.get(chunk);
  if (!p) {
    const loader = loaderByChunk.get(chunk);
    if (!loader) return Promise.reject(new Error(`Unknown chunk: ${chunk}`));
    p = loader().then((m) => m.default);
    chunkCache.set(chunk, p);
  }
  return p;
}

export async function loadCategory(category: CompoundCategory): Promise<ReadonlyArray<Compound>> {
  const manifest = getCompoundManifest();
  const cat = manifest.categories[category];
  if (!cat || cat.chunks.length === 0) return [];

  const results = await Promise.all(cat.chunks.map(loadCompoundChunk));
  return results.flat();
}

let cidIndex: Map<number, ManifestEntry> | null = null;
let inchiKeyIndex: Map<string, ManifestEntry> | null = null;

function buildIndices(): void {
  if (cidIndex) return;
  const manifest = getCompoundManifest();
  cidIndex = new Map();
  inchiKeyIndex = new Map();
  for (const entry of manifest.entries) {
    cidIndex.set(entry.cid, entry);
    inchiKeyIndex.set(entry.inchiKey, entry);
  }
}

export async function findCompoundByCid(cid: number): Promise<Compound | null> {
  buildIndices();
  const entry = cidIndex!.get(cid);
  if (!entry) return null;

  const chunk = await loadCompoundChunk(entry.chunk);
  return chunk.find((c) => c.cid === cid) ?? null;
}

export async function findCompoundByInchiKey(inchiKey: string): Promise<Compound | null> {
  buildIndices();
  const entry = inchiKeyIndex!.get(inchiKey);
  if (!entry) return null;

  const chunk = await loadCompoundChunk(entry.chunk);
  return chunk.find((c) => c.inchiKey === inchiKey) ?? null;
}

export function searchCompoundManifest(opts: CompoundSearchOptions): ReadonlyArray<ManifestEntry> {
  const manifest = getCompoundManifest();
  const limit = opts.limit ?? 20;
  const rawQuery = opts.query
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9ㄱ-힝]/g, ' ')
    .trim();

  const categorySet: Set<CompoundCategory> | null =
    opts.categories && opts.categories.length > 0 ? new Set(opts.categories) : null;

  const candidates: Array<{ entry: ManifestEntry; score: number }> = [];

  for (const entry of manifest.entries) {
    if (categorySet && !categorySet.has(entry.category)) continue;

    if (rawQuery === '') {
      candidates.push({ entry, score: 0 });
      continue;
    }

    let best = 0;
    for (const token of entry.searchTokens) {
      const t = token.toLowerCase();
      if (t === rawQuery) {
        best = 100;
        break;
      } else if (t.startsWith(rawQuery)) {
        best = Math.max(best, 60);
      } else if (rawQuery.startsWith(t) && t.length >= 2) {
        best = Math.max(best, 40);
      } else if (t.includes(rawQuery)) {
        best = Math.max(best, 20);
      }
    }

    if (best > 0 || rawQuery === '') {
      candidates.push({ entry, score: best });
    }
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.entry.priority !== b.entry.priority) return a.entry.priority - b.entry.priority;
    if (a.entry.cid !== b.entry.cid) return a.entry.cid - b.entry.cid;
    return a.entry.name.en.localeCompare(b.entry.name.en);
  });

  return candidates.slice(0, limit).map((c) => c.entry);
}

export function resetCompoundCache(): void {
  manifestCache = null;
  chunkCache.clear();
  cidIndex = null;
  inchiKeyIndex = null;
}
