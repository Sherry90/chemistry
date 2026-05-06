import type { RdkitBackend } from '@/engine/rdkit/backend';
import type { ParsedMol, InputSource } from '@/engine/rdkit/types';
import type { ParseError } from '@/engine/parser/errors';
import type { EmbedOptions, EmbedError } from '@/engine/geometry/types';
import type { Molecule } from '@/chemistry/compounds/types';
import type { Result } from '@/types/result';
import { ok, err } from '@/types/result';
import { EMPTY_STEREO } from '@/types/stereo';

export function makeParsedMol(overrides: Partial<ParsedMol> = {}): ParsedMol {
  return {
    source: { kind: 'smiles', raw: 'C', normalized: 'C' },
    canonicalSmiles: 'C',
    formula: 'CH4',
    molecularWeight: 16.04,
    totalCharge: 0,
    radicalElectrons: 0,
    atoms: [],
    bonds: [],
    stereo: EMPTY_STEREO,
    inchi: 'InChI=1S/CH4/h1H4',
    inchiKey: 'VNWKTOKETHGBQD-UHFFFAOYSA-N',
    ...overrides,
  };
}

export function makeMolecule(overrides: Partial<Molecule> = {}): Molecule {
  return {
    id: 'test-mol',
    atoms: [],
    bonds: [],
    totalCharge: 0,
    canonicalSmiles: 'C',
    inchi: null,
    inchiKey: null,
    stereo: EMPTY_STEREO,
    spinMultiplicity: 1,
    ...overrides,
  };
}

export interface MockBackendStubs {
  parseSmiles?: (input: string) => Result<ParsedMol, ParseError>;
  parseInchi?: (input: string) => Result<ParsedMol, ParseError>;
  parseSdfBlock?: (sdf: string) => Result<ParsedMol, ParseError>;
  embed?: (parsed: ParsedMol, opts: EmbedOptions) => Result<Molecule, EmbedError>;
  toCanonical?: (parsed: ParsedMol) => { smiles: string; inchi: string; inchiKey: string };
}

export function createMockRdkitBackend(stubs: MockBackendStubs = {}): RdkitBackend {
  return {
    async parseSmiles(input: string) {
      if (stubs.parseSmiles) return stubs.parseSmiles(input);
      if (input.trim() === '') return err({ code: 'InputEmpty', message: 'Empty SMILES' });
      const source: InputSource = { kind: 'smiles', raw: input, normalized: input.trim() };
      return ok(makeParsedMol({ source, canonicalSmiles: input.trim() }));
    },

    async parseInchi(input: string) {
      if (stubs.parseInchi) return stubs.parseInchi(input);
      const source: InputSource = { kind: 'inchi', raw: input, normalized: input.trim() };
      return ok(makeParsedMol({ source }));
    },

    async parseSdfBlock(sdf: string) {
      if (stubs.parseSdfBlock) return stubs.parseSdfBlock(sdf);
      const source: InputSource = { kind: 'smiles', raw: sdf, normalized: sdf.trim() };
      return ok(makeParsedMol({ source }));
    },

    async embed(parsed: ParsedMol, opts: EmbedOptions) {
      if (stubs.embed) return stubs.embed(parsed, opts);
      return ok(makeMolecule({ canonicalSmiles: parsed.canonicalSmiles }));
    },

    async toCanonical(parsed: ParsedMol) {
      if (stubs.toCanonical) return stubs.toCanonical(parsed);
      return {
        smiles: parsed.canonicalSmiles,
        inchi: parsed.inchi ?? '',
        inchiKey: parsed.inchiKey ?? '',
      };
    },
  };
}
