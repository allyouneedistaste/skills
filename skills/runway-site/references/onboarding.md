# The onboarding

The person may not be technical and may never have seen this effect. Talk about what a
visitor sees and does, in their language. **One question at a time**, each with your
recommended answer, so "yes" is always enough. Tell a small story when a choice is
abstract ("Someone opens your page on their laptop, reads a little, clicks the button,
and…"). Write every answer into `brief.md` as it arrives, in their words; it is the
memory if the session stops. If they give a lot at once, take it all and skip what is
answered. If they say "you decide", decide and say what you chose.

Start by saying what they will get, in three lines, then show it if you can: a long
page that works normally, plus one button that tips the whole live page over into a
floor you travel along in 3D, in a dark room drawn like a technical drawing, with the
section titles standing up and the cards raised. Everything on it stays clickable.
An example: `S/assets/example-tipped.jpg` (give them the path; read it yourself first so you can describe it).

## 1. What is it?

- **What is the site about, and for whom?** Real business, or invented (a demo, a
  concept, a portfolio piece)? Its name.
- **Real:** facts come from them, never from you: names, prices, dates, addresses,
  numbers, quotes. Ask for an old site, a document or photos to read. What is missing
  is marked `TODO` in `brief.md` and asked for at handover; it is never invented.
- **Invented:** you write everything, and the footer says it is fictional.
- **The one thing a visitor should do** (book, buy, sign up, write, come), and where it goes.
- **The language** of the words on the site (default: the one you are speaking).

## 2. Does it have the length? (the effect needs this; say so kindly)

The floor is worth travelling only if there is plenty on it. It needs **at least 5
chapters** (days, departments, collections, projects, years, places, services), **each
with at least 3 things** with a few words and a picture or drawing. Ask what their
chapters are, and propose them from what you know. A story helps: "someone flies down
your page and every few seconds a new chapter arrives, in its own colour."

Too little content (a one-product page, a three-section brochure): say plainly the
effect will feel empty, and offer to help them find chapters, or that this skill is the
wrong tool. Do not build it anyway.

Then write the **chapter list**, in order, with its things.

## 3. What to highlight

- **Which three things matter most?** They become the big lead cards.
- **The first screen:** what must someone understand in five seconds? Propose it.
- **What must not be missed in the room:** the short labels that float beside the floor
  come from card headings; which deserve one (default: every card, shortened to ≤ 24 characters).

## 4. How it looks

- **An existing brand?** A logo, colours, fonts or a guideline they must keep: if so,
  those are locked, and every direction below works inside them.
- **Otherwise,** after reading `planning.md`, propose **three directions**, each one
  concrete sentence that could only belong to them, never "modern and clean". Recommend one.
- **Chapter colours:** each chapter wears its own ground by default. Ask only if they
  have a reason not to.
- **Pictures they love,** or sites whose feel they want: look, take the feel in words,
  never copy from them.

## 5. Pictures

Say how many are needed (from the chapter list) and give the choices. Any mix works,
and nothing is spent without a total and a yes.

- **Their own photos.** Say exactly what is needed: how many, what each shows, shape.
- **Generated.** Two ways:
  - an image tool they already have connected to Claude Code (use it; its own prices);
  - a kie.ai key (`export KIE_API_KEY=…` before starting Claude Code), through
    `scripts/generate-media.mjs`: as of September 2026 about $0.09 a picture
    (nano-banana-pro) and $0.04 a second of clip (MiniMax H3 at 768P). Check kie.ai/pricing.
- **Drawings only, free.** Line drawings as code (the same objects that stand in the
  room). Honest and often beautiful; less warm than photographs.
- **Default budget if they don't care:** about 20 pictures + 1 short clip ≈ $2–3, with
  the rest as drawings. Real people and real brands are never generated; a real
  product is shown from their own photos.

## 6. The 3D room

Offer, don't interrogate; these all have good defaults you propose from their world.

- **The button's word**, from their world ("Walk it in 3D" is the fallback; a festival
  of streets said "Promenade").
- **The objects standing beside the floor** (5 or 6): what belongs to them? A bakery:
  oven, rolling pin, bread peel, scales, sacks, a whisk. Drawn as wireframes in code.
- **The small marks in the air:** formulas, measures, recipes, sayings, coordinates.
- **The figures along the floor's edges:** metres, years, pages, kilometres of route.
- **The room's colour:** dark by default.

## 7. Where it goes, and who sees it (say this before they fall in love with it)

Plainly: the 3D mode runs in **Chrome 157 or later**, on a computer with a mouse or
trackpad. Everyone else (older Chrome, Safari, Firefox, phones) sees the normal page,
finished and working, with no button. So the flat page must stand alone. It needs
**HTTPS** once online (WebGPU requires it; `localhost` is fine). It is plain files, so
any static host works. A site that needs the mode in older Chrome today can register
its own domain for Chrome's origin trial for HTML-in-Canvas: mention it, check its
current terms before promising.

**How many versions?** One by default. Several means several looks of the same content,
each costing its own pictures: say the total.

## Read back

Read `brief.md` back in plain words, ten lines at most, with the money. Fix what they
correct. Go on only on a yes.

## `brief.md`

```
# <name>
Real or invented: …   Language: …   One action: … → <link>
For whom: …
## Chapters (in order)
1. <chapter>: <thing>, <thing>, <thing> …
## Highlights
Lead cards: …   First screen: …
## Look
Locked: … (or none)   Chosen direction: …
## Pictures
Own: … Generated: … Drawings: …   Tool: …   Budget agreed: $…
## Room
Button: … Objects: … Marks in the air: … Figures: … Colour: …
## Versions: 1
## TODO (facts missing)
- …
## Progress
- [ ] onboarding  - [ ] plan  - [ ] pictures  - [ ] build  - [ ] check  - [ ] review  - [ ] handed over
```
