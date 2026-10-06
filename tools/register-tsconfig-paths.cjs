const { register } = require('tsconfig-paths');
const { resolve } = require('node:path');

register({
  baseUrl: resolve(__dirname, '..'),
  paths: {
    '@silvervibe/shared/ui': ['libs/shared/ui/src/index.ts'],
    '@silvervibe/shared/data-access': ['libs/shared/data-access/src/index.ts'],
    '@silvervibe/shared/feature-flags': [
      'libs/shared/feature-flags/src/index.ts',
    ],
    '@silvervibe/shared/auth': ['libs/shared/auth/src/index.ts'],
  },
});
