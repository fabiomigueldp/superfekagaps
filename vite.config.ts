import { defineConfig, loadEnv } from 'vite';
import { publishedAssetsPlugin } from './scripts/build_output_policy';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  // The published site is currently a development playground. Set this to false
  // for a normal campaign build; untouched normal saves resume automatically.
  const developmentUnlocked = (process.env.VITE_DEVELOPMENT_UNLOCKED_SAVE ?? env.VITE_DEVELOPMENT_UNLOCKED_SAVE ?? 'true') === 'true';
  return {
    define: { __FEKA_DEVELOPMENT_UNLOCKED_SAVE__: JSON.stringify(developmentUnlocked) },
    base: './',
    plugins: [publishedAssetsPlugin()],
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      copyPublicDir: false,
      sourcemap: false,
      rollupOptions: { input: { main: 'index.html', delicia: 'delicia.html', juiceLab: 'juice-lab.html', guairaLab: 'guaira-lab.html', guairaMap: 'guaira.html', guairaTraversal: 'guaira-travessia.html', guairaAscent: 'guaira-subida.html', guairaMayor: 'guaira-prefeito.html', guairaJunction: 'guaira-patio.html', guairaRespiros: 'guaira-respiros.html', guairaChapter: 'guaira-capitulo.html', guairaGallery: 'guaira-galeria.html' } },
      // usar esbuild para minify (mais leve e evita dep opcional `terser`)
      minify: 'esbuild'
    },
    server: {
      port: 3000,
      open: true
    }
  };
});
