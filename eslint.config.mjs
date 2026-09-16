import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const nodeGlobals = {
  console: 'readonly', process: 'readonly', require: 'readonly', module: 'writable',
  __dirname: 'readonly', Buffer: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
  setInterval: 'readonly', clearInterval: 'readonly', structuredClone: 'readonly',
};

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/release/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Scripts de Node (tools/, configs de electron-builder)
    files: ['tools/**/*.{js,mjs,cjs,ts}', '**/*.config.{cjs,mjs,js}'],
    languageOptions: { globals: nodeGlobals },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['apps/server/**/*.ts', 'apps/desktop/**/*.cts'],
    languageOptions: { globals: nodeGlobals },
  },
);
