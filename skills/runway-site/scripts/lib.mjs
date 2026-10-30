// Shared by this skill's scripts: find Chrome, start it headless, talk to it, serve a folder.
// Node 22 or newer, no dependencies.
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const SWITCH = '--enable-blink-features=CanvasDrawElement';

export function findChrome() {
  const candidates = process.env.CHROME_PATH ? [process.env.CHROME_PATH] : [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

export function chromeVersion(chrome) {
  try {
    const text = execFileSync(chrome, ['--version'], { encoding: 'utf8', timeout: 10000 });
    return Number(text.match(/(\d+)\./)?.[1]) || null;
  } catch { return null; }
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8' };

/** A static server on 127.0.0.1 with byte ranges (films need them). port 0 picks a free one. */
export function serve(root, port = 0) {
  const base = path.resolve(root);
  const server = createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(base, rel);
    if (!file.startsWith(base) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end('not found'); return; }
    const size = statSync(file).size, type = TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
    const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
    if (range) {
      const start = Number(range[1] || 0), end = Math.min(size - 1, range[2] ? Number(range[2]) : size - 1);
      res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
      createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size });
      createReadStream(file).pipe(res);
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}

/** A headless Chrome of its own (temporary profile). Never a window: the person is using this computer. */
export async function launch(chrome, { flag = true } = {}) {
  const profile = mkdtempSync(path.join(tmpdir(), 'runway-chrome-'));
  const args = ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
    '--enable-unsafe-webgpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'];
  if (flag) args.unshift(SWITCH);
  const proc = spawn(chrome, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => {
    let err = '';
    const timer = setTimeout(() => reject(new Error('Chrome did not start in 30 s')), 30000);
    proc.stderr.on('data', (d) => {
      err += d;
      const m = err.match(/DevTools listening on (ws:\S+)/);
      if (m) { clearTimeout(timer); resolve(m[1]); }
    });
    proc.on('exit', (code) => { clearTimeout(timer); reject(new Error(`Chrome exited (${code})`)); });
  });
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
  let id = 0;
  const pending = new Map(), listeners = new Map();
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { const { res, rej, method } = pending.get(d.id); pending.delete(d.id); d.error ? rej(new Error(`${method}: ${d.error.message}`)) : res(d.result ?? {}); return; }
    for (const h of listeners.get(`${d.sessionId ?? ''}|${d.method}`) ?? []) h(d.params ?? {});
  });
  const raw = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const my = ++id; pending.set(my, { res, rej, method });
    ws.send(JSON.stringify({ id: my, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  return {
    async tab(width, height, { mobile = false, dpr = 2, reducedMotion = false } = {}) {
      const { targetId } = await raw('Target.createTarget', { url: 'about:blank', newWindow: true, width, height });
      const { sessionId } = await raw('Target.attachToTarget', { targetId, flatten: true });
      const send = (m, p) => raw(m, p, sessionId);
      const on = (m, h) => { const k = `${sessionId}|${m}`; if (!listeners.has(k)) listeners.set(k, new Set()); listeners.get(k).add(h); };
      for (const d of ['Page', 'Runtime', 'Network']) await send(`${d}.enable`);
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile });
      if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      if (reducedMotion) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
      const evaluate = async (expression) => {
        const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
        return r.result?.value ?? null;
      };
      const goto = (url) => new Promise((resolve) => {
        const timer = setTimeout(resolve, 30000);
        on('Page.loadEventFired', () => { clearTimeout(timer); resolve(); });
        send('Page.navigate', { url });
      });
      const shot = async (file) => { const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 82 }); (await import('node:fs')).writeFileSync(file, Buffer.from(data, 'base64')); };
      return { send, on, evaluate, goto, shot, resize: (w, h) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile }), close: () => raw('Target.closeTarget', { targetId }) };
    },
    close() {
      try { ws.close(); } catch {}
      proc.kill();
      setTimeout(() => { try { rmSync(profile, { recursive: true, force: true }); } catch {} }, 800);
    },
  };
}

export const delay = (ms) => new Promise((r) => setTimeout(r, ms));
