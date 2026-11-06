import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    // The optional local model gateway (npm run gateway). When it is not
    // running, /api requests fail fast and the app falls back to local models.
    proxy: { '/api': { target: 'http://127.0.0.1:4173', changeOrigin: true } },
  },
});
