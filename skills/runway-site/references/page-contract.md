# How the page must be built for the engine

The engine (`assets/engine/page-tips-into-3d-runway.js|css`) goes in **unedited**. Read
its header and `LOOK`. Everything specific to a site is passed to `mount()`. Copy
`assets/starter/` to start; it runs as it is.

## Files

Plain files, relative paths, nothing from the network (no CDN, no font links):

```
site/index.html
site/vendor/page-tips-into-3d-runway.js|css   (the engine, unedited)
site/vendor/site.css  site.js                 (yours)
site/vendor/fonts.css  fonts/                 (scripts/fonts.mjs)
site/vendor/img-<name>.webp  clip-<name>.mp4  (pictures, with width and height on every <img>)
```

`site.js` is a module; start inside a function, no top-level await.

## Markup

```html
<main data-page-tips-into-3d-runway>                         <!-- the root: everything that travels -->
  <h2 data-page-tips-into-3d-runway-part="title">…</h2>       <!-- stands up in 3D -->
  <article data-page-tips-into-3d-runway-part="slab">          <!-- rises off the floor -->
    <h3 data-page-tips-into-3d-runway-part="callout"            <!-- floats beside the floor on a leader line -->
        data-page-tips-into-3d-runway-label="Short label">Long heading</h3>
  </article>
</main>
```

- Titles: `width: fit-content`; the box should hug the letters, or the standing title
  has a wide empty quad. Colour from CSS; no background on the title itself (the ground
  sits on its section).
- Labels: **≤ 24 characters** (`-label` when the heading is longer). Long ones get pushed
  onto the floor or dropped.
- Slabs: cards with their own ground, no nesting of slabs.
- The leader starts at the callout element's corner. On a wide or horizontal card that lands mid-card and the line
  crosses it: there, make the callout an empty corner marker,
  `<span data-…-part="callout" data-…-label="Short label" aria-hidden="true" style="position:absolute;top:0;right:0;width:1px;height:1px"></span>`
  (the card `position: relative`).
- The hero's `h1` may be a title part if it looks right standing; a very long one is better left flat.
- The footer goes inside the root: the floor ends on it, and a fictional site's notice stays readable there.

## Mount

```js
const runway = mount(root, { ground, line, ink, font, labelFont, formulas, props, rulerFormat, zIndex: 40, keepClear, onchange });
window.__runway = runway;                    // scripts/check.mjs reads it
runway.toggle(); runway.enter(); runway.exit(); runway.on;
runway.travel(row);  runway.row;             // go to a page row (e.g. a chapter's offsetTop); the row at the screen's centre
```

Passing a number from `LOOK` throws: those stay. `props` entries are the built-in names
(`tower`, `column`, `arch`, `dome`, `torus`, `stairs`) or, better, functions of your own
returning an array of `[x, y, z]` point pairs, each pair one line, in screen heights,
origin on the ground at the object's centre, y up, 0.6 to 1.0 tall. Six objects are
enough; they repeat along the floor, both sides, turned differently. Keep them in
`vendor/props.js`. `vendor/drawings.js` (`drawing(prop, { yaw, pitch, size })`) turns the same
function into an inline ink SVG, so a card can show the object that stands in the room, at no cost;
any polylines in 3D work, plants and tools as well as buildings. Labels draw at weight 600 of `labelFont`, marks in the air in italic of `font`, on a 2D canvas: those
faces must be in the page's font files. `rulerFormat(n)`
gets the page's pixel row: subtract the first chapter's top, so the figures start where
the chapters do; return `''` for no figure.

## The toggle

- A real `<button data-runway-toggle>`, fixed, created **only** when
  `supported() && matchMedia('(pointer: fine) and (min-width: 1024px)').matches`.
  Elsewhere it does not exist: no dead control, nothing that promises it. The engine
  travels with a wheel and keys only, so phones never get it.
- Its words change through `onchange(on)`. `aria-pressed`. 44 px tall. `:focus-visible`.
- Its selector goes in `keepClear`.

## A chapter index

Fixed, outside the root. While tipped, anchors do nothing: on click call
`runway.on ? runway.travel(section.offsetTop) : section.scrollIntoView()`, and read `runway.row` in a
`requestAnimationFrame` loop for the "where you are" mark (flat: an IntersectionObserver). Stop the loop on `onchange(false)`.

## Traps, each found the hard way

Fixed UI and anything people type in stay **outside the root**, with `z-index` over 41
(the stage is 40, its text layer 41 by default): the toggle, a header, a chapter index,
dialogs, forms. Inside the root nothing is ever on screen in the normal sense while
tipped, and there is no scrolling, so:

- **No reveal-on-scroll.** Anything hidden until scrolled stays hidden on the floor.
  (Also: it is a cliché.)
- **`loading="lazy"`** is switched to eager by the engine when it tips; a picture still
  loading appears a moment later. Fine.
- **`position: sticky` or `fixed` inside the root** do nothing useful. Move them out.
- **Scroll-driven scripts** see no scroll while tipped. On `onchange(false)` measure again.
- **Iframes and plugins** do not draw on the floor.
- **Films:** at most one playing at a time in the root; every frame of a playing film
  repaints the band. Pause others on `onchange(true)`, or use a poster.
- **Hover states** do not show on the floor. A click presses the real control under it
  (`el.click()`), and focuses it.
- **A page that loads a font late** draws titles in the fallback if tipped too soon; preload the display face.
- **Hero on the floor:** it travels too, so it should look right lying down.
- **The toggle sits over the page while flat:** check what is under it at the top of the page (a strip of links at the bottom of a hero gets covered). Leave it a clear place.
- **`html { scroll-behavior: smooth }`** makes every jump animate, the page's anchors included. Use it only if you need it; the engine's return is instant.
- **Page height:** long pages are the point; the floor shows five screens at a time.
  Some tools fail to capture full pages above about 16,000 px: this is a tool's limit, so
  don't reshape the page for it; use `scripts/check.mjs`.

## The flat page first

Most people never tip it: older Chrome, Safari, Firefox, phones. Finish and judge it flat
at 1440, 1280, 1024, 768 and 390 before looking at the room.

## Reduced motion, keys

The engine turns the tip into a cut under `prefers-reduced-motion`; Esc lays the page
back, arrows, PageUp/Down, space, Home and End travel. Your own motion goes inside the
same rule. Don't add scroll hijacking to the flat page.
