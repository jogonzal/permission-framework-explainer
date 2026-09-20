import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'permission-framework-explainer/core': path.join(repoRoot, 'src/core.ts'),
    },
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
});
