import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'
import eslintConfigPrettier from 'eslint-config-prettier'
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),
  eslintConfigPrettier,
  {
    rules: {
      semi: 'off',
      'no-unused-vars': 'warn',
      'no-var': 'error',

      quotes: ['error', 'single', { allowTemplateLiterals: true }],
      eqeqeq: 'error',
      'no-console': 'warn',
      'no-debugger': 'warn',

      // Additional rules
      curly: 'error', // Enforce consistent brace style for all control statements
      camelcase: 'warn', // Enforce camelcase naming convention
      'comma-dangle': ['error', 'always-multiline'], // Require or disallow trailing commas
      indent: ['error', 2], // Enforce consistent indentation (2 spaces)
      'linebreak-style': ['error', 'unix'], // Enforce consistent linebreak style
      'no-trailing-spaces': 'error', // Disallow trailing whitespace at the end of lines
      'object-curly-spacing': ['error', 'always'], // Enforce consistent spacing inside braces
      'array-bracket-spacing': ['error', 'never'], // Enforce consistent spacing inside array brackets
      'space-before-function-paren': ['error', 'always'], // Enforce consistent spacing before function definition opening parenthesis
      'keyword-spacing': ['error', { before: true, after: true }], // Enforce consistent spacing before and after keywords
    },
  },
]

export default eslintConfig
