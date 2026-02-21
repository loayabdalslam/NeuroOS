import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: mode === 'development' ? '/' : './',
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: true,
      port: 5173,
      host: '127.0.0.1',
      strictPort: true,
      watch: {
        ignored: [
          '**/native-shell/**',
          '**/dist-electron/**',
          '**/release/**',
          '**/dist/**',
          '**/scripts/**',
          '**/neuro_os.db*',
        ],
      },
    },
  };
});
