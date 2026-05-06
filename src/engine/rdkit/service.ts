import type { RDKitModule, RDKitLoader } from '@rdkit/rdkit';
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
      const mod = await initFn();
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
