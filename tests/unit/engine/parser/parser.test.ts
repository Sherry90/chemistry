import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setRdkitBackend, parseSmiles, parseInchi } from '@/engine/parser/index';
import { createMockRdkitBackend, makeParsedMol } from '../rdkit/mock-backend';
import { err } from '@/types/result';
import { disposeCache } from '@/engine/rdkit/index';

beforeEach(() => {
  disposeCache();
  setRdkitBackend(createMockRdkitBackend());
});

describe('parseSmiles with mock backend', () => {
  it('returns InputEmpty for empty string', async () => {
    const result = await parseSmiles('');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('InputEmpty');
  });

  it('returns InputTooLong for overlong SMILES', async () => {
    const result = await parseSmiles('C'.repeat(2001));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('InputTooLong');
  });

  it('returns ParsedMol for valid input', async () => {
    const result = await parseSmiles('CCO');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.source.kind).toBe('smiles');
  });

  it('caches: second call does not invoke backend', async () => {
    const parseFn = vi.fn().mockResolvedValue({ ok: true, value: makeParsedMol() });
    setRdkitBackend(
      createMockRdkitBackend({
        parseSmiles: (s) => ({ ok: true, value: makeParsedMol({ canonicalSmiles: s }) }),
      }),
    );

    const backend = createMockRdkitBackend();
    const spy = vi.spyOn(backend, 'parseSmiles');
    setRdkitBackend(backend);

    void parseFn; // suppress unused warning

    await parseSmiles('CCO');
    await parseSmiles('CCO');

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('backend error propagates', async () => {
    setRdkitBackend(
      createMockRdkitBackend({
        parseSmiles: () => err({ code: 'SmilesSyntax', message: 'bad' }),
      }),
    );
    const result = await parseSmiles('C(C');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('SmilesSyntax');
  });
});

describe('parseInchi with mock backend', () => {
  it('returns InchiSyntax for invalid prefix', async () => {
    const result = await parseInchi('1S/H2O/h1H2');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('InchiSyntax');
  });

  it('returns ParsedMol for valid InChI prefix', async () => {
    const result = await parseInchi('InChI=1S/H2O/h1H2');
    expect(result.ok).toBe(true);
  });
});
