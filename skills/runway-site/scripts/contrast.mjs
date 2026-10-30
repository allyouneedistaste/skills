#!/usr/bin/env node
// Contrast ratio of two colours (WCAG). node contrast.mjs '#ffffff' '#3e5c9a' ['#hex' '#hex' …]: pairs.
const lum = (hex) => { const h = hex.replace('#', ''), f = h.length === 3 ? [...h].map((c) => c + c) : [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)]; const [r, g, b] = f.map((v) => { const c = parseInt(v, 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const a = process.argv.slice(2);
if (a.length < 2 || a.length % 2) { console.error("usage: node contrast.mjs '#fff' '#000' [more pairs]"); process.exit(2); }
for (let i = 0; i < a.length; i += 2) { const [x, y] = [lum(a[i]), lum(a[i + 1])]; const r = (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); console.log(`${a[i]} on ${a[i + 1]}: ${r.toFixed(2)}:1 ${r >= 4.5 ? 'ok for text' : r >= 3 ? 'large titles only' : 'too low'}`); }
