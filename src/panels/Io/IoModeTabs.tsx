// Phase 13 §6.2 — IoModeTabs. Radix Tabs (←/→ nav + aria-selected 무료).
// 4 tabs: png-export / json-export / sdf-export / json-import.
// Phase 15 §6.4 retrofit — 빈 TabsContent 동반 (axe aria-valid-attr-value 해소).
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components';
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
      <TabsContent value="png-export" />
      <TabsContent value="json-export" />
      <TabsContent value="sdf-export" />
      <TabsContent value="json-import" />
    </Tabs>
  );
}
