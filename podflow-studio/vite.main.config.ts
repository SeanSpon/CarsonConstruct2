import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        'electron',
        'ffprobe-static',
        '@ffprobe-installer/ffprobe',
      ],
    },
  },
  resolve: {
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
});
