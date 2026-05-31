import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isTauri = !!process.env.TAURI_ENV_DEBUG;

    return {
      assetsInclude: ['**/*.vert', '**/*.frag'],

      // Tauri expects a fixed port, fail if it's not available
      server: {
        port: 3005,
        strictPort: true,
        host: '0.0.0.0',
      },
      // prevent vite from obscuring rust errors
      clearScreen: false,
      // tauri expects these to be present
      envPrefix: ['VITE_', 'TAURI_'],
      
      plugins: [react()],
      
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      
      build: {
        // Tauri supports es2021
        target: process.env.TAURI_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
        // don't minify for debug builds
        minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
        // produce sourcemaps for debug builds
        sourcemap: !!process.env.TAURI_DEBUG,
      },
    };
});
