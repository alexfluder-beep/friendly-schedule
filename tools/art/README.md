# App art: hand-drawn SVG

The avatar pictures (30) and badge pictures (75) are drawn by hand as small SVG files. Gemini is not needed (it needs billing; owner chose "B" on 11 Nov 2026).

- `draw.py` holds every drawing. Run `python3 tools/art/draw.py` after a change. It writes:
  - `art/avatars/<id>.svg`: 96 x 96, round, on its own background.
  - `art/badges/<id>.svg`: 48 x 48 symbol (preview only).
  - `art.js`: the one file the app loads (about 56 KB, cached for offline by `sw.js`).
- Rules: flat, few shapes, palette paper #f7f5ef, green #314b3c, rust #b8441c, plum #5b4bb0, mustard #f0b03f, ink #20251f, sand #e9e8dc; must read at 40 px (avatars) and 64 px (badges); no text, letters or numbers; no churches, crosses or religious buildings; no glow.
- Keep badge colours to that palette: an unearned badge shows its picture in grey by swapping exactly those colours.
- `prompts.json` is the list of ids and subjects; `draw.py` refuses to run if a picture is missing.

How the app uses them: a person's avatar can be `art:<id>` (new), `ms:<icon>:<colour>` (old icon avatars) or a photo; all three keep working. A badge with a picture shows it inside its medal (tiers, progress ring, shine and the secret "?" stay); a badge without one (tour mastery, region titles) keeps the old line icon.

`make_art.py` (Gemini) is kept for later, in case billing is ever turned on.
