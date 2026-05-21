// Phase 13 §6.1 — IoDialog. D-IO-MOUNT: App.tsx 가 직접 마운트 (PanelRegistry 비등록).
// uiStore.isIoOpen / ioInitialMode 구독 → Radix Dialog open + 4 mode tabs.
// viewportApiRef 는 App.tsx 의 ref 와 동일 (Toolbar 와 공유).
import type * as React from 'react';
import type { RefObject } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore, selectIsIoOpen, selectIoInitialMode } from '@/stores';
import { Dialog, DialogContent, DialogClose, Tabs, TabsContent, Button } from '@/components';
import type { ViewportApi } from '@/viewport';
import { IoModeTabs } from './IoModeTabs';
import { PngExportPane } from './PngExportPane';
import { JsonExportPane } from './JsonExportPane';
import { SdfExportPane } from './SdfExportPane';
import { JsonImportPane } from './JsonImportPane';
import type { IoMode } from './types';

interface Props {
  readonly viewportApiRef: RefObject<ViewportApi | null>;
}

export default function IoDialog({ viewportApiRef }: Props): React.ReactElement {
  const { t } = useTranslation('panels');
  const open = useUiStore(selectIsIoOpen);
  const initialMode = useUiStore(selectIoInitialMode);
  const toggle = useUiStore((s) => s.actions.toggleIo);

  const [mode, setMode] = useState<IoMode>(initialMode ?? 'png-export');

  // open=true + initialMode 변경 시 active tab 동기화 (text-input 패턴 답습).
  useEffect(() => {
    if (open && initialMode) setMode(initialMode);
  }, [initialMode, open]);

  const close = (): void => toggle(false);

  return (
    <Dialog open={open} onOpenChange={(o) => toggle(o)}>
      {/* DialogContent 가 내부적으로 RDialog.Title 렌더 (i18nTitleKey 필수, ns='common').
          panels.io.title 은 ns='panels' → 'panels:io.title' prefix 로 해소. */}
      <DialogContent i18nTitleKey="panels:io.title" size="xl">
        <div className="flex flex-col gap-4 py-4">
          <IoModeTabs mode={mode} onChange={setMode} />
          <Tabs value={mode} className="flex flex-col">
            <TabsContent value="png-export">
              <PngExportPane apiRef={viewportApiRef} onClose={close} />
            </TabsContent>
            <TabsContent value="json-export">
              <JsonExportPane onClose={close} />
            </TabsContent>
            <TabsContent value="sdf-export">
              <SdfExportPane onClose={close} />
            </TabsContent>
            <TabsContent value="json-import">
              <JsonImportPane onClose={close} />
            </TabsContent>
          </Tabs>
        </div>
        <footer className="flex justify-end gap-2 border-t border-border pt-4">
          <DialogClose asChild>
            <Button variant="ghost">{t('io.close')}</Button>
          </DialogClose>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
