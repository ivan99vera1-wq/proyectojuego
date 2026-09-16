/**
 * Punto de entrada del cliente.
 * Fase 1: arranca el motor y muestra una escena placeholder con un "chibi" de prueba.
 * Fase 2: sustituir BootScene por MenuScene → (CustomizationScene | MatchScene).
 */
import { BRANDING } from '@game/config';
import { Engine } from './core/Engine';
import { BootScene } from './scenes/BootScene';
import { applyBrandingCss } from './ui/theme';

applyBrandingCss();
console.info(`[${BRANDING.name}] cliente v${BRANDING.version}`);

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const engine = new Engine(canvas);
engine.setScene(new BootScene(engine));
engine.start();
