import type { PersistenceAdapter, PlayerProfile } from './PersistenceAdapter.js';

/** Persistencia en memoria (se pierde al reiniciar). Ideal para desarrollo y tests. */
export class MemoryAdapter implements PersistenceAdapter {
  private readonly profiles = new Map<string, PlayerProfile>();
  async getProfile(id: string): Promise<PlayerProfile | null> {
    return this.profiles.get(id) ?? null;
  }
  async saveProfile(profile: PlayerProfile): Promise<void> {
    this.profiles.set(profile.id, structuredClone(profile));
  }
  async close(): Promise<void> {
    this.profiles.clear();
  }
}
