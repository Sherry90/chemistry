// Phase 11 §6.11 / D-SHORTCUT-SHEET-GROUPING — scope 별 (global/viewport).
// i18nLabelKey = 'shortcuts.${action}' → 기본 ns 'common' (shortcuts 병합) 해소.
import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import { KEY_MAP, describeKey } from '@/viewport';
import type { KeyBinding } from '@/viewport';
import { Separator } from '@/components';

function Section({
  title,
  bindings,
}: {
  readonly title: string;
  readonly bindings: ReadonlyArray<KeyBinding>;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <section>
      <h3 className="mb-2 text-xs font-medium uppercase text-fg-muted">{title}</h3>
      <ul className="flex flex-col gap-1">
        {bindings.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-fg-primary">{t(b.i18nLabelKey)}</span>
            <kbd className="rounded border border-border bg-bg-panel-elevated px-2 py-0.5 font-mono text-xs">
              {describeKey(b)}
            </kbd>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ShortcutSheet(): React.ReactElement {
  const { t } = useTranslation('panels');
  const globals = KEY_MAP.filter((b) => b.scope === 'global');
  const viewports = KEY_MAP.filter((b) => b.scope === 'viewport');
  return (
    <div className="flex max-h-96 flex-col gap-3 overflow-auto">
      <Section title={t('toolbar.shortcuts')} bindings={globals} />
      <Separator />
      {/* viewport scope 라벨 — Phase 15 i18n 폴리싱 (D-SHORTCUT-SHEET-GROUPING). */}
      <Section title="Viewport" bindings={viewports} />
    </div>
  );
}
