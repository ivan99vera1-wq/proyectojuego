/**
 * Punto de entrada del cliente.
 */
import './ui/styles.css';
import { BRANDING } from '@game/config';
import { initPhysics } from '@game/shared';
import { preloadModels } from './customization/glb.js';
import { applyBrandingCss } from './ui/theme.js';
import { App } from './app/App.js';

applyBrandingCss();
console.info(`[${BRANDING.name}] cliente v${BRANDING.version}`);

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

Promise.all([initPhysics(), preloadModels()]).then(() => {
  const app = new App(canvas);
  if (import.meta.env.DEV) (window as unknown as { __game: App }).__game = app;
  app.start();
}).catch((err) => {
  console.error('No se pudo inicializar la física', err);
  document.getElementById('ui-root')!.textContent = 'Error al iniciar el juego. Revisa la consola.';
});
