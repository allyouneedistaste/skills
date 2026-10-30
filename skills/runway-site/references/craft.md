# The floor every page must clear

Ideas adapted from Impeccable's craft floor (Paul Bakaus, Apache 2.0). A world that truly
asks for one of the refused things can earn it back, in writing, in `plan.md`.

## Verify on the built page

- **Contrast:** body and labels ≥ 4.5:1, large titles ≥ 3:1. On a coloured ground, tint
  secondary text from that hue.
- **Colour:** about 60 / 30 / 10 on the first screen; the accent does one job.
- **Size:** nothing readable under 12 px; targets 44 px.
- **Type:** body 45–75 characters a line, line height ≥ 1.4, tracking ≥ -0.04em; all-caps
  only for three words or fewer; tabular figures on times and dates.
- **Spacing:** related things sit close; a heading stays nearer what it introduces than what came before it.
  Text inside a card or colour ≥ 12 px from the edge.
- **Motion:** animate transform and opacity, not layout. One authored moment per section at
  most, not the same fade everywhere. Everything inside a reduced-motion rule.
- **States:** hover (inside `@media (hover: hover)`), `:focus-visible`, active, disabled.
  `touch-action: manipulation` on controls. A form has sent and error states.
- **Browser surfaces:** theme `::selection`, focus rings, `scrollbar-color`, link underline
  offset. Viewport meta with `viewport-fit=cover`; fixed things pad with `env(safe-area-inset-*)`.
- **Words:** the world's own. Buttons say what happens. Facts are real or marked.
- **Every width:** from 360 to 1920: headline whole, first action above the fold in windows
  664 to 1080 px high, nothing riding under the top bar, no word leaving its box, no sideways scroll.
- **Skip link,** `alt` on pictures, one `h1`, headings in order, `lang` on `<html>`.

## Refuse

- A small label above every heading.
- Section numbers (01 / 02 / 03) unless the order is information.
- Same-size grids of icon + heading + text as the page's structure; cards in cards.
- The big-number block with three stats.
- Gradient text; glass or blur as decoration; a coloured stripe down one side of a card.
- Mono as a "technical" costume: it is for times, data, measures.
- Pulsing dots, tickers, marquees as filler.
- Emoji or Unicode as icons: draw them.
- Testimonials, statistics, logos or awards nobody gave you.
- Light or dark picked by category.

## Optional mechanical check

`npx -y impeccable@latest detect <site folder> --no-config --json`, and on the served URL with
`--viewport 1440x900` and `390x844`. Fix contrast, size, layout-transition and padding
findings. Name any stylistic one you keep in `plan.md`. (It reads the flat page only.)
