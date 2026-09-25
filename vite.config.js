import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: {
    target: 'es2022',
    // three.js plus its post-processing addons form one long-cached renderer chunk.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: (id) => (id.includes('node_modules/three/') ? 'renderer' : undefined),
      },
    },
  },
});
