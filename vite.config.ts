import { defineConfig } from 'vite';

export default defineConfig({
  appType: 'mpa',
  build: {
    // Phaser alone is about 1.6 MB minified (380 kB gzip), so the host bundle is meant to be over Vite's 500 kB advice.
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: { host: 'host/index.html', player: 'player/index.html' },
    },
  },
});
