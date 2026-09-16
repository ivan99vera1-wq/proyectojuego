import * as THREE from 'three';
import type { MapLayout, MapZone } from '@game/shared';
import { BRANDING } from '@game/config';

/** Construye la geometría visual de un MapLayout (cajas de colores + zonas). */
export function buildMapMeshes(layout: MapLayout, skyColor: string): THREE.Group {
  const group = new THREE.Group();
  const mats = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (color: string) => {
    let m = mats.get(color);
    if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.0 }); mats.set(color, m); }
    return m;
  };
  const geo = new THREE.BoxGeometry(1, 1, 1);
  for (const b of layout.boxes) {
    const mesh = new THREE.Mesh(geo, mat(b.color ?? '#888888'));
    mesh.position.set(b.x, b.y, b.z);
    mesh.rotation.set(b.rx ?? 0, b.ry ?? 0, b.rz ?? 0);
    mesh.scale.set(b.sx, b.sy, b.sz);
    mesh.castShadow = b.solid !== false;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  // Marcadores de zonas de bomba (aros en el suelo)
  const zoneRing = (z: MapZone, color: string, label: string) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(Math.min(z.sx, z.sz) * 0.42, Math.min(z.sx, z.sz) * 0.48, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(z.x, 0.12, z.z);
    ring.name = `zone_${label}`;
    group.add(ring);
  };
  zoneRing(layout.bombsites.A, BRANDING.colors.teamB, 'A');
  zoneRing(layout.bombsites.B, BRANDING.colors.teamB, 'B');

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 24, 12),
    new THREE.MeshBasicMaterial({ color: skyColor, side: THREE.BackSide, fog: false }),
  );
  group.add(sky);
  return group;
}
