import type {
  ReactionRule,
  RuleCategory,
  ReactionManifestEntry,
  RuleSearchOptions,
} from '@/chemistry/reactions/types';
import { ALL_RULE_CATEGORIES } from '@/chemistry/reactions/types';
import type { ElementNumber } from '@/chemistry/elements/types';
import type { ReactionManifest, SerializedReactionManifestEntry } from './types';
import manifestJson from './manifest.json';

function materializeEntry(s: SerializedReactionManifestEntry): ReactionManifestEntry {
  return {
    id: s.id,
    category: s.category,
    priority: s.priority,
    confidence: s.confidence,
    thermo: s.thermo,
    requiresPh: s.requiresPh,
    requiredElements: s.requiredElements as ReadonlyArray<ElementNumber>,
    chunk: s.chunk,
  };
}

let manifestCache: ReactionManifest | null = null;
const chunkCache = new Map<string, Promise<ReadonlyArray<ReactionRule>>>();

const chunkLoaders = import.meta.glob<{ default: { rules: ReadonlyArray<ReactionRule> } }>(
  './chunks/*.json',
);
const loaderByChunk = new Map(
  Object.entries(chunkLoaders).map(([path, loader]) => {
    const name = path.replace('./chunks/', '');
    return [name, loader] as const;
  }),
);

export function getReactionManifest(): ReactionManifest {
  if (!manifestCache) {
    manifestCache = Object.freeze(manifestJson) as unknown as ReactionManifest;
  }
  return manifestCache;
}

export function loadReactionChunk(category: RuleCategory): Promise<ReadonlyArray<ReactionRule>> {
  const meta = getReactionManifest().categories[category];
  if (!meta || meta.count === 0) return Promise.resolve([]);
  let p = chunkCache.get(meta.chunk);
  if (!p) {
    const loader = loaderByChunk.get(meta.chunk);
    if (!loader) return Promise.reject(new Error(`Unknown chunk: ${meta.chunk}`));
    p = loader().then((m) => m.default.rules);
    chunkCache.set(meta.chunk, p);
  }
  return p;
}

export function searchRulesManifest(opts: RuleSearchOptions): ReadonlyArray<ReactionManifestEntry> {
  const manifest = getReactionManifest();
  const catSet = opts.categories && opts.categories.length > 0 ? new Set(opts.categories) : null;
  const subset =
    opts.requiredElementsSubsetOf && opts.requiredElementsSubsetOf.length >= 0
      ? new Set<number>(opts.requiredElementsSubsetOf as ReadonlyArray<number>)
      : null;

  const out = manifest.entries.map(materializeEntry).filter((e) => {
    if (catSet && !catSet.has(e.category)) return false;
    if (opts.requiresPh !== undefined && opts.requiresPh !== null) {
      if (e.requiresPh !== opts.requiresPh) return false;
    }
    if (opts.minPriority !== undefined && e.priority < opts.minPriority) return false;
    if (subset !== null) {
      for (const el of e.requiredElements) {
        if (!subset.has(el as unknown as number)) return false;
      }
    }
    return true;
  });

  return [...out].sort((a, b) =>
    a.priority !== b.priority ? a.priority - b.priority : a.id.localeCompare(b.id),
  );
}

/** 모든 RuleCategory 키가 매니페스트에 존재하는지 (noUncheckedIndexedAccess 안전). */
export function allReactionCategoriesPresent(): boolean {
  const cats = getReactionManifest().categories;
  return ALL_RULE_CATEGORIES.every((c) => cats[c] !== undefined);
}

export function resetReactionDataCache(): void {
  manifestCache = null;
  chunkCache.clear();
}
