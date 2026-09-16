import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import { BRANDING } from '../../packages/config/src/branding';

/** Sustituye %GAME_NAME% y similares en index.html con los valores de @game/config. */
function brandingPlugin(): Plugin {
  return {
    name: 'game-branding',
    transformIndexHtml(html) {
      return html
        .replaceAll('%GAME_NAME%', BRANDING.name)
        .replaceAll('%GAME_TAGLINE%', BRANDING.tagline)
        .replaceAll('%GAME_VERSION%', BRANDING.version)
        .replaceAll('%GAME_BG%', BRANDING.colors.background);
    },
  };
}

export default defineConfig({
  plugins: [brandingPlugin()],
  // Ruta relativa para que el build funcione dentro de Electron (file://) y en cualquier subcarpeta web.
  base: './',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, host: true },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
  },
  optimizeDeps: { exclude: ['@dimforge/rapier3d-compat'] },
});
