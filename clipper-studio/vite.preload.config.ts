import { defineConfig } from 'vite';
import path from 'path';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/preload/index.ts'),
      formats: ['cjs'],
      fileName: () => 'preload.js',
    },
    outDir: '.vite/build',
    rollupOptions: {
      external: ['electron'],
    },
  },
});
