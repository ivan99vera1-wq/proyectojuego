import type { BodySlider, CharacterId, ColorChannel, CosmeticId, CosmeticSlot } from '@game/config';

/** Configuración completa de un avatar tal como se guarda y se sincroniza. */
export interface AvatarConfig {
  character: CharacterId;
  items: Record<CosmeticSlot, CosmeticId>;
  colors: Record<ColorChannel, string>;
  sliders: Record<BodySlider, number>;
}
