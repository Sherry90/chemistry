// Phase 11 §6.6 — Frame Active/All/Reset/Capture (apiRef null → disabled).
// captureBlob 은 임시 download 헬퍼 (phase-13 이 io/png 정식 교체).
import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { RefObject } from 'react';
import type { ViewportApi } from '@/viewport';
import { KEY_MAP, describeKey } from '@/viewport';
import { IconButton, Tooltip } from '@/components';
import { Maximize, Box, RotateCcw, Camera } from 'lucide-react';

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

  const onCapture = async (): Promise<void> => {
    const api = apiRef.current;
    if (!api) return;
    const blob = await api.captureBlob({ format: 'png', dpr: 2 });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chemistry-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
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
      <Tooltip content={t('toolbar.capture')}>
        <IconButton
          aria-label={t('toolbar.capture')}
          disabled={noApi}
          onClick={() => void onCapture()}
        >
          <Camera size={18} />
        </IconButton>
      </Tooltip>
    </>
  );
}
