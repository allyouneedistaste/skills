#!/usr/bin/env node
// The whole site checked in a headless Chrome of its own: never a window, nothing spent.
//   node <skill>/scripts/check.mjs <site folder> [--page index.html] [--out <folder>] [--toggle "<selector>"]
// Flat page at five window sizes (errors, missing files, requests that leave, sideways scroll);
// the 3D mode: tip, travel the whole page, a click through the floor, resize, Esc, reduced motion;
// the button absent where the feature is. Shots in <out>; prints PASS / FAIL lines; exit 2 on any FAIL.
// The page must set window.__runway = mount(...). Look at the shots: this checks that it works, not that it is good.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { findChrome, chromeVersion, launch, serve, delay } from './lib.mjs';

const argv = process.argv.slice(2);
const site = argv[0];
if (!site) { console.error('usage: node check.mjs <site folder> [--page index.html] [--out folder] [--toggle selector]'); process.exit(2); }
const opt = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const page = opt('--page', 'index.html'), TOGGLE = opt('--toggle', '[data-runway-toggle]');
const out = path.resolve(opt('--out', path.join(site, '..', 'check')));
mkdirSync(out, { recursive: true });
const ROOT = '[data-page-tips-into-3d-runway]', ON = 'data-page-tips-into-3d-runway-on';

const chrome = findChrome();
if (!chrome) { console.error('Chrome not found (set CHROME_PATH).'); process.exit(2); }
const version = chromeVersion(chrome);
const srv = await serve(site);
const url = `${srv.url}/${page}`;
const results = [];
const report = (ok, name, detail = '') => { results.push({ ok, name, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); };
const note = (text) => { results.push({ note: text }); console.log(`note  ${text}`); };

function watch(t) {
  const seen = { errors: [], missing: [], left: [] };
  t.on('Runtime.exceptionThrown', (e) => seen.errors.push((e.exceptionDetails.exception?.description ?? e.exceptionDetails.text).slice(0, 200)));
  t.on('Runtime.consoleAPICalled', (e) => { if (e.type === 'error') seen.errors.push(e.args.map((a) => a.value ?? a.description).join(' ').slice(0, 200)); });
  t.on('Network.responseReceived', (e) => { if (e.response.status >= 400 && !e.response.url.endsWith('/favicon.ico')) seen.missing.push(`${e.response.status} ${e.response.url.replace(srv.url, '')}`); });
  t.on('Network.requestWillBeSent', (e) => { const u = e.request.url; if (/^https?:/.test(u) && !u.startsWith(srv.url)) seen.left.push(u.slice(0, 120)); });
  return seen;
}

const b = await launch(chrome, { flag: true });
try {
  // ---- flat, at the sizes where pages break ----
  for (const [w, h, mobile] of [[1440, 900], [1280, 720], [1024, 768], [768, 1024], [390, 844, true]]) {
    const t = await b.tab(w, h, { mobile: !!mobile, dpr: mobile ? 3 : 2 });
    const seen = watch(t);
    await t.goto(url);
    await delay(1500);
    await t.shot(path.join(out, `flat-${w}x${h}-top.jpg`));
    const m = await t.evaluate(`({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h: document.documentElement.scrollHeight })`);
    for (const [i, share] of [[1, 0.33], [2, 0.66], [3, 1]]) { await t.evaluate(`window.scrollTo({ top: ${Math.round(m.h * share)}, behavior: 'instant' })`); await delay(700); await t.shot(path.join(out, `flat-${w}x${h}-${i === 3 ? 'end' : i}.jpg`)); }
    const label = `flat ${w}×${h}`;
    report(m.sw <= m.cw + 1, `${label}: no sideways scroll`, m.sw > m.cw + 1 ? `${m.sw} wide in ${m.cw}` : '');
    report(!seen.errors.length, `${label}: no errors`, seen.errors[0] ?? '');
    report(!seen.missing.length, `${label}: no missing files`, seen.missing.slice(0, 3).join(', '));
    report(!seen.left.length, `${label}: nothing loaded from the network`, seen.left.slice(0, 2).join(', '));
    await t.close();
  }

  // ---- the 3D mode ----
  const t = await b.tab(1440, 900);
  const seen = watch(t);
  await t.goto(url);
  await delay(1500);
  const has = await t.evaluate(`({ runway: !!window.__runway, toggle: !!document.querySelector(${JSON.stringify(TOGGLE)}), titles: document.querySelectorAll('[data-page-tips-into-3d-runway-part="title"]').length, slabs: document.querySelectorAll('[data-page-tips-into-3d-runway-part="slab"]').length, callouts: document.querySelectorAll('[data-page-tips-into-3d-runway-part="callout"]').length, root: !!document.querySelector(${JSON.stringify(ROOT)}) })`);
  report(has.root && has.runway, 'the page mounts the engine and sets window.__runway');
  report(has.toggle, `the toggle exists at 1440×900 (${TOGGLE})`);
  report(has.titles >= 3 && has.slabs >= 6, 'parts marked', `${has.titles} titles, ${has.slabs} slabs, ${has.callouts} callouts`);
  if (has.toggle && has.runway) {
    const h = await t.evaluate(`document.documentElement.scrollHeight`);
    await t.evaluate(`window.scrollTo({ top: ${Math.round(Math.min(h * 0.1, 1400))}, behavior: 'instant' })`);
    await delay(800);
    await t.evaluate(`document.querySelector(${JSON.stringify(TOGGLE)}).click()`);
    await delay(320);
    await t.shot(path.join(out, 'tip-midway.jpg'));
    await delay(2500);
    report(await t.evaluate(`document.documentElement.hasAttribute('${ON}')`), 'the toggle tips the page');
    await t.shot(path.join(out, 'tipped-0.jpg'));

    const wheel = async (px) => { const n = Math.ceil(px / 300); for (let i = 0; i < n; i++) { await t.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 720, y: 450, deltaX: 0, deltaY: 300 }); await delay(25); } await delay(1800); };
    const key = async (k, code, vk) => { await t.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk }); await t.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code }); };
    const pageH = await t.evaluate(`document.querySelector(${JSON.stringify(ROOT)}).offsetHeight`);
    // Both ends of the page first: the hero lying down, the last chapter.
    await key('End', 'End', 35); await delay(3000); await t.shot(path.join(out, 'tipped-end.jpg'));
    await key('Home', 'Home', 36); await delay(3000); await t.shot(path.join(out, 'tipped-home.jpg'));
    for (let i = 1; i <= 5; i++) { await wheel(pageH / 6); await t.shot(path.join(out, `tipped-${i}.jpg`)); }

    // A click through the floor: find a control of the page on screen, press where the engine says it is.
    await t.evaluate(`window.__pressed = null; document.querySelector(${JSON.stringify(ROOT)}).addEventListener('click', (e) => { window.__pressed = e.target.closest('a[href], button, input, select, textarea, summary, [tabindex]'); }, true)`);
    const CONTROLS = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';
    let spot = null;
    for (let tries = 0; tries < 6 && !spot; tries++) {
      spot = await t.evaluate(`(() => { const root = document.querySelector(${JSON.stringify(ROOT)}), o = root.getBoundingClientRect();
        for (const el of root.querySelectorAll(${JSON.stringify(CONTROLS)})) { const q = el.getBoundingClientRect(); if (!q.width) continue;
          const p = window.__runway.screenOf(q.left - o.left + q.width / 2, q.top - o.top + q.height / 2);
          if (p && p[0] > 180 && p[0] < innerWidth - 180 && p[1] > 160 && p[1] < innerHeight - 90) { window.__want = el; return { x: p[0], y: p[1], text: el.textContent.trim().slice(0, 40) }; } }
        return null; })()`);
      if (!spot) await wheel(-900);
    }
    report(!!spot, 'a control of the page is on the floor to press');
    if (spot) {
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await t.send('Input.dispatchMouseEvent', { type, x: spot.x, y: spot.y, button: 'left', clickCount: 1 });
      await delay(500);
      report(await t.evaluate(`window.__pressed === window.__want`), 'a click on the floor presses the real control', `"${spot.text}"`);
      await t.shot(path.join(out, 'tipped-after-click.jpg'));
    }
    // That click may have opened the page's own dialog, which keeps its Esc: close it first.
    if (await t.evaluate(`!!document.querySelector('dialog[open], [role="dialog"]:not([hidden])')`)) { await key('Escape', 'Escape', 27); await delay(400); await t.evaluate(`document.querySelector('dialog[open]')?.close()`); await delay(300); }
    await t.evaluate(`if (location.hash) history.replaceState(null, '', location.pathname)`);

    await t.resize(1100, 760);
    await delay(2200);
    await t.shot(path.join(out, 'tipped-resized.jpg'));
    report(await t.evaluate(`document.documentElement.hasAttribute('${ON}')`), 'still tipped after a resize');
    await t.resize(1440, 900);
    await delay(1500);
    await key('Escape', 'Escape', 27);
    await delay(1600);
    report(!(await t.evaluate(`document.documentElement.hasAttribute('${ON}')`)), 'Esc lays the page back');
    const after = await t.evaluate(`({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, back: !!document.querySelector('body > ${ROOT}, body ${ROOT}') && !document.querySelector('canvas ${ROOT}') })`);
    report(after.back && after.sw <= after.cw + 1, 'the page is back in the document, no sideways scroll');
    await t.shot(path.join(out, 'back.jpg'));
    report(!seen.errors.length, 'no errors in the 3D mode', seen.errors[0] ?? '');
  }
  await t.close();

  // ---- reduced motion: the tip is a cut ----
  const r = await b.tab(1440, 900, { reducedMotion: true });
  await r.goto(url);
  await delay(1200);
  if (await r.evaluate(`!!document.querySelector(${JSON.stringify(TOGGLE)})`)) {
    await r.evaluate(`window.scrollTo({ top: 800, behavior: 'instant' }); document.querySelector(${JSON.stringify(TOGGLE)}).click()`);
    await delay(400);
    await r.shot(path.join(out, 'reduced-motion.jpg'));
    report(await r.evaluate(`document.documentElement.hasAttribute('${ON}')`), 'reduced motion: the tip still works, as a cut');
  }
  await r.close();

  // ---- phone: no button (no wheel to travel with) ----
  const p = await b.tab(390, 844, { mobile: true, dpr: 3 });
  await p.goto(url);
  await delay(1000);
  report(!(await p.evaluate(`!!document.querySelector(${JSON.stringify(TOGGLE)})`)), 'phone: no 3D button');
  await p.close();
} finally { b.close(); }

// ---- where the feature is missing: no dead button ----
if (version && version < 157) {
  const plain = await launch(chrome, { flag: false });
  const t = await plain.tab(1440, 900);
  await t.goto(url);
  await delay(1200);
  const api = await t.evaluate(`'content' in HTMLCanvasElement.prototype || 'layoutSubtree' in HTMLCanvasElement.prototype`);
  if (!api) report(!(await t.evaluate(`!!document.querySelector(${JSON.stringify(TOGGLE)})`)), 'a browser without the feature gets no button');
  else note('this Chrome has the feature without the switch: the no-button case was not tested');
  plain.close();
} else note(`Chrome ${version}: has the feature as it comes, so the no-button case was not tested here`);

srv.close();
const failed = results.filter((x) => x.ok === false);
writeFileSync(path.join(out, 'report.json'), JSON.stringify(results, null, 2));
console.log(`\n${failed.length ? `${failed.length} FAILED` : 'all passed'}. Shots: ${out}`);
setTimeout(() => process.exit(failed.length ? 2 : 0), 1000);
