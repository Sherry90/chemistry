// Phase 09 §6.7 (D15) — unmount fade-out + delayed real unmount wrapper.
// moleculeStore 에서 분자가 사라져도 즉시 unmount 하지 않고 opacity 1→0 보간
// 후 durationMs 뒤 실제 unmount (React.startTransition + setTimeout).
// 보간은 setInterval 샘플링 (useFrame 비의존 — wrapper 가 jsdom 에서도 동작,
// 시각 회귀는 Phase 15 Playwright). mount fade-in 은 inner 의 useFadeOnMount.
import type * as React from 'react';
import { useEffect, useRef, useState, startTransition, createElement } from 'react';
import { useMoleculeStore } from '@/stores';
import type { MoleculeId } from '@/chemistry/compounds/ids';
import { exitOpacity } from './easing';
import { registerAnimation, clearAnimation } from './animationRegistry';

const DEFAULT_FADE_MS = 150;

export interface MoleculeFadeOpts {
  readonly durationMs?: number;
}

/**
 * Component 는 `fadeOpacity` 를 받아 머티리얼 opacity 에 곱한다. wrapper 는
 * 분자 존재 여부만 구독하고 perse 렌더는 Component 책임 (selector 분리).
 */
// 문서 §6.7 의 명칭은 `useMoleculeFadeWrapper` 이나, 이는 hook 이 아닌 HOC
// 팩토리다 (반환 컴포넌트만 hook 사용). `use*` 접두사는 react-hooks/rules-of-hooks
// 가 top-level 호출을 오탐하므로 HOC 관례명 `withMoleculeFade` 로 노출.
export function withMoleculeFade<P extends { readonly molId: MoleculeId }>(
  Component: React.ComponentType<P & { readonly fadeOpacity: number }>,
  opts?: MoleculeFadeOpts,
): React.ComponentType<P> {
  const durationMs = opts?.durationMs ?? DEFAULT_FADE_MS;

  function Faded(props: P): React.ReactElement | null {
    const molId = props.molId;
    const present = useMoleculeStore((s) => Boolean(s.molecules[molId]));
    const [render, setRender] = useState(present);
    const [, force] = useState(0);
    const exitStartRef = useRef<number | null>(null);

    useEffect(() => {
      if (present) {
        // 재등장 — 진행 중 exit 취소 (R4), 다시 표시.
        clearAnimation(`fade:${molId}`);
        exitStartRef.current = null;
        setRender(true);
        return;
      }
      if (!render) return;
      // 분자 제거됨 → exit 시작.
      exitStartRef.current = Date.now();
      const sample = setInterval(() => force((n) => n + 1), 16);
      const remove = setTimeout(() => {
        clearInterval(sample);
        startTransition(() => setRender(false));
        clearAnimation(`fade:${molId}`);
      }, durationMs);
      const cancel = (): void => {
        clearInterval(sample);
        clearTimeout(remove);
      };
      registerAnimation(`fade:${molId}`, cancel);
      return cancel;
    }, [present, render, molId]);

    if (!render) return null;
    // present 면 항상 1 (mount fade-in 은 inner useFadeOnMount 책임). exit 중일
    // 때만 보간 — 재등장 렌더에서 stale exitStartRef 를 읽지 않도록 present 게이트.
    const start = exitStartRef.current;
    const fadeOpacity = present || start == null ? 1 : exitOpacity(Date.now() - start, durationMs);
    return createElement(Component, { ...props, fadeOpacity });
  }

  Faded.displayName = `MoleculeFade(${Component.displayName ?? Component.name ?? 'Component'})`;
  return Faded;
}
