import js from '@eslint/js';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import a11yPlugin from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';
import prettierConfig from 'eslint-config-prettier';

/** @type {import('eslint').Linter.Config[]} */
export default [
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.config.js', '*.config.ts'] },

  js.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': a11yPlugin,
      import: importPlugin,
    },
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
      },
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...a11yPlugin.configs.recommended.rules,

      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],

      'import/no-cycle': ['error', { maxDepth: 10 }],

      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: 'src/chemistry',
              from: [
                'src/engine',
                'src/services',
                'src/stores',
                'src/viewport',
                'src/panels',
                'src/components',
                'src/app',
              ],
            },
            {
              target: 'src/engine',
              from: [
                'src/services',
                'src/stores',
                'src/viewport',
                'src/panels',
                'src/components',
                'src/app',
              ],
            },
            {
              target: 'src/data',
              from: [
                'src/services',
                'src/stores',
                'src/viewport',
                'src/panels',
                'src/components',
                'src/app',
                'src/io',
                'src/hooks',
              ],
            },
            {
              target: 'src/services',
              from: ['src/stores', 'src/viewport', 'src/panels', 'src/components', 'src/app'],
            },
            {
              target: 'src/stores',
              from: ['src/viewport', 'src/panels', 'src/components', 'src/app'],
            },
            { target: 'src/viewport', from: 'src/app' },
            { target: 'src/panels', from: 'src/app' },
            { target: 'src/components', from: 'src/app' },
            {
              target: 'src/io',
              from: [
                'src/services',
                'src/stores',
                'src/viewport',
                'src/panels',
                'src/components',
                'src/app',
                'src/hooks',
              ],
            },
          ],
        },
      ],

      'no-restricted-imports': [
        'error',
        {
          patterns: [
            // Phase 03 에서 추가: @rdkit/rdkit 직접 import 금지 패턴
            // Phase 03 에서 추가: engine/rdkit 내부 경로 직접 import 금지 패턴
            // Phase 05: idb는 services/cache/ 내부에서만 허용
            {
              group: ['idb'],
              message:
                'idb must only be imported from src/services/cache/. Use compoundCache from @/services/cache instead.',
            },
          ],
        },
      ],
    },
  },

  // Allow idb inside services/cache (the designated isolation boundary)
  {
    files: ['src/services/cache/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },

  // Phase 05 §8.7 / DoD #11 — 서비스 레이어 가드.
  // 비공개 서비스 모듈은 각 서비스 디렉터리 외부에서 import 금지 (공개 진입점은
  // index.ts 배럴만). src/** 에만 적용 — tests/** 는 화이트박스 검증을 위해
  // 내부 모듈 import 가 정당하므로 제외.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/services/pubchem/**', 'src/services/cache/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['idb'],
              message:
                'idb must only be imported from src/services/cache/. Use compoundCache from @/services/cache instead.',
            },
            {
              group: [
                '@/services/pubchem/*',
                '@/services/cache/*',
                '**/services/pubchem/client',
                '**/services/pubchem/tokenBucket',
                '**/services/pubchem/inflightDedup',
                '**/services/pubchem/endpoints',
                '**/services/pubchem/schemas',
                '**/services/pubchem/readiness',
                '**/services/cache/db',
                '**/services/cache/compoundStore',
                '**/services/cache/schema',
              ],
              message:
                'Private service modules are internal. Import the public barrel only: @/services/pubchem or @/services/cache.',
            },
          ],
        },
      ],
    },
  },

  // Phase 05 §7.1 / §8.7 — engine/pubchem 은 프레임워크/브라우저 비의존
  // (순수 함수, Node + 브라우저 양쪽 동작). DOM / IndexedDB 글로벌 사용 금지.
  {
    files: ['src/engine/pubchem/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'engine/pubchem must be browser-independent (no DOM globals).' },
        {
          name: 'document',
          message: 'engine/pubchem must be browser-independent (no DOM globals).',
        },
        {
          name: 'indexedDB',
          message: 'engine/pubchem must not touch IndexedDB — it is a pure normalize layer.',
        },
        {
          name: 'IDBDatabase',
          message: 'engine/pubchem must not touch IndexedDB — it is a pure normalize layer.',
        },
        {
          name: 'localStorage',
          message: 'engine/pubchem must be browser-independent (no Web Storage).',
        },
      ],
    },
  },

  // Node.js globals for build scripts
  {
    files: ['scripts/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
  },

  prettierConfig,
];
