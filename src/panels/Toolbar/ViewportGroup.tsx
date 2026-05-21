// Phase 13 §6.16 — Capture PNG IconButton 제거 → Export dropdown (PNG/JSON/SDF) + Import.
// 클릭 시 uiStore.setIoInitialMode + toggleIo(true) 로 IoDialog 오픈 (D-IO-MOUNT).
// Frame Active/All/Reset Camera 는 phase-11 원형 그대로 유지 (KEY_MAP hint 포함).
import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { RefObject } from 'react';
import type { ViewportApi } from '@/viewport';
import { KEY_MAP, describeKey } from '@/viewport';
import { useUiStore } from '@/stores';
import type { IoMode } from '@/stores';
import { IconButton, Tooltip, Popover, PopoverTrigger, PopoverContent } from '@/components';
import { Maximize, Box, RotateCcw, Download, Upload, Image, FileText, Atom } from 'lucide-react';

interface Props {
  readonly apiRef: RefObject<ViewportApi | null>;
}

const hint = (t: (k: string) => string, label: string, id: string): string => {
  const b = KEY_MAP.find((x) => x.id === id);
  return b ? `${t(label)} (${describeKey(b)})` : t(label);
};

export function ViewportGroup({ apiRef }: Props): React.ReactElement {
  const { t } = useTranslation('panels');
  const noApi = !apiRef.current;
  const toggleIo = useUiStore((s) => s.actions.toggleIo);
  const setIoInitialMode = useUiStore((s) => s.actions.setIoInitialMode);

  const openIo = (mode: IoMode): void => {
    setIoInitialMode(mode);
    toggleIo(true);
  };

  return (
    <>
      <Tooltip content={hint(t, 'toolbar.frameActive', 'frameActive')}>
        <IconButton
          aria-label={t('toolbar.frameActive')}
          disabled={noApi}
          onClick={() => apiRef.current?.frameActive()}
        >
          <Maximize size={18} />
        </IconButton>
      </Tooltip>
      <Tooltip content={t('toolbar.frameAll')}>
        <IconButton
          aria-label={t('toolbar.frameAll')}
          disabled={noApi}
          onClick={() => apiRef.current?.frameAll()}
        >
          <Box size={18} />
        </IconButton>
      </Tooltip>
      <Tooltip content={hint(t, 'toolbar.resetCamera', 'resetCamera')}>
        <IconButton
          aria-label={t('toolbar.resetCamera')}
          disabled={noApi}
          onClick={() => apiRef.current?.resetCamera()}
        >
          <RotateCcw size={18} />
        </IconButton>
      </Tooltip>

      {/* Export dropdown — PNG/JSON/SDF (Phase 13 §6.16). */}
      <Popover>
        <PopoverTrigger asChild>
          <Tooltip content={t('toolbar.export')}>
            <IconButton aria-label={t('toolbar.export')}>
              <Download size={18} />
            </IconButton>
          </Tooltip>
        </PopoverTrigger>
        <PopoverContent>
          <div className="flex min-w-40 flex-col gap-1">
            <button
              type="button"
              onClick={() => openIo('png-export')}
              className="flex items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-bg-panel-elevated"
            >
              <Image size={14} /> {t('io.modeLabel.pngExport')}
            </button>
            <button
              type="button"
              onClick={() => openIo('json-export')}
              className="flex items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-bg-panel-elevated"
            >
              <FileText size={14} /> {t('io.modeLabel.jsonExport')}
            </button>
            <button
              type="button"
              onClick={() => openIo('sdf-export')}
              className="flex items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-bg-panel-elevated"
            >
              <Atom size={14} /> {t('io.modeLabel.sdfExport')}
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Import button (JSON only). */}
      <Tooltip content={t('toolbar.import')}>
        <IconButton aria-label={t('toolbar.import')} onClick={() => openIo('json-import')}>
          <Upload size={18} />
        </IconButton>
      </Tooltip>
    </>
  );
}
