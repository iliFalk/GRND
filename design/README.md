# Design source

`cp1-palette.json` is vendored from [CP1-colors](https://github.com/iliFalk/CP1-colors): two palettes,
light and dark, each role named once and measured for contrast on its own ground. Do not edit it here —
change it in CP1-colors and copy it again, so the two do not drift.

`tools/theme-from-palette.mjs` turns the palette into the CSS variables the React UI reads. Generate, do
not hand-write:

```sh
node tools/theme-from-palette.mjs > frontend/src/styles/tokens.css
```
