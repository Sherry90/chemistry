// Phase 10 §6.10 / D5 — WebGL2 미지원 전체 화면 안내. i18n 키만 (문구는
// Phase 15). sidepanel 은 정상 — 본 페이지는 viewport 영역만 차지.
import { useTranslation } from 'react-i18next';
import type { WebGLDetectResult } from '@/viewport';

export interface WebGL2FallbackPageProps {
  readonly result: WebGLDetectResult; // ok=false 만 의미
}

export function WebGL2FallbackPage(_props: WebGL2FallbackPageProps) {
  const { t } = useTranslation('common');
  return (
    <div
      role="region"
      aria-label={t('app.webgl2Unsupported.title')}
      className="flex h-full flex-col items-center justify-center bg-bg-canvas p-8"
    >
      <div className="max-w-lg text-center">
        <h1 className="text-2xl font-semibold text-fg-primary">
          {t('app.webgl2Unsupported.title')}
        </h1>
        <p className="mt-4 text-base text-fg-muted">{t('app.webgl2Unsupported.reason')}</p>
        <p className="mt-2 text-sm text-fg-muted">{t('app.webgl2Unsupported.suggestion')}</p>
        <a
          href={t('app.webgl2Unsupported.docsLink')}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-block text-accent hover:underline"
        >
          {t('app.webgl2Unsupported.docsLinkLabel')}
        </a>
      </div>
    </div>
  );
}
