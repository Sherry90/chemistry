// Phase 13 §6.9 — PNG/JPEG/WebP 스크린샷 export.
// ViewportApi.captureBlob 호출 + filename 생성.
import type { RefObject } from 'react';
import type { ViewportApi } from '@/viewport';
import type { Result } from '@/types/result';
import { ok, err } from '@/types/result';
import { buildFilename } from '../_shared/download';
import type { ExportError } from '../_shared/errors';
import type { PngExportOptions } from './types';

/**
 * Viewport 의 현재 프레임을 Blob 으로 capture 한다.
 *
 * - apiRef.current === null → CanvasNotReady.
 * - captureBlob throw → CaptureFailed { message }.
 * - JPEG 는 알파를 지원하지 않으므로 transparentBackground 를 강제로 false.
 *
 * NOTE: timeoutMs 는 v1 미구현 — captureBlob 자체의 시간 보장이 없는 한
 *       호출자가 책임 (UI 가 spinner 만 표시). 본 phase 미수용.
 */
export async function exportPng(args: {
  readonly apiRef: RefObject<ViewportApi | null>;
  readonly options: PngExportOptions;
  readonly timeoutMs?: number;
}): Promise<Result<{ blob: Blob; filename: string }, ExportError>> {
  const api = args.apiRef.current;
  if (!api) return err({ kind: 'CanvasNotReady' });

  try {
    const blob = await api.captureBlob({
      format: args.options.format,
      dpr: args.options.dpr,
      transparentBackground:
        args.options.format === 'jpeg' ? false : args.options.transparentBackground,
    });
    const filename = buildFilename('chemistry', args.options.format);
    return ok({ blob, filename });
  } catch (e) {
    return err({
      kind: 'CaptureFailed',
      message: e instanceof Error ? e.message : String(e),
    });
  }
}
