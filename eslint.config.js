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
