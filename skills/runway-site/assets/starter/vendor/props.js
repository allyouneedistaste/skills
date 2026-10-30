// The objects that stand beside the floor. Each is a function returning line segments as pairs of [x, y, z] points,
// in screen heights, origin on the ground at the object's centre, y up, about 0.6 to 1.0 tall. Draw the site's own world.
function pushBox(out, a, b) {
  const c = [[a[0], a[1], a[2]], [b[0], a[1], a[2]], [b[0], a[1], b[2]], [a[0], a[1], b[2]], [a[0], b[1], a[2]], [b[0], b[1], a[2]], [b[0], b[1], b[2]], [a[0], b[1], b[2]]];
  for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) out.push(c[i], c[j]);
}
export function steps() { const s = []; for (let k = 0; k < 6; k++) pushBox(s, [-0.2, 0, -0.3 + k * 0.1], [0.2, (k + 1) * 0.08, -0.2 + k * 0.1]); return s; }
export function block() { const s = []; for (let k = 0; k < 3; k++) pushBox(s, [-0.2 + k * 0.03, k * 0.28, -0.14], [0.2 - k * 0.03, (k + 1) * 0.28, 0.14]); return s; }
