import { defineConfig } from 'vitest/config';
import path from 'path';
import fs from 'fs';
import { getGoogleMapUrls } from './build.mjs';

const domainOverride = path.resolve(import.meta.dirname, 'gen/intermediates-10000-chrome/domains.override.ts');
if (!fs.existsSync(domainOverride)) {
  fs.mkdirSync(path.dirname(domainOverride), { recursive: true });
  fs.writeFileSync(domainOverride, `export default ${JSON.stringify(getGoogleMapUrls())};`);
}

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/unit/setup.ts'],
  },
  resolve: {
    alias: {
      domains: domainOverride,
    },
  },
});
