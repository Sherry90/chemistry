// Phase 13 §6.12 — JSON session import 진입점.
// File → text → JSON.parse → validateSessionFile → applyImportedSession 위임.
import type { Result } from '@/types/result';
import { err } from '@/types/result';
import { useMoleculeStore } from '@/stores';
import type { ImportError } from '../_shared/errors';
import { validateSessionFile } from './validate';

const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

/**
 * 사용자가 고른 JSON 파일을 import.
 *
 * 단계:
 *  1. 크기 검사: > maxFileSizeBytes → FileTooLarge.
 *  2. 크기 0 → EmptyFile.
 *  3. file.text() → JSON.parse (try/catch → JsonSyntax).
 *  4. validateSessionFile → Result<SessionFile, ImportError>.
 *  5. success → useMoleculeStore.actions.applyImportedSession(session, { mode }) 위임.
 *     결과(Result<{imported, skipped}, ImportError>) 를 그대로 반환.
 *
 * NOTE: applyImportedSession 은 W2.2 가 moleculeStore 에 추가한다 (phase-13 §6.14).
 *       본 모듈은 인터페이스 의존만 — typecheck 는 W2.2 완료 시 통과.
 */
export async function importJson(args: {
  readonly file: File;
  readonly mode: 'replace' | 'append';
  readonly maxFileSizeBytes?: number;
}): Promise<Result<{ imported: number; skipped: number }, ImportError>> {
  const limit = args.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE;

  if (args.file.size > limit) {
    return err({
      kind: 'FileTooLarge',
      sizeBytes: args.file.size,
      limitBytes: limit,
    });
  }
  if (args.file.size === 0) {
    return err({ kind: 'EmptyFile' });
  }

  let text: string;
  try {
    text = await args.file.text();
  } catch (e) {
    return err({
      kind: 'Internal',
      message: e instanceof Error ? e.message : String(e),
    });
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // JSON.parse error message 에서 position 추출 (best-effort).
    const match = message.match(/position (\d+)/);
    // exactOptionalPropertyTypes: undefined 는 누락 = 키 자체 생략.
    return err(
      match
        ? { kind: 'JsonSyntax', message, at: Number(match[1]) }
        : { kind: 'JsonSyntax', message },
    );
  }

  const validation = validateSessionFile(json);
  if (!validation.ok) return validation;

  const session = validation.value;
  const applyAction = useMoleculeStore.getState().actions.applyImportedSession;
  return applyAction(session, { mode: args.mode });
}
