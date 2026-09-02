import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import importX from 'eslint-plugin-import-x';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'spikes/out/**',
    ],
  },

  // ---------------------------------------------------------------- baseline
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    plugins: { 'import-x': importX },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // -------------------------------------------------- the core/* purity fence
  // Enforced three ways, because this is the one boundary the whole plan rests on:
  //   1. `tsconfig.core.json` drops `lib: DOM`  -> DOM globals are compile errors
  //   2. no-restricted-imports                  -> React / browser packages banned
  //   3. import-x/no-restricted-paths           -> upward imports banned
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'src/core is pure. Keep React in src/ui.' },
            { name: 'react-dom', message: 'src/core is pure. Keep React in src/ui.' },
            { name: 'react-dom/client', message: 'src/core is pure. Keep React in src/ui.' },
            {
              name: 'zustand',
              message:
                'src/core is pure. It has no state library at all — see the header of core/store.ts.',
            },
            {
              name: 'zustand/react',
              message: 'src/core is pure. Keep React bindings in src/ui.',
            },
            { name: 'idb', message: 'src/core is pure. Persistence lives in src/persist.' },
            {
              name: 'pdf-lib',
              message: 'src/core emits specs; src/export-browser renders them.',
            },
          ],
          patterns: [
            {
              group: ['**/ui/**', '**/webmcp/**', '**/persist/**', '**/measure/**'],
              message: 'src/core must not depend on any browser-facing layer.',
            },
          ],
        },
      ],
      'import-x/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/core',
              from: './src',
              except: ['./core'],
              message: 'src/core must not import from outside src/core.',
            },
          ],
        },
      ],
    },
  },

  // ------------------------------------------------------------ React + a11y
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      'jsx-a11y': jsxA11y,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...jsxA11y.flatConfigs.strict.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // The one place `strict` is walked back, and only to what WAI-ARIA itself sanctions.
      // `strict` forbids *every* role on a list element; the APG's own tree pattern is
      // `ul[role=tree] > li[role=treeitem]`, which is what `Navigator.tsx` builds. This is
      // the mapping `jsx-a11y`'s own `recommended` config ships, restored verbatim — so a
      // `role` that ARIA does not allow on a list is still an error.
      'jsx-a11y/no-noninteractive-element-to-interactive-role': [
        'error',
        {
          ul: ['listbox', 'menu', 'menubar', 'radiogroup', 'tablist', 'tree', 'treegrid'],
          ol: ['listbox', 'menu', 'menubar', 'radiogroup', 'tablist', 'tree', 'treegrid'],
          li: [
            'menuitem',
            'menuitemradio',
            'menuitemcheckbox',
            'option',
            'row',
            'tab',
            'treeitem',
          ],
          table: ['grid'],
          td: ['gridcell'],
          fieldset: ['radiogroup', 'presentation'],
        },
      ],
    },
  },

  // ------------------------------------------------------- tooling and tests
  /**
   * These files live in `tsconfig.node.json`, not in the root `tsconfig.json`. The project
   * service looks up from each file for the *nearest* `tsconfig.json` and reports anything
   * that config does not include as "not found by the project service", so this group names
   * its project explicitly instead. `globals.browser` is here as well as `globals.node`
   * because `page.evaluate` bodies in the Playwright specs run in the page.
   */
  {
    files: ['vite.config.ts', 'playwright.config.ts', 'tests/**/*.ts', 'scripts/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: {
        projectService: false,
        project: ['./tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: { 'no-console': 'off' },
  },
  /**
   * The Day 0 spikes and the WebMCP probe. Node scripts that drive a browser, so both global
   * sets apply: the `page.evaluate` callbacks they pass to Playwright are browser code living
   * inside a Node file.
   */
  {
    files: ['**/*.mjs', '**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-console': 'off' },
  },
);
