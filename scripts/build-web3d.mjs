/** Empaqueta el prototipo 3D en un único HTML autocontenido (modelo incluido). */
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const result = await build({
  entryPoints: ['src/web3d/main.ts'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: true,
  loader: { '.glb': 'dataurl' },
  write: false,
});

const js = result.outputFiles[0].text;
const html = readFileSync('src/web3d/page.html', 'utf8').replace('/*__BUNDLE__*/', () => js);
mkdirSync('dist/web', { recursive: true });
writeFileSync('dist/web/gea3d.html', html);
console.log(`dist/web/gea3d.html generado (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
