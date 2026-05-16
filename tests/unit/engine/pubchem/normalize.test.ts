import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizePubChemResponse,
  NORMALIZE_SCHEMA_VERSION,
  normalizeSynonyms,
  toSearchTokens,
} from '@/engine/pubchem/normalize';
import type { PubChemPropertyRow, NormalizeOptions } from '@/engine/pubchem/normalize';
import type { RdkitBackend } from '@/engine/rdkit/backend';
import type { ParsedMol } from '@/engine/rdkit/types';

function makeBackend(overrides?: Partial<RdkitBackend>): RdkitBackend {
  const fakeParsedMol = { smiles: 'O', source: 'smiles' } as unknown as ParsedMol;
  return {
    parseSmiles: vi.fn().mockResolvedValue({ ok: true, value: fakeParsedMol }),
    parseInchi: vi.fn().mockResolvedValue({ ok: true, value: fakeParsedMol }),
    parseSdfBlock: vi.fn().mockResolvedValue({ ok: true, value: fakeParsedMol }),
    embed: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        id: 'test',
        atoms: [
          {
            elementNumber: 8,
            position: [0, 0, 0.117] as [number, number, number],
            formalCharge: 0,
            implicitHCount: 0,
          },
        ],
        bonds: [],
        totalCharge: 0,
        canonicalSmiles: 'O',
        inchi: 'InChI=1S/H2O/h1H2',
        inchiKey: 'XLYOFNOQVPJJNP-UHFFFAOYSA-N',
        stereo: { doubleBondStereo: [], tetrahedralStereo: [] },
        spinMultiplicity: 1,
      },
    }),
    toCanonical: vi.fn().mockResolvedValue({
      smiles: 'O',
      inchi: 'InChI=1S/H2O/h1H2',
      inchiKey: 'XLYOFNOQVPJJNP-UHFFFAOYSA-N',
    }),
    ...overrides,
  };
}

const waterRow: PubChemPropertyRow = {
  CID: 962,
  MolecularFormula: 'H2O',
  MolecularWeight: '18.015',
  CanonicalSMILES: 'O',
  IsomericSMILES: 'O',
  InChI: 'InChI=1S/H2O/h1H2',
  InChIKey: 'XLYOFNOQVPJJNP-UHFFFAOYSA-N',
  IUPACName: 'oxidane',
};

describe('normalizePubChemResponse', () => {
  let backend: RdkitBackend;
  let opts: NormalizeOptions;

  beforeEach(() => {
    backend = makeBackend();
    opts = { rdkit: backend, fillRuntimeDefaults: true };
  });

  it('returns a valid Compound for water with fillRuntimeDefaults: true', async () => {
    const result = await normalizePubChemResponse(waterRow, null, opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.cid).toBe(962);
    expect(result.value.name.en).toBe('oxidane');
    expect(result.value.molecularFormula).toBe('H2O');
    expect(result.value.category).toBe('inorganic-common');
    expect(result.value.priority).toBe(9999);
    expect(result.value.properties.standardState).toBe('unknown');
    expect(result.value.defaultMolecule?.id).toBe('cid:962');
    expect(result.value.coordinateSource).toBe('rdkit-etkdg');
  });

  it('uses category placeholder with fillRuntimeDefaults: false', async () => {
    const result = await normalizePubChemResponse(waterRow, null, {
      rdkit: backend,
      fillRuntimeDefaults: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // fillRuntimeDefaults: false sets priority: 0
    expect(result.value.priority).toBe(0);
  });

  it('sets coordinateSource pubchem-3d when SDF embed succeeds', async () => {
    const sdf = '\n  Mrv2306 01012400002D\n\n  0  0  0  0  0  0            999 V2000\nM  END\n';
    const result = await normalizePubChemResponse(waterRow, sdf, opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.coordinateSource).toBe('pubchem-3d');
  });

  it('falls back to rdkit-etkdg when SDF parsing fails', async () => {
    const failBackend = makeBackend({
      parseSdfBlock: vi.fn().mockResolvedValue({
        ok: false,
        error: { message: 'parse failed' },
      }),
    });
    const result = await normalizePubChemResponse(waterRow, 'bad sdf', {
      rdkit: failBackend,
      fillRuntimeDefaults: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.coordinateSource).toBe('rdkit-etkdg');
  });

  it('returns SmilesParseFailed when SMILES parse fails', async () => {
    const failBackend = makeBackend({
      parseSmiles: vi.fn().mockResolvedValue({
        ok: false,
        error: { message: 'invalid SMILES' },
      }),
    });
    const result = await normalizePubChemResponse(waterRow, null, {
      rdkit: failBackend,
      fillRuntimeDefaults: true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('SmilesParseFailed');
    expect(result.error.cid).toBe(962);
  });

  it('returns SmilesParseFailed when no SMILES is available', async () => {
    const noSmiles: PubChemPropertyRow = {
      CID: 999,
      MolecularFormula: 'X',
      MolecularWeight: 10,
    };
    const result = await normalizePubChemResponse(noSmiles, null, opts);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('SmilesParseFailed');
  });

  it('returns EmbedFailed when embed fails', async () => {
    const failBackend = makeBackend({
      embed: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'EmbedFailed', message: 'failed' },
      }),
    });
    const result = await normalizePubChemResponse(waterRow, null, {
      rdkit: failBackend,
      fillRuntimeDefaults: true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('EmbedFailed');
  });

  it('returns MissingRequiredField when MolecularFormula is empty', async () => {
    const badRow: PubChemPropertyRow = {
      CID: 1,
      MolecularFormula: '',
      MolecularWeight: 10,
    };
    const result = await normalizePubChemResponse(badRow, null, opts);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('MissingRequiredField');
    if (result.error.kind !== 'MissingRequiredField') return;
    expect(result.error.field).toBe('MolecularFormula');
  });

  it('parses numeric MolecularWeight correctly', async () => {
    const result = await normalizePubChemResponse(
      { ...waterRow, MolecularWeight: 18.015 },
      null,
      opts,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.molecularWeight).toBeCloseTo(18.015);
  });

  it('NORMALIZE_SCHEMA_VERSION is 2 (CD1: serialized SerializedMolecule schema)', () => {
    expect(NORMALIZE_SCHEMA_VERSION).toBe(2);
  });
});

describe('normalizeSynonyms', () => {
  it('deduplicates and caps at 5', () => {
    const input = ['a', 'b', 'c', 'd', 'e', 'f', 'a'];
    expect(normalizeSynonyms(input)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('trims whitespace', () => {
    expect(normalizeSynonyms(['  foo  ', 'bar'])).toEqual(['foo', 'bar']);
  });
});

describe('toSearchTokens', () => {
  it('returns lowercase tokens for name, formula, and synonyms', () => {
    const tokens = toSearchTokens('Water', '물', 'H2O', ['oxidane']);
    expect(tokens).toContain('water');
    expect(tokens).toContain('h2o');
    expect(tokens).toContain('oxidane');
    expect(tokens).toContain('물');
  });
});
