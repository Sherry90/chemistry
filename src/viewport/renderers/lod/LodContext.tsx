// Phase 14 §5.2 — LodContext + LodProvider.
import type * as React from 'react';
import { createContext, useContext } from 'react';
import type { LodLevel } from '@/viewport/_shared/types';
import { useLodLevel } from './useLodLevel';

export const LodContext = createContext<LodLevel>('high');

interface ProviderProps {
  readonly children: React.ReactNode;
}

export function LodProvider({ children }: ProviderProps): React.ReactElement {
  const level = useLodLevel();
  return <LodContext.Provider value={level}>{children}</LodContext.Provider>;
}

export function useLodContext(): LodLevel {
  return useContext(LodContext);
}
