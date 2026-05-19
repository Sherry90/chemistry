// Phase 11 §6.2 / D-COMPOUND-CATEGORY-DISPLAY — flat chip 다중 선택.
// v1: 선택은 success 결과를 클라이언트 필터 (store categories 미지원 — 트리는
// §11 #4 / Phase 14). 카테고리 목록은 정적 manifest.
import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import { getCompoundManifest } from '@/data/compounds';
import type { CompoundCategory } from '@/chemistry/compounds/categories';
import { cn } from '../_shared/cn';

interface Props {
  readonly selected: ReadonlyArray<CompoundCategory>;
  readonly onToggle: (c: CompoundCategory) => void;
}

export function CategoryChips({ selected, onToggle }: Props): React.ReactElement {
  const { t } = useTranslation('panels');
  const categories = Object.keys(getCompoundManifest().categories) as CompoundCategory[];

  return (
    <div
      className="flex flex-wrap gap-1.5"
      role="group"
      aria-label={t('compoundBrowser.categoryChips.label')}
    >
      {categories.map((c) => {
        const on = selected.includes(c);
        return (
          <button
            key={c}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(c)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
              on
                ? 'border-accent bg-accent text-accent-fg'
                : 'border-border bg-bg-panel text-fg-muted hover:bg-bg-panel-elevated',
            )}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}
