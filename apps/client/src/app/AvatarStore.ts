import { BRANDING } from '@game/config';
import { sanitizeAvatar, type AvatarConfig } from '@game/shared';

const KEY = `${BRANDING.codename}:avatar`;

/** Avatar del jugador local, persistido en localStorage. */
export class AvatarStore {
  current: AvatarConfig = sanitizeAvatar(undefined);

  load(): AvatarConfig {
    try {
      const raw = localStorage.getItem(KEY);
      this.current = sanitizeAvatar(raw ? JSON.parse(raw) : undefined);
    } catch { this.current = sanitizeAvatar(undefined); }
    return this.current;
  }

  save(avatar: AvatarConfig): void {
    this.current = sanitizeAvatar(avatar);
    try { localStorage.setItem(KEY, JSON.stringify(this.current)); } catch { /* ignore */ }
  }
}

export const avatarStore = new AvatarStore();
