/** Empaqueta el cliente web jugable en un único HTML autocontenido. */
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const result = await build({
  entryPoints: ['src/web/main.ts'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  write: false,
});

const js = result.outputFiles[0].text;
const html = readFileSync('src/web/page.html', 'utf8').replace('/*__BUNDLE__*/', () => js);
mkdirSync('dist/web', { recursive: true });
writeFileSync('dist/web/gea.html', html);
console.log(`dist/web/gea.html generado (${(html.length / 1024).toFixed(0)} KB)`);
