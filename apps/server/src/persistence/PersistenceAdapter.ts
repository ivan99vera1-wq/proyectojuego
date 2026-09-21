export interface PlayerProfile {
  id: string;
  nickname: string;
  softCurrency: number;
  stats: { kills: number; deaths: number; wins: number; losses: number };
}

/**
 * Interfaz de persistencia. Implementaciones: memory (dev), sqlite, postgres.
 * El resto del servidor nunca conoce la base de datos concreta.
 */
export interface PersistenceAdapter {
  getProfile(id: string): Promise<PlayerProfile | null>;
  saveProfile(profile: PlayerProfile): Promise<void>;
  close(): Promise<void>;
}
