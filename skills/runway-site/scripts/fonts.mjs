#!/usr/bin/env node
// Bring a Google Fonts family into the site, so nothing loads from the network.
//   node <skill>/scripts/fonts.mjs <site folder> "<Family>" [--weights 400,700] [--italic] [--subsets latin,latin-ext,greek]
// Writes <site>/vendor/fonts/<family>-<weight>[-italic]-<subset>.woff2 and appends @font-face rules to <site>/vendor/fonts.css.
// Fails loudly when a family has no .woff2 for a subset, rather than leaving an empty rule.
// Licences: check each family's page on fonts.google.com before a commercial site (almost all are OFL).
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const [site, family] = argv;
if (!site || !family) { console.error('usage: node fonts.mjs <site folder> "<Family>" [--weights 400,700] [--italic] [--subsets latin,latin-ext]'); process.exit(2); }
const opt = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const weights = opt('--weights', '400').split(','), subsets = opt('--subsets', 'latin').split(','), italic = argv.includes('--italic');
const axis = italic ? `ital,wght@${[...weights.map((w) => `0,${w}`), ...weights.map((w) => `1,${w}`)].join(';')}` : `wght@${weights.join(';')}`;
const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:${axis}&display=swap`;
const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' } });
if (!res.ok) { console.error(`Google Fonts answered ${res.status} for "${family}" with ${axis}: check the name and weights.`); process.exit(1); }
const css = await res.text();
const dir = path.join(site, 'vendor', 'fonts');
mkdirSync(dir, { recursive: true });
const slug = family.toLowerCase().replace(/[^a-z0-9]+/g, '-');
let out = '', n = 0;
for (const m of css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]+)\}/g)) {
  const [, subset, body] = m;
  if (!subsets.includes(subset)) continue;
  const src = body.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
  if (!src) { console.error(`no .woff2 for ${family} ${subset}: pick another family or add the file by hand.`); process.exit(1); }
  const weight = body.match(/font-weight:\s*([\d ]+)/)[1].trim(), style = body.match(/font-style:\s*(\w+)/)[1], range = body.match(/unicode-range:\s*([^;]+)/)?.[1];
  const file = `${slug}-${weight.replace(' ', '_')}${style === 'italic' ? '-italic' : ''}-${subset}.woff2`;
  writeFileSync(path.join(dir, file), Buffer.from(await (await fetch(src)).arrayBuffer()));
  out += `@font-face { font-family: "${family}"; font-style: ${style}; font-weight: ${weight}; font-display: swap; src: url("fonts/${file}") format("woff2");${range ? ` unicode-range: ${range};` : ''} }\n`;
  n++;
}
if (!n) { console.error(`none of the subsets ${subsets.join(', ')} found for "${family}".`); process.exit(1); }
appendFileSync(path.join(site, 'vendor', 'fonts.css'), out);
console.log(`${family}: ${n} files -> vendor/fonts/, rules in vendor/fonts.css. Link vendor/fonts.css in the page, and preload the display face's latin file.`);
