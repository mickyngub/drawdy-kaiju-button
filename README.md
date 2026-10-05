# Kaiju Button

Press the button and let a kaiju stomp across your Drawdy board: it walks across your view leaving footprints, every stomp jolts the view and knocks nearby elements flying, and after a last roar everything goes back where it was.

## How to use

1. After installing, a kaiju button appears with the board's action buttons on the right.
2. Press it. A kaiju as tall as two fifths of your view walks across it from left to right, leaving a footprint at every step.
3. Every stomp gives the view a small jolt and knocks the elements near its foot away; the closest ones fly off and stay a little way from where they were. Elements in view tremble the whole time it walks.
4. Once it has walked off, a last roar shakes everything harder for a second. Then every element goes back where it was and the footprints disappear. A rampage lasts about nine seconds.
5. To stop it early, press the button again or press Escape.

## Good to know

- It loads nothing from the network: the kaiju's frames are bundled in the extension and the footprints are drawn in code.
- Only you see it. The kaiju and its footprints are an overlay on your screen, not board elements, and they stay pinned to the board when the view moves.
- It moves up to 150 elements in or near your view, the ones closest to the kaiju's path. Frames, and elements in a group, stay still.
- The stomped elements are previews: they move only on your screen, and nothing is saved, synced to others or added to undo. Nothing on the board changes: when it ends or you stop it, every element is back where it was and the overlay is gone.
- It nudges your view at each stomp and puts it back. If the board is replaced while it runs, for example by switching boards, the rampage stops.

## Licence

This extension's code is [MIT](LICENSE). The kaiju sprite (`art/kaiju-sheet.png` and the frames in `src/sprite-data.ts`) is Drawdy's blue mascot and is not covered by the MIT licence.

## Development

```bash
npm install
npm test
npm run typecheck
npm run dev          # dev server on :5173; in Drawdy run ⌘K → "Add extension dev server" on a local board
npm run build        # builds dist/main.js and dist/*.drawdyx
uv run art/slice.py  # regenerates src/sprite-data.ts from art/kaiju-sheet.png
npm run preflight    # before submitting: committed, built, pushed, under Drawdy's limits, above the live version
```

Drawdy builds published versions from this repository's `src/index.ts`, so commit `src/sprite-data.ts` after `uv run art/slice.py`. Bump `driverVersion` in `manifest.json` for every release and add it to `CHANGELOG.md`. `npm test` holds the manifest and listing files to Drawdy's submission rules (a description of at most 500 characters, an icon of at most 256 KB, only `@drawdy/driver-protocol` imported from outside the repository).
