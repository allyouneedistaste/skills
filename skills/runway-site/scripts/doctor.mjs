#!/usr/bin/env node
// What this computer can do, in plain lines. Spends nothing, prints no key.
//   node <skill>/scripts/doctor.mjs
import { execFileSync } from 'node:child_process';
import { findChrome, chromeVersion, launch, delay } from './lib.mjs';

let bad = 0;
const line = (ok, text) => { console.log(`${ok ? 'ok  ' : 'NO  '} ${text}`); if (!ok) bad++; };
const has = (cmd) => { try { execFileSync(cmd, ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } };

const node = Number(process.versions.node.split('.')[0]);
line(node >= 22, `Node ${process.versions.node}${node >= 22 ? '' : ' (22 or newer is needed: nodejs.org)'}`);

const chrome = findChrome();
line(!!chrome, chrome ? `Chrome: ${chrome}` : 'Google Chrome not found (install it, or set CHROME_PATH)');
if (chrome && node >= 22) {
  const version = chromeVersion(chrome);
  console.log(`     Chrome version ${version ?? 'unknown'}`);
  const probe = `(async () => { const a = await navigator.gpu?.requestAdapter(); return { api: 'content' in HTMLCanvasElement.prototype || 'layoutSubtree' in HTMLCanvasElement.prototype, gpu: !!a, copy: typeof GPUQueue !== 'undefined' && ('copyElementImageToTexture' in GPUQueue.prototype || 'drawElementImageToTexture' in GPUQueue.prototype) }; })()`;
  for (const flag of [false, true]) {
    const b = await launch(chrome, { flag });
    const t = await b.tab(800, 600);
    await t.goto('data:text/html,<title>x</title>');
    await delay(200);
    // WebGPU wants a secure context; about:blank and data: are not, so the checks run on 127.0.0.1 too.
    const r = await t.evaluate(probe).catch(() => ({}));
    console.log(`     ${flag ? 'with the switch   ' : 'as it comes       '}: HTML-in-Canvas ${r.api ? 'yes' : 'no'}${flag ? '' : (r.api ? ' (the 3D button will show for you as is)' : ' (the 3D button will not show in your normal Chrome)')}`);
    b.close();
    await delay(300);
    if (!flag && r.api) break;
  }
}
console.log(`${has('ffmpeg') ? 'ok  ' : '--  '} ffmpeg ${has('ffmpeg') ? 'found' : 'not found (optional: turns generated pictures into .webp, takes sound off clips)'}`);
console.log(`${process.env.KIE_API_KEY ? 'ok  ' : '--  '} KIE_API_KEY ${process.env.KIE_API_KEY ? 'is set' : 'not set (only needed to generate pictures with kie.ai)'}`);
process.exit(bad ? 2 : 0);
