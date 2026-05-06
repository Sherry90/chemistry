import type { Compound } from '../../src/chemistry/compounds/types.js';
import type { CompoundCategory } from '../../src/chemistry/compounds/categories.js';
import { CHUNK_SIZE_LIMIT_BYTES } from './config.js';

export interface ChunkResult {
  readonly fileName: string;
  readonly compounds: ReadonlyArray<Compound>;
}

export function chunkByCategory(
  compounds: ReadonlyArray<Compound>,
  category: CompoundCategory,
): ReadonlyArray<ChunkResult> {
  // Sort by CID ascending (§6.6: deterministic ordering within chunk)
  const sorted = [...compounds].sort((a, b) => (a.cid ?? 0) - (b.cid ?? 0));

  const chunks: ChunkResult[] = [];
  let current: Compound[] = [];
  let currentSize = 0;
  let shardIndex = 1;

  for (const compound of sorted) {
    const serialized = JSON.stringify(compound, null, 2);
    const size = Buffer.byteLength(serialized, 'utf8');

    if (current.length > 0 && currentSize + size > CHUNK_SIZE_LIMIT_BYTES) {
      const fileName =
        chunks.length === 0
          ? `${category}.json`
          : `${category}.${shardIndex.toString().padStart(3, '0')}.json`;
      chunks.push({ fileName, compounds: current });
      current = [];
      currentSize = 0;
      shardIndex++;
    }

    current.push(compound);
    currentSize += size;
  }

  if (current.length > 0) {
    const fileName =
      chunks.length === 0
        ? `${category}.json`
        : `${category}.${shardIndex.toString().padStart(3, '0')}.json`;
    chunks.push({ fileName, compounds: current });
  }

  return chunks;
}
