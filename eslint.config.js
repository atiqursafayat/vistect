module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.base.json', './packages/*/tsconfig.json', './apps/*/tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: {
    '@typescript-eslint': true,
    import: true,
    'jsx-a11y': true,
    react: true,
    'react-hooks': true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:@typescript-eslint/strict-type-checked',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:jsx-a11y/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  settings: {
    react: { version: '19' },
    'import/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx'] },
    'import/resolver': {
      typescript: { project: ['./tsconfig.base.json', './packages/*/tsconfig.json', './apps/*/tsconfig.json'] },
    },
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/consistent-type-exports': 'error',
    '@typescript-eslint/no-floating-promises': 'warn',
    '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
    'import/no-restricted-paths': [
      'error',
      {
        zones: [
          {
            target: './packages/domain',
            from: './packages/domain',
            except: ['**/testing/**'],
            message: 'Domain package must not import React, DOM APIs, or app code',
          },
          {
            target: './packages/graph',
            from: './packages/graph',
            except: ['**/testing/**'],
            message: 'Graph package must not import React or DOM APIs',
          },
          {
            target: './packages/charting',
            from: './packages/charting',
            except: ['**/testing/**'],
            message: 'Charting package must not import React or DOM APIs',
          },
          {
            target: './packages/render-pdf',
            from: './packages/render-pdf',
            except: ['**/testing/**'],
            message: 'Render-PDF package must not import React or DOM APIs',
          },
          {
            target: './packages/webmcp',
            from: './packages/webmcp',
            except: ['**/testing/**'],
            message: 'WebMCP package must only import domain',
          },
          {
            target: './packages/storage',
            from: './packages/storage',
            except: ['**/testing/**'],
            message: 'Storage package must only import domain schemas',
          },
        ],
      },
    ],
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    'jsx-a11y/anchor-is-valid': 'error',
    'jsx-a11y/click-events-have-key-events': 'error',
    'jsx-a11y/no-noninteractive-element-interactions': 'error',
    'jsx-a11y/role-has-required-aria-props': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
  ],
  ignorePatterns: ['dist/', 'node_modules/', '*.config.*', '*.md', '*.yaml', '*.yml'],
};