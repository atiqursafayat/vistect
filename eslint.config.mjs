// ============================================================================
// ESLint 9 flat configuration
// ============================================================================
//
// Flat config, not eslintrc. The previous `eslint.config.js` used eslintrc keys
// (`root`, `extends`, `env`) inside a flat-config filename, which ESLint 9
// rejects outright — so the `lint` CI job had never actually run, which is how 80
// `any` casts accumulated under a config declaring `no-explicit-any: error`.
//
// Boundaries enforced here (see `docs/planning/13-repository-structure.md`):
//   - pure packages must not import React, DOM globals, or app code
//   - `webmcp` imports `domain` only
//   - nothing imports `apps/web`

import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Packages that must stay free of React, DOM globals, and app imports. */
const PURE_PACKAGES = [
  'packages/domain/**',
  'packages/graph/**',
  'packages/charting/**',
  'packages/render-pdf/**',
];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.d.ts',
      '**/playwright-report/**',
      '**/test-results/**',
      'apps/web/public/sw.js',
      'apps/web/vite.config.js',
      'apps/web/vitest.config.js',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        // `projectService` resolves each file to its owning tsconfig. Test and
        // config files sit outside the build tsconfigs (which exclude them), so
        // they are typed against the default project instead.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { import: importPlugin },
    settings: {
      'import/resolver': {
        typescript: { alwaysTryTypes: true, project: ['./tsconfig.base.json'] },
      },
    },
    rules: {
      // The product's central claim is type-safe agent operation; an `any` at a
      // boundary silently removes that guarantee.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/require-await': 'error',

      // Numbers in template literals are unambiguous and idiomatic;
      // `String(n)` everywhere adds noise without preventing a defect.
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: false, allowNullish: false, allowAny: false },
      ],

      // `Partial<Record<BrandedId, T>>` legitimately requires deleting keys.
      '@typescript-eslint/no-dynamic-delete': 'off',

      // `noUncheckedIndexedAccess` already forces undefined handling; this rule
      // then flags the resulting guards as unnecessary on branded-key records.
      '@typescript-eslint/no-unnecessary-condition': 'off',

      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-param-reassign': 'error',

      'import/no-cycle': 'error',
      'import/no-self-import': 'error',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
    },
  },

  // Pure packages: no React, no DOM, no app code.
  {
    files: PURE_PACKAGES,
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-*'], message: 'Pure packages must not depend on React.' },
            { group: ['@vistect/web', 'apps/web/*'], message: 'Nothing may import apps/web.' },
            {
              group: ['@vistect/storage', '@vistect/storage/*'],
              message: 'Pure packages must not reach storage; state flows through the command bus.',
            },
          ],
        },
      ],
    },
  },

  // webmcp: domain only.
  {
    files: ['packages/webmcp/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-*'], message: 'webmcp must not depend on React.' },
            {
              group: [
                '@vistect/graph*',
                '@vistect/charting*',
                '@vistect/render-*',
                '@vistect/storage*',
              ],
              message: 'webmcp may import @vistect/domain only.',
            },
          ],
        },
      ],
    },
  },

  // Browser + React surface.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.strict.rules,

      // Accessibility is the product, so these are errors rather than warnings.
      'jsx-a11y/no-autofocus': 'error',
      'jsx-a11y/no-noninteractive-element-interactions': 'error',
      'jsx-a11y/prefer-tag-over-role': 'error',

      'react/prop-types': 'off',
      'react/jsx-no-target-blank': ['error', { allowReferrer: false }],
    },
  },

  // Tests and tooling: typed against `tsconfig.lint.json`, which includes the
  // files the build tsconfigs deliberately exclude.
  {
    files: [
      '**/tests/**/*.{ts,tsx}',
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
      '**/*.config.{ts,mts}',
      '**/scripts/*.ts',
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.lint.json'],
        tsconfigRootDir: import.meta.dirname,
        projectService: false,
      },
    },
    rules: {
      // Test fixtures cast partial objects into full domain types, and Playwright's
      // page API is loosely typed. Relaxed here only — production code keeps the
      // strict rules, which is where type erosion actually costs correctness.
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/unbound-method': 'off',
      // Fixture builders cast loose literals into branded domain types; the rule
      // cannot see that the assertion is what makes the fixture assignable.
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      'no-console': 'off',
    },
  },

  // Test fixtures package: same latitude as tests, since that is all it contains.
  {
    files: ['packages/testing/src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },

  // Config files run in Node.
  {
    files: ['**/*.config.{ts,js,mjs}'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'import/no-default-export': 'off' },
  },

  // This file cannot be type-checked against a project that includes it without
  // a cycle, so it is linted with syntax-only rules.
  {
    files: ['eslint.config.mjs'],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { project: false, projectService: false },
    },
    ...tseslint.configs.disableTypeChecked,
  },

  // Prettier last, so formatting rules win.
  prettier
);
