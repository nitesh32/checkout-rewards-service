import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const API_TARGET = process.env['API_URL'] ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  server: {
    port: 5173,
    // The backend sends no CORS headers, so the browser talks to it through this proxy.
    proxy: { '/api': { target: API_TARGET, rewrite: (url) => url.replace(/^\/api/, '') } },
  },
  preview: {
    port: 5173,
    proxy: { '/api': { target: API_TARGET, rewrite: (url) => url.replace(/^\/api/, '') } },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
  },
});
