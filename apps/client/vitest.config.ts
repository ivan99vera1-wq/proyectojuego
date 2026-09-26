import { defineConfig } from 'vitest/config';

/**
 * Los tests de interfaz necesitan un DOM. `happy-dom` es bastante más ligero
 * que jsdom y basta para comprobar cómo se comporta un panel ante clics.
 * Los tests que no lo necesitan declaran `@vitest-environment node`.
 */
export default defineConfig({
  test: { environment: 'happy-dom' },
});
