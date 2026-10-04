import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the build works on Netlify, GitHub Pages, or straight from a folder.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { include: ['tests/**/*.test.js'] },
});
