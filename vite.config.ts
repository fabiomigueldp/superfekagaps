import { defineConfig } from 'vite';
import { publishedAssetsPlugin } from './scripts/build_output_policy';

export default defineConfig({
  base: './',
  plugins: [publishedAssetsPlugin()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    copyPublicDir: false,
    sourcemap: false,
    rollupOptions: { input: { main: 'index.html', juiceLab: 'juice-lab.html', guairaLab: 'guaira-lab.html', guairaMap: 'guaira.html', guairaTraversal: 'guaira-travessia.html', guairaAscent: 'guaira-subida.html', guairaMayor: 'guaira-prefeito.html', guairaJunction: 'guaira-patio.html', guairaRespiros: 'guaira-respiros.html' } },
    // usar esbuild para minify (mais leve e evita dep opcional `terser`)
    minify: 'esbuild'
  },
  server: {
    port: 3000,
    open: true
  }
});
