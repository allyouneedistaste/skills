#!/usr/bin/env node
// One screenshot of a file or URL, headless. node shot.mjs <file.html|url> <out.jpg> [--size 1440x900] [--scroll 1200] [--wait 1200]
import path from 'node:path';
import { findChrome, launch, serve, delay } from './lib.mjs';
const argv = process.argv.slice(2), [src, out] = argv;
if (!src || !out) { console.error('usage: node shot.mjs <file.html|url> <out.jpg> [--size 1440x900] [--scroll 1200] [--wait 1200]'); process.exit(2); }
const opt = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const [w, h] = opt('--size', '1440x900').split('x').map(Number);
const chrome = findChrome();
if (!chrome) { console.error('Chrome not found (set CHROME_PATH).'); process.exit(2); }
const srv = /^https?:/.test(src) ? null : await serve(path.dirname(path.resolve(src)));
const url = srv ? `${srv.url}/${path.basename(src)}` : src;
const b = await launch(chrome);
const t = await b.tab(w, h);
await t.goto(url);
await delay(Number(opt('--wait', 1200)));
if (argv.includes('--scroll')) { await t.evaluate(`window.scrollTo({ top: ${Number(opt('--scroll', 0))}, behavior: 'instant' })`); await delay(600); }
await t.shot(path.resolve(out));
b.close(); srv?.close();
console.log(path.resolve(out));
setTimeout(() => process.exit(0), 500);
