import globals from 'globals';

export default [
  {
    files: ['apps/web/integration/**/*.js', 'apps/web/js/**/*.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.worker, __APP_VERSION__: 'readonly', __APP_COMMIT__: 'readonly' } },
  },
  {
    files: ['apps/web/js/**/*.js'],
    rules: {
      // Short-circuit actions and best-effort storage/audio catches are game idioms.
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@typescript-eslint/no-unused-vars': ['error', { caughtErrorsIgnorePattern: '^_$' }],
    },
  },
  // Existing unused prototype bindings; keep checks for all other names.
  ...Object.entries({
    'admin/app.js': 'h', 'bodies.js': 'LIVE_KEYS', 'glass.js': 'it',
    'main.js': 'getPlayer|seedGalaxy|saved|pick|freezeUi|migrateLegacy',
    'world.js': 'LAVANDA|frames',
  }).map(([file, names]) => ({
    files: ['apps/web/js/' + file],
    rules: { '@typescript-eslint/no-unused-vars': ['error', {
      caughtErrorsIgnorePattern: '^_$', varsIgnorePattern: '^(' + names + ')$',
      ...(file === 'main.js' ? { argsIgnorePattern: '^x$' } : {}),
    }] },
  })),
  {
    files: ['apps/web/js/audio.js'],
    // Ternary branches use comma sequences to play two notes.
    rules: { '@typescript-eslint/no-unused-expressions': 'off' },
  },
  {
    files: ['apps/web/js/ui/player.js'],
    // Storage fallbacks initialize raw/name before assigning a saved value.
    rules: { 'no-useless-assignment': 'off' },
  },
];
