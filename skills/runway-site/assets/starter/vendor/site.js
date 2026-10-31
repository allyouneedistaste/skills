// The site's own script. The engine goes in unedited; everything this world wants is passed to mount().
import { mount, supported } from './page-tips-into-3d-runway.js';

import { steps, block } from './props.js';

const root = document.querySelector('[data-page-tips-into-3d-runway]');
let first = null; // rulers count from the first chapter; measured late, so fonts have loaded
const firstRow = () => (first ??= root.querySelector('.chapter')?.offsetTop ?? 0);

const runway = mount(root, {
  ground: [0.08, 0.08, 0.09], // the room, 0–1 rgb
  line: [0.93, 0.92, 0.88], // grid, props
  ink: 'rgb(237 235 228)', // text in the air
  font: 'ui-monospace, monospace',
  labelFont: 'system-ui, sans-serif',
  formulas: ['a² + b² = c²', 'φ = (1 + √5) / 2'], // small marks in the air: whatever belongs to this world
  props: [steps, block],
  rulerFormat: (n) => (n < firstRow() ? '' : `${Math.round((n - firstRow()) / 100)} m`),
  zIndex: 40,
  keepClear: '.toggle', // fixed controls no label may sit under
  onchange: (on) => {
    first = null;
    if (toggle) { toggle.textContent = on ? 'Back to the page' : 'Walk it in 3D'; toggle.setAttribute('aria-pressed', String(on)); }
  },
});
window.__runway = runway; // the check script reads it; harmless to keep

// Only where it can run and be travelled: the feature present, a GPU that answers, a wheel, room for the floor.
let toggle = null, usable = false, starting = false;
const wanted = matchMedia('(pointer: fine) and (min-width: 1024px)');
const install = () => {
  toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'toggle';
  toggle.setAttribute('data-runway-toggle', '');
  toggle.setAttribute('aria-pressed', 'false');
  toggle.textContent = 'Walk it in 3D';
  toggle.addEventListener('click', () => {
    if (starting) return; // a second click while the GPU is still answering
    const going = !runway.on;
    starting = going;
    Promise.resolve(runway.toggle()).then(() => {
      starting = false;
      if (going && !runway.on) { toggle.remove(); toggle = null; usable = false; } // it could not start: the page stays flat, no dead button
    });
  });
  document.querySelector('.toggle-slot').replaceWith(toggle);
};
// A window can change size, and a frame learns its width late: the button follows the query.
const sync = () => {
  if (usable && wanted.matches && !toggle) install();
  if (toggle && !runway.on) toggle.style.display = wanted.matches ? '' : 'none';
};
wanted.addEventListener('change', sync);
// A cold browser's first answer can be late or empty: ask again before giving up.
const ask = (left) => {
  let done = false;
  const next = () => { if (done) return; done = true; if (left > 0 && !usable) setTimeout(() => ask(left - 1), 1500); };
  navigator.gpu.requestAdapter().then((adapter) => { if (!adapter) return next(); done = true; usable = true; sync(); }).catch(next);
  setTimeout(next, 2000);
};
if (supported()) ask(3);

// Anchors do nothing while tipped: every link to a place on the page travels there instead.
document.addEventListener('click', (e) => {
  if (!runway.on) return;
  const to = document.getElementById(e.target.closest('a[href^="#"]')?.getAttribute('href').slice(1));
  if (!to) return;
  e.preventDefault();
  runway.travel(to.offsetTop + innerHeight * 0.35);
});
