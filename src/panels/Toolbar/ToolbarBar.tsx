// Phase 11 §6.6 — Toolbar 컨테이너 (App.tsx 가 <AppLayout toolbar> 로 직접 주입).
import type * as React from 'react';
import { Separator } from '@/components';
import type { ToolbarProps } from './types';
import { EditGroup } from './EditGroup';
import { ViewportGroup } from './ViewportGroup';
import { DisplayGroup } from './DisplayGroup';
import { AppGroup } from './AppGroup';
import { useUndoSelectionToast } from './_shared/useUndoSelectionToast';

export default function ToolbarBar({ apiRef }: ToolbarProps): React.ReactElement {
  useUndoSelectionToast(); // D-UNDO-TOAST 단일 관찰자 (버튼·Cmd+Z 공통, §6.13)
  return (
    <div className="flex w-full items-center gap-2">
      <EditGroup apiRef={apiRef} />
      <Separator orientation="vertical" className="h-8" />
      <ViewportGroup apiRef={apiRef} />
      <Separator orientation="vertical" className="h-8" />
      <DisplayGroup />
      <Separator orientation="vertical" className="ml-auto h-8" />
      <AppGroup />
    </div>
  );
}
