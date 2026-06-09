import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  // Charge le .env du root (un seul .env pour le monorepo)
  const env = loadEnv(mode, path.resolve(__dirname, '../..'), '');
  return {
    plugins: [react()],
    envDir: path.resolve(__dirname, '../..'),
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_URL ?? 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
    build: {
      // Le seuil par défaut (500 Ko) déclenche un warning même sur des chunks vendor
      // raisonnables après splitting ; on remonte à 600 Ko.
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          // Splitting manuel des grosses libs vendor pour améliorer le cache navigateur
          // et réduire le bundle initial (~1.2 Mo aujourd'hui).
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            i18n: ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
            recharts: ['recharts'],
            sentry: ['@sentry/react'],
          },
        },
      },
    },
  };
});
