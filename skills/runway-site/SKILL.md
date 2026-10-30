---
name: runway-site
license: MIT
description: Build a complete website whose whole live page can tip over into a long floor you travel in 3D, in a dark room drawn like a technical drawing, with section titles standing up, cards raised as slabs, labels on leader lines, and everything still clickable (HTML-in-Canvas + WebGPU, plain files, no framework). Starts with an onboarding interview (what the site is, what to highlight, its look, generated pictures or not, the budget), then plans, makes the pictures, builds, checks headlessly and gets a fresh review. Use when someone asks for a site with this 3D effect, a page you can walk or fly through, a page that tips into 3D, a walkable programme or catalogue, or runs /runway-site. Needs a long page with chapters; say so if theirs is not.
argument-hint: "[what the site is about]"
---

# A site you can walk

`S` = this skill's folder. It carries everything it needs: the engine, a starter page,
scripts and rules. Work in the person's project folder: `brief.md`, `plan.md`, `site/`,
`check/`. Speak their language; files and code in English.

**Resume first.** If `brief.md` exists, read it, and pick up at the first unticked item under
Progress: they may have stopped halfway.

**Never:**
- open a browser window unless they ask to look (a window takes their focus): checks are headless;
- spend money without a total and a yes, or pass the agreed budget;
- invent a fact about a real business: `TODO`, and ask;
- generate real people or real brands; copy words, pictures or code from a site they admire;
- edit the engine: everything goes through `mount()`. If it can't do what's needed, say so;
- generate audio.

## 0. Can this computer do it?

```
node S/scripts/doctor.mjs
```

Node 22+ and Chrome are required; say what to install and stop if they're missing. Then
tell them in one line whether their own Chrome will show the button (Chrome 157+), or
needs a separate window to see it (`preview.mjs --open`), or the flag at
`chrome://flags/#canvas-draw-element`. Note whether an image tool or `KIE_API_KEY` is there.

## 1. Onboarding (with them)

Follow `references/onboarding.md`. One question at a time, each with your recommendation;
write `brief.md` as you go. Read it back, and go on only on a yes. If the content is too
short for the effect, say so instead of building.

## 2. Plan (show them)

Follow `references/planning.md`, and read `references/craft.md` and
`references/page-contract.md`. Write `plan.md`: the idea, colours with contrast ratios,
faces, sections, the picture set and shot list with prices, the room, the contract. Show
it in ten lines. Go on only on a yes.

**Prove the machine first** (a few minutes, no design), so nothing is spent on a page
that can't run:
```
mkdir -p site && cp -R S/assets/starter/. site/ && cp S/assets/engine/* site/vendor/
node S/scripts/check.mjs site --out check-starter
```
Everything must pass on this starter page. If it doesn't, stop and find out why.

## 3. Pictures (if any)

Generate with their tool, or:
```
node S/scripts/generate-media.mjs image --ratio 4:3 --out site/vendor/img-<name>.webp --prompt "<SET LINE> <what it shows>"
```
Keep a running total in `plan.md`. **Open every one** (and frames of a clip) side by side:
one light direction? one grade? a border or frame inside? text? a shadow falling the wrong
way (mirror it, free, if it holds no lettering)? Redo only what breaks the set, inside the
budget. Their own photos: look at each, crop to the shapes, say what's missing.

## 4. Build

The whole page, flat first, exactly to `plan.md` and `references/page-contract.md`, to the floor
in `references/craft.md`. If you can start a subagent, a build this long goes to one
with those files named as its brief. Then the room: Dress, props, marks, figures, the
toggle.

- Fonts: `node S/scripts/fonts.mjs site "<Family>" --weights 400,700 [--subsets latin,greek]`
- The engine stays byte-identical to `S/assets/engine/`.
- Words: finished and real, or `TODO` visible in `brief.md`, never lorem ipsum at handover.

## 5. Check

```
node S/scripts/check.mjs site --out check
```

Fix every FAIL. It says the page works, not that it's good, so **open the shots**: flat at
every size, top and end; tipped at home, at each place, at the end. Ask of the tipped ones: far cards legible? titles clean
on both light and dark chapters? labels whole? the hero and the last chapter right? does
the room look like this world? Fix, run again. Bounded: build, one inspection, one batch of
fixes, one confirmation.

## 6. Fresh review

Follow `references/review-brief.md`. Two fix rounds at most. What's left goes to them word for word.

## 7. Hand over

Show them:
```
node S/scripts/preview.mjs site [--open]
```
(`--open` only if they want a window now: it's a separate Chrome with the feature on.)
Tell them, in plain words:

- what was built and where it is (`site/` is the whole website: plain files for any static host);
- how to use it: the button, the wheel, Esc;
- who sees the 3D mode: Chrome 157+ on a computer, over HTTPS; everyone else the flat page;
- every `TODO` still open, every known weakness, the money spent;
- what it can't do yet: travel on touch screens; hover states on the floor.

Tick Progress in `brief.md`. Ask what they'd like changed, and change it. A change goes through
`check.mjs` again.

## More versions

They can ask for more looks of the same content any time: each is a new `plan-<n>.md` and
`site-<n>/`, with the same engine, its own idea, colours, faces, pictures and props, and its own
budget, agreed first. Keep them apart: two versions must differ in idea and look, not only in colour.
