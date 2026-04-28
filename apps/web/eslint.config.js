export default [
  {
    ignores: [
      'node_modules',
      '.next',
      'dist',
      'coverage',
      'drizzle',
      '.eslintcache',
      '**/*.ts',
      '**/*.tsx',
      'scripts/**',
      'vitest.config.js',
    ],
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
    },
  },
];
