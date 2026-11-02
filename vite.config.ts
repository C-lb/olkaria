import { defineConfig } from 'vite';

export default defineConfig({
  appType: 'mpa',
  build: {
    rollupOptions: {
      input: { host: 'host/index.html', player: 'player/index.html' },
    },
  },
});
