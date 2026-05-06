import type { RdkitBackend } from '../../src/engine/rdkit/backend.js';
import type { Result } from '../../src/types/result.js';
import type { Molecule } from '../../src/chemistry/compounds/types.js';
import type { EmbedError } from '../../src/engine/geometry/types.js';
import { EMBED_SEED_PRIMARY } from '../../src/engine/geometry/types.js';
import { embed3D } from '../../src/engine/geometry/embed.js';

export interface ValidateAndEmbedOptions {
  readonly backend: RdkitBackend;
  readonly sdf: string | null;
}

export async function validateAndEmbed(
  smiles: string,
  opts: ValidateAndEmbedOptions,
): Promise<Result<{ molecule: Molecule; source: 'pubchem-3d' | 'rdkit-etkdg' }, EmbedError>> {
  const { backend, sdf } = opts;

  // 1. Parse SMILES to validate
  const parsed = await backend.parseSmiles(smiles);
  if (!parsed.ok) {
    return {
      ok: false,
      error: { code: 'EmbedFailed', message: `SMILES parse failed: ${parsed.error.message}` },
    };
  }

  // 2. If SDF available, parse it directly
  if (sdf) {
    const sdfParsed = await backend.parseSdfBlock(sdf);
    if (sdfParsed.ok) {
      const embedded = await backend.embed(sdfParsed.value, {
        seed: EMBED_SEED_PRIMARY,
        maxIters: 2000,
        useRandomCoords: false,
        optimize: 'MMFF94',
        timeoutMs: 4000,
      });
      if (embedded.ok) {
        return { ok: true, value: { molecule: embedded.value, source: 'pubchem-3d' } };
      }
    }
  }

  // 3. Fallback: embed from SMILES (up to EMBED_MAX_RETRIES)
  const seeds = [EMBED_SEED_PRIMARY, -1, -1]; // -1 = random
  let lastError: EmbedError | null = null;

  for (const seedHint of seeds) {
    const seed = seedHint === -1 ? (Math.random() * 0xffffffff) >>> 0 : seedHint;
    const result = await embed3D(parsed.value, backend, {
      seed,
      maxIters: 2000,
      useRandomCoords: seedHint === -1,
      optimize: 'MMFF94',
      timeoutMs: 4000,
    });
    if (result.ok) {
      return { ok: true, value: { molecule: result.value, source: 'rdkit-etkdg' } };
    }
    lastError = result.error;
  }

  return {
    ok: false,
    error: lastError ?? { code: 'EmbedFailed', message: 'All embed attempts failed' },
  };
}
