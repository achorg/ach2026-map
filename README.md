# ACH2026 WorkAdventure Map

This repository contains a starting scaffold for a WorkAdventure map based on the ACH2026 image.

What I added
- `assets/ach2026-map.png` - (not included) place the provided map image here.
- `ach2026-map.json` - Tiled JSON map file that references the image as a tileset.
- `workadventure-map.json` - minimal WorkAdventure manifest to load the map.
- `objects.json` - sample objects/portals definitions for WorkAdventure.

Quick start
1. Copy the attached image into `assets/ach2026-map.png`.
2. Open `ach2026-map.json` in Tiled (File > Open). Tiled may ask to locate the image; point it to `assets/ach2026-map.png`.
3. Adjust tile size or layers as needed, then export as JSON (if you edit in Tiled ensure the export settings match WorkAdventure expectations).
4. Serve the folder with a static server and open WorkAdventure with `workadventure-map.json` configured.

Notes and assumptions
- I assumed a tile size of 16x16. If the original map uses a different tile size, open in Tiled and change the tileset settings.
- The included `ach2026-map.json` is a simple single-image tileset with one layer sized to the image dimensions.

Next steps
- Edit the Tiled map to add object layers for portals, triggers, and collision.
- Export the final JSON and add to your WorkAdventure server or to the online editor.
