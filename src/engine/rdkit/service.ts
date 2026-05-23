import type { RDKitModule, RDKitLoader } from '@rdkit/rdkit';
// Phase 15 §6.1 retrofit — Vite `?url` 임포트로 WASM 정적 자산 등록.
// 평시 RDKit_minimal.js 는 `document.currentScript.src` 기준 상대 fetch,
// Vite 번들 후 그 경로에 .wasm 미존재 → locateFile 콜백으로 우회.
import rdkitWasmUrl from '@rdkit/rdkit/dist/RDKit_minimal.wasm?url';
import type { RdkitInitError, RdkitStatus } from './types';

type StatusListener = (status: RdkitStatus) => void;

let rdkitInstance: RDKitModule | null = null;
let initPromise: Promise<void> | null = null;
let currentStatus: RdkitStatus = { phase: 'idle' };
const listeners = new Set<StatusListener>();

function broadcast(status: RdkitStatus): void {
  currentStatus = status;
  for (const l of listeners) l(status);
}

export function getRdkitInstance(): RDKitModule | null {
  return rdkitInstance;
}

export function getRdkitStatus(): RdkitStatus {
  return currentStatus;
}

export function onRdkitStatusChange(listener: StatusListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function ensureRdkit(): Promise<void> {
  if (rdkitInstance !== null) return;
  if (initPromise !== null) return initPromise;

  initPromise = (async () => {
    broadcast({ phase: 'loading' });
    try {
      // RDKit_minimal.js sets module.exports = initRDKitModule
      const rdkitPkg = (await import('@rdkit/rdkit')) as unknown as { default: RDKitLoader };
      const initFn: RDKitLoader = rdkitPkg.default;
      const mod = await initFn({ locateFile: () => rdkitWasmUrl });
      rdkitInstance = mod;
      broadcast({ phase: 'ready' });
    } catch (cause) {
      const code = (cause as { code?: RdkitInitError['code'] }).code ?? 'InternalError';
      const rdkitErr: RdkitInitError = {
        code,
        message: cause instanceof Error ? cause.message : String(cause),
        cause,
      };
      broadcast({ phase: 'error', error: rdkitErr });
      initPromise = null;
      throw rdkitErr;
    }
  })();

  return initPromise;
}

export function disposeRdkit(): void {
  rdkitInstance = null;
  initPromise = null;
  broadcast({ phase: 'idle' });
}
