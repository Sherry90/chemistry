// Phase 07 §5.1 — moleculeStore selector helpers.
// Phase 13 §4.8 / §6.13 retrofit — MoleculeSnapshot 동결 + IO 에러 매핑.
import type { Molecule } from '@/chemistry/compounds/types';
import type { BondOrder } from '@/chemistry/bonds/types';
import { getElement } from '@/chemistry/elements';
import type { ParseError } from '@/engine/parser';
import type { EmbedError } from '@/engine/geometry';
import type { MoleculeSnapshot } from '@/chemistry/session/types';
import { toSnapshot } from '@/chemistry/session/snapshot';
import type { ExportError, ImportError } from '@/io/_shared/errors';
import type { AsyncState, IngestError, MoleculeId } from './_shared/types';
import type { MoleculeStoreState } from './moleculeStore.types';

// MoleculeSnapshot 의 출처 = @/chemistry/session/types (CD6).
// 본 모듈은 외부 호환을 위해 *재수출* (phase-07 §5.1 line 461 동결 책임 이행).
export type { MoleculeSnapshot };

export const selectActiveMolecule = (s: MoleculeStoreState): Molecule | null =>
  s.activeId ? (s.molecules[s.activeId] ?? null) : null;

export const selectMoleculeById =
  (id: MoleculeId) =>
  (s: MoleculeStoreState): Molecule | null =>
    s.molecules[id] ?? null;

export const selectMoleculeIds = (s: MoleculeStoreState): ReadonlyArray<MoleculeId> => s.ids;

export const selectIngestState = (s: MoleculeStoreState): AsyncState<MoleculeId, IngestError> =>
  s.ingest;

/**
 * Phase 07 §5.1 line 461 의 동결 책임을 Phase 13 가 이행. 시그니처는 보존
 * (id → state → MoleculeSnapshot | null) 하되, **반환 형태가 Molecule → MoleculeSnapshot**
 * 으로 좁아짐. SerializedAtom/BondSnapshot 기반 직렬화 형식 (atom ID 미보유, bond 는 index 기반).
 */
export const selectMoleculeSnapshot =
  (id: MoleculeId) =>
  (s: MoleculeStoreState): MoleculeSnapshot | null => {
    const m = s.molecules[id];
    return m ? toSnapshot(m) : null;
  };

/** Phase 13 §4.8 — JSON export 진입점. 모든 분자 (s.ids 순서) 의 snapshot.
 *  Phase 15 §6.1 retrofit — WeakMap memo (state identity 키). 매 호출 새 배열
 *  반환 시 Zustand `Object.is` 비교가 항상 false → 무한 re-render 루프 (S13 발견). */
const _allSnapshotsCache = new WeakMap<MoleculeStoreState, ReadonlyArray<MoleculeSnapshot>>();
export const selectAllMoleculeSnapshots = (
  s: MoleculeStoreState,
): ReadonlyArray<MoleculeSnapshot> => {
  const cached = _allSnapshotsCache.get(s);
  if (cached) return cached;
  const result = s.ids.map((id) => toSnapshot(s.molecules[id]!));
  _allSnapshotsCache.set(s, result);
  return result;
};

// ── Phase 11 §4.7 retrofit — selectBondMetrics (standalone 순수 + WeakMap memo) ──

export interface BondMetric {
  readonly bondIndex: number;
  readonly atom1Index: number;
  readonly atom2Index: number;
  readonly atom1Symbol: string;
  readonly atom2Symbol: string;
  readonly order: BondOrder;
  readonly lengthAngstrom: number;
}

export interface BondAngleMetric {
  readonly atom1Index: number;
  readonly atom2Index: number; // vertex
  readonly atom3Index: number;
  readonly angleDegrees: number;
}

export interface BondMetricsResult {
  readonly lengths: ReadonlyArray<BondMetric>;
  readonly angles: ReadonlyArray<BondAngleMetric>;
}

const bondMetricsCache = new WeakMap<Molecule, BondMetricsResult>();

const symbolOf = (n: number): string => getElement(n as never)?.symbol ?? String(n);

/**
 * 활성 분자의 결합 길이/각. Molecule 참조를 키로 WeakMap memoize
 * (immer immutable → 내용 변경 시 새 참조 → miss → 재계산). null → null.
 */
export function selectBondMetrics(m: Molecule | null): BondMetricsResult | null {
  if (!m) return null;
  const cached = bondMetricsCache.get(m);
  if (cached) return cached;

  const idx = new Map(m.atoms.map((a, i) => [a.id, i]));
  const lengths: BondMetric[] = [];
  m.bonds.forEach((b, bondIndex) => {
    const i1 = idx.get(b.aAtomId);
    const i2 = idx.get(b.bAtomId);
    if (i1 == null || i2 == null) return;
    const p1 = m.atoms[i1]!.position;
    const p2 = m.atoms[i2]!.position;
    lengths.push({
      bondIndex,
      atom1Index: i1,
      atom2Index: i2,
      atom1Symbol: symbolOf(m.atoms[i1]!.elementNumber),
      atom2Symbol: symbolOf(m.atoms[i2]!.elementNumber),
      order: b.order,
      lengthAngstrom: Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z),
    });
  });

  // 인접 결합 쌍 → vertex 각. atom 별 이웃 목록 구축.
  const neighbors = new Map<number, number[]>();
  for (const bm of lengths) {
    (neighbors.get(bm.atom1Index) ?? neighbors.set(bm.atom1Index, []).get(bm.atom1Index)!).push(
      bm.atom2Index,
    );
    (neighbors.get(bm.atom2Index) ?? neighbors.set(bm.atom2Index, []).get(bm.atom2Index)!).push(
      bm.atom1Index,
    );
  }
  const angles: BondAngleMetric[] = [];
  for (const [vertex, nb] of neighbors) {
    for (let a = 0; a < nb.length; a++) {
      for (let c = a + 1; c < nb.length; c++) {
        const v = m.atoms[vertex]!.position;
        const p1 = m.atoms[nb[a]!]!.position;
        const p2 = m.atoms[nb[c]!]!.position;
        const v1 = [p1.x - v.x, p1.y - v.y, p1.z - v.z];
        const v2 = [p2.x - v.x, p2.y - v.y, p2.z - v.z];
        const dot = v1[0]! * v2[0]! + v1[1]! * v2[1]! + v1[2]! * v2[2]!;
        const n1 = Math.hypot(v1[0]!, v1[1]!, v1[2]!);
        const n2 = Math.hypot(v2[0]!, v2[1]!, v2[2]!);
        if (n1 === 0 || n2 === 0) continue;
        const cos = Math.max(-1, Math.min(1, dot / (n1 * n2)));
        angles.push({
          atom1Index: nb[a]!,
          atom2Index: vertex,
          atom3Index: nb[c]!,
          angleDegrees: (Math.acos(cos) * 180) / Math.PI,
        });
      }
    }
  }

  const result: BondMetricsResult = { lengths, angles };
  bondMetricsCache.set(m, result);
  return result;
}

// ── Phase 12 §6.11 retrofit — IngestError → i18n 매핑 ──

export interface IngestErrorMapping {
  readonly key: string;
  readonly params?: Readonly<Record<string, string | number>>;
  readonly action?: 'open-compound-browser' | 'activate-existing' | 'reload-page' | null;
}

export function mapIngestErrorToKey(e: IngestError): IngestErrorMapping {
  switch (e.kind) {
    case 'parse':
      return parseErrorToMapping(e.detail);
    case 'embed':
      return embedErrorToMapping(e.detail);
    case 'pubchem':
      // 본 Phase 미사용 (text input 은 PubChem 미경유). addFromCompound 만 발생.
      return {
        key: 'common.ingest.error.internal',
        params: { message: e.detail.kind },
      };
    case 'duplicate':
      return {
        key: 'common.ingest.error.duplicate',
        params: { existingId: e.existingId },
        action: 'activate-existing',
      };
    case 'rdkit-not-ready':
      return { key: 'common.ingest.error.rdkitNotReady', action: 'reload-page' };
    case 'internal':
      return { key: 'common.ingest.error.internal', params: { message: e.message } };
  }
}

function parseErrorToMapping(p: ParseError): IngestErrorMapping {
  switch (p.code) {
    case 'InputEmpty':
      return { key: 'common.ingest.error.parse.empty' };
    case 'InputTooLong':
      return { key: 'common.ingest.error.parse.tooLong' };
    case 'SmilesSyntax':
      return p.at !== undefined
        ? { key: 'common.ingest.error.parse.smilesSyntaxAt', params: { at: p.at } }
        : { key: 'common.ingest.error.parse.smilesSyntax' };
    case 'InchiSyntax':
      return { key: 'common.ingest.error.parse.inchiSyntax' };
    case 'FormulaSyntax':
      return { key: 'common.ingest.error.parse.formulaSyntax' };
    case 'FormulaUnsupported':
      return {
        key: 'common.ingest.error.parse.formulaUnsupported',
        action: 'open-compound-browser',
      };
    case 'UnknownElement':
      return { key: 'common.ingest.error.parse.unknownElement' };
    case 'SanitizationFailed':
      return { key: 'common.ingest.error.parse.sanitization' };
    case 'RdkitNotReady':
      return { key: 'common.ingest.error.rdkitNotReady', action: 'reload-page' };
    case 'InternalError':
      return { key: 'common.ingest.error.parse.generic', params: { message: p.message } };
  }
}

function embedErrorToMapping(e: EmbedError): IngestErrorMapping {
  switch (e.code) {
    case 'EmbedTimeout':
      return { key: 'common.ingest.error.embed.timeout' };
    case 'EmbedFailed':
      return { key: 'common.ingest.error.embed.failed' };
    case 'IonHandlingFailed':
      return { key: 'common.ingest.error.embed.ionHandling' };
    case 'InvalidMolecule':
      return { key: 'common.ingest.error.embed.invalidMolecule' };
    case 'RdkitNotReady':
      return { key: 'common.ingest.error.rdkitNotReady', action: 'reload-page' };
    case 'InternalError':
      return { key: 'common.ingest.error.embed.generic', params: { message: e.message } };
  }
}

// ── Phase 13 §4.6 / §6.13 retrofit — ExportError / ImportError → i18n 매핑 ──

export interface IoErrorMapping {
  readonly key: string;
  readonly params?: Readonly<Record<string, string | number>>;
  readonly action?: 'retry' | 'pick-file-again' | 'reload-page' | null;
}

/** 1 MB 미만은 소수 2 자리, 그 외는 정수. i18n 표시용 helper. */
function formatMb(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(2);
}

/** ExportError → IoErrorMapping. i18n 키는 common.io.error.export.* 트리. */
export function mapExportErrorToKey(e: ExportError): IoErrorMapping {
  switch (e.kind) {
    case 'CanvasNotReady':
      return { key: 'common.io.error.export.canvasNotReady', action: 'retry' };
    case 'CaptureFailed':
      return {
        key: 'common.io.error.export.captureFailed',
        params: { message: e.message },
        action: 'retry',
      };
    case 'SdfSerializationFailed':
      return {
        key: 'common.io.error.export.sdfFailed',
        params: { moleculeId: e.moleculeId },
      };
    case 'JsonSerializationFailed':
      return {
        key: 'common.io.error.export.jsonFailed',
        params: { message: e.message },
      };
    case 'NothingToExport':
      return { key: 'common.io.error.export.nothingToExport' };
    case 'FileTooLarge':
      return {
        key: 'common.io.error.export.fileTooLarge',
        params: { sizeMb: formatMb(e.sizeBytes), limitMb: formatMb(e.limitBytes) },
      };
    case 'UserAborted':
      return { key: 'common.io.error.export.userAborted' };
    case 'Internal':
      return {
        key: 'common.io.error.export.internal',
        params: { message: e.message },
      };
  }
}

/** ImportError → IoErrorMapping. i18n 키는 common.io.error.import.* 트리. */
export function mapImportErrorToKey(e: ImportError): IoErrorMapping {
  switch (e.kind) {
    case 'FileTooLarge':
      return {
        key: 'common.io.error.import.fileTooLarge',
        params: { sizeMb: formatMb(e.sizeBytes), limitMb: formatMb(e.limitBytes) },
        action: 'pick-file-again',
      };
    case 'JsonSyntax':
      return {
        key: 'common.io.error.import.jsonSyntax',
        params: { message: e.message },
        action: 'pick-file-again',
      };
    case 'SchemaMismatch':
      return {
        key: 'common.io.error.import.schemaMismatch',
        params: { path: e.path, message: e.message },
        action: 'pick-file-again',
      };
    case 'IncompatibleVersion':
      return {
        key: 'common.io.error.import.incompatibleVersion',
        params: { fileVersion: e.fileVersion, supportedVersion: e.supportedVersion },
      };
    case 'EmptyFile':
      return { key: 'common.io.error.import.empty', action: 'pick-file-again' };
    case 'NoMolecules':
      return { key: 'common.io.error.import.noMolecules', action: 'pick-file-again' };
    case 'PartiallyFailed':
      return {
        key: 'common.io.error.import.partial',
        params: { imported: e.imported, skipped: e.skipped },
      };
    case 'UserAborted':
      return { key: 'common.io.error.import.userAborted' };
    case 'Internal':
      return {
        key: 'common.io.error.import.internal',
        params: { message: e.message },
      };
  }
}

/**
 * Phase 13 §6.13 의 통합 진입점. ExportError 와 ImportError 는 일부 kind 가 동일 shape
 * (`FileTooLarge` / `UserAborted` / `Internal`) 이지만 i18n 키 트리가 export.* / import.*
 * 로 분리되어 있어, **호출자가 context 를 명시**해야 한다 (advisor 결정).
 * - 단일 함수 시그니처는 ExportError | ImportError 유니온 + context 필수.
 * - 내부에서 mapExportErrorToKey / mapImportErrorToKey 로 dispatch.
 *
 * Note: TS 의 구조적 타이핑 한계로 유니온의 일부 kind 가 양측에 존재 — 본 함수는
 * context 파라미터로 i18n 키 트리를 결정하므로 ambiguity 가 사라진다.
 */
export function mapIoErrorToKey(
  e: ExportError | ImportError,
  context: 'export' | 'import',
): IoErrorMapping {
  if (context === 'export') {
    return mapExportErrorToKey(e as ExportError);
  }
  return mapImportErrorToKey(e as ImportError);
}
