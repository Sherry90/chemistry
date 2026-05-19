// Phase 11 §6.2 — 검색 입력 (autoFocus). Input primitive 위.
import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components';
import { Search } from 'lucide-react';

interface Props {
  readonly value: string;
  readonly onChange: (q: string) => void;
}

export function SearchInput({ value, onChange }: Props): React.ReactElement {
  const { t } = useTranslation('panels');
  return (
    <div className="relative flex-1">
      <Search
        size={16}
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted"
      />
      <Input
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('compoundBrowser.searchPlaceholder')}
        aria-label={t('compoundBrowser.searchPlaceholder')}
        className="pl-9"
      />
    </div>
  );
}
