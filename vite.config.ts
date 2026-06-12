import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Forward AI calls to the Node server (server.js) during local dev.
      // Start it on port 3001 — PowerShell: $env:PORT=3001; npm start
      proxy: {
        '/api': {
          target: process.env.VITE_API_TARGET || 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
