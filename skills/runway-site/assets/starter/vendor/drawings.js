// The same objects as the room's props, as ink drawings for the cards: an inline SVG string, free of charge.
//   card.querySelector('.pic').innerHTML = drawing(steps, { yaw: 35, pitch: 28, size: 400, stroke: 1.25, color: 'currentColor' });
export function drawing(prop, { yaw = 35, pitch = 28, size = 400, stroke = 1.25, color = 'currentColor', pad = 0.08, title = '' } = {}) {
  const y = (yaw * Math.PI) / 180, p = (pitch * Math.PI) / 180;
  const flat = ([a, b, c]) => { // a parallel view, as a draughtsman draws: no perspective
    const x = a * Math.cos(y) - c * Math.sin(y), z = a * Math.sin(y) + c * Math.cos(y);
    return [x, -(b * Math.cos(p) - z * Math.sin(p))];
  };
  const pts = prop().map(flat);
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const scale = (size * (1 - 2 * pad)) / Math.max(x1 - x0, y1 - y0, 1e-6);
  const px = (q) => `${((q[0] - (x0 + x1) / 2) * scale + size / 2).toFixed(1)} ${((q[1] - (y0 + y1) / 2) * scale + size / 2).toFixed(1)}`;
  let d = '';
  for (let i = 0; i + 1 < pts.length; i += 2) d += `M${px(pts[i])}L${px(pts[i + 1])}`;
  const label = title ? `<title>${title}</title>` : '';
  return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-hidden="${title ? 'false' : 'true'}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round">${label}<path vector-effect="non-scaling-stroke" d="${d}"/></svg>`;
}
