// Phase 12 §6.2 / D-MODE-RESET — Tabs (smiles / formula / inchi). 탭 전환 시 onChange 가 raw reset.
// Phase 15 §6.4 retrofit — TabsTrigger 의 aria-controls 가 IDREF 가리킬 수 있도록 빈 TabsContent
// 동반 (axe aria-valid-attr-value critical 해소). 실제 입력 영역 (InputArea/Preview) 은 외부.
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components';
import { useTranslation } from 'react-i18next';
import type { TextInputMode } from './types';

interface Props {
  readonly mode: TextInputMode;
  readonly onChange: (m: TextInputMode) => void;
}

export function ModeTabs({ mode, onChange }: Props) {
  const { t } = useTranslation('panels');
  return (
    <Tabs value={mode} onValueChange={(v) => onChange(v as TextInputMode)}>
      <TabsList>
        <TabsTrigger value="smiles">{t('textInput.modeTabs.smiles')}</TabsTrigger>
        <TabsTrigger value="formula">{t('textInput.modeTabs.formula')}</TabsTrigger>
        <TabsTrigger value="inchi">{t('textInput.modeTabs.inchi')}</TabsTrigger>
      </TabsList>
      <TabsContent value="smiles" />
      <TabsContent value="formula" />
      <TabsContent value="inchi" />
    </Tabs>
  );
}
