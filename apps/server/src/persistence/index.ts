import type { PersistenceAdapter } from './PersistenceAdapter.js';
import { MemoryAdapter } from './MemoryAdapter.js';

export async function createPersistence(driver: string): Promise<PersistenceAdapter> {
  switch (driver) {
    case 'memory':
      return new MemoryAdapter();
    // Fase 2: case 'sqlite': return new SqliteAdapter(process.env.DATABASE_URL);
    // Fase 2: case 'postgres': return new PostgresAdapter(process.env.DATABASE_URL);
    default:
      throw new Error(`PERSISTENCE_DRIVER desconocido: ${driver}`);
  }
}
export type { PersistenceAdapter } from './PersistenceAdapter.js';
