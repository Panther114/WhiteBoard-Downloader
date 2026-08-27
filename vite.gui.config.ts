import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'src/gui/renderer'),
  base: './',
  publicDir: path.resolve(__dirname, 'assets'),
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    fs: {
      allow: [path.resolve(__dirname)],
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/gui/renderer'),
    emptyOutDir: false,
  },
});

