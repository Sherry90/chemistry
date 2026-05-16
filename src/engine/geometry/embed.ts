import type { ParsedMol } from '@/engine/rdkit/types';
import type { EmbedOptions, EmbedError } from './types';
import { DEFAULT_EMBED_OPTIONS, EMBED_DEFAULT_TIMEOUT_MS } from './types';
import type { Molecule } from '@/chemistry/compounds/types';
import type { Result } from '@/types/result';
import { err } from '@/types/result';

export async function embedMolecule(
  parsed: ParsedMol,
  backend: { embed(p: ParsedMol, opts: EmbedOptions): Promise<Result<Molecule, EmbedError>> },
  opts: Partial<EmbedOptions> = {},
): Promise<Result<Molecule, EmbedError>> {
  const options: EmbedOptions = { ...DEFAULT_EMBED_OPTIONS, ...opts };
  const timeoutMs = options.timeoutMs ?? EMBED_DEFAULT_TIMEOUT_MS;

  const embedPromise = backend.embed(parsed, options);
  const timeoutPromise = new Promise<Result<Molecule, EmbedError>>((resolve) => {
    setTimeout(
      () => resolve(err({ code: 'EmbedTimeout', message: `Embed timed out after ${timeoutMs}ms` })),
      timeoutMs,
    );
  });

  return Promise.race([embedPromise, timeoutPromise]);
}
