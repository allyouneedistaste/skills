// page-tips-into-3d-runway: on request, the live page tips over into a long floor
// seen in 3D, in a dark drafting room; titles stand up, cards become slabs, the far
// end curls up to face the camera, and the wheel travels the floor. The page stays
// live and clickable. Self-contained, no imports.
//
// Built on HTML-in-Canvas (a <canvas layoutsubtree> lays the page out unseen and
// GPUQueue.copyElementImageToTexture copies any band of it into a texture) and WebGPU.
// Chrome 157+, or Chrome 147–156 with chrome://flags/#canvas-draw-element. Needs HTTPS or localhost.
//
//   import { mount, supported } from './page-tips-into-3d-runway.js';
//   const runway = mount(root, dress);  // root carries data-page-tips-into-3d-runway
//   runway.enter() / exit() / toggle() / on
//   runway.travel(row)                  // go to a page row (px from root's top), e.g. a chapter's offsetTop
//   runway.row                          // the row under the screen's centre
//   runway.screenOf(x, row)             // where a page point lands on screen, or null
//   dress: { ground, line, ink, font, labelFont, formulas, props, rulerFormat, zIndex, keepClear, onchange }

// The numbers that make the room what it is. A page never changes them: mount() throws if one is passed.
export const LOOK = Object.freeze({
  pitch: -31, // degrees below the horizon, at rest
  fovFlat: 48, // vertical field of view while the page is still flat (degrees)
  fovTilted: 44, // vertical field of view at rest
  height: 1.05, // camera height above the floor, in screen heights
  back: 1.2, // floor reaching behind the camera, in screen heights
  ahead: 4.2, // floor reaching ahead of the camera, in screen heights
  sharpness: 6, // how late the far end curls to face the camera (exponential)
  duration: 850, // ms, flat page to floor and back
  riseAt: 0.3, // share of the entry before the floor starts to curl
  texScale: 1.2, // texels per CSS px while the camera rests
  texScaleMoving: 1, // and while it travels
  titleRaise: 30, // px a standing title is lifted off the floor
  titleStand: 90, // degrees a title stands up from the floor
  slabShadow: 0.7, // darkness of the shadow under a slab
  shade: 0.2, // darkness of slab sides
  gridColumns: 8, // ground grid columns across the page width
  gridEvery: 5, // a major grid line every n minor ones
  rulerEvery: 400, // px of page between ruler marks
  rulerSize: 11, // px, ruler figures
  rulerAlpha: 0.5,
  labelPx: 22, // px, callout labels
  labelAlpha: 0.9,
  formulaEvery: 800, // px of page between floating formulas
  formulaSize: 12,
  formulaAlpha: 0.55,
  propEvery: 1800, // px of page between wireframe props
  propAlpha: 0.7,
  keyAzimuth: -35, // degrees, key light
  keyElevation: 40,
});

const NAME = 'page-tips-into-3d-runway';
const DEG = Math.PI / 180;
const SEG = 128; // strips of the floor
const SLAB = 22; // px a card is raised
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** True when this browser can draw a live page into WebGPU. */
export function supported() {
  return !!navigator.gpu && 'layoutSubtree' in HTMLCanvasElement.prototype && typeof GPUQueue !== 'undefined' &&
    ('copyElementImageToTexture' in GPUQueue.prototype || 'drawElementImageToTexture' in GPUQueue.prototype);
}

// ---- small matrix kit (column-major) ----
const mul = (a, b) => {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
};
const perspective = (fov, aspect, near, far) => {
  const f = 1 / Math.tan(fov / 2), o = new Float32Array(16);
  o[0] = f / aspect; o[5] = f; o[10] = far / (near - far); o[11] = -1; o[14] = (near * far) / (near - far);
  return o;
};
const viewFrom = (eye, fwd, up) => {
  const z = fwd.map((v) => -v), x = [up[1] * z[2] - up[2] * z[1], up[2] * z[0] - up[0] * z[2], up[0] * z[1] - up[1] * z[0]];
  const xl = Math.hypot(...x), xn = x.map((v) => v / xl), y = [z[1] * xn[2] - z[2] * xn[1], z[2] * xn[0] - z[0] * xn[2], z[0] * xn[1] - z[1] * xn[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return new Float32Array([xn[0], y[0], z[0], 0, xn[1], y[1], z[1], 0, xn[2], y[2], z[2], 0, -dot(xn, eye), -dot(y, eye), -dot(z, eye), 1]);
};
const project = (m, p) => {
  const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
  const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  return w > 1 ? [(x / w + 1) / 2, (1 - y / w) / 2, w] : null;
};

const SHADER = /* wgsl */ `
struct U { viewProj: mat4x4f, eye: vec4f, fog: vec4f, ground: vec4f };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var tex: texture_2d<f32>;
struct V { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) tint: vec4f, @location(2) dist: f32 };
@vertex fn vs(@location(0) p: vec3f, @location(1) uv: vec2f, @location(2) tint: vec4f) -> V {
  var o: V;
  o.pos = u.viewProj * vec4f(p, 1.0);
  o.uv = uv;
  o.tint = tint;
  o.dist = distance(p, u.eye.xyz);
  return o;
}
fn fogged(rgb: vec3f, d: f32) -> vec3f { return mix(rgb, u.ground.rgb, smoothstep(u.fog.x, u.fog.y, d)); }
// tint.a < -1: the texture's shape in tint.rgb; -1 <= tint.a < 0: textured, tint.rgb multiplies; tint.a >= 0: flat colour
@fragment fn fsTex(i: V) -> @location(0) vec4f {
  let c = textureSample(tex, samp, i.uv);
  if (i.tint.a < -1.0) { // the texture's shape in one flat colour (a title's edge, its shadow)
    let k = -i.tint.a - 1.0;
    return vec4f(fogged(i.tint.rgb, i.dist) * c.a * k, c.a * k);
  }
  if (i.tint.a < 0.0) {
    let k = -i.tint.a;
    let straight = c.rgb / max(c.a, 0.001); // the copy is premultiplied
    return vec4f(fogged(straight * i.tint.rgb, i.dist) * c.a * k, c.a * k);
  }
  return vec4f(fogged(i.tint.rgb, i.dist) * i.tint.a, i.tint.a);
}
@fragment fn fsLine(i: V) -> @location(0) vec4f {
  let a = i.tint.a * (1.0 - smoothstep(u.fog.x, u.fog.y, i.dist));
  return vec4f(i.tint.rgb * a, a);
}`;

/**
 * @param {HTMLElement} root  the element carrying data-page-tips-into-3d-runway: the page to tip, laid out normally
 * @param {object} dress      ground, line (0–1 rgb), ink, font, labelFont, formulas, props, rulerFormat, zIndex, keepClear, onchange
 * @returns {{ enter(): Promise<void>, exit(): Promise<void>, toggle(): Promise<void>, travel(row: number): void, readonly row: number, screenOf(x: number, row: number): number[]|null, readonly on: boolean, destroy(): void }}
 */
export function mount(root, dress = {}) {
  for (const k of Object.keys(dress)) if (k in LOOK) throw new Error(`${NAME}: "${k}" is one of the engine's own numbers, not Dress`);
  const D = {
    ground: dress.ground ?? [0.04, 0.04, 0.045], // the room, 0–1 rgb
    line: dress.line ?? [1, 1, 1], // wireframes, grid, rulers
    ink: dress.ink ?? 'rgb(255 255 255)', // overlay text
    font: dress.font ?? 'ui-monospace, monospace',
    labelFont: dress.labelFont ?? 'system-ui, sans-serif',
    formulas: dress.formulas ?? ['y = sin(x)', 'a² + b² = c²', 'Δx · Δp ≥ ħ/2', 'φ = (1 + √5) / 2'],
    props: dress.props ?? ['tower', 'arch', 'torus', 'dome', 'stairs', 'column'],
    rulerFormat: dress.rulerFormat ?? ((n) => String(n)),
    onchange: dress.onchange ?? (() => {}),
    keepClear: dress.keepClear ?? null, // selector of fixed controls no label may sit under
  };
  const part = (p) => [...root.querySelectorAll(`[data-${NAME}-part="${p}"]`)];

  let on = false, busy = false, t = 0, raf = 0;
  let device, ctx, format, canvas, overlay, o2d, placeholder, pipes, ubuf, sampler, layout, vbuf, lbuf, depth;
  let band = null, bandTex, bandBind, titleTex = new Map(), lastMove = 0, titlesTaken = false;
  let focus = 0, target = 0, W = 0, H = 0, pageH = 0, viewProj = null, eye = [0, 0, 0], curve = null, R0 = 0;
  let geo = { slabs: [], titles: [], callouts: [] };

  // ---- the floor's side profile: SEG strips, flat under the camera, curling at the far end to face it ----
  function buildCurve(rise, camY) {
    const L = (LOOK.back + LOOK.ahead) * H, ds = L / SEG, z = new Float32Array(SEG + 1), y = new Float32Array(SEG + 1), g = new Float32Array(SEG);
    const k = LOOK.sharpness, r = (u) => Math.expm1(k * u) / Math.expm1(k);
    z[0] = LOOK.back * H; y[0] = 0;
    for (let i = 0; i < SEG; i++) {
      const face = Math.atan2(-z[i], camY - y[i]); // the tilt that would point this strip at the camera
      g[i] = rise * r((i + 0.5) / SEG) * Math.max(0, face);
      z[i + 1] = z[i] - Math.cos(g[i]) * ds;
      y[i + 1] = y[i] + Math.sin(g[i]) * ds;
    }
    return { z, y, g, ds, L };
  }
  // A point on (or above) the floor: page x, page row, height off the floor along its normal.
  function at(x, row, h = 0) {
    const s = clamp((R0 - row) / curve.ds, 0, SEG - 1e-4), i = Math.floor(s), f = s - i;
    const z = lerp(curve.z[i], curve.z[i + 1], f), y = lerp(curve.y[i], curve.y[i + 1], f), g = curve.g[Math.min(SEG - 1, i)];
    return [x - W / 2, y + Math.cos(g) * h, z + Math.sin(g) * h];
  }
  // The page row and x where a ray from the camera meets the floor.
  function hit(o, d) {
    for (let i = 0; i < SEG; i++) {
      const az = curve.z[i], ay = curve.y[i], bz = curve.z[i + 1], by = curve.y[i + 1];
      const ez = bz - az, ey = by - ay, den = d[2] * ey - d[1] * ez;
      if (Math.abs(den) < 1e-9) continue;
      const tt = ((az - o[2]) * ey - (ay - o[1]) * ez) / den, u = Math.abs(ez) > Math.abs(ey) ? (o[2] + d[2] * tt - az) / ez : (o[1] + d[1] * tt - ay) / ey;
      if (tt > 0 && u >= 0 && u <= 1) return { x: o[0] + d[0] * tt + W / 2, s: (i + u) * curve.ds };
    }
    return null;
  }

  function pose(e) {
    const H2 = H / 2, a = H2 / Math.tan((LOOK.fovFlat * DEG) / 2);
    const pitch = lerp(-90, LOOK.pitch, e) * DEG, fov = lerp(LOOK.fovFlat, LOOK.fovTilted, e) * DEG;
    const flat = [0, a, LOOK.back * H - 2 * H], rest = [0, LOOK.height * H, 0];
    const p = [0, lerp(flat[1], rest[1], e), lerp(flat[2], rest[2], e)];
    const fwd = [0, Math.sin(pitch), -Math.cos(pitch)], up = [0, Math.cos(pitch), Math.sin(pitch)];
    return { p, fwd, up, fov };
  }

  function layoutParts() {
    const o = root.getBoundingClientRect();
    const box = (el) => { const r = el.getBoundingClientRect(); return { x0: r.left - o.left, y0: r.top - o.top, x1: r.right - o.left, y1: r.bottom - o.top, el }; };
    geo = {
      slabs: part('slab').map(box),
      titles: part('title').map((el) => {
        const m = getComputedStyle(el).color.match(/[\d.]+/g) ?? ['255', '255', '255'];
        const scale = /^color\(/.test(getComputedStyle(el).color) ? 1 : 255;
        const face = m.slice(0, 3).map((v) => Number(v) / scale);
        return { ...box(el), face, luma: 0.2126 * face[0] + 0.7152 * face[1] + 0.0722 * face[2] };
      }),
      callouts: part('callout').map((el) => ({ ...box(el), text: el.getAttribute(`data-${NAME}-label`) || el.textContent.trim().split('\n')[0].slice(0, 48) })),
    };
  }

  // The API copies only direct children of the canvas, so every title gets a twin
  // there: same text, same computed type and colour, on a clear ground. The title itself
  // is hidden from the floor, which then shows only the twin's shadow.
  const TYPE = ['font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch', 'font-variation-settings', 'font-feature-settings',
    'letter-spacing', 'word-spacing', 'line-height', 'text-transform', 'text-align', 'color', '-webkit-text-stroke', 'text-shadow', 'white-space'];
  function makeTwins() {
    for (const tl of geo.titles) {
      const cs = getComputedStyle(tl.el), twin = tl.el.cloneNode(true);
      twin.removeAttribute(`data-${NAME}-part`);
      twin.removeAttribute('id');
      for (const k of TYPE) twin.style.setProperty(k, cs.getPropertyValue(k));
      Object.assign(twin.style, { position: 'absolute', left: '0', top: '0', margin: '0', padding: cs.padding, boxSizing: 'border-box',
        width: `${tl.x1 - tl.x0}px`, height: `${tl.y1 - tl.y0}px`, background: 'transparent', pointerEvents: 'none', visibility: 'visible' });
      twin.setAttribute('aria-hidden', 'true');
      canvas.append(twin);
      tl.twin = twin;
      tl.el.style.visibility = 'hidden';
    }
  }
  function dropTwins() { for (const tl of geo.titles) { tl.twin?.remove(); tl.twin = null; tl.el.style.visibility = ''; } }

  // ---- upload: the band of page the floor shows, and each standing title ----
  function wantedBand(scale) {
    const top = clamp(R0 - curve.L, 0, Math.max(0, pageH - curve.L));
    return { top: Math.round(top), height: Math.round(Math.min(curve.L, pageH)), scale };
  }
  // Copy a rectangle of an element (root by default) into a texture, at the texture's size.
  function copy(rect, tex, el = root) {
    const q = device.queue;
    if (q.copyElementImageToTexture)
      q.copyElementImageToTexture({ source: el, sx: rect.x, sy: rect.y, swidth: rect.w, sheight: rect.h },
        { destination: { texture: tex, premultipliedAlpha: true }, width: tex.width, height: tex.height });
    else
      q.drawElementImageToTexture({ element: el, sourceX: rect.x, sourceY: rect.y, sourceWidth: rect.w, sourceHeight: rect.h },
        { texture: tex, size: { width: tex.width, height: tex.height }, premultipliedAlpha: true });
  }
  const makeTex = (w, h) => device.createTexture({ size: [w, h], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
  const bindFor = (tex) => device.createBindGroup({ layout, entries: [{ binding: 0, resource: { buffer: ubuf } }, { binding: 1, resource: sampler }, { binding: 2, resource: tex.createView() }] });
  function upload() {
    if (!on || !curve) return;
    const moving = performance.now() - lastMove < 250;
    const b = wantedBand(moving ? LOOK.texScaleMoving : LOOK.texScale);
    const max = device.limits.maxTextureDimension2D;
    const w = Math.min(max, Math.round(W * b.scale)), h = Math.min(max, Math.round(b.height * b.scale));
    if (!bandTex || bandTex.width !== w || bandTex.height !== h) { bandTex?.destroy(); bandTex = makeTex(w, h); bandBind = bindFor(bandTex); }
    try {
      if (!titlesTaken) {
        // Titles are taken once, from their twins.
        for (const tl of geo.titles) {
          const tw = Math.round((tl.x1 - tl.x0) * LOOK.texScale), th = Math.round((tl.y1 - tl.y0) * LOOK.texScale);
          let rec = titleTex.get(tl.el);
          if (!rec || rec.tex.width !== tw || rec.tex.height !== th) { rec?.tex.destroy(); const tex = makeTex(tw, th); rec = { tex, bind: bindFor(tex) }; titleTex.set(tl.el, rec); }
          copy({ x: 0, y: 0, w: tl.x1 - tl.x0, h: tl.y1 - tl.y0 }, rec.tex, tl.twin);
        }
        titlesTaken = true;
      }
      copy({ x: 0, y: b.top, w: W, h: b.height }, bandTex);
      band = b;
    } catch (err) { console.error(`${NAME}: upload failed`, err); }
  }
  function needsUpload() {
    if (!band) return true;
    const moving = performance.now() - lastMove < 250;
    if (!moving && band.scale !== LOOK.texScale) return true;
    const want = wantedBand(band.scale);
    return Math.abs(want.top - band.top) > H * 0.5;
  }

  // ---- the props: wireframes of our own, as line segments, in units of one screen height ----
  const PROPS = {
    tower: () => { const s = []; for (let k = 0; k < 4; k++) box(s, [-0.18 + k * 0.02, k * 0.22, -0.12], [0.18 - k * 0.02, (k + 1) * 0.22, 0.12]); return s; },
    column: () => { const s = []; ring(s, 0, 0.08, 16); ring(s, 0.7, 0.08, 16); for (let k = 0; k < 8; k++) { const a = (k / 8) * 2 * Math.PI; s.push([Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08], [Math.cos(a) * 0.08, 0.7, Math.sin(a) * 0.08]); } box(s, [-0.12, 0.7, -0.12], [0.12, 0.76, 0.12]); return s; },
    arch: () => { const s = []; for (let k = 0; k < 24; k++) { const a0 = (k / 24) * Math.PI, a1 = ((k + 1) / 24) * Math.PI; for (const z of [-0.05, 0.05]) s.push([Math.cos(a0) * 0.3, 0.3 + Math.sin(a0) * 0.3, z], [Math.cos(a1) * 0.3, 0.3 + Math.sin(a1) * 0.3, z]); } for (const x of [-0.3, 0.3]) for (const z of [-0.05, 0.05]) s.push([x, 0, z], [x, 0.3, z]); return s; },
    dome: () => { const s = []; for (let k = 1; k <= 5; k++) ring(s, Math.sin((k / 6) * Math.PI / 2) * 0.3, Math.cos((k / 6) * Math.PI / 2) * 0.3, 24); for (let k = 0; k < 12; k++) { const a = (k / 12) * 2 * Math.PI; for (let j = 0; j < 6; j++) { const b0 = (j / 6) * Math.PI / 2, b1 = ((j + 1) / 6) * Math.PI / 2; s.push([Math.cos(a) * Math.cos(b0) * 0.3, Math.sin(b0) * 0.3, Math.sin(a) * Math.cos(b0) * 0.3], [Math.cos(a) * Math.cos(b1) * 0.3, Math.sin(b1) * 0.3, Math.sin(a) * Math.cos(b1) * 0.3]); } } return s; },
    torus: () => { const s = [], R = 0.22, r = 0.07; for (let i = 0; i < 24; i++) for (let j = 0; j < 8; j++) { const p = (a, b) => [(R + r * Math.cos(b)) * Math.cos(a), 0.3 + r * Math.sin(b), (R + r * Math.cos(b)) * Math.sin(a)]; const a0 = (i / 24) * 2 * Math.PI, a1 = ((i + 1) / 24) * 2 * Math.PI, b0 = (j / 8) * 2 * Math.PI, b1 = ((j + 1) / 8) * 2 * Math.PI; s.push(p(a0, b0), p(a1, b0), p(a0, b0), p(a0, b1)); } return s; },
    stairs: () => { const s = []; for (let k = 0; k < 6; k++) box(s, [-0.15, 0, -0.3 + k * 0.1], [0.15, (k + 1) * 0.06, -0.2 + k * 0.1]); return s; },
  };
  function box(s, a, b) {
    const c = [[a[0], a[1], a[2]], [b[0], a[1], a[2]], [b[0], a[1], b[2]], [a[0], a[1], b[2]], [a[0], b[1], a[2]], [b[0], b[1], a[2]], [b[0], b[1], b[2]], [a[0], b[1], b[2]]];
    for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) s.push(c[i], c[j]);
  }
  function ring(s, y, r, n) { for (let k = 0; k < n; k++) { const a0 = (k / n) * 2 * Math.PI, a1 = ((k + 1) / n) * 2 * Math.PI; s.push([Math.cos(a0) * r, y, Math.sin(a0) * r], [Math.cos(a1) * r, y, Math.sin(a1) * r]); } }
  const propCache = new Map();
  const propLines = (name) => { if (!propCache.has(name)) propCache.set(name, (typeof name === 'function' ? name : PROPS[name] ?? PROPS.tower)()); return propCache.get(name); };

  // ---- one frame: geometry rebuilt on the CPU (a few thousand vertices), drawn in two passes ----
  const tris = new Float32Array(9 * 60000), lines = new Float32Array(9 * 160000);
  let nt = 0, nl = 0;
  const tri = (p, uv, c) => { tris.set([p[0], p[1], p[2], uv[0], uv[1], c[0], c[1], c[2], c[3]], nt * 9); nt++; };
  const quad = (a, b, c, d, ua, ub, uc, ud, col) => { tri(a, ua, col); tri(b, ub, col); tri(c, uc, col); tri(a, ua, col); tri(c, uc, col); tri(d, ud, col); };
  // a long line in short pieces, so the fog, which is worked out per vertex, fades it along its length
  const long = (p, q, c, n = 48) => { for (let k = 0; k < n; k++) seg([0, 1, 2].map((i) => lerp(p[i], q[i], k / n)), [0, 1, 2].map((i) => lerp(p[i], q[i], (k + 1) / n)), c); };
  const seg = (p, q, c) => { if (nl > 159990) return; lines.set([p[0], p[1], p[2], 0, 0, c[0], c[1], c[2], c[3]], nl * 9); lines.set([q[0], q[1], q[2], 0, 0, c[0], c[1], c[2], c[3]], (nl + 1) * 9); nl += 2; };

  function frame(now) {
    if (!on) return;
    const before = focus;
    focus += (target - focus) * 0.12;
    if (Math.abs(focus - before) > 0.4) lastMove = now;
    const e = easeInOut(t), rise = easeInOut(clamp((t - LOOK.riseAt) / (1 - LOOK.riseAt), 0, 1));
    const cam = pose(e);
    curve = buildCurve(rise, cam.p[1]);
    // Keep the page row under the screen's centre where the viewer was reading.
    const centre = hit(cam.p, cam.fwd);
    R0 = focus + (centre ? centre.s : 2 * H);
    eye = cam.p;
    viewProj = mul(perspective(cam.fov, innerWidth / innerHeight, 5, H * 40), viewFrom(cam.p, cam.fwd, cam.up));
    if (needsUpload()) canvas.requestPaint();
    if (band) draw(rise);
    drawOverlay(rise);
    raf = requestAnimationFrame(frame);
  }

  function draw(rise) {
    nt = 0; nl = 0;
    const white = [1, 1, 1, -1], uvOf = (x, row) => [x / W, (row - band.top) / band.height];
    // the floor
    const rows = [];
    for (let i = 0; i <= SEG; i++) rows.push(R0 - i * curve.ds);
    for (let i = 0; i < SEG; i++) {
      const r0 = rows[i], r1 = rows[i + 1];
      if (r1 > pageH || r0 < 0) continue;
      const a = clamp(r0, 0, pageH), b = clamp(r1, 0, pageH);
      quad(at(0, a), at(W, a), at(W, b), at(0, b), uvOf(0, a), uvOf(W, a), uvOf(W, b), uvOf(0, b), white);
    }
    const nFloor = nt;
    // slabs: raised copies of each card with dark sides, and a shadow on the floor under them
    const lift = SLAB * rise, sh = [0, 0, 0, LOOK.slabShadow * 0.5 * rise], side = [D.ground[0] + LOOK.shade * 0.3, D.ground[1] + LOOK.shade * 0.3, D.ground[2] + LOOK.shade * 0.3, 0.92];
    for (const s of geo.slabs) {
      if (s.y1 < band.top || s.y0 > band.top + band.height || lift < 0.5) continue;
      const off = lift * 0.6;
      const n = 6;
      for (let k = 0; k < n; k++) { // in strips, so on the curl it stays on the floor and under the slab
        const ya = lerp(s.y0 - off * 0.2, s.y1 + off, k / n), yb = lerp(s.y0 - off * 0.2, s.y1 + off, (k + 1) / n);
        quad(at(s.x0 + off, ya, 0.3), at(s.x1 + off, ya, 0.3), at(s.x1 + off, yb, 0.3), at(s.x0 + off, yb, 0.3), [0, 0], [0, 0], [0, 0], [0, 0], sh);
      }
      for (let k = 0; k < n; k++) {
        const ya = lerp(s.y0, s.y1, k / n), yb = lerp(s.y0, s.y1, (k + 1) / n);
        quad(at(s.x0, ya, lift), at(s.x1, ya, lift), at(s.x1, yb, lift), at(s.x0, yb, lift), uvOf(s.x0, ya), uvOf(s.x1, ya), uvOf(s.x1, yb), uvOf(s.x0, yb), white);
        quad(at(s.x0, yb, 0), at(s.x0, ya, 0), at(s.x0, ya, lift), at(s.x0, yb, lift), [0, 0], [0, 0], [0, 0], [0, 0], side);
        quad(at(s.x1, ya, 0), at(s.x1, yb, 0), at(s.x1, yb, lift), at(s.x1, ya, lift), [0, 0], [0, 0], [0, 0], [0, 0], side);
      }
      quad(at(s.x0, s.y1, 0), at(s.x1, s.y1, 0), at(s.x1, s.y1, lift), at(s.x0, s.y1, lift), [0, 0], [0, 0], [0, 0], [0, 0], side);
    }
    const nSlab = nt;
    // standing titles: hinged at their baseline, lifted, with a short extrusion behind the face
    const titleDraws = [];
    const stand = LOOK.titleStand * DEG * rise, raise = LOOK.titleRaise * rise + 1; // never quite on the floor, even before the rise: no z-fighting
    for (const tl of geo.titles) {
      const rec = titleTex.get(tl.el);
      if (!rec || tl.y1 < band.top - H || tl.y0 > band.top + band.height) continue;
      const hgt = tl.y1 - tl.y0, base = tl.y1;
      const foot = (x) => at(x, base, raise);
      const head = (x) => { const p = foot(x), q = at(x, base - hgt, raise); return [p[0], p[1] + (q[1] - p[1]) * Math.cos(stand) + hgt * Math.sin(stand), p[2] + (q[2] - p[2]) * Math.cos(stand)]; };
      const start = nt;
      const layers = 10;
      for (let k = layers; k >= 0; k--) {
        const dz = -k * 1.4 * rise, depth = (layers - k) / layers;
        // the edge is a step away from the face: lighter behind dark letters, darker behind light ones
        const tint = k === 0 ? [1, 1, 1, -1] : [...tl.face.map((v) => (tl.luma > 0.5 ? v * (0.42 + 0.3 * depth) : v + (1 - v) * (0.3 + 0.2 * depth))), -2];
        const sh2 = (p) => [p[0], p[1], p[2] + dz];
        quad(sh2(head(tl.x0)), sh2(head(tl.x1)), sh2(foot(tl.x1)), sh2(foot(tl.x0)), [0, 0], [1, 0], [1, 1], [0, 1], tint);
      }
      // its shadow on the floor: its own letters, foreshortened and thrown sideways away from the key
      // light, soft (several faint offset copies), so it reads as a shadow and not as a second word
      const spread = [[0, 0], [5, 0], [-5, 0], [0, 4], [0, -4], [9, 3], [-9, -3], [10, -5], [-10, 5]];
      const reach = hgt * 0.5, sideways = 26 * rise;
      if (rise > 0) for (const [ox, oy] of spread) { // at rise 0 the alpha code would mean "textured", a solid black copy of the word
        const ax = tl.x0 + sideways + ox * rise, bx = tl.x1 + sideways + ox * rise, far = base - reach + oy * rise, near = base + oy * rise;
        quad(at(ax, far, 0.3), at(bx, far, 0.3), at(bx, near, 0.3), at(ax, near, 0.3), [0, 0], [1, 0], [1, 1], [0, 1], [0, 0, 0, -1 - (LOOK.slabShadow * 0.45 * rise) / spread.length]);
      }
      titleDraws.push({ bind: rec.bind, first: start, count: nt - start });
    }
    const nAfterTitles = nt;

    // lines: the ground grid of the room, rulers' ticks, slab outlines, the props.
    // The room's ground lies flat just under the floor and travels with the page.
    const lc = (a) => [D.line[0], D.line[1], D.line[2], a * rise];
    const colW = W / LOOK.gridColumns, gy = -2, zNear = curve.z[0], zOf = (row) => zNear - (R0 - row);
    const rFar = R0 - curve.L - H * 2;
    // six major columns across the page width, each in ten: a dense drafting grid
    const minor = colW / LOOK.gridEvery;
    for (let c = -LOOK.gridColumns * 2 * LOOK.gridEvery; c <= LOOK.gridColumns * 3 * LOOK.gridEvery; c++) {
      const x = c * minor - W / 2, major = c % LOOK.gridEvery === 0;
      long([x, gy, zOf(R0)], [x, gy, zOf(rFar)], lc(major ? 0.28 : 0.07), 32);
    }
    for (let k = Math.ceil(rFar / minor), r = k * minor; r <= R0; r += minor, k++) {
      const major = k % LOOK.gridEvery === 0;
      long([-W / 2 - W * 2, gy, zOf(r)], [W / 2 + W * 2, gy, zOf(r)], lc(major ? 0.28 : 0.07), 20);
    }
    for (let r = Math.ceil((R0 - curve.L) / LOOK.rulerEvery) * LOOK.rulerEvery; r < R0; r += LOOK.rulerEvery) {
      seg(at(0, r), at(-40, r), lc(LOOK.rulerAlpha)); seg(at(W, r), at(W + 40, r), lc(LOOK.rulerAlpha));
    }
    // the floor's edges, and a hairline round every slab's top
    for (let i = 0; i < SEG; i++) { seg(at(0, rows[i]), at(0, rows[i + 1]), lc(0.5)); seg(at(W, rows[i]), at(W, rows[i + 1]), lc(0.5)); }
    for (const sl of geo.slabs) {
      if (sl.y1 < R0 - curve.L || sl.y0 > R0) continue;
      const hh = SLAB * rise + 0.5, n = 6;
      for (let k = 0; k < n; k++) {
        const ya = lerp(sl.y0, sl.y1, k / n), yb = lerp(sl.y0, sl.y1, (k + 1) / n);
        seg(at(sl.x0, ya, hh), at(sl.x0, yb, hh), lc(0.45)); seg(at(sl.x1, ya, hh), at(sl.x1, yb, hh), lc(0.45));
      }
      seg(at(sl.x0, sl.y0, hh), at(sl.x1, sl.y0, hh), lc(0.45)); seg(at(sl.x0, sl.y1, hh), at(sl.x1, sl.y1, hh), lc(0.45));
    }
    // props: wireframes of our own standing on the room's ground beside the floor, both sides
    const props = D.props.length ? D.props : ['tower'];
    for (let r = Math.ceil(rFar / (LOOK.propEvery / 2)) * (LOOK.propEvery / 2); r < R0 + H; r += LOOK.propEvery / 2) {
      const idx = Math.round(r / (LOOK.propEvery / 2)), left = idx % 2 === 0, name = props[idx % props.length];
      const ax = left ? -W / 2 - H * 0.24 : W / 2 + H * 0.24, az = zOf(r);
      const yaw = ((idx * 37) % 360) * DEG, sc = H * (0.7 + (idx % 3) * 0.18);
      for (const p of propLines(name)) {
        if (nl > 159990) break;
        const x = p[0] * Math.cos(yaw) - p[2] * Math.sin(yaw), z = p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw);
        lines.set([ax + x * sc, gy + p[1] * sc, az + z * sc, 0, 0, D.line[0], D.line[1], D.line[2], LOOK.propAlpha * rise], nl * 9);
        nl++;
      }
    }

    const fogNear = curve.L * 0.62, fogFar = curve.L * 0.98;
    const u = new Float32Array(16 + 12);
    u.set(viewProj, 0); u.set([eye[0], eye[1], eye[2], 1], 16); u.set([fogNear, fogFar, 0, 0], 20); u.set([D.ground[0], D.ground[1], D.ground[2], 1], 24);
    device.queue.writeBuffer(ubuf, 0, u);
    device.queue.writeBuffer(vbuf, 0, tris, 0, nt * 9);
    if (nl) device.queue.writeBuffer(lbuf, 0, lines, 0, nl * 9);
    if (!depth || depth.width !== canvas.width || depth.height !== canvas.height) {
      depth?.destroy();
      depth = device.createTexture({ size: [canvas.width, canvas.height], format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT });
    }
    const enc = device.createCommandEncoder();
    const pass = enc.beginRenderPass({
      colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: D.ground[0], g: D.ground[1], b: D.ground[2], a: 1 } }],
      depthStencilAttachment: { view: depth.createView(), depthLoadOp: 'clear', depthStoreOp: 'store', depthClearValue: 1 },
    });
    pass.setVertexBuffer(0, vbuf);
    pass.setPipeline(pipes.tex);
    pass.setBindGroup(0, bandBind);
    pass.draw(nFloor * 1, 1, 0);
    pass.draw(nSlab - nFloor, 1, nFloor);
    for (const d of titleDraws) { pass.setBindGroup(0, d.bind); pass.draw(d.count, 1, d.first); }
    pass.setBindGroup(0, bandBind);
    pass.draw(nt - nAfterTitles, 1, nAfterTitles);
    if (nl) { pass.setPipeline(pipes.line); pass.setVertexBuffer(0, lbuf); pass.draw(nl); }
    pass.end();
    device.queue.submit([enc.finish()]);
  }

  // ---- the 2D layer: ruler figures, callouts on leader lines, formulas ----
  function drawOverlay(rise) {
    const dpr = devicePixelRatio, w = innerWidth, h = innerHeight;
    if (overlay.width !== Math.round(w * dpr) || overlay.height !== Math.round(h * dpr)) { overlay.width = Math.round(w * dpr); overlay.height = Math.round(h * dpr); }
    o2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    o2d.clearRect(0, 0, w, h);
    if (!curve || rise < 0.02) return;
    const P = (p) => { const s = project(viewProj, p); return s && [s[0] * w, s[1] * h, s[2]]; };
    const fade = (p) => 1 - clamp((Math.hypot(p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]) - curve.L * 0.62) / (curve.L * 0.36), 0, 1);
    o2d.fillStyle = D.ink; o2d.strokeStyle = D.ink; o2d.textBaseline = 'middle';
    // callouts: the card's own title floats beside the floor, a leader line back to its corner.
    // Worked out first, because everything else in the air gives way to them.
    const margin = 16, labelFont = `600 ${LOOK.labelPx * 0.75}px ${D.labelFont}`;
    o2d.font = labelFont;
    o2d.lineWidth = 1;
    const tags = [];
    for (const c of geo.callouts) {
      if (c.y1 < R0 - curve.L || c.y0 > R0) continue;
      const right = (c.x0 + c.x1) / 2 > W / 2;
      const corner = at(right ? c.x1 : c.x0, c.y0, SLAB * rise), sc = P(corner);
      const tag = at(right ? W + H * 0.12 : -H * 0.12, c.y0 - 40, 60), st = P(tag);
      if (!sc || !st) continue;
      const a = LOOK.labelAlpha * rise * fade(corner);
      if (a < 0.02 || sc[0] < 0 || sc[0] > w || sc[1] < 0 || sc[1] > h) continue;
      const tw = o2d.measureText(c.text).width;
      // kept inside the window; a label that would have to sit past its own corner is left out
      const x = right ? Math.min(st[0], w - margin - tw - 6) : Math.max(st[0], margin + tw + 6);
      if (right ? x < sc[0] : x > sc[0]) continue;
      tags.push({ right, text: c.text, sc, st: [x, st[1]], a, tw, onFloor: x !== st[0] });
    }
    // Cards on one row share a height: each side's labels are stacked so none prints over another.
    for (const side of [false, true]) {
      let last = -Infinity;
      for (const g of tags.filter((x) => x.right === side).sort((p, q) => p.st[1] - q.st[1])) {
        g.st = [g.st[0], Math.max(g.st[1], last + LOOK.labelPx * 1.15)];
        last = g.st[1];
      }
    }
    const boxOf = (g) => (g.right ? [g.st[0], g.st[1] - 24, g.st[0] + g.tw + 6, g.st[1] + 4] : [g.st[0] - g.tw - 6, g.st[1] - 24, g.st[0], g.st[1] + 4]);
    // a label under one of the page's fixed controls is left out
    if (D.keepClear) for (const el of document.querySelectorAll(D.keepClear)) {
      const r = el.getBoundingClientRect();
      for (let i = tags.length - 1; i >= 0; i--) { const b = boxOf(tags[i]); if (b[2] > r.left - 8 && b[0] < r.right + 8 && b[3] > r.top - 8 && b[1] < r.bottom + 8) tags.splice(i, 1); }
    }
    const boxes = tags.map(boxOf);
    const clear = (x0, y0, x1, y1) => boxes.every((b) => x1 + 8 < b[0] || x0 - 8 > b[2] || y1 + 2 < b[1] || y0 - 2 > b[3]);
    // rulers
    o2d.font = `${LOOK.rulerSize}px ${D.font}`;
    for (let r = Math.ceil((R0 - curve.L) / LOOK.rulerEvery) * LOOK.rulerEvery; r < R0; r += LOOK.rulerEvery) {
      if (r <= 0 || r > pageH) continue;
      for (const [x, align] of [[-48, 'right'], [W + 48, 'left']]) {
        const wp = at(x, r), s = P(wp);
        if (!s) continue;
        const text = D.rulerFormat(r), tw = o2d.measureText(text).width, x0 = align === 'right' ? s[0] - tw : s[0];
        if (!clear(x0, s[1] - 8, x0 + tw, s[1] + 8)) continue;
        o2d.globalAlpha = LOOK.rulerAlpha * rise * fade(wp);
        o2d.textAlign = align;
        o2d.fillText(text, s[0], s[1]);
      }
    }
    // formulas
    o2d.font = `italic ${LOOK.formulaSize}px ${D.font}`;
    for (let r = Math.ceil((R0 - curve.L) / LOOK.formulaEvery) * LOOK.formulaEvery; r < R0; r += LOOK.formulaEvery) {
      const k = Math.round(r / LOOK.formulaEvery), left = k % 2 === 1, wp = at(left ? -H * 0.18 : W + H * 0.18, r, 40), s = P(wp);
      if (!s || r <= 0) continue;
      const text = D.formulas[k % D.formulas.length], tw = o2d.measureText(text).width, x0 = left ? s[0] - tw : s[0];
      if (!clear(x0, s[1] - 8, x0 + tw, s[1] + 8)) continue;
      o2d.globalAlpha = LOOK.formulaAlpha * rise * fade(wp);
      o2d.textAlign = left ? 'right' : 'left';
      o2d.fillText(text, s[0], s[1]);
    }
    // the labels, last, on top
    o2d.font = labelFont;
    const plate = `rgb(${D.ground.map((v) => Math.round(v * 255)).join(' ')})`;
    for (const { right, text, sc, st, a, tw, onFloor } of tags) {
      if (onFloor) { // pushed in from the window's edge onto the floor: a plate of the room's colour keeps it readable
        o2d.globalAlpha = a * 0.9;
        o2d.fillStyle = plate;
        o2d.fillRect(right ? st[0] : st[0] - tw - 12, st[1] - 21, tw + 12, 21);
        o2d.fillStyle = D.ink;
      }
      o2d.globalAlpha = a;
      o2d.beginPath(); o2d.arc(sc[0], sc[1], 2.5, 0, 2 * Math.PI); o2d.fill();
      o2d.beginPath(); o2d.moveTo(sc[0], sc[1]); o2d.lineTo(st[0], st[1]); o2d.stroke();
      o2d.textAlign = right ? 'left' : 'right';
      o2d.fillText(text, st[0] + (right ? 6 : -6), st[1] - 10);
      o2d.beginPath(); o2d.moveTo(st[0], st[1]); o2d.lineTo(st[0] + (right ? tw + 6 : -tw - 6), st[1]); o2d.stroke();
    }
    o2d.globalAlpha = 1;
  }

  // ---- input while tipped: the wheel travels, keys too; a click presses the real control under it ----
  // Travel stops where the floor still fills the view: the page's top a little ahead, its end near the camera.
  const inRange = (row) => clamp(row, Math.min(H * 0.5, pageH / 2), Math.max(H * 0.5, pageH - H * 0.85));
  const onWheel = (e) => { e.preventDefault(); target = inRange(target + e.deltaY); };
  const onKey = (e) => {
    if (e.key === 'Escape') { if (!e.defaultPrevented && !document.querySelector('dialog[open], [role="dialog"]:not([hidden])')) exit(); return; }
    const step = { ArrowDown: 120, ArrowUp: -120, PageDown: H * 0.875, PageUp: -H * 0.875, ' ': e.shiftKey ? -H * 0.875 : H * 0.875, Home: -1e9, End: 1e9 }[e.key];
    if (step === undefined || e.target.closest?.('input, textarea, select, dialog, [role="dialog"]')) return;
    if (e.key === ' ' && e.target.closest?.('button, a, summary')) return; // space presses a control
    e.preventDefault(); target = inRange(target + step);
  };
  const onClick = (e) => {
    if (e.target !== canvas || !viewProj || t < 1) return;
    const cam = pose(1), ndc = [(e.clientX / innerWidth) * 2 - 1, 1 - (e.clientY / innerHeight) * 2];
    const f = Math.tan(cam.fov / 2), aspect = innerWidth / innerHeight;
    const right = [1, 0, 0], d = [0, 1, 2].map((i) => cam.fwd[i] + right[i] * ndc[0] * f * aspect + cam.up[i] * ndc[1] * f);
    const h = hit(cam.p, d);
    if (!h) return;
    const row = R0 - h.s, x = h.x, o = root.getBoundingClientRect();
    for (const el of root.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')) {
      const r = el.getBoundingClientRect(), lx = x - (r.left - o.left), ly = row - (r.top - o.top);
      if (lx >= 0 && ly >= 0 && lx <= r.width && ly <= r.height) { el.click(); el.focus?.({ preventScroll: true }); return; }
    }
  };
  const onResize = () => {
    if (!on) return;
    const row = focus / Math.max(1, pageH); // keep the reader at the same share of the page
    H = innerHeight; W = document.documentElement.clientWidth;
    canvas.width = Math.round(innerWidth * devicePixelRatio); canvas.height = Math.round(innerHeight * devicePixelRatio);
    dropTwins();
    root.style.width = `${W}px`;
    pageH = root.offsetHeight;
    placeholder.style.height = `${pageH}px`;
    focus = target = clamp(row * pageH, 0, pageH);
    titlesTaken = false; layoutParts(); makeTwins(); band = null; canvas.requestPaint();
  };

  function animate(to) {
    return new Promise((done) => {
      const from = t, start = performance.now(), dur = reduce() ? 1 : LOOK.duration * Math.abs(to - from);
      const step = (now) => { t = dur <= 1 ? to : lerp(from, to, clamp((now - start) / dur, 0, 1)); if (t !== to) requestAnimationFrame(step); else done(); };
      requestAnimationFrame(step);
    });
  }

  async function enter() {
    if (on || busy || !supported()) return;
    busy = true;
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) throw new Error('no WebGPU adapter');
      device = await adapter.requestDevice({ requiredLimits: { maxTextureDimension2D: adapter.limits.maxTextureDimension2D } });
      H = innerHeight; W = document.documentElement.clientWidth;
      const scrollTop = scrollY;
      const o = root.getBoundingClientRect();
      // Lazy pictures would stay blank once the page is off screen inside the stage.
      for (const img of root.querySelectorAll('img[loading="lazy"]')) img.loading = 'eager';
      pageH = root.offsetHeight;
      focus = target = clamp(scrollTop - (o.top + scrollTop) + H / 2, 0, pageH);

      canvas = document.createElement('canvas');
      canvas.setAttribute('layoutsubtree', '');
      canvas.setAttribute(`data-${NAME}-stage`, '');
      overlay = document.createElement('canvas');
      overlay.setAttribute(`data-${NAME}-overlay`, '');
      placeholder = document.createElement('div');
      placeholder.style.height = `${pageH}px`;
      root.replaceWith(placeholder);
      Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', display: 'block', zIndex: dress.zIndex ?? 40 });
      Object.assign(overlay.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: (dress.zIndex ?? 40) + 1 });
      root.setAttribute(`data-${NAME}-tipped`, '');
      // Laid out unseen inside the canvas at its normal width; the canvas takes every pointer event.
      Object.assign(root.style, { width: `${W}px`, pointerEvents: 'none' });
      canvas.append(root);
      document.body.append(canvas, overlay);
      document.documentElement.setAttribute(`data-${NAME}-on`, '');
      canvas.width = Math.round(innerWidth * devicePixelRatio); canvas.height = Math.round(innerHeight * devicePixelRatio);
      o2d = overlay.getContext('2d');
      ctx = canvas.getContext('webgpu');
      format = navigator.gpu.getPreferredCanvasFormat();
      ctx.configure({ device, format, alphaMode: 'opaque' });
      layout = device.createBindGroupLayout({ entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} }] });
      const module = device.createShaderModule({ code: SHADER });
      const plLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
      const vertex = { module, entryPoint: 'vs', buffers: [{ arrayStride: 36, attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x2' }, { shaderLocation: 2, offset: 20, format: 'float32x4' }] }] };
      const blend = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } };
      pipes = {
        tex: device.createRenderPipeline({ layout: plLayout, vertex, fragment: { module, entryPoint: 'fsTex', targets: [{ format, blend }] }, primitive: { topology: 'triangle-list' }, depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less-equal' } }),
        line: device.createRenderPipeline({ layout: plLayout, vertex, fragment: { module, entryPoint: 'fsLine', targets: [{ format, blend }] }, primitive: { topology: 'line-list' }, depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'less-equal' } }),
      };
      ubuf = device.createBuffer({ size: 112, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      vbuf = device.createBuffer({ size: tris.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      lbuf = device.createBuffer({ size: lines.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear' });

      layoutParts();
      makeTwins();
      canvas.addEventListener('paint', upload);
      canvas.addEventListener('wheel', onWheel, { passive: false });
      canvas.addEventListener('click', onClick);
      addEventListener('keydown', onKey);
      addEventListener('resize', onResize);
      on = true; t = 0; band = null; lastMove = performance.now();
      raf = requestAnimationFrame(frame);
      canvas.requestPaint();
      D.onchange(true);
      await animate(1);
    } catch (err) {
      console.error(`${NAME}: could not tip the page`, err);
      teardown();
    } finally { busy = false; }
  }

  function teardown() {
    cancelAnimationFrame(raf);
    on = false;
    if (canvas) {
      canvas.removeEventListener('paint', upload);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('click', onClick);
    }
    removeEventListener('keydown', onKey);
    removeEventListener('resize', onResize);
    if (placeholder?.isConnected) { root.removeAttribute(`data-${NAME}-tipped`); root.style.width = ''; root.style.pointerEvents = ''; placeholder.replaceWith(root); }
    canvas?.remove(); overlay?.remove();
    document.documentElement.removeAttribute(`data-${NAME}-on`);
    for (const r of titleTex.values()) r.tex.destroy();
    dropTwins();
    titlesTaken = false;
    titleTex.clear(); bandTex?.destroy(); depth?.destroy(); bandTex = depth = null; band = null;
    device?.destroy(); device = null;
  }

  async function exit() {
    if (!on || busy) return;
    busy = true;
    await animate(0);
    const o = placeholder.getBoundingClientRect();
    const row = focus;
    teardown();
    scrollTo({ top: Math.max(0, o.top + scrollY + row - innerHeight / 2), behavior: 'instant' });
    D.onchange(false);
    busy = false;
  }

  return {
    enter, exit,
    toggle: () => (on ? exit() : enter()),
    get on() { return on; },
    /** The page row under the screen's centre. */
    get row() { return focus; },
    /** Travel to a page row (px from the root's top), e.g. a chapter's offsetTop: for an index, while tipped. */
    travel(row) { target = inRange(row); },
    /** For checks: where a page point lands on screen (CSS px), or null. */
    screenOf(x, row) { if (!viewProj) return null; const s = project(viewProj, at(x, row, 0)); return s && [s[0] * innerWidth, s[1] * innerHeight]; },
    destroy() { teardown(); },
  };
}
