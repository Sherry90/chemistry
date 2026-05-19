// Phase 11 §6.1 — WAI-ARIA grid + roving tabindex + 화살표/Home/End nav.
import type * as React from 'react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PeriodicTableCell, Element } from '@/chemistry/elements';
import { useSettingsStore, selectLocale } from '@/stores';
import { Tooltip } from '@/components';
import { cn } from '../_shared/cn';

interface Props {
  readonly layout: readonly PeriodicTableCell[];
  readonly onSelect: (e: Element) => void;
  readonly selected: Element | null;
}

export function PeriodicGrid({ layout, onSelect, selected }: Props): React.ReactElement {
  const { t } = useTranslation('panels');
  const locale = useSettingsStore(selectLocale);
  // roving tabindex — 정확히 1 셀만 tabIndex=0.
  const [activeZ, setActiveZ] = useState<number>(selected?.number ?? 1);
  const cellRefs = useRef(new Map<number, HTMLButtonElement | null>());

  const focusCell = (z: number): void => {
    setActiveZ(z);
    cellRefs.current.get(z)?.focus();
  };

  const moveFocus = (fromEl: Element, key: string): void => {
    const cur = layout.find((c) => c.element.number === fromEl.number);
    if (!cur) return;
    const inRow = layout.filter((c) => c.row === cur.row);
    const target =
      key === 'ArrowRight'
        ? layout.find((c) => c.row === cur.row && c.column === cur.column + 1)
        : key === 'ArrowLeft'
          ? layout.find((c) => c.row === cur.row && c.column === cur.column - 1)
          : key === 'ArrowDown'
            ? layout.find((c) => c.column === cur.column && c.row === cur.row + 1)
            : key === 'ArrowUp'
              ? layout.find((c) => c.column === cur.column && c.row === cur.row - 1)
              : key === 'Home'
                ? [...inRow].sort((a, b) => a.column - b.column)[0]
                : key === 'End'
                  ? [...inRow].sort((a, b) => b.column - a.column)[0]
                  : undefined;
    if (target) focusCell(target.element.number);
  };

  return (
    <div
      role="grid"
      aria-label={t('periodicTable.title')}
      className="grid gap-1"
      style={{ gridTemplateColumns: 'repeat(18, minmax(0, 1fr))' }}
    >
      {layout.map(({ element, row, column }) => {
        const isSelected = selected?.number === element.number;
        const name = locale === 'ko' ? element.nameKo : element.nameEn;
        return (
          <Tooltip key={element.number} content={`${name} (Z=${element.number})`}>
            <button
              type="button"
              role="gridcell"
              ref={(el) => {
                cellRefs.current.set(element.number, el);
              }}
              tabIndex={element.number === activeZ ? 0 : -1}
              aria-label={`${name}, Z=${element.number}`}
              aria-selected={isSelected}
              onClick={() => {
                setActiveZ(element.number);
                onSelect(element);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(element);
                  return;
                }
                if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') {
                  e.preventDefault();
                  moveFocus(element, e.key);
                }
              }}
              className={cn(
                'aspect-square rounded p-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                isSelected && 'ring-2 ring-accent',
              )}
              style={{ gridRow: row, gridColumn: column, backgroundColor: element.cpkColorHex }}
            >
              <div className="text-[8px] text-fg-muted">{element.number}</div>
              <div className="text-base font-bold text-fg-primary">{element.symbol}</div>
              <div className="text-[8px] text-fg-muted">{element.atomicMass.toFixed(2)}</div>
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
