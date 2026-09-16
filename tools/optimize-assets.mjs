#!/usr/bin/env node
/**
 * Optimiza los GLB de assets/source → apps/client/public/assets/models.
 * Requiere: npm i -g @gltf-transform/cli
 * Pasos: dedup, prune, draco (compresión de geometría), resize de texturas a 1024.
 * Uso: node tools/optimize-assets.mjs
 */
import { execSync } from 'node:child_process';
import { readdirSync, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const SRC = 'assets/source';
const OUT = 'apps/client/public/assets/models';

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.glb') ? [p] : [];
  });
}

for (const file of walk(SRC)) {
  const rel = path.relative(SRC, file);
  const out = path.join(OUT, rel);
  mkdirSync(path.dirname(out), { recursive: true });
  console.log(`→ ${rel}`);
  execSync(`gltf-transform optimize "${file}" "${out}" --compress draco --texture-size 1024`, { stdio: 'inherit' });
}
