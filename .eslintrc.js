// ESLint Configuration
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.gui.json'],
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  plugins: ['@typescript-eslint'],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': 'off',
    // Existing parsing utilities intentionally accept control characters and
    // Unicode grapheme ranges; keep lint focused on executable regressions.
    'no-control-regex': 'off',
    'no-misleading-character-class': 'off',
    'no-useless-escape': 'off',
    'no-constant-condition': 'off',
  },
};
