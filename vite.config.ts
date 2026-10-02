import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../dist-landing',
    emptyOutDir: true,
  },
  server: {
    port: 5175,
    proxy: { '/coda/api': 'http://127.0.0.1:3218' },
  },
});