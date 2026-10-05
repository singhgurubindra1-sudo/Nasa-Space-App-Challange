import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Codespaces and Gitpod open the dev server on their own domains; Vite blocks
// unknown hosts by default, which shows up as an empty page.
const allowedHosts = ['.app.github.dev', '.githubpreview.dev', '.gitpod.io'];

// base './' so the build works on Netlify, GitHub Pages, or straight from a folder.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true, allowedHosts },
  preview: { host: true, allowedHosts },
  build: { chunkSizeWarningLimit: 900 },
  test: { include: ['tests/**/*.test.js'] },
});
