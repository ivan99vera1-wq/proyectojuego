import { WEAPONS, type ReloadStyle, type WeaponId } from '@game/config';

/**
 * =====================================================================
 *  GESTOS DEL ARMA
 * =====================================================================
 *  Sacar, recargar, inspeccionar y el retroceso del disparo. Este módulo
 *  NO dibuja: calcula una pose (desplazamiento y giro respecto a la pose
 *  de reposo) y quién la aplica es el ViewModel o el PlayerEntity.
 *
 *  Es procedural a propósito: el pack de armas son mallas estáticas sin
 *  esqueleto, y el personaje todavía tiene dos esferas por manos, así que
 *  animar a mano no compraría nada.
 *
 *  ---------------------------------------------------------------------
 *  CÓMO SUSTITUIR ESTO POR ANIMACIÓN DE VERDAD (cuando haya manos)
 *  ---------------------------------------------------------------------
 *  La frontera está pensada para que no haya que tocar nada más:
 *
 *    1. Riggear cada arma en Blender y exportar un clip por gesto, con
 *       los nombres de `ANIMATION_CLIPS` en packages/config.
 *    2. Escribir un `ClipWeaponAnimator` con esta MISMA interfaz pública
 *       (`draw/reload/inspect/fire/cancel/update/pose`), que por dentro
 *       lleve un `THREE.AnimationMixer` y lea la pose del hueso raíz del
 *       arma en vez de calcularla.
 *    3. Cambiar quién se instancia en `ViewModel` y `PlayerEntity`.
 *
 *  Lo único que hay que respetar es que `pose` siga siendo relativa a la
 *  pose de reposo, porque el ViewModel le suma encima el balanceo, el
 *  cabeceo al andar y el retroceso de la cámara.
 *
 *  Lo que sigue faltando el día que se haga: un rig de manos en primera
 *  persona. Hoy `ViewModel` dibuja dos esferas y por eso los gestos mueven
 *  el arma entera; con manos, la mano izquierda es la que baja al cargador
 *  y el arma casi no se mueve.
 * =====================================================================
 */

export interface WeaponPose {
  /** Desplazamiento respecto a la pose de reposo, en metros. */
  x: number; y: number; z: number;
  /** Giro respecto a la pose de reposo, en radianes. */
  pitch: number; yaw: number; roll: number;
  /** Desplazamiento del cargador respecto a su sitio. Cae en -Y. */
  magY: number;
  /** Opacidad del cargador: 0 mientras no está puesto. */
  magVisible: boolean;
}

/** Gestos, de menos a más prioritario. Uno corta a todos los de debajo. */
type Gesto = 'none' | 'inspect' | 'draw' | 'reload';
const PRIORIDAD: Record<Gesto, number> = { none: 0, inspect: 1, draw: 2, reload: 3 };

/** Duración del gesto de inspección, en segundos. */
const INSPECT_TIME = 2.0;
/** Cuánto dura el retroceso visible de un disparo. */
const KICK_DECAY = 6;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Suavizado en las dos puntas: ni el arma arranca de golpe ni frena en seco. */
const suave = (t: number): number => t * t * (3 - 2 * t);
/** Campana 0→1→0. Sirve para los gestos que van y vuelven. */
const ida_y_vuelta = (t: number): number => Math.sin(clamp01(t) * Math.PI);

const REPOSO: WeaponPose = {
  x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0, magY: 0, magVisible: true,
};

export class WeaponAnimator {
  private gesto: Gesto = 'none';
  /** Tiempo transcurrido del gesto actual y su duración total. */
  private t = 0;
  private duracion = 0;
  private kick = 0;
  private weaponId = '';
  private readonly salida: WeaponPose = { ...REPOSO };

  /** Arma empuñada. Cambiarla corta cualquier gesto en curso. */
  setWeapon(id: string): void {
    if (id === this.weaponId) return;
    this.weaponId = id;
    this.gesto = 'none';
    this.t = 0;
    this.kick = 0;
  }

  private get def() {
    return WEAPONS[this.weaponId as WeaponId];
  }

  private get reloadStyle(): ReloadStyle {
    return this.def?.reloadStyle ?? 'none';
  }

  /** ¿Está el arma a medio sacar? Lo usa el HUD para no mentir con la mira. */
  get drawing(): boolean {
    return this.gesto === 'draw';
  }

  get busy(): boolean {
    return this.gesto !== 'none';
  }

  private empezar(gesto: Gesto, duracion: number): void {
    if (PRIORIDAD[gesto] < PRIORIDAD[this.gesto]) return;
    this.gesto = gesto;
    this.duracion = Math.max(0.01, duracion);
    this.t = 0;
  }

  draw(): void {
    this.empezar('draw', this.def?.drawTime ?? 0.3);
  }

  reload(): void {
    if (this.reloadStyle === 'none') return;
    this.empezar('reload', this.def?.reloadTime ?? 2);
  }

  inspect(): void {
    this.empezar('inspect', INSPECT_TIME);
  }

  /** Disparar corta cualquier gesto: si estás disparando, no estás mirando el arma. */
  fire(): void {
    this.gesto = 'none';
    this.t = 0;
    const recoil = this.def?.recoilVertical ?? 2;
    this.kick = Math.min(1, 0.35 + recoil * 0.08);
  }

  /** Corta el gesto en curso sin empezar otro (muerte, menú, cambio de arma). */
  cancel(): void {
    this.gesto = 'none';
    this.t = 0;
  }

  update(dt: number): WeaponPose {
    this.kick = Math.max(0, this.kick - dt * KICK_DECAY);
    if (this.gesto !== 'none') {
      this.t += dt;
      if (this.t >= this.duracion) {
        this.gesto = 'none';
        this.t = 0;
      }
    }
    return this.calcular();
  }

  get pose(): WeaponPose {
    return this.salida;
  }

  private calcular(): WeaponPose {
    const p = this.salida;
    Object.assign(p, REPOSO);
    const k = this.duracion > 0 ? clamp01(this.t / this.duracion) : 0;

    switch (this.gesto) {
      case 'draw': {
        // El arma entra desde abajo, girada, y se endereza.
        const e = 1 - suave(k);
        p.y = -0.22 * e;
        p.z = 0.10 * e;
        p.pitch = -0.9 * e;
        p.roll = 0.5 * e;
        break;
      }
      case 'reload':
        this.poseRecarga(k, p);
        break;
      case 'inspect':
        this.poseInspeccion(k, p);
        break;
    }

    // El retroceso se suma encima de cualquier gesto.
    p.z += this.kick * 0.045;
    p.pitch += this.kick * 0.22;
    return p;
  }

  /**
   * Recarga. Con cargador extraíble el arma baja e inclina, el cargador cae,
   * entra uno nuevo y el arma vuelve con un golpe seco. Con peine no cae nada:
   * el arma da un tirón hacia arriba, que es lo que se ve al meter el peine.
   */
  private poseRecarga(k: number, p: WeaponPose): void {
    if (this.reloadStyle === 'clip') {
      p.y = -0.05 * ida_y_vuelta(k);
      p.pitch = 0.35 * ida_y_vuelta(k);
      // Tirón corto al meter el peine, a mitad del gesto.
      const golpe = Math.max(0, 1 - Math.abs(k - 0.55) * 14);
      p.y += 0.04 * golpe;
      p.roll = 0.18 * ida_y_vuelta(k);
      return;
    }

    // Con cargador: el arma se aparta para dejar sitio a la mano.
    p.y = -0.10 * ida_y_vuelta(k);
    p.pitch = 0.55 * ida_y_vuelta(k);
    p.roll = -0.35 * ida_y_vuelta(k);

    // El cargador sale entre el 15 % y el 40 % del gesto, y el nuevo entra
    // entre el 60 % y el 85 %. En medio no hay cargador puesto.
    if (k < 0.15) {
      p.magY = 0;
    } else if (k < 0.40) {
      p.magY = -0.30 * suave((k - 0.15) / 0.25);
    } else if (k < 0.60) {
      p.magVisible = false;
    } else if (k < 0.85) {
      p.magY = -0.30 * (1 - suave((k - 0.60) / 0.25));
    } else {
      p.magY = 0;
    }
  }

  /**
   * Inspección: sube el arma, la gira para enseñar el lado, la inclina al otro
   * y vuelve. El cuchillo tiene su propio giro, más lucido, porque es lo que la
   * gente quiere enseñar.
   */
  private poseInspeccion(k: number, p: WeaponPose): void {
    const campana = ida_y_vuelta(k);
    if (this.def?.category === 'knife') {
      // Una vuelta entera sobre el eje de la hoja, más un giro de muñeca.
      p.y = 0.05 * campana;
      p.z = 0.08 * campana;
      p.roll = suave(clamp01(k * 1.15)) * Math.PI * 2;
      p.yaw = 0.5 * campana;
      p.pitch = -0.3 * campana;
      return;
    }
    p.y = 0.04 * campana;
    p.z = 0.10 * campana;
    // Dos tiempos: primero enseña un lado, luego el otro.
    p.yaw = Math.sin(clamp01(k) * Math.PI * 2) * 0.9;
    p.roll = -0.55 * campana;
    p.pitch = -0.35 * campana;
  }
}
