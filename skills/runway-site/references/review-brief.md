# The fresh review

A builder that reviews its own work inherits its own optimism. If you can start a
subagent, send this to a **fresh** one (it has seen nothing of the build). If you can't,
tell the person it is a self-review, and do it from the shots as if you'd never seen them.

```
You review one website. You did not build it; judge only what the evidence shows. Edit nothing.
Every browser you use is headless: the person is using this computer. No windows.

Folder: <site folder>. Served at: <url>. The promise: plan.md's contract, brief.md for what the person asked.
Rules: <skill>/references/craft.md, <skill>/references/page-contract.md, <skill>/references/planning.md.
Evidence: the shots from `node <skill>/scripts/check.mjs` in <check folder> (flat-*, tip-midway, tipped-*,
tipped-home, tipped-end, tipped-after-click, tipped-resized, back, reduced-motion). Open every one. Run it again if they are older
than the last change.

Return exactly:
1. DISPOSITION: ship | fix | rebuild | recapture (the evidence is broken: say what, stop).
2. CONTRACT: THESIS, OWN WORLD, STORY, FIRST VIEWPORT, SIGNATURE: kept / partial / missed, a line of evidence each.
3. MATERIAL FIXES: at most 8, worst first: the element, the shot, what is wrong, what fixed looks like. Only what a
   visitor would notice. Say whether each is in the page, or in the engine.
4. CLUSTER: could its look be guessed from the category, or does it fall in one of planning.md's three? yes/no, why.
5. BEST MOMENT: the one thing to leave alone.
6. THE ROOM: tipped, does it read as this world? Are far cards legible, titles clean, labels whole, floors and
   titles in contrast (dark and light chapters), the first and last chapters right?
7. ONE SHOOT: do the pictures share one light direction, one grade, one camera? Which breaks it (its id)? Frames or
   borders inside a picture? Shadows falling the wrong way?
8. FACTS: anything stated that brief.md does not hold (a number, a name, a quote)? A real business's facts are never invented.
```

**Act on it.** ship: done. fix: fix them in one batch, run `check.mjs`, send the fresh shots to
the same reviewer to score each fix resolved / partial / unresolved, and anything new.
**Two rounds at most.** What is left goes to the person, word for word, as known weaknesses.
rebuild: tell the person, rebuild what failed, and let them decide on a second rebuild.
Report the verdict at its real scope: "the reviewer scored its 8 fixes resolved" is not "no issues remain".
