/**
 * Optimiza un GLB para uso web: poda, suelda vértices, une mallas por
 * material y cuantiza atributos. Uso:
 *   node scripts/optimize-model.mjs assets/models/liger-zero.glb
 * Escribe <nombre>.opt.glb al lado.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, join, meshopt, prune, quantize, simplify, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { statSync } from 'node:fs';

const input = process.argv[2];
if (!input) throw new Error('falta la ruta del .glb');
const output = input.replace(/\.glb$/, '.opt.glb');

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const document = await io.read(input);

await document.transform(
  dedup(),
  flatten(),
  join(),
  weld(),
  // Reduce la densidad de malla conservando la silueta: para fichas de
  // tablero vistas a distancia media sobra muchísimo detalle.
  simplify({ simplifier: MeshoptSimplifier, ratio: 0.4, error: 0.001 }),
  prune(),
  quantize(),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);

await io.write(output, document);
const before = statSync(input).size / 1024 / 1024;
const after = statSync(output).size / 1024 / 1024;
console.log(`${input}: ${before.toFixed(2)} MB → ${output}: ${after.toFixed(2)} MB`);
