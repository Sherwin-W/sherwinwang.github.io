import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',  // Root path since it is a user GitHub Pages site
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        sketchbook: 'sketchbook/index.html',
      },
    },
  },
});
