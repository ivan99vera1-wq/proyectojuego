import { UI, type Language, type StringKey } from '@game/config';

let current: Language = UI.defaultLanguage;

export function setLanguage(lang: string): void {
  if (lang in UI.strings) current = lang as Language;
}
export const getLanguage = (): Language => current;

/** Texto traducido; si falta en el idioma actual, cae al idioma por defecto. */
export function t(key: StringKey): string {
  return (UI.strings[current] as Record<string, string>)[key] ?? UI.strings[UI.defaultLanguage][key] ?? key;
}
