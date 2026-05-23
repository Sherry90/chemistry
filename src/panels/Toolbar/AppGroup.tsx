// Phase 11 §6.6 / D-SHORTCUT-OPEN-STATE — 테마/언어/단축키 시트. '?' 디스패치는
// shortcutBus(installAppShortcuts onAction 단일 소스) 구독 — 별도 keydown 금지.
import type * as React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore, selectTheme } from '@/stores';
// 언어는 Phase 01 useLocale 컨텍스트가 i18n 을 구동 (settingsStore.locale 은
// i18n 미연동 — 문서 §6.6 의 settingsStore 가정과 실제 배선 불일치 정합).
import { useLocale } from '@/hooks/useLocale';
import { Switch, IconButton, Tooltip, Popover, PopoverTrigger, PopoverContent } from '@/components';
import { Globe } from 'lucide-react';
import { Keyboard } from 'lucide-react';
import { ShortcutSheet } from './ShortcutSheet';
import { subscribeShortcutAction } from './shortcutBus';

export function AppGroup(): React.ReactElement {
  const { t } = useTranslation('panels');
  const theme = useSettingsStore(selectTheme);
  const setTheme = useSettingsStore((s) => s.actions.setTheme);
  const { locale, setLocale } = useLocale();
  const [shortcutOpen, setShortcutOpen] = useState(false);

  useEffect(
    () =>
      subscribeShortcutAction((action) => {
        if (action === 'showShortcutSheet') setShortcutOpen((o) => !o);
      }),
    [],
  );

  return (
    <>
      <Tooltip content={t('toolbar.theme')}>
        <Switch
          checked={theme === 'dark'}
          onCheckedChange={(c) => setTheme(c ? 'dark' : 'light')}
          aria-label={t('toolbar.theme')}
        />
      </Tooltip>
      <Tooltip content={t('toolbar.language')}>
        <IconButton
          aria-label={t('toolbar.language')}
          data-testid="toolbar-language"
          onClick={() => setLocale(locale === 'ko' ? 'en' : 'ko')}
        >
          <Globe size={18} />
          <span className="ml-1 text-xs">{locale.toUpperCase()}</span>
        </IconButton>
      </Tooltip>
      <Popover open={shortcutOpen} onOpenChange={setShortcutOpen}>
        <PopoverTrigger asChild>
          <Tooltip content={`${t('toolbar.shortcuts')} (?)`}>
            <IconButton aria-label={t('toolbar.shortcuts')}>
              <Keyboard size={18} />
            </IconButton>
          </Tooltip>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="end" className="w-96">
          <ShortcutSheet />
        </PopoverContent>
      </Popover>
    </>
  );
}
