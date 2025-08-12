import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import globals from 'globals'

export default [
  { ignores: ['dist', 'node_modules'] },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vue.parsers['vue-eslint-parser'],
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue']
      },
      globals: { ...globals.browser, ...globals.es2021 }
    },
    plugins: { vue, '@typescript-eslint': tsPlugin },
    rules: {
      ...vue.configs['flat/recommended'].rules,
      '@typescript-eslint/consistent-type-imports': 'warn'
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      globals: { ...globals.browser, ...globals.es2021 }
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...js.configs.recommended.rules,
      '@typescript-eslint/consistent-type-imports': 'warn'
    }
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 }
    },
    rules: {
      ...js.configs.recommended.rules
    }
  }
]
