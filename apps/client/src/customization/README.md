# apps/client/src/customization

Sistema de avatares (Fase 2):

- `AvatarBuilder.ts` — recibe un `AvatarConfig` y monta el chibi: carga el rig base del arquetipo,
  engancha cada cosmético a su hueso/socket, aplica colores a los materiales marcados como
  recolorables y ajusta morph targets con los sliders.
- `CustomizationScene.ts` — escena de vestidor con cámara orbital, pestañas por slot, paleta de colores.
- `AvatarStore.ts` — persistencia local (localStorage con clave `${BRANDING.codename}:avatar`) y
  sincronización con el servidor.
