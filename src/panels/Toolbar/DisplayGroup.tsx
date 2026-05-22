// Phase 11 §6.6 — 원자 라벨 Switch + 렌더 모드 Popover(P10: 1옵션) + 배경.
import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  useUiStore,
  selectAtomLabelsOn,
  selectBackgroundOverride,
  useSettingsStore,
  selectRenderMode,
  type RenderMode,
} from '@/stores';
import { Switch, Popover, PopoverTrigger, PopoverContent, IconButton } from '@/components';
import { Tag, Atom, Palette, ChevronDown } from 'lucide-react';
import { cn } from '../_shared/cn';

export function DisplayGroup(): React.ReactElement {
  const { t } = useTranslation('panels');
  const labelsOn = useUiStore(selectAtomLabelsOn);
  const toggleLabels = useUiStore((s) => s.actions.toggleAtomLabels);
  const bg = useUiStore(selectBackgroundOverride);
  const setBg = useUiStore((s) => s.actions.setBackgroundOverride);
  const renderMode = useSettingsStore(selectRenderMode);
  const setRenderMode = useSettingsStore((s) => s.actions.setRenderMode);

  const KEY: Record<RenderMode, string> = {
    'ball-and-stick': 'ballAndStick',
    'space-filling': 'spaceFilling',
    wireframe: 'wireframe',
    stick: 'stick',
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Switch
          checked={labelsOn}
          onCheckedChange={(c) => toggleLabels(c)}
          aria-label={t('toolbar.labels')}
        />
        <Tag size={16} aria-hidden className="text-fg-muted" />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <IconButton aria-label={t('toolbar.renderMode.ballAndStick')}>
            <Atom size={18} />
            <ChevronDown size={12} />
          </IconButton>
        </PopoverTrigger>
        <PopoverContent>
          <div className="flex min-w-44 flex-col gap-1">
            {(['ball-and-stick', 'space-filling', 'wireframe', 'stick'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setRenderMode(mode)}
                className={cn(
                  'rounded px-2 py-1 text-left text-sm',
                  renderMode === mode && 'bg-bg-panel-elevated',
                )}
              >
                {t(`toolbar.renderMode.${KEY[mode]}`)}
              </button>
            ))}
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="cursor-not-allowed rounded px-2 py-1 text-left text-sm text-fg-muted"
            >
              {t('toolbar.renderMode.surface')}
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <IconButton aria-label={t('toolbar.background.theme')}>
            <Palette size={18} />
          </IconButton>
        </PopoverTrigger>
        <PopoverContent>
          <div className="flex min-w-32 flex-col gap-1">
            {(['theme', 'light', 'dark'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setBg(mode)}
                className={cn(
                  'rounded px-2 py-1 text-left text-sm',
                  bg === mode && 'bg-bg-panel-elevated',
                )}
              >
                {t(`toolbar.background.${mode}`)}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
