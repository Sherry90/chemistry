import type { Compound } from '../../src/chemistry/compounds/types.js';
import type { CompoundCategory } from '../../src/chemistry/compounds/categories.js';
import { ALL_COMPOUND_CATEGORIES } from '../../src/chemistry/compounds/categories.js';
import type { ChunkResult } from './chunk.js';
import { toSearchTokens } from './normalize.js';

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

export interface CategoryManifestEntry {
  readonly chunks: ReadonlyArray<string>;
  readonly count: number;
}

export interface CompoundManifestOutput {
  readonly version: string;
  readonly totalCompounds: number;
  readonly categories: Record<CompoundCategory, CategoryManifestEntry>;
  readonly entries: ReadonlyArray<ManifestEntry>;
}

export function buildManifest(
  chunksByCategory: ReadonlyMap<CompoundCategory, ReadonlyArray<ChunkResult>>,
): CompoundManifestOutput {
  const categories = {} as Record<CompoundCategory, CategoryManifestEntry>;
  const entries: ManifestEntry[] = [];

  for (const cat of ALL_COMPOUND_CATEGORIES) {
    const catChunks = chunksByCategory.get(cat) ?? [];
    const chunkNames = catChunks.map((c) => c.fileName);
    let count = 0;

    for (const chunk of catChunks) {
      count += chunk.compounds.length;

      for (const compound of chunk.compounds) {
        if (compound.cid === null) continue;
        entries.push({
          cid: compound.cid,
          name: compound.name,
          formula: compound.molecularFormula,
          inchiKey: compound.inchiKey ?? '',
          category: cat,
          chunk: chunk.fileName,
          priority: compound.priority,
          molecularWeight: compound.molecularWeight,
          searchTokens: toSearchTokens(
            compound.name.en,
            compound.name.ko,
            compound.molecularFormula,
            compound.synonyms,
          ),
        });
      }
    }

    categories[cat] = { chunks: chunkNames, count };
  }

  // Sort entries: priority ASC, then cid ASC, then name.en ASC
  entries.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.cid !== b.cid) return a.cid - b.cid;
    return a.name.en.localeCompare(b.name.en);
  });

  return {
    version: new Date().toISOString(),
    totalCompounds: entries.length,
    categories,
    entries,
  };
}

export function compoundToManifestEntry(
  compound: Compound,
  chunkFileName: string,
): ManifestEntry | null {
  if (compound.cid === null || compound.inchiKey === null) return null;
  return {
    cid: compound.cid,
    name: compound.name,
    formula: compound.molecularFormula,
    inchiKey: compound.inchiKey,
    category: compound.category,
    chunk: chunkFileName,
    priority: compound.priority,
    molecularWeight: compound.molecularWeight,
    searchTokens: toSearchTokens(
      compound.name.en,
      compound.name.ko,
      compound.molecularFormula,
      compound.synonyms,
    ),
  };
}
