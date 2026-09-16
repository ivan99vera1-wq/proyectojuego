import { BRANDING } from '@game/config';

/** Expone los colores de marca como variables CSS (--color-primary, ...). */
export function applyBrandingCss(): void {
  const root = document.documentElement.style;
  for (const [key, value] of Object.entries(BRANDING.colors)) {
    root.setProperty(`--color-${key}`, value);
  }
  document.title = BRANDING.name;
}
