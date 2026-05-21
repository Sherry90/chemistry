// Phase 12 §6.3 — usePreviewParse: 디바운스 + previewFromText 호출 + AbortController inflight 관리.
import { useEffect, useRef, useState } from 'react';
import { useMoleculeStore } from '@/stores';
import type { PreviewState, TextInputMode } from './types';

interface Args {
  readonly mode: TextInputMode;
  readonly raw: string;
  readonly debounceMs: number;
}

export function usePreviewParse({ mode, raw, debounceMs }: Args): PreviewState {
  const [state, setState] = useState<PreviewState>({ kind: 'idle' });
  const previewFromText = useMoleculeStore((s) => s.actions.previewFromText);
  const acRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // raw 비어있으면 idle.
    if (raw.trim().length === 0) {
      setState({ kind: 'idle' });
      acRef.current?.abort();
      acRef.current = null;
      return;
    }

    const handle = setTimeout(() => {
      // 이전 inflight abort
      acRef.current?.abort();
      const ac = new AbortController();
      acRef.current = ac;

      setState({ kind: 'loading', startedAt: Date.now() });

      void previewFromText({ kind: mode, raw: raw.trim(), signal: ac.signal }).then((result) => {
        // abort 후 결과는 무시 (StaleClosure 방지)
        if (ac.signal.aborted) return;

        if (result.ok) {
          setState({ kind: 'success', value: result.value, settledAt: Date.now() });
        } else {
          setState({ kind: 'error', error: result.error, settledAt: Date.now() });
        }
      });
    }, debounceMs);

    return () => {
      clearTimeout(handle);
      // mode 변경 / raw 변경 / unmount 시 inflight 도 abort
      acRef.current?.abort();
    };
  }, [mode, raw, debounceMs, previewFromText]);

  return state;
}
