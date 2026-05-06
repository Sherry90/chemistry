import type { ParseError } from './errors';
import type { Result } from '@/types/result';
import { ok, err } from '@/types/result';

const SMILES_MAX_LENGTH = 2000;
const INCHI_MAX_LENGTH = 4000;
const FORMULA_MAX_LENGTH = 200;

export function normalizeSmiles(input: string): Result<string, ParseError> {
  const trimmed = input.trim().replace(/\s+/g, '');
  if (trimmed.length === 0) {
    return err({ code: 'InputEmpty', message: 'SMILES input is empty' });
  }
  if (trimmed.length > SMILES_MAX_LENGTH) {
    return err({ code: 'InputTooLong', message: `SMILES exceeds ${SMILES_MAX_LENGTH} characters` });
  }
  return ok(trimmed);
}

export function normalizeInchi(input: string): Result<string, ParseError> {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return err({ code: 'InputEmpty', message: 'InChI input is empty' });
  }
  if (trimmed.length > INCHI_MAX_LENGTH) {
    return err({ code: 'InputTooLong', message: `InChI exceeds ${INCHI_MAX_LENGTH} characters` });
  }
  if (!trimmed.startsWith('InChI=')) {
    return err({ code: 'InchiSyntax', message: 'InChI must start with "InChI="' });
  }
  return ok(trimmed);
}

export function normalizeFormula(input: string): Result<string, ParseError> {
  const trimmed = input.trim().replace(/\s+/g, '');
  if (trimmed.length === 0) {
    return err({ code: 'InputEmpty', message: 'Formula input is empty' });
  }
  if (trimmed.length > FORMULA_MAX_LENGTH) {
    return err({
      code: 'InputTooLong',
      message: `Formula exceeds ${FORMULA_MAX_LENGTH} characters`,
    });
  }
  return ok(trimmed);
}
