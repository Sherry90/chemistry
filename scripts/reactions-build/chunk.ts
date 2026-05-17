import type { BuiltRule } from './validate.ts';
import { BUILD_VERSION, type RuleCategoryName } from './config.ts';

export interface ChunkFile {
  version: string;
  category: RuleCategoryName;
  rules: Array<Omit<BuiltRule, '_category' | '_requiresPh' | '_notesKo' | '_notesEn'>>;
}

function stripInternal(r: BuiltRule): ChunkFile['rules'][number] {
  const { _category, _requiresPh, _notesKo, _notesEn, ...rest } = r;
  void _category;
  void _requiresPh;
  void _notesKo;
  void _notesEn;
  return rest;
}

// §4.5 — priority asc → id asc 정렬로 결정성 확보.
export function buildChunks(rules: BuiltRule[]): Map<RuleCategoryName, ChunkFile> {
  const byCat = new Map<RuleCategoryName, BuiltRule[]>();
  for (const r of rules) {
    const arr = byCat.get(r._category) ?? [];
    arr.push(r);
    byCat.set(r._category, arr);
  }
  const out = new Map<RuleCategoryName, ChunkFile>();
  for (const [cat, arr] of byCat) {
    arr.sort((a, b) =>
      a.priority !== b.priority ? a.priority - b.priority : a.id.localeCompare(b.id),
    );
    out.set(cat, { version: BUILD_VERSION, category: cat, rules: arr.map(stripInternal) });
  }
  return out;
}
