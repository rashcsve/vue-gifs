import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import globals from 'globals'

const tsRules = {
  ...js.configs.recommended.rules,
  // TypeScript already reports undefined names; the base rule misfires on types
  'no-undef': 'off',
  'no-unused-vars': 'off',
  '@typescript-eslint/no-unused-vars': 'error',
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/consistent-type-imports': 'warn'
}

export default [
  { ignores: ['dist', 'dist-ssr', 'coverage', 'node_modules', '**/*.local'] },
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue']
      },
      globals: { ...globals.browser, ...globals.es2021 }
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: tsRules
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      globals: { ...globals.browser, ...globals.es2021 }
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: tsRules
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
