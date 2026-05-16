import path from 'node:path';
import { defineConfig } from 'vite';
import babel from 'vite-plugin-babel';
import tsconfigPaths from 'vite-tsconfig-paths';

// Standalone Vite config for Capacitor (no SSR, no Hono, pure SPA)
export default defineConfig({
  plugins: [
    babel({
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: /node_modules/,
      babelConfig: {
        babelrc: false,
        configFile: false,
        presets: ['@babel/preset-react'],
      },
    }),
    tsconfigPaths(),
  ],
  envPrefix: 'NEXT_PUBLIC_',
  define: {
    'process.env.BROWSER': 'true',
    global: 'globalThis',
  },
  resolve: {
    alias: {
      lodash: 'lodash-es',
      '@': path.resolve(__dirname, 'src'),
      buffer: 'buffer/',
    },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    outDir: 'build/client',
    emptyOutDir: true,
    target: 'esnext',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
    },
  },
});
