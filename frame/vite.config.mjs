import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('./view', import.meta.url)),
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@ui': fileURLToPath(new URL('../components', import.meta.url)),
      '@frame': fileURLToPath(new URL('./', import.meta.url)),
      ...Object.fromEntries(['react', 'react-dom', '@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled']
        .map((name) => [name, fileURLToPath(new URL(`./node_modules/${name}`, import.meta.url))])),
    },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    outDir: fileURLToPath(new URL('./view-built', import.meta.url)),
    emptyOutDir: true,
  },
});
