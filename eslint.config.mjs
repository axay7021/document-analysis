import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintPluginPrettier from 'eslint-plugin-prettier'
import importPlugin from 'eslint-plugin-import'
import unusedImportsPlugin from 'eslint-plugin-unused-imports'
import perfectionistPlugin from 'eslint-plugin-perfectionist'

import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', 'build'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.strictTypeChecked, // Add strict TypeScript rules
      prettier, // Disables ESLint rules that conflict with Prettier
    ],

    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },

    plugins: {
      prettier: eslintPluginPrettier,
      import: importPlugin,
      'unused-imports': unusedImportsPlugin,
      '@typescript-eslint': tseslint.plugin,
      perfectionist: perfectionistPlugin,
    },

    rules: {
      // =========================================
      // 1. General JavaScript/TypeScript Rules
      // =========================================

      // Development convenience rules
      'no-alert': 'error', // Prevent usage of alert, confirm, and prompt
      'no-console': 'warn', // Warn console.log statements
      'no-plusplus': 0, // Allow increment/decrement operators
      camelcase: 'error', //  Prevent usage of non-camelCase names
      'no-param-reassign': 0, // Allow parameter reassignment
      'no-underscore-dangle': 'error', // Prevent usage of underscore in names
      'no-promise-executor-return': 0, // Allow return in promise executor

      // TypeScript specific
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-underscore-dangle': 'off',

      // Import/Export rules
      // 'no-restricted-imports': 'off',
      // '@typescript-eslint/no-restricted-imports': 'error',
      'import/prefer-default-export': 0,
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-duplicates': 'error',
      // 'no-restricted-imports': [
      //   'error',
      //   {
      //     patterns: ['./*', '../*'],
      //   },
      // ],

      // no used of vars
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],

      // perfectionist
      // https://eslint-plugin-perfectionist.azat.io/
      'perfectionist/sort-named-imports': [
        1,
        {
          order: 'asc',
          type: 'alphabetical',
        },
      ],
      'perfectionist/sort-named-exports': [
        1,
        {
          order: 'asc',
          type: 'alphabetical',
        },
      ],
      'perfectionist/sort-exports': [
        1,
        {
          order: 'asc',
          type: 'alphabetical',
        },
      ],
      'perfectionist/sort-imports': [
        'error',
        {
          order: 'asc',
          type: 'alphabetical',
          newlinesBetween: 'always',
          internalPattern: ['^@/.+'],
          groups: [
            ['builtin', 'external'],
            // 'custom-routes',
            // 'custom-hooks',
            // 'custom-utils',
            'internal',
            // 'custom-components',
            // 'custom-sections',
            // 'custom-types',
            ['parent', 'sibling', 'index'],
            'object',
            'unknown',
          ],
          // customGroups: {
          //   // Changed from 'custom-groups' to 'customGroups'
          // 'custom-routes': '@/routes/**',
          // 'custom-hooks': '@/hooks/**',
          // 'custom-utils': '@/utils/**',
          //   'custom-components': '@/components/**',
          //   'custom-sections': '@/sections/**',
          //   'custom-types': '@/types/**',
          // },
        },
      ],

      // Object/Array handling
      'prefer-destructuring': [
        1,
        {
          object: true,
          array: false,
        },
      ],

      // Prettier Integration
      'prettier/prettier': 'error',
      'arrow-body-style': 'off',
      'prefer-arrow-callback': 'off',
    },
  }
)
