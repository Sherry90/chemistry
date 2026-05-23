// Phase 15 §6.4 I6 — settingsStore.cvdMode ↔ <html class="cvd"> 동기.
// architecture §3.5: CVD 모드 시 .cvd 변수 활성 + 라벨 강제 on (BallAndStickRenderer
// 가 cvdOn 보조로 처리). 본 컴포넌트는 DOM 토글만 담당, render-less.
import { useEffect } from 'react';
import { useSettingsStore, selectIsCvdOn } from '@/stores';

export function CvdSync(): null {
  const cvdOn = useSettingsStore(selectIsCvdOn);
  useEffect(() => {
    document.documentElement.classList.toggle('cvd', cvdOn);
  }, [cvdOn]);
  return null;
}
