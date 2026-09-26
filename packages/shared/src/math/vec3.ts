export interface Vec3 { x: number; y: number; z: number; }

/** Vector unitario hacia donde mira una cámara dada yaw/pitch (convención Y-up, -Z adelante). */
export const directionFromAngles = (yaw: number, pitch: number): Vec3 => ({
  x: -Math.sin(yaw) * Math.cos(pitch),
  y: Math.sin(pitch),
  z: -Math.cos(yaw) * Math.cos(pitch),
});
