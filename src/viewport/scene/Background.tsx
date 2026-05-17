// Phase 08 §6.6 — 테마/오버라이드 배경색.
import type * as React from 'react';
import { useEffect, useState } from 'react';
import { useSettingsStore, useUiStore, selectTheme, selectBackgroundOverride } from '@/stores';
import type { Theme } from '@/stores';
import { THEME_DARK_BG, THEME_LIGHT_BG, type BackgroundResolved } from '../_shared/types';

type Override = 'theme' | 'light' | 'dark';

const LIGHT: BackgroundResolved = { mode: 'theme-light', hex: THEME_LIGHT_BG };
const DARK: BackgroundResolved = { mode: 'theme-dark', hex: THEME_DARK_BG };
const OVERRIDE_LIGHT: BackgroundResolved = { mode: 'override-light', hex: THEME_LIGHT_BG };
const OVERRIDE_DARK: BackgroundResolved = { mode: 'override-dark', hex: THEME_DARK_BG };

function prefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

/**
 * 우선순위 (architecture §3.10): override(light/dark 명시) > theme(system 시 OS) > light.
 */
export function resolveBackground(theme: Theme, override: Override): BackgroundResolved {
  if (override === 'light') return OVERRIDE_LIGHT;
  if (override === 'dark') return OVERRIDE_DARK;
  if (theme === 'system') return prefersDark() ? DARK : LIGHT;
  return theme === 'dark' ? DARK : LIGHT;
}

export function Background(): React.ReactElement {
  const theme = useSettingsStore(selectTheme);
  const override = useUiStore(selectBackgroundOverride) as Override;
  const [, force] = useState(0);

  // system 테마일 때 prefers-color-scheme 변경에 반응.
  useEffect(() => {
    if (theme !== 'system' || override !== 'theme') return;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => force((n) => n + 1);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [theme, override]);

  const resolved = resolveBackground(theme, override);
  return <color attach="background" args={[resolved.hex]} />;
}
