// Phase 13 §6.13 — SessionFile hand-written 검증.
// JSON.parse 후 unknown → SessionFile 안전 변환. 외부 스키마 라이브러리 0 (P0).
import type { Result } from '@/types/result';
import { ok, err } from '@/types/result';
import type {
  SessionFile,
  MoleculeSnapshot,
  AtomSnapshot,
  BondSnapshot,
  SerializedSelection,
} from '@/chemistry/session/types';
import type { ImportError } from '../_shared/errors';

const SUPPORTED_VERSION = 1;

function mismatch(path: string, message: string): Result<never, ImportError> {
  return err({ kind: 'SchemaMismatch', path, message });
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validateSessionFile(data: unknown): Result<SessionFile, ImportError> {
  if (!isRecord(data)) return mismatch('', 'Expected object');

  // schemaVersion
  if (typeof data.schemaVersion !== 'number') {
    return mismatch('schemaVersion', 'Expected number');
  }
  if (data.schemaVersion !== SUPPORTED_VERSION) {
    return err({
      kind: 'IncompatibleVersion',
      fileVersion: data.schemaVersion,
      supportedVersion: SUPPORTED_VERSION,
    });
  }

  // app
  if (!isRecord(data.app)) return mismatch('app', 'Expected object');
  if (typeof data.app.name !== 'string') return mismatch('app.name', 'Expected string');
  if (typeof data.app.version !== 'string') return mismatch('app.version', 'Expected string');

  // exportedAt
  if (typeof data.exportedAt !== 'string') return mismatch('exportedAt', 'Expected string');

  // molecules
  if (!Array.isArray(data.molecules)) return mismatch('molecules', 'Expected array');
  if (data.molecules.length === 0) return err({ kind: 'NoMolecules' });

  for (let i = 0; i < data.molecules.length; i++) {
    const v = validateMoleculeSnapshot(data.molecules[i], `molecules[${i}]`);
    if (!v.ok) return v;
  }

  // activeMoleculeId — string | null
  if (data.activeMoleculeId !== null && typeof data.activeMoleculeId !== 'string') {
    return mismatch('activeMoleculeId', 'Expected string or null');
  }

  // condition
  if (!isRecord(data.condition)) return mismatch('condition', 'Expected object');
  if (typeof data.condition.temperatureK !== 'number') {
    return mismatch('condition.temperatureK', 'Expected number');
  }
  if (typeof data.condition.pressureAtm !== 'number') {
    return mismatch('condition.pressureAtm', 'Expected number');
  }
  if (typeof data.condition.pH !== 'number') {
    return mismatch('condition.pH', 'Expected number');
  }

  // selection
  const selResult = validateSelection(data.selection);
  if (!selResult.ok) return selResult;

  // viewport
  if (!isRecord(data.viewport)) return mismatch('viewport', 'Expected object');
  if (typeof data.viewport.showAtomLabels !== 'boolean') {
    return mismatch('viewport.showAtomLabels', 'Expected boolean');
  }
  const bg = data.viewport.backgroundOverride;
  if (bg !== 'theme' && bg !== 'light' && bg !== 'dark') {
    return mismatch('viewport.backgroundOverride', 'Expected "theme" | "light" | "dark"');
  }

  return ok(data as unknown as SessionFile);
}

function validateMoleculeSnapshot(
  data: unknown,
  path: string,
): Result<MoleculeSnapshot, ImportError> {
  if (!isRecord(data)) return mismatch(path, 'Expected object');

  if (typeof data.id !== 'string') return mismatch(`${path}.id`, 'Expected string');
  if (typeof data.canonicalSmiles !== 'string') {
    return mismatch(`${path}.canonicalSmiles`, 'Expected string');
  }
  if (data.inchi !== null && typeof data.inchi !== 'string') {
    return mismatch(`${path}.inchi`, 'Expected string or null');
  }
  if (data.inchiKey !== null && typeof data.inchiKey !== 'string') {
    return mismatch(`${path}.inchiKey`, 'Expected string or null');
  }
  if (typeof data.totalCharge !== 'number') {
    return mismatch(`${path}.totalCharge`, 'Expected number');
  }
  if (typeof data.spinMultiplicity !== 'number') {
    return mismatch(`${path}.spinMultiplicity`, 'Expected number');
  }

  if (!Array.isArray(data.atoms)) return mismatch(`${path}.atoms`, 'Expected array');
  for (let i = 0; i < data.atoms.length; i++) {
    const v = validateAtomSnapshot(data.atoms[i], `${path}.atoms[${i}]`);
    if (!v.ok) return v;
  }

  if (!Array.isArray(data.bonds)) return mismatch(`${path}.bonds`, 'Expected array');
  const atomCount = data.atoms.length;
  for (let i = 0; i < data.bonds.length; i++) {
    const v = validateBondSnapshot(data.bonds[i], `${path}.bonds[${i}]`, atomCount);
    if (!v.ok) return v;
  }

  // stereo — phase-12 의 StereoAnnotations. 본 v1 은 object 면 통과 (구체 검증 phase-14).
  if (!isRecord(data.stereo)) return mismatch(`${path}.stereo`, 'Expected object');

  // origin
  const originResult = validateOrigin(data.origin, `${path}.origin`);
  if (!originResult.ok) return originResult;

  return ok(data as unknown as MoleculeSnapshot);
}

function validateAtomSnapshot(data: unknown, path: string): Result<AtomSnapshot, ImportError> {
  if (!isRecord(data)) return mismatch(path, 'Expected object');

  if (
    typeof data.elementNumber !== 'number' ||
    data.elementNumber < 1 ||
    data.elementNumber > 118
  ) {
    return mismatch(`${path}.elementNumber`, 'Expected number 1..118');
  }
  if (
    !Array.isArray(data.position) ||
    data.position.length !== 3 ||
    !data.position.every((x) => typeof x === 'number')
  ) {
    return mismatch(`${path}.position`, 'Expected [number, number, number]');
  }
  if (typeof data.formalCharge !== 'number') {
    return mismatch(`${path}.formalCharge`, 'Expected number');
  }
  if (typeof data.implicitHCount !== 'number') {
    return mismatch(`${path}.implicitHCount`, 'Expected number');
  }
  // isotope 는 optional (`number | null | undefined`).
  if (data.isotope !== undefined && data.isotope !== null && typeof data.isotope !== 'number') {
    return mismatch(`${path}.isotope`, 'Expected number, null, or undefined');
  }

  return ok(data as unknown as AtomSnapshot);
}

function validateBondSnapshot(
  data: unknown,
  path: string,
  atomCount: number,
): Result<BondSnapshot, ImportError> {
  if (!isRecord(data)) return mismatch(path, 'Expected object');

  if (typeof data.aAtomIndex !== 'number' || data.aAtomIndex < 0 || data.aAtomIndex >= atomCount) {
    return mismatch(`${path}.aAtomIndex`, `Expected 0..${atomCount - 1}`);
  }
  if (typeof data.bAtomIndex !== 'number' || data.bAtomIndex < 0 || data.bAtomIndex >= atomCount) {
    return mismatch(`${path}.bAtomIndex`, `Expected 0..${atomCount - 1}`);
  }
  if (data.order !== 1 && data.order !== 2 && data.order !== 3 && data.order !== 'aromatic') {
    return mismatch(`${path}.order`, 'Expected 1 | 2 | 3 | "aromatic"');
  }

  return ok(data as unknown as BondSnapshot);
}

function validateOrigin(
  data: unknown,
  path: string,
): Result<MoleculeSnapshot['origin'], ImportError> {
  if (!isRecord(data)) return mismatch(path, 'Expected object');
  if (data.kind === 'user-input') {
    return ok({ kind: 'user-input' });
  }
  if (data.kind === 'pubchem') {
    if (typeof data.cid !== 'number') return mismatch(`${path}.cid`, 'Expected number');
    if (data.name !== undefined && typeof data.name !== 'string') {
      return mismatch(`${path}.name`, 'Expected string or undefined');
    }
    return ok(data as unknown as MoleculeSnapshot['origin']);
  }
  return mismatch(`${path}.kind`, 'Expected "user-input" | "pubchem"');
}

function validateSelection(data: unknown): Result<SerializedSelection, ImportError> {
  if (!isRecord(data)) return mismatch('selection', 'Expected object');
  if (!Array.isArray(data.atomIds)) return mismatch('selection.atomIds', 'Expected array');
  if (!Array.isArray(data.bondIds)) return mismatch('selection.bondIds', 'Expected array');

  for (let i = 0; i < data.atomIds.length; i++) {
    const item = data.atomIds[i];
    if (!isRecord(item)) {
      return mismatch(`selection.atomIds[${i}]`, 'Expected object');
    }
    if (typeof item.moleculeIndex !== 'number') {
      return mismatch(`selection.atomIds[${i}].moleculeIndex`, 'Expected number');
    }
    if (typeof item.atomIndex !== 'number') {
      return mismatch(`selection.atomIds[${i}].atomIndex`, 'Expected number');
    }
  }
  for (let i = 0; i < data.bondIds.length; i++) {
    const item = data.bondIds[i];
    if (!isRecord(item)) {
      return mismatch(`selection.bondIds[${i}]`, 'Expected object');
    }
    if (typeof item.moleculeIndex !== 'number') {
      return mismatch(`selection.bondIds[${i}].moleculeIndex`, 'Expected number');
    }
    if (typeof item.bondIndex !== 'number') {
      return mismatch(`selection.bondIds[${i}].bondIndex`, 'Expected number');
    }
  }

  return ok(data as unknown as SerializedSelection);
}
