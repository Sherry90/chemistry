// Phase 13 §6.2 — IoModeTabs. Radix Tabs (←/→ nav + aria-selected 무료).
// 4 tabs: png-export / json-export / sdf-export / json-import.
import { Tabs, TabsList, TabsTrigger } from '@/components';
import { useTranslation } from 'react-i18next';
import { Image, FileText, Atom, Upload } from 'lucide-react';
import type { IoMode } from './types';

interface Props {
  readonly mode: IoMode;
  readonly onChange: (m: IoMode) => void;
}

export function IoModeTabs({ mode, onChange }: Props) {
  const { t } = useTranslation('panels');
  return (
    <Tabs value={mode} onValueChange={(v) => onChange(v as IoMode)}>
      <TabsList>
        <TabsTrigger value="png-export">
          <Image aria-hidden size={14} className="mr-1" />
          {t('io.modeLabel.pngExport')}
        </TabsTrigger>
        <TabsTrigger value="json-export">
          <FileText aria-hidden size={14} className="mr-1" />
          {t('io.modeLabel.jsonExport')}
        </TabsTrigger>
        <TabsTrigger value="sdf-export">
          <Atom aria-hidden size={14} className="mr-1" />
          {t('io.modeLabel.sdfExport')}
        </TabsTrigger>
        <TabsTrigger value="json-import">
          <Upload aria-hidden size={14} className="mr-1" />
          {t('io.modeLabel.jsonImport')}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
