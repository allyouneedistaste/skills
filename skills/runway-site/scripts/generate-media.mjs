#!/usr/bin/env node
/**
 * generate-media.mjs — one picture or one clip from kie.ai, for when the person
 * has a kie.ai key and no media MCP. Needs KIE_API_KEY in the environment
 * (https://kie.ai → API key). Node 18+, no dependencies; ffmpeg is used when
 * it is installed (to convert to .webp and to take the sound off a clip).
 *
 *   node <skill>/scripts/generate-media.mjs image --ratio 16:9 --out site/previews/vendor/hero.webp --prompt "…"
 *   node <skill>/scripts/generate-media.mjs video --ratio 16:9 --seconds 6 --out site/previews/vendor/loop.mp4 --prompt "…"
 *
 * Models: nano-banana-pro for a picture (1K or 2K, ~$0.09 each), MiniMax H3
 * text-to-video at 768P for a clip (~$0.04 per second). Prices as read on
 * kie.ai in September 2026 — check https://kie.ai/pricing before a big batch.
 *
 * Ratios — picture: 1:1 2:3 3:2 3:4 4:3 4:5 5:4 9:16 16:9 21:9;
 *          clip:    1:1 4:3 3:4 16:9 9:16 21:9. Clip length: 4 to 15 seconds.
 *
 * Writes the file and prints what it cost to make, the model's URL and the
 * final size.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const API = 'https://api.kie.ai';
const IMAGE_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
const VIDEO_RATIOS = ['1:1', '4:3', '3:4', '16:9', '9:16', '21:9'];

const [kind, ...rest] = process.argv.slice(2);
const option = (name, fallback) => {
  const index = rest.indexOf(`--${name}`);
  return index >= 0 && rest[index + 1] !== undefined ? rest[index + 1] : fallback;
};

function fail(message) {
  console.error(`generate-media: ${message}`);
  process.exit(1);
}

const key = process.env.KIE_API_KEY;
if (!['image', 'video'].includes(kind)) fail('say "image" or "video" first. See the top of this file.');
if (!key) fail('KIE_API_KEY is not set. Ask the person for their kie.ai key (export KIE_API_KEY=…), or have them provide the file.');
const prompt = option('prompt');
const out = option('out');
const ratio = option('ratio', kind === 'image' ? '16:9' : '16:9');
if (!prompt) fail('--prompt is required.');
if (!out) fail("--out is required (a path under the site's vendor/ folder).");
const target = path.resolve(process.cwd(), out);
if (!(kind === 'image' ? IMAGE_RATIOS : VIDEO_RATIOS).includes(ratio)) fail(`--ratio ${ratio} is not one the model takes.`);

const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

async function kie(pathname, init = {}) {
  const response = await fetch(API + pathname, {
    ...init,
    headers: { authorization: `Bearer ${key}`, ...(init.body ? { 'content-type': 'application/json' } : {}) },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || (json.code !== undefined && json.code !== 200)) fail(`kie.ai answered ${response.status}: ${json.msg ?? 'no message'}`);
  return json;
}

let model;
let input;
if (kind === 'image') {
  model = 'nano-banana-pro';
  input = { prompt, aspect_ratio: ratio, resolution: option('resolution', '2K'), output_format: 'png' };
} else {
  const seconds = Math.round(Number(option('seconds', '6')));
  if (!(seconds >= 4 && seconds <= 15)) fail('--seconds must be 4 to 15.');
  model = 'minimax-h3/text-to-video';
  input = { prompt, aspect_ratio: ratio, resolution: '768P', duration: seconds };
}

console.log(`Asking ${model} …`);
const created = await kie('/api/v1/jobs/createTask', { method: 'POST', body: JSON.stringify({ model, input }) });
const taskId = created.data?.taskId;
if (!taskId) fail('kie.ai did not start the task.');

const started = Date.now();
let url;
while (!url) {
  if (Date.now() - started > (kind === 'image' ? 5 : 15) * 60_000) fail(`gave up waiting (task ${taskId}).`);
  await new Promise((resolve) => setTimeout(resolve, 5_000));
  const record = await kie(`/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`).catch(() => null);
  const state = record?.data?.state;
  if (state === 'fail') fail(`the model could not make it: ${record.data.failMsg ?? 'no reason given'}`);
  if (state !== 'success') continue;
  const result = typeof record.data.resultJson === 'string' ? JSON.parse(record.data.resultJson) : record.data.resultJson;
  url = result?.resultUrls?.[0];
  if (!url) fail('the model finished without a file.');
}

const response = await fetch(url);
if (!response.ok) fail(`the file could not be downloaded (${response.status}) from ${url}`);
const bytes = Buffer.from(await response.arrayBuffer());
await mkdir(path.dirname(target), { recursive: true });

const wanted = path.extname(target).toLowerCase();
const raw = kind === 'image' ? target.replace(/\.[^.]+$/, '') + '.generated.png' : target.replace(/\.[^.]+$/, '') + '.generated.mp4';
await writeFile(raw, bytes);

if (kind === 'image' && wanted !== '.png') {
  // The picture is paid for: nothing below may lose it. ffmpeg builds without a webp encoder are common.
  const tools = [['ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, ...(wanted === '.webp' ? ['-quality', '82'] : ['-q:v', '3']), target]]];
  if (wanted === '.webp') tools.push(['cwebp', ['-quiet', '-q', '82', raw, '-o', target]]);
  let made = false;
  for (const [tool, args] of tools) {
    try { execFileSync(tool, args, { stdio: 'ignore' }); made = existsSync(target); } catch { made = false; }
    if (made) break;
  }
  if (made) await rm(raw);
  else console.log(`Could not convert the picture here (no ffmpeg with that format, no cwebp): the picture is kept as ${path.relative(process.cwd(), raw)}; use that file or convert it.`);
} else if (kind === 'video') {
  if (hasFfmpeg) {
    // Silent, starts fast on the web: no sound track, moov atom first.
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-an', '-c:v', 'copy', '-movflags', '+faststart', target]);
    await rm(raw);
  } else {
    await writeFile(target, bytes);
    await rm(raw);
    console.log('No ffmpeg: the clip may carry a sound track; mute it in the page (muted attribute) — most Tastes already do.');
  }
} else {
  await writeFile(target, bytes);
  await rm(raw);
}

const final = existsSync(target) ? target : raw;
console.log(`Done: ${path.relative(process.cwd(), final)} (${bytes.length} bytes from the model)`);
console.log(`Source: ${url}`);
console.log('Log it in CHANGES.md with the prompt, so it can be made again.');
