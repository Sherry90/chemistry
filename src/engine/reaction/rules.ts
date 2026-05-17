import type {
  ReactionRule,
  ReactionManifestEntry,
  RuleSearchOptions,
  Condition,
} from '@/chemistry/reactions/types';
import type { Molecule } from '@/chemistry/compounds/types';
import { getReactionManifest, loadReactionChunk, searchRulesManifest } from '@/data/reactions';

export function searchManifestEntries(
  opts: RuleSearchOptions,
): ReadonlyArray<ReactionManifestEntry> {
  return searchRulesManifest(opts);
}

export async function loadRulesByIds(
  ids: ReadonlyArray<string>,
): Promise<ReadonlyArray<ReactionRule>> {
  if (ids.length === 0) return [];
  const want = new Set(ids);
  const manifest = getReactionManifest();
  const cats = new Set(manifest.entries.filter((e) => want.has(e.id)).map((e) => e.category));
  const loaded = await Promise.all([...cats].map((c) => loadReactionChunk(c)));
  const byId = new Map<string, ReactionRule>();
  for (const rule of loaded.flat()) byId.set(rule.id, rule);
  return ids.map((id) => byId.get(id)).filter((r): r is ReactionRule => r !== undefined);
}

function reactantElementSet(reactants: ReadonlyArray<Molecule>): Set<number> {
  const s = new Set<number>();
  for (const m of reactants) for (const a of m.atoms) s.add(a.elementNumber as number);
  return s;
}

// Phase 06 §6.2 — 매니페스트만 보고 후보 좁힘. priority asc → id asc.
export function prefilterCandidates(
  reactants: ReadonlyArray<Molecule>,
  condition: Condition,
): ReadonlyArray<ReactionManifestEntry> {
  const elements = reactantElementSet(reactants);
  const out = searchRulesManifest({}).filter((e) => {
    if (e.requiresPh && condition.pH === null) return false;
    for (const el of e.requiredElements) {
      if (!elements.has(el as unknown as number)) return false;
    }
    return true;
  });
  return [...out].sort((a, b) =>
    a.priority !== b.priority ? a.priority - b.priority : a.id.localeCompare(b.id),
  );
}
