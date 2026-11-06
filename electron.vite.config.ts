import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

const alias = {
  '@shared': resolve('src/shared'),
  '@main': resolve('src/main'),
  '@renderer': resolve('src/renderer/src'),
};

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: [] })],
    resolve: { alias },
    build: {
      outDir: 'out/main',
      rollupOptions: {
        external: ['node-pty', 'electron'],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias },
    build: {
      outDir: 'out/preload',
      rollupOptions: { output: { format: 'cjs', entryFileNames: 'index.js' } },
    },
  },
  renderer: {
    root: resolve('src/renderer'),
    resolve: { alias },
    plugins: [react()],
    server: { fs: { allow: [resolve('.')] } },
    build: {
      outDir: resolve('out/renderer'),
      rollupOptions: { input: resolve('src/renderer/index.html') },
      chunkSizeWarningLimit: 2400,
    },
  },
});
