# PixelPress — pocket pixel-art studio & animator

A free, fully client-side pixel-art editor and animator styled like a retro 16-bit handheld with a CRT screen.

**Live:** https://kumarnikhildeveloperaccount.github.io/pixelpress/

## The twist: the link is the save file
Every edit rewrites the page address (`#art=…`). The palette, layers (names + visibility), frames, FPS and title are packed into a small binary format, run-length encoded (with "same as previous frame" and "empty" shortcuts for animation cells) and turned into base64url. Bookmark it to save, send it to share. The Back button walks through artworks you opened or created.
There's also a local **My saves** gallery in IndexedDB (localStorage fallback) with thumbnails, plus gallery/project JSON export and import.

## Features
- Tools: pencil, eraser, flood fill, line (Shift = 45° snap), rectangle and ellipse (outline/filled, Shift = square/circle), dither brush (checkerboard of A/B colours), colour picker, move-pixels, pan
- Mirror / symmetry on X, Y or both; brush sizes 1–8; right-click (or long-press a swatch) for colour B
- Up to 8 layers (add, duplicate, reorder, hide, rename) and 64 frames (add, duplicate, reorder, delete)
- Onion skin (previous frame red-tinted, next frame blue-tinted), playback with FPS control, live preview window
- Palettes: PICO-8, Game Boy green (approximation), NES (a common emulator approximation), Pocket Grape, 1-bit, plus custom edit/add/remove (up to 64 colours); remap to nearest colours or "palette swap" by index
- Zoom (buttons, wheel, pinch), pan (Space-drag, middle mouse, two fingers, D-pad, arrow keys), grid
- Snapshot undo/redo (Ctrl+Z / Ctrl+Shift+Z, or the B / A buttons)
- Export: PNG (current frame), PNG sprite sheet, animated GIF from a hand-written GIF89a encoder with LZW (no library), project JSON
- 8 original starter sprites (several animated)
- Four console shells (Grape Pocket, Pea Brick, Atomic Clear, Night Arcade), CRT scanline toggle, synthesized chiptune clicks (Web Audio, off until you enable them)
- Easter eggs: a famous up-up-down-down code, and clicking the logo several times

## Files
```
index.html  404.html  favicon.svg  manifest.webmanifest  README.md
css/base.css  css/console.css  css/panels.css
js/core.js  js/doc.js  js/codec.js  js/gif.js  js/store.js  js/sprites.js  js/view.js  js/panels.js  js/app.js
```
No build step, no dependencies, no CDN, no trackers, no accounts.

## Limitations
- Very large canvases with many frames produce long links (the header meter warns above ~8 KB); some chat apps truncate long URLs, so export a project file as a backup.
- Max canvas 128×128 in the New dialog (format supports up to 256×256), 8 layers, 64 frames, 64 colours.
- GIF frame delays are in 1/100 s steps, so some FPS values get rounded.
- Layer opacity and blend modes are not supported.

---
Designed & built by Kumar Nikhil · [Portfolio](https://kumarnikhildeveloperaccount.github.io/) · [LinkedIn](https://www.linkedin.com/in/kumar-nikhil-1000a9192/) · [Email](mailto:nkashyapnikhilnk@gmail.com) · [More projects by Kumar Nikhil →](https://kumarnikhildeveloperaccount.github.io/)

With gratitude to God — Om Namah Paarvati Pateh, Har Har Mahadev. May God bless you and everyone.
