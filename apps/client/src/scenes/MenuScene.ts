import * as THREE from 'three';
import type { Engine } from '../core/Engine.js';
import type { GameScene } from '../core/GameScene.js';
import { PlayerEntity } from '../entities/PlayerEntity.js';
import { buildMenuStage, STAGE, type MenuStage } from '../world/MenuStage.js';
import { settings } from '../app/Settings.js';

/**
 * =====================================================================
 *  ESCENA DEL MENÚ
 * =====================================================================
 *  Un rincón del mundo con el personaje dentro, no un maniquí sobre una
 *  peana. Tres cosas hacen el trabajo:
 *
 *    COMPOSICIÓN   el personaje va descentrado, con la hoguera a un lado
 *                  y hierba en primer plano recortando el encuadre.
 *    LUZ           sol cálido en contraluz, relleno frío del cielo y la
 *                  hoguera dando luz de color sobre el personaje.
 *    AIRE          niebla que separa los planos y un cielo en degradado.
 * =====================================================================
 */

/** Dónde se planta el personaje. La cámara y el escenario giran a su alrededor. */
const HERO_X = 0.9;

export class MenuScene implements GameScene {
  private readonly scene = new THREE.Scene();
  // 34 grados de campo: comprime la perspectiva y da aire de cámara de cine.
  // Con el 45 de antes la escena se veía como una demo de escritorio.
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
  private entity: PlayerEntity | null = null;
  private stage: MenuStage | null = null;
  private sky: THREE.Mesh | null = null;
  private t = 0;

  constructor(private readonly engine: Engine) {}

  init(): void {
    this.scene.fog = new THREE.Fog(STAGE.sky, 11, 34);
    this.scene.add(this.buildSky());

    this.stage = buildMenuStage(HERO_X);
    this.scene.add(this.stage.root);
    this.buildLights();

    this.entity = new PlayerEntity('', 'A');
    this.entity.root.position.set(HERO_X, 0, 0);
    this.scene.add(this.entity.root);

    const quality = settings.data.graphicsQuality;
    this.engine.renderer.shadowMap.enabled = quality !== 'low';
    this.engine.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.engine.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.engine.renderer.toneMappingExposure = 1.15;
    this.resize(window.innerWidth, window.innerHeight);
  }

  /**
   * Cielo en degradado. Un color plano deja el horizonte muerto; con cenit y
   * horizonte distintos la escena gana profundidad de inmediato.
   *
   * El shader escribe directo al búfer final, sin pasar por la conversión de
   * espacio de color de Three, así que los colores se entregan en sRGB.
   */
  private buildSky(): THREE.Mesh {
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(STAGE.skyTop) },
        horizonColor: { value: new THREE.Color(STAGE.sky) },
      },
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        varying vec3 vWorld;
        void main() {
          float h = clamp(normalize(vWorld).y * 1.6 + 0.15, 0.0, 1.0);
          gl_FragColor = vec4(mix(horizonColor, topColor, h), 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(60, 24, 16), material);
    return this.sky;
  }

  /**
   * Luz de tres puntos, como en un estudio, más la hoguera.
   * La clave es que el sol venga de DETRÁS: recorta la silueta del personaje
   * contra el fondo, que es lo que separa una figura de un recorte plano.
   */
  private buildLights(): void {
    const sun = new THREE.DirectionalLight('#ffe3b0', 3.1);
    sun.position.set(HERO_X - 5, 6.5, 7.5);
    sun.target.position.set(HERO_X, 0.6, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0012;
    sun.shadow.normalBias = 0.02;
    const cam = sun.shadow.camera;
    cam.left = -3.2; cam.right = 3.2; cam.top = 3.2; cam.bottom = -3.2; cam.near = 0.5; cam.far = 20;

    // Relleno frío desde el lado de la cámara: levanta las sombras sin
    // aplanar el volumen.
    const fill = new THREE.DirectionalLight('#9fc4e8', 0.85);
    fill.position.set(HERO_X + 4.5, 3.2, -5);

    this.scene.add(
      sun, sun.target, fill,
      new THREE.HemisphereLight(STAGE.sky, STAGE.groundDark, 1.05),
      new THREE.AmbientLight('#ffffff', 0.18),
    );
  }

  update(dt: number): void {
    this.t += dt;
    // La cámara se mueve muy poco: lo justo para que la imagen respire.
    const drift = Math.sin(this.t * 0.16);
    // Cámara algo por debajo del pecho y cerca: el personaje manda en el
    // encuadre y el suelo no se come media pantalla.
    this.camera.position.set(
      HERO_X + 1.08 + drift * 0.08,
      0.98 + Math.sin(this.t * 0.22) * 0.025,
      -2.48 - drift * 0.05,
    );
    this.camera.lookAt(HERO_X - 0.04, 0.62, 0.05);

    // El personaje gira despacio sobre sí mismo para enseñarse por todos lados.
    this.entity?.update(dt, {
      x: HERO_X, y: 0, z: 0,
      yaw: Math.sin(this.t * 0.3) * 0.20 + 0.41,
      pitch: 0, speed: 0, grounded: true, crouching: false,
      alive: true, reloading: false, weaponId: '', hasBomb: false, team: 'A',
    });

    // La hoguera parpadea. Dos senos de periodo distinto bastan: uno solo se
    // nota como un pulso mecánico.
    if (this.stage) {
      const flicker = 5.4 + Math.sin(this.t * 11) * 0.8 + Math.sin(this.t * 4.3) * 0.5;
      this.stage.fireLight.intensity = flicker;
      const flame = this.stage.fire.getObjectByName('flame');
      const ember = this.stage.fire.getObjectByName('ember');
      if (flame) flame.scale.set(1, 0.9 + Math.sin(this.t * 9) * 0.12, 1);
      if (ember) ember.scale.set(1, 0.9 + Math.sin(this.t * 13 + 1) * 0.16, 1);
    }
  }

  render(renderer: THREE.WebGLRenderer): void {
    renderer.render(this.scene, this.camera);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.entity?.dispose();
    this.stage?.dispose();
    (this.sky?.material as THREE.Material | undefined)?.dispose();
    this.sky?.geometry.dispose();
    this.scene.clear();
  }
}
