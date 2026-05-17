import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    css: false,
    // agent/git 워크트리(.claude/worktrees/**)는 별도 브랜치 사본 — 메인 테스트
    // 수집에서 제외 (중복/stale 스펙이 루트 글롭에 섞이지 않도록).
    // vitest 기본 exclude 보존 + .claude 추가.
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
});
