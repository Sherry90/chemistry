import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { resolve } from 'path';

export default defineConfig({
  // GH Pages base 경로 정합 (phase-14 D9 / §6.1).
  // 프로덕션 빌드는 `/chemistry/` 하위 경로에 호스팅되므로 자산 URL prefix 필요.
  base: process.env.NODE_ENV === 'production' ? '/chemistry/' : '/',
  plugins: [
    react(),
    // 번들 시각화 — 빌드 시 dist/stats.html 생성 (phase-14 §6.1).
    // CI 환경 호환: open=false (자동 브라우저 열기 방지).
    visualizer({
      open: false,
      gzipSize: true,
      brotliSize: true,
      filename: 'dist/stats.html',
      template: 'treemap',
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // 명시적 vendor 청크 경계 — phase-14 §6.1 / D12 의 size-check 임계값 정합.
        // 4 그룹: react / three / radix / state. 나머지는 Vite 기본 분할 (panels/* lazy).
        manualChunks(id: string) {
          if (
            id.includes('node_modules/react') ||
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react-i18next') ||
            id.includes('node_modules/i18next')
          ) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/three') || id.includes('node_modules/@react-three/')) {
            return 'vendor-three';
          }
          if (id.includes('node_modules/@radix-ui/')) {
            return 'vendor-radix';
          }
          if (id.includes('node_modules/zustand') || id.includes('node_modules/immer')) {
            return 'vendor-state';
          }
          // 나머지: Vite 기본 분할 (panels/* lazy chunk 자동)
        },
      },
    },
    // dev/preview 빌드는 sourcemap 유지, production 은 제외 (페이로드 절감).
    sourcemap: process.env.NODE_ENV !== 'production',
  },
  worker: {
    // Vite Worker script ES module 형식 (phase-14 D14).
    format: 'es',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    css: false,
    // agent/git 워크트리(.claude/worktrees/**)는 별도 브랜치 사본 — 메인 테스트
    // 수집에서 제외 (중복/stale 스펙이 루트 글롭에 섞이지 않도록).
    // tests/e2e/** 는 Playwright 전용 — vitest 수집 제외 (phase-15 §6.1).
    // vitest 기본 exclude 보존 + .claude + e2e 추가.
    exclude: [...configDefaults.exclude, '**/.claude/**', '**/tests/e2e/**'],
  },
});
