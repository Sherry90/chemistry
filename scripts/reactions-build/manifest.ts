import type { BuiltRule } from './validate.ts';
import {
  BUILD_VERSION,
  RULE_CATEGORIES,
  ATTRIBUTION_URL,
  type RuleCategoryName,
} from './config.ts';

export function buildManifest(rules: BuiltRule[]): Record<string, unknown> {
  // licenseSummary — 라이선스별 집계 (결정적 정렬).
  const licCount = new Map<string, number>();
  for (const r of rules) licCount.set(r.license, (licCount.get(r.license) ?? 0) + 1);
  const licenseSummary = [...licCount.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([license, count]) => ({
      license,
      count,
      attributionUrl: ATTRIBUTION_URL[license] ?? null,
    }));

  // categories — 모든 RuleCategory 키 존재 보장 (빈 카테고리도 count:0).
  const categories: Record<string, unknown> = {};
  for (const cat of RULE_CATEGORIES) {
    const inCat = rules.filter((r) => r._category === cat);
    const prios = inCat.map((r) => r.priority);
    const elemUnion = [...new Set(inCat.flatMap((r) => r.requiredElements))].sort((a, b) => a - b);
    categories[cat] = {
      chunk: `${cat}.json`,
      count: inCat.length,
      priorityRange: inCat.length > 0 ? [Math.min(...prios), Math.max(...prios)] : [0, 0],
      requiredElementsUnion: elemUnion,
    };
  }

  // entries — priority asc → id asc.
  const entries = rules
    .map((r) => ({
      id: r.id,
      category: r._category as RuleCategoryName,
      priority: r.priority,
      confidence: r.confidence,
      thermo: r.thermo,
      requiresPh: r._requiresPh,
      requiredElements: [...r.requiredElements].sort((a, b) => a - b),
      chunk: `${r._category}.json`,
    }))
    .sort((a, b) =>
      a.priority !== b.priority ? a.priority - b.priority : a.id.localeCompare(b.id),
    );

  return {
    version: BUILD_VERSION,
    totalRules: rules.length,
    licenseSummary,
    categories,
    entries,
  };
}
