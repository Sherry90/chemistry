/**
 * Build-time PubChem data pipeline.
 * Usage: pnpm run fetch-compounds [--offline]
 *
 * Flags:
 *   --offline   Use cached responses only, skip network calls.
 */

import { readFile } from 'node:fs/promises';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALL_COMPOUND_CATEGORIES } from '../../src/chemistry/compounds/categories.js';
import type { CompoundCategory } from '../../src/chemistry/compounds/categories.js';
import type { Compound } from '../../src/chemistry/compounds/types.js';
import { OUT_DIR, CHUNKS_DIR, FORMULA_MAP_GENERATED_PATH, SEEDS_DIR } from './config.js';
import { createStats, printFinalReport, logWarning } from './report.js';
import { buildManifest } from './manifest.js';
import { buildFormulaMapGenerated, serializeFormulaMapGenerated } from './formula-map.js';
import type { ChunkResult } from './chunk.js';
import { NORMALIZE_SCHEMA_VERSION } from './normalize.js';

const isOffline = process.argv.includes('--offline');

async function parseTsv(filePath: string): Promise<ReadonlyArray<Record<string, string>>> {
  if (!existsSync(filePath)) return [];
  const content = await readFile(filePath, 'utf8');
  const lines = content.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
  if (lines.length === 0) return [];

  const headers = (lines[0] ?? '').split('\t').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split('\t');
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i] ?? ''] = (cols[i] ?? '').trim();
    }
    return row;
  });
}

async function main(): Promise<void> {
  console.log(`=== PubChem Compound Fetch ===`);
  console.log(`Mode: ${isOffline ? 'offline (cache only)' : 'online'}`);
  console.log(`Schema version: ${NORMALIZE_SCHEMA_VERSION}`);

  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });
  if (!existsSync(CHUNKS_DIR)) await mkdir(CHUNKS_DIR, { recursive: true });

  const stats = createStats();
  const dropped: Array<{ cid: number; reason: string; detail: string }> = [];

  // In this skeleton, we read seed files and report — actual PubChem fetch is wired up
  // by connecting client.ts + validate.ts. The data pipeline runs when seeds are populated.
  const chunksByCategory = new Map<CompoundCategory, ReadonlyArray<ChunkResult>>();
  const allCompounds: Compound[] = [];
  const seedFiles: Array<{ path: string; entries: number }> = [];

  for (const cat of ALL_COMPOUND_CATEGORIES) {
    const seedPath = resolve(SEEDS_DIR, `${cat}.tsv`);
    const rows = await parseTsv(seedPath);
    seedFiles.push({ path: `seeds/${cat}.tsv`, entries: rows.length });

    if (rows.length === 0) {
      chunksByCategory.set(cat, []);
      continue;
    }

    // Placeholder: actual fetch + normalize + embed would happen here.
    // For the skeleton, we skip network calls and use empty compounds.
    logWarning(
      `Seed file found for ${cat} (${rows.length} entries) but network fetch not yet implemented. Skipping.`,
    );
    chunksByCategory.set(cat, []);
  }

  // Write manifest
  const manifest = buildManifest(chunksByCategory);
  await writeFile(resolve(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  // Write meta
  const meta = {
    collectedAt: new Date().toISOString(),
    pubchemApiVersion: 'PUG REST',
    rdkitVersion: '2025.3.4-1.0.0',
    normalizeSchemaVersion: NORMALIZE_SCHEMA_VERSION,
    embedSeed: 12648430,
    totals: {
      requestedCids: stats.total,
      successful: stats.successful,
      droppedParse: stats.droppedParse,
      droppedEmbed: stats.droppedEmbed,
    },
    dropped,
    seedFiles,
    koNameCoverage: { total: stats.successful, withKo: 0, withoutKo: stats.successful },
    formulaMapSkipped: [] as string[],
    smilesFallbacks: [] as number[],
  };
  await writeFile(resolve(OUT_DIR, 'compounds.meta.json'), JSON.stringify(meta, null, 2), 'utf8');

  // Write formula-map.generated.ts
  const formulaMap = buildFormulaMapGenerated(allCompounds);
  const formulaMapSrc = serializeFormulaMapGenerated(formulaMap, new Date().toISOString());
  await writeFile(FORMULA_MAP_GENERATED_PATH, formulaMapSrc, 'utf8');

  printFinalReport(stats, dropped);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
