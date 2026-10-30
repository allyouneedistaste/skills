# The plan

Write `plan.md` before generating or building anything. It is what the builder builds,
not a safer reading of it. Short, in numbers and plain facts.

## The idea, in one sentence

An X × Y: something from their world meets something unexpected, and both show on the
page. ("A city's colour plan × the draughtsman's ink", so the coloured walls are the
page and the drawings are the room.) Test: **could someone guess this look from the
category alone?** Then look again. List seven possible worlds before choosing one.

The flat page and the room must be two sides of one idea, because the mode is what
people remember. If the objects in the room also appear as drawings on the cards, the
page and the room become one thing.

## Where unforced work lands (leave only if the world truly demands it)

1. warm cream ground, high-contrast serif, terracotta or red accent;
2. near-black, one neon or ember accent, glowing edges;
3. broadsheet: hairlines, italic serif, small tracked mono labels.

Faces that mean you stopped looking, for display: Fraunces, Playfair Display, Cormorant,
Lora, Crimson, Newsreader, Syne, Space Grotesk, Space Mono, IBM Plex, Inter, DM Sans,
DM Serif, Outfit, Plus Jakarta Sans, Instrument Sans or Serif. Choose faces the way
you'd choose objects from their world: its signs, its printed matter, its instruments.

## Colour

- **One ground per chapter.** They belong together: one family of pigments, not a
  rainbow. Alternate light and dark so the floor reads as bands when tipped.
- Text on each ground **≥ 4.5:1** (large titles ≥ 3:1). Write the ratio for each and
  compute it (`node S/scripts/contrast.mjs '#fff' '#3e5c9a'`), don't guess. Secondary text is tinted from the ground, never mid grey.
- Cards one quiet surface colour, shared across chapters.
- **One accent, one job** (the action; where you are). It is not a chapter colour.
- The room: one colour for ground and one for lines (given to the engine as 0–1 rgb).

## Type

Two or three faces at most: a display with character for titles (it stands up in 3D,
so it must hold at an angle and big), a text face, optionally a mono for times, figures
and data only. Open licences: `scripts/fonts.mjs` brings a Google Fonts family into the
site. Try at least three candidates in a test page with their real words and look
(`node S/scripts/shot.mjs <file or url> proof.jpg`).
Add `--subsets` for any alphabet or symbols the marks in the air need.

## Sections

Hero (the site's own idea: not a giant vertical word, not a network of nodes, not a
device mockup, unless their world truly is that), then the chapters, each: title, one
sentence, one lead card, then 3 to 6 smaller cards. Then the action again, and the
footer. Give one fixed index of chapters if there are more than five. Cards say only
what distinguishes them; every button says what happens.

## Pictures: one shoot

Generated separately, pictures fall apart. Decide once, and repeat it word for word in
every prompt (the SET LINE):

- **LIGHT:** one source, direction, quality, time of day ("low sun from the left, about
  25°, long soft shadows"). Then check: shadows must fall the same way in every picture;
  a flipped one can be mirrored for free if it holds no lettering.
- **GRADE:** highlights, blacks, saturation, grain.
- **CAMERA:** lens, height, depth of field ("35 mm, eye level, verticals parallel").
- **GROUND and MATERIALS:** what may be in front of the camera.
- **ACCENT:** only one small detail per picture, or never.
- **EDGES:** what a picture's edge must be where it meets a colour. "Full-bleed, no border, no
  frame" in every prompt (models add frames; look for them).
- People small, distant or from behind, no faces, unless they supply real photos. No
  text, letters, logos or signs in pictures. No real places or brands.

They sit on cards that go to a floor at an angle: **one clear shape**, the wall or
subject filling a third of the frame, nothing vital near the edge. Say the framing.

Shot list in `plan.md`: id, chapter, shape, what it shows, full prompt, price. Total it.
Reuse is fine (a second crop). Drawings cost nothing. Wait for a yes if it changed
from what they agreed; never pass the agreed budget.

## The room (the engine's Dress)

Write it all down: `ground`, `line`, `ink`, `font`, `labelFont`, the marks in the air
(8 to 12, real ones), `rulerFormat`, `keepClear`, the button's two words, and the props
precisely enough to draw: for each, its parts and rough sizes in screen heights
(origin on the ground, y up, 0.6 to 1.0 tall). See `page-contract.md`.

If cards carry drawings, each drawing must **illustrate its card**. Six objects repeated at random reads as clip art: plan one per kind of thing on the page (10 to 15 small functions for 30 to 40 cards, 5 to 15 lines of code each), and no two neighbours the same. The room can use just the six largest.

## The contract (what the reviewer will hold it to)

```
THESIS: what the page is, what default it refuses.
OWN WORLD: what remains with every word removed.
STORY: 3 or 4 beats a visitor goes through.
FIRST VIEWPORT: what is on screen at 1440×900 and 390×844, what it does.
SIGNATURE: what the tipped room looks like here, in one paragraph.
```

Show the person: the idea, the colours, the faces, the first screen in a sentence, the
button's word, the objects, and the money, in ten lines. On a yes, go on.
