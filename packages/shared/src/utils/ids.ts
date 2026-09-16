const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Código corto legible para invitar a una sala (p. ej. "K7Q2PD"). */
export function roomCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}
