import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', ['VITE_', 'TAURI_']);
    const isTauri = !!process.env.TAURI_ENV_DEBUG;

    return {
      assetsInclude: ['**/*.vert', '**/*.frag'],

      // Tauri expects a fixed port, fail if it's not available
      server: {
        port: 3005,
        strictPort: true,
        host: '0.0.0.0',
        watch: {
          ignored: ['**/src-tauri/target/**'],
        },
        warmup: {
          clientFiles: ['./index.tsx', './components/PhotoGrid/PhotoGrid.tsx'],
        },
      },
      // prevent vite from obscuring rust errors
      clearScreen: false,
      // tauri expects these to be present
      envPrefix: ['VITE_', 'TAURI_'],
      
      plugins: [react()],
      
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      
      test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: [],
      },
      
      build: {
        // Tauri supports es2021 on Windows (WebView2) and ES2020+ on Linux (WebKitGTK)
        target: process.env.TAURI_PLATFORM == 'windows' ? 'chrome105' : 'es2022',
        // don't minify for debug builds
        minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
        // produce sourcemaps for debug builds
        sourcemap: !!process.env.TAURI_DEBUG,
        rollupOptions: {
          output: {
            manualChunks: {
              'react-vendor': ['react', 'react-dom'],
              'motion-vendor': ['framer-motion'],
              'map-vendor': ['leaflet', 'react-leaflet'],
              'virtual-vendor': ['@tanstack/react-virtual'],
            },
          },
        },
      },
    };
});
