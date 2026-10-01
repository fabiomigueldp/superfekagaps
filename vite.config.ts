import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: { input: { main: 'index.html', juiceLab: 'juice-lab.html', guairaLab: 'guaira-lab.html' } },
    // usar esbuild para minify (mais leve e evita dep opcional `terser`)
    minify: 'esbuild'
  },
  server: {
    port: 3000,
    open: true
  }
});
