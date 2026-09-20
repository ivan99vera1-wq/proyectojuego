/**
 * Comprueba que los huesos del personaje tienen sus ejes locales alineados con
 * los del mundo.
 *
 *     node tools/check-bone-axes.mjs apps/client/public/assets/models/characters/character.glb
 *
 * Por qué importa: el cliente anima girando huesos (`hueso.rotation.x = ...`).
 * Si un hueso llega con los ejes torcidos, esa misma línea gira sobre otro eje
 * y la animación se descoloca sin que nada falle ni avise. `flatten_orientations`
 * en assets/blender/lib/rig.py es lo que garantiza esta condición.
 */
import fs from 'node:fs';
const b = fs.readFileSync(process.argv[2]);
const j = JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8'));
const parent = new Map();
j.nodes.forEach((n, i) => (n.children || []).forEach((c) => parent.set(c, i)));
const quatToM3 = ([x, y, z, w]) => [
  1 - 2*(y*y+z*z), 2*(x*y-z*w),     2*(x*z+y*w),
  2*(x*y+z*w),     1 - 2*(x*x+z*z), 2*(y*z-x*w),
  2*(x*z-y*w),     2*(y*z+x*w),     1 - 2*(x*x+y*y),
];
const mul = (a, c) => { const o = new Array(9).fill(0);
  for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) for (let t = 0; t < 3; t++) o[r*3+t] += a[r*3+k]*c[k*3+t];
  return o; };
const worldRot = (i) => { let m = [1,0,0,0,1,0,0,0,1]; let cur = i;
  while (cur !== undefined) { const n = j.nodes[cur];
    if (n.rotation) m = mul(quatToM3(n.rotation), m);
    cur = parent.get(cur); }
  return m; };
const I = [1,0,0,0,1,0,0,0,1];
let ok = 0, bad = [];
for (const idx of j.skins[0].joints) {
  const m = worldRot(idx);
  const err = m.reduce((a, v, k) => Math.max(a, Math.abs(v - I[k])), 0);
  if (err < 1e-3) ok++;
  else bad.push(`${j.nodes[idx].name} err=${err.toFixed(3)} [${m.map(v=>v.toFixed(2)).join(' ')}]`);
}
console.log(`huesos con ejes = ejes del mundo: ${ok}/${j.skins[0].joints.length}`);
bad.slice(0, 5).forEach((s) => console.log('  ✗ ' + s));

process.exitCode = bad.length === 0 ? 0 : 1;
