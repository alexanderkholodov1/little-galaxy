import hooks from 'eslint-plugin-react-hooks';
import refresh from 'eslint-plugin-react-refresh';

export default {
  files: ['apps/web/src/**/*.{ts,tsx}'],
  plugins: { 'react-hooks': hooks, 'react-refresh': refresh },
  rules: {
    ...hooks.configs.recommended.rules,
    'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
  },
};
