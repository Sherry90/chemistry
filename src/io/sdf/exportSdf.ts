// Phase 13 §6.11 — SDF 구조 export (multi-record).
// 현재 toSdfBlock(mol): string 시그니처 (engine §3 의 phase-03 sync 직렬화) 가정.
// 각 분자의 SDF block 을 `$$$$\n` separator 로 join.
import type { Result } from '@/types/result';
import { ok, err } from '@/types/result';
import { useMoleculeStore } from '@/stores';
import { toSdfBlock } from '@/engine/rdkit';
import type { Molecule } from '@/chemistry/compounds/types';
import { buildFilename } from '../_shared/download';
import type { ExportError } from '../_shared/errors';

// `toSdfBlock` 본 구현은 각 record 끝에 이미 `$$$$` 을 포함 → 단순 join 으로 충분.
// 호환 안전을 위해 record 사이에 명시 newline 보장.
const SDF_MIME = 'chemical/x-mdl-sdfile';
const RECORD_SEPARATOR = '\n';

export function exportSdf(args: {
  readonly scope: 'active' | 'all';
}): Result<{ blob: Blob; filename: string }, ExportError> {
  const state = useMoleculeStore.getState();

  let molecules: ReadonlyArray<Molecule>;
  if (args.scope === 'active') {
    const m = state.activeId ? state.molecules[state.activeId] : undefined;
    molecules = m ? [m] : [];
  } else {
    molecules = state.ids
      .map((id) => state.molecules[id])
      .filter((m): m is Molecule => m !== undefined);
  }

  if (molecules.length === 0) {
    return err({ kind: 'NothingToExport' });
  }

  const blocks: string[] = [];
  for (const m of molecules) {
    try {
      const block = toSdfBlock(m);
      blocks.push(block);
    } catch (e) {
      return err({
        kind: 'SdfSerializationFailed',
        moleculeId: m.id,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const sdf = blocks.join(RECORD_SEPARATOR) + RECORD_SEPARATOR;
  const blob = new Blob([sdf], { type: SDF_MIME });
  const filename = buildFilename('chemistry', 'sdf');
  return ok({ blob, filename });
}
