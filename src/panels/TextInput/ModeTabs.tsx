// Phase 12 §6.2 / D-MODE-RESET — Tabs (smiles / formula / inchi). 탭 전환 시 onChange 가 raw reset.
import { Tabs, TabsList, TabsTrigger } from '@/components';
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
    </Tabs>
  );
}
