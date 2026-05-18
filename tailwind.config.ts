// Phase 01 + Phase 10 §6.7 retrofit — theme.extend.colors 가 theme.css CSS 변수
// 참조. 토큰 *값* 변경은 theme.css 만; 토큰 *이름* 추가 시 본 config + dev restart.
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class', // <html class="dark"> (Phase 01)
  theme: {
    extend: {
      colors: {
        'bg-canvas': 'rgb(var(--bg-canvas) / <alpha-value>)',
        'bg-panel': 'rgb(var(--bg-panel) / <alpha-value>)',
        'bg-panel-elevated': 'rgb(var(--bg-panel-elevated) / <alpha-value>)',
        'fg-primary': 'rgb(var(--fg-primary) / <alpha-value>)',
        'fg-muted': 'rgb(var(--fg-muted) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          fg: 'rgb(var(--accent-fg) / <alpha-value>)',
        },
        error: 'rgb(var(--error) / <alpha-value>)',
        warn: 'rgb(var(--warn) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};

export default config;
