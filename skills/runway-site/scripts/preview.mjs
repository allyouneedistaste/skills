#!/usr/bin/env node
// Serve the site and print its link. With --open, also open a separate Chrome window with HTML-in-Canvas
// switched on (only when the person asks to look: a window takes their focus). Stops with Ctrl+C.
//   node <skill>/scripts/preview.mjs <site folder> [--port 4410] [--open]
import { spawn } from 'node:child_process';
import path from 'node:path';
import { findChrome, serve, SWITCH } from './lib.mjs';

const argv = process.argv.slice(2);
const dir = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--port');
if (!dir) { console.error('usage: node preview.mjs <site folder> [--port 4410] [--open]'); process.exit(2); }
const port = argv.includes('--port') ? Number(argv[argv.indexOf('--port') + 1]) : 4410;
const s = await serve(dir, port);
console.log(`${s.url}/`);
if (argv.includes('--open')) {
  const chrome = findChrome();
  if (!chrome) { console.error('Chrome not found: open the link yourself.'); }
  else {
    const profile = path.resolve(dir, '..', '.runway-preview-chrome');
    spawn(chrome, [SWITCH, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--window-size=1440,900', `${s.url}/`], { stdio: 'ignore', detached: true }).unref();
    console.log(`opened a separate Chrome window with the 3D feature on (its profile: ${profile})`);
  }
}
