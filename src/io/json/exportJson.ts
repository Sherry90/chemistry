// Phase 13 §6.10 — JSON session export.
// 동기 read (모든 store getState() sync) → SessionFile 구성 → JSON.stringify → Blob.
import type { Result } from '@/types/result';
import { ok, err } from '@/types/result';
import { useMoleculeStore, useReactionStore, useUiStore } from '@/stores';
import { toSnapshot } from '@/chemistry/session/snapshot';
import type { SessionFile, MoleculeSnapshot, SerializedSelection } from '@/chemistry/session/types';
import { buildFilename } from '../_shared/download';
import type { ExportError } from '../_shared/errors';

const APP_VERSION = '0.1.0';

/**
 * 현재 세션을 JSON 으로 직렬화.
 *
 * - scope='active' → activeId 의 분자만 (없으면 NothingToExport).
 * - scope='all'    → 모든 분자 (s.ids 순서).
 * - 분자 0 개 → NothingToExport.
 *
 * NOTE: selection 직렬화는 v1 빈 객체로 둔다. snapshot 은 atom/bond id 를 보존하지
 *       않으므로, viewport ID (`${molId}::a:${atomId}`) → moleculeIndex/atomIndex
 *       환원은 chemistry/session/selection.ts (W3.x / phase-14) 도입 후 활성화.
 *       현재 round-trip 은 selection 없이 분자/조건/뷰포트 옵션만 보존.
 */
export function exportJson(args: {
  readonly scope: 'active' | 'all';
}): Result<{ blob: Blob; filename: string }, ExportError> {
  try {
    const moleculeState = useMoleculeStore.getState();
    const reactionState = useReactionStore.getState();
    const uiState = useUiStore.getState();

    const allSnapshots: ReadonlyArray<MoleculeSnapshot> = moleculeState.ids.map((id) =>
      toSnapshot(moleculeState.molecules[id]!),
    );

    let snapshots: ReadonlyArray<MoleculeSnapshot>;
    if (args.scope === 'active') {
      const activeId = moleculeState.activeId;
      const m = activeId ? moleculeState.molecules[activeId] : null;
      snapshots = m ? [toSnapshot(m)] : [];
    } else {
      snapshots = allSnapshots;
    }

    if (snapshots.length === 0) {
      return err({ kind: 'NothingToExport' });
    }

    // TODO phase-14 — chemistry/session/selection.ts 의 serializeSelectionWithMolecules
    //                 도입 후 uiState.selection 의 viewport ID 문자열을 moleculeIndex/
    //                 atomIndex 로 환원. v1 은 빈 selection 으로 round-trip.
    const selection: SerializedSelection = { atomIds: [], bondIds: [] };

    const session: SessionFile = {
      schemaVersion: 1,
      app: { name: 'chemistry-platform', version: APP_VERSION },
      exportedAt: new Date().toISOString(),
      molecules: snapshots,
      activeMoleculeId:
        args.scope === 'active'
          ? (moleculeState.activeId ?? null)
          : (moleculeState.activeId ?? null),
      condition: reactionState.condition,
      selection,
      viewport: {
        showAtomLabels: uiState.viewport.showAtomLabels,
        backgroundOverride: uiState.viewport.backgroundOverride,
      },
    };

    const json = JSON.stringify(session, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const filename = buildFilename('chemistry', 'json');
    return ok({ blob, filename });
  } catch (e) {
    return err({
      kind: 'JsonSerializationFailed',
      message: e instanceof Error ? e.message : String(e),
    });
  }
}
