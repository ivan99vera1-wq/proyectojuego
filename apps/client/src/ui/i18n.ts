import { UI, type Language, type StringKey } from '@game/config';

let current: Language = UI.defaultLanguage;

export function setLanguage(lang: string): void {
  if (lang in UI.strings) current = lang as Language;
}
export const getLanguage = (): Language => current;

/**
 * Texto traducido; si falta en el idioma actual, cae al idioma por defecto.
 * `vars` sustituye marcadores tipo `{url}` dentro del texto.
 */
export function t(key: StringKey, vars: Record<string, string> = {}): string {
  const raw = (UI.strings[current] as Record<string, string>)[key] ?? UI.strings[UI.defaultLanguage][key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (m, name: string) => vars[name] ?? m);
}
