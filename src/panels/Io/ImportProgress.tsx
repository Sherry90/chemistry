// Phase 13 §6.7 — Import 중 진행 표시 오버레이. D-LOADING-OVERLAY: panel variant 의도.
// `LoadingOverlay` 는 `@/app/layout` 거주 — `panels/*` 가 직접 import 불가 (ESLint zone P1).
// `@/components` 미노출 → 본 파일이 inline overlay (Spinner + i18n 라벨) 로 구현.
// 진행 카운트 (N/M) 는 v1 미포함 (applyImportedSession progress callback 없음).
import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner, VisuallyHidden } from '@/components';

interface Props {
  readonly visible: boolean;
}

export function ImportProgress({ visible }: Props): React.ReactElement | null {
  const { t } = useTranslation('panels');
  if (!visible) return null;
  return (
    <div
      role="status"
      aria-busy="true"
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-bg-panel/80"
    >
      <Spinner size="lg" />
      <p className="text-sm text-fg-primary">{t('io.jsonImport.importing')}</p>
      <VisuallyHidden>{t('io.jsonImport.importing')}</VisuallyHidden>
    </div>
  );
}
