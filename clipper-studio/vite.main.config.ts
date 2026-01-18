import { defineConfig } from 'vite';
import path from 'path';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/main/index.ts'),
      formats: ['cjs'],
      fileName: () => 'main.js',
    },
    outDir: '.vite/build',
    rollupOptions: {
      external: ['electron', 'child_process', 'path', 'fs'],
    },
  },
});
