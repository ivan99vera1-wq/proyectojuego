import { defineConfig } from 'vitest/config';
// Colyseus usa process.send (modo cluster); el pool "forks" de Vitest lo intercepta. Usamos hilos.
export default defineConfig({ test: { pool: 'threads', testTimeout: 15000 } });
