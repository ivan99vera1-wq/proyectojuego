import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/**
 * Cargador de assets con caché. Todas las rutas son relativas a /assets/.
 * Fase 2: añadir KTX2 (texturas comprimidas), audio y barra de progreso.
 */
export class AssetLoader {
  private readonly gltf = new GLTFLoader();
  private readonly cache = new Map<string, Promise<GLTF>>();

  constructor(base = 'assets/') {
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    this.gltf.setDRACOLoader(draco);
    this.gltf.setPath(base);
  }

  loadModel(path: string): Promise<GLTF> {
    let p = this.cache.get(path);
    if (!p) {
      p = this.gltf.loadAsync(path);
      this.cache.set(path, p);
    }
    return p;
  }
}
