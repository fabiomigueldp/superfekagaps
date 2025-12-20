import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    // usar esbuild para minify (mais leve e evita dep opcional `terser`)
    minify: 'esbuild'
  },
  server: {
    port: 3000,
    open: true
  }
});
