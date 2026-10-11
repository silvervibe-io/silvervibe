/**
 * Rasterize brand SVGs to PNG / ICO helpers.
 * Usage (from repo root, with optional deps installed):
 *   npm install --no-save @resvg/resvg-js png-to-ico
 *   node tools/render-brand-icons.mjs
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { Resvg } = require('@resvg/resvg-js');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'apps/silvervibe/public');
const markPath = join(pub, 'brand/mark.svg');
const favPath = join(pub, 'favicon.svg');

const mark = readFileSync(markPath, 'utf8');
const inner = mark
  .replace(/<svg[^>]*>/i, '')
  .replace(/<\/svg>/i, '')
  .trim();

const appleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180">
  <rect width="180" height="180" fill="#eef1f5"/>
  <g transform="translate(18 18) scale(2.25)">${inner}</g>
</svg>`;

function png(svg, width) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } })
    .render()
    .asPng();
}

const fav16 = png(readFileSync(favPath), 16);
const fav32 = png(readFileSync(favPath), 32);
writeFileSync(join(pub, 'favicon-16.png'), fav16);
writeFileSync(join(pub, 'favicon-32.png'), fav32);
writeFileSync(join(pub, 'apple-touch-icon.png'), png(appleSvg, 180));

const pngToIco = require('png-to-ico');
const icoFn = pngToIco.default || pngToIco;
const ico = await icoFn([
  join(pub, 'favicon-16.png'),
  join(pub, 'favicon-32.png'),
]);
writeFileSync(join(pub, 'favicon.ico'), ico);

console.log(
  'Wrote favicon-16.png, favicon-32.png, apple-touch-icon.png, favicon.ico',
);
