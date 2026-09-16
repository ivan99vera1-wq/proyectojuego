import * as THREE from 'three';

interface Effect { update(dt: number): boolean; dispose(): void; }

/** Efectos visuales efímeros: trazadores, fogonazos, explosiones, humo, confeti. */
export class Effects {
  readonly group = new THREE.Group();
  private readonly list: Effect[] = [];
  private readonly confettiGeo = new THREE.PlaneGeometry(0.06, 0.06);
  private readonly sparkGeo = new THREE.SphereGeometry(0.03, 6, 5);

  constructor() { this.group.name = 'effects'; }

  update(dt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i]!;
      if (!e.update(dt)) { e.dispose(); this.list.splice(i, 1); }
    }
  }

  tracer(from: THREE.Vector3, to: THREE.Vector3, color = '#fff4b0'): void {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geo, mat);
    this.group.add(line);
    let t = 0.09;
    this.list.push({
      update: (dt) => { t -= dt; mat.opacity = Math.max(0, t / 0.09); return t > 0; },
      dispose: () => { this.group.remove(line); geo.dispose(); mat.dispose(); },
    });
  }

  muzzleFlash(pos: THREE.Vector3): void {
    const light = new THREE.PointLight('#ffcc66', 6, 6, 2);
    light.position.copy(pos);
    this.group.add(light);
    let t = 0.05;
    this.list.push({ update: (dt) => { t -= dt; return t > 0; }, dispose: () => this.group.remove(light) });
  }

  impact(pos: THREE.Vector3, normal: THREE.Vector3, color = '#dddddd'): void {
    this.particles(pos, 6, color, 2.5, 0.35, normal);
  }

  /** Confeti al eliminar (sin sangre). */
  confetti(pos: THREE.Vector3, count = 40): void {
    const colors = ['#ff5c7a', '#37d0ff', '#ffd23f', '#7de3c4', '#c56cff'];
    this.particles(pos, count, colors, 4.5, 1.2, undefined, true);
  }

  explosion(pos: THREE.Vector3): void {
    const mat = new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.9 });
    const s = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), mat);
    s.position.copy(pos);
    this.group.add(s);
    const light = new THREE.PointLight('#ffa040', 30, 20, 2);
    light.position.copy(pos);
    this.group.add(light);
    let t = 0;
    this.list.push({
      update: (dt) => { t += dt; s.scale.setScalar(0.5 + t * 14); mat.opacity = Math.max(0, 0.9 - t * 2.2); light.intensity = Math.max(0, 30 - t * 90); return t < 0.45; },
      dispose: () => { this.group.remove(s, light); s.geometry.dispose(); mat.dispose(); },
    });
    this.confetti(pos, 60);
  }

  smoke(pos: THREE.Vector3, duration: number): void {
    const mat = new THREE.MeshStandardMaterial({ color: '#e8eef5', transparent: true, opacity: 0.0, roughness: 1 });
    const s = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat);
    s.position.copy(pos).add(new THREE.Vector3(0, 1.2, 0));
    this.group.add(s);
    let t = 0;
    this.list.push({
      update: (dt) => {
        t += dt;
        const grow = Math.min(1, t / 1.2);
        s.scale.setScalar(0.3 + grow * 3.2);
        const fadeOut = Math.max(0, 1 - Math.max(0, t - (duration - 2)) / 2);
        mat.opacity = 0.92 * grow * fadeOut;
        return t < duration;
      },
      dispose: () => { this.group.remove(s); s.geometry.dispose(); mat.dispose(); },
    });
  }

  private particles(pos: THREE.Vector3, count: number, color: string | string[], speed: number, life: number, dir?: THREE.Vector3, planes = false): void {
    const mats: THREE.Material[] = [];
    const meshes: { m: THREE.Mesh; v: THREE.Vector3; spin: number }[] = [];
    for (let i = 0; i < count; i++) {
      const c = Array.isArray(color) ? color[i % color.length]! : color;
      const mat = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, transparent: true });
      mats.push(mat);
      const m = new THREE.Mesh(planes ? this.confettiGeo : this.sparkGeo, mat);
      m.position.copy(pos);
      const v = new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.8 + 0.2, (Math.random() - 0.5)).normalize();
      if (dir) v.lerp(dir, 0.5).normalize();
      v.multiplyScalar(speed * (0.5 + Math.random()));
      meshes.push({ m, v, spin: (Math.random() - 0.5) * 12 });
      this.group.add(m);
    }
    let t = 0;
    this.list.push({
      update: (dt) => {
        t += dt;
        for (const p of meshes) {
          p.v.y -= 9 * dt;
          p.m.position.addScaledVector(p.v, dt);
          if (planes) { p.m.rotation.x += p.spin * dt; p.m.rotation.y += p.spin * 0.7 * dt; }
          (p.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - t / life);
        }
        return t < life;
      },
      dispose: () => { for (const p of meshes) this.group.remove(p.m); for (const m of mats) m.dispose(); },
    });
  }
}
