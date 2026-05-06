import type { Result } from '@/types/result';
import type { Molecule } from '@/chemistry/compounds/types';
import type { ParsedMol } from './types';
import type { ParseError } from '@/engine/parser/errors';
import type { EmbedOptions, EmbedError } from '@/engine/geometry/types';

export interface RdkitBackend {
  parseSmiles(input: string): Promise<Result<ParsedMol, ParseError>>;
  parseInchi(input: string): Promise<Result<ParsedMol, ParseError>>;
  parseSdfBlock(sdf: string): Promise<Result<ParsedMol, ParseError>>;
  embed(parsed: ParsedMol, opts: EmbedOptions): Promise<Result<Molecule, EmbedError>>;
  toCanonical(parsed: ParsedMol): Promise<{ smiles: string; inchi: string; inchiKey: string }>;
}
