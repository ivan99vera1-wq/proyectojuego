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
    // El WASM de Rapier viaja en base64 dentro de su propio JS y pesa 2 MB: es
    // su tamaño real, no un descuido, así que el aviso se sube por encima.
    chunkSizeWarningLimit: 2200,
    rollupOptions: {
      output: {
        // Three, Rapier y la red cambian mucho menos que el código del juego:
        // en trozos aparte, el navegador los reutiliza entre despliegues en vez
        // de volver a bajar tres megas por cada cambio de una línea.
        manualChunks: {
          three: ['three'],
          physics: ['@dimforge/rapier3d-compat'],
          net: ['colyseus.js'],
        },
      },
    },
  },
  optimizeDeps: { exclude: ['@dimforge/rapier3d-compat'] },
});
