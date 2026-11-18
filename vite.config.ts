import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'web',
  base: '/next/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../frontend/dist',
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000'
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.tsx']
  }
});
