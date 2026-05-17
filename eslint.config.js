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
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '.claude/**',
      '*.config.js',
      '*.config.ts',
    ],
  },

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
            // Phase 06 §7.1 / §7.2 — Reaction 엔진 공개 경계.
            // 공개 진입점: @/engine/reaction, @/data/reactions, @/chemistry/reactions/types.
            // 모듈 내부 상대 import (./heuristic 등) 는 alias 패턴 비매칭 → 영향 없음.
            {
              group: [
                '@/engine/reaction/*',
                '@/engine/rdkit/reactions',
                '@/data/reactions/chunks/*',
                '@/data/reactions/manifest.json',
              ],
              message:
                'Reaction internals/data are private. Import public barrels only: @/engine/reaction or @/data/reactions (types via @/chemistry/reactions/types).',
            },
            // Phase 07 §7 — stores 공개 경계. 외부는 @/stores 배럴만 import.
            // src/stores/** 자체는 상대 경로(./x)로 내부 결합 → 본 패턴 비매칭.
            {
              group: ['@/stores/*'],
              message:
                'Stores are private behind the barrel. Import the public barrel only: @/stores (Phase 07 §7).',
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

  // Phase 08 §7.1 — viewport 레이어 가드. viewport 는 @/stores + @/chemistry/* 만.
  // flat-config 는 매칭 파일당 rule 을 *교체* 하므로 본 블록은 viewport 에 적용될
  // no-restricted-imports 전체(공유 private 패턴 + viewport 전용)를 자기-완결로 담는다.
  {
    files: ['src/viewport/**/*.{ts,tsx}'],
    rules: {
      // R3F intrinsic 요소(<group/><instancedMesh/><color/>…)는 three.js props 사용 —
      // eslint-plugin-react 의 HTML 속성 검사는 viewport 에 부적용.
      'react/no-unknown-property': 'off',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['idb'],
              message:
                'idb must only be imported from src/services/cache/. viewport must not touch it.',
            },
            {
              group: ['@/engine/*', '@/engine', '@/services/*', '@/services', '@/data/*', '@/data'],
              message:
                'viewport 는 stores 와 chemistry 만 import 할 수 있습니다 (architecture §4.1).',
            },
            {
              group: ['@/panels/*', '@/app/*', '@/components/*'],
              message: 'viewport 는 UI 상위 레이어를 import 할 수 없습니다.',
            },
            {
              group: ['@/stores/*'],
              message: 'Import the stores barrel only: @/stores (Phase 07 §7).',
            },
            {
              group: ['@/viewport/_shared/poolRegistry', '**/viewport/_shared/poolRegistry'],
              message: 'poolRegistry 는 viewport 내부 전용 (상대 경로로만, 외부 변경 금지).',
            },
            // Phase 09 §7.1 — undo 코어는 stores 레이어(`@/stores/_shared/undo`)
            // 로 이전. 외부 deep-import 는 기존 `@/stores/*` 배럴 가드가 이미
            // 차단 (createUndoStack/useUndoStack 은 @/stores 배럴로만).
            {
              group: [
                '@/viewport/animations/animationRegistry',
                '**/viewport/animations/animationRegistry',
              ],
              message: 'animationRegistry 는 animations 내부 전용 (Phase 09 §7.1).',
            },
          ],
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
