# Working on Voxel Scenes

## Shared memory

Before starting work, locate or clone [Wilfred/shared_memory](https://github.com/Wilfred/shared_memory)
and read its README. Follow its instructions for syncing, consulting relevant
memories, recording useful findings, and consolidating, committing, and pushing
memory updates.

## Product and workflow

Voxel Scenes is a TypeScript and Three.js website for generating scenic voxel
wallpapers. The current workflow is to generate a landscape in the browser,
review it at full browser width, and save a 2560 × 1440 PNG. A Linux laptop is
the first target. Keep that browser workflow portable to Windows and macOS.
Daily automatic wallpaper changes are a longer-term goal.

[ART_STYLE.md](ART_STYLE.md) describes what the scenes should look like. This
file describes how to work on them.

- Commit completed, coherent changes regularly as local checkpoints.
- Work in small visual iterations and pause for feedback between experiments.
  Compare alternatives in one setting with the same seed and camera. When the
  camera itself is the experiment, keep the terrain and assets fixed.
- Use one localhost preview for discussion. Reuse the running server for this
  checkout. To start it on the usual port, run
  `npm run dev -- --port 5173 --strictPort`. Share a URL with the scene,
  framing, weather and seed, such as
  `http://localhost:5173/?scene=woods&framing=vista&weather=clear&seed=123`,
  so the user sees the same composition.
- Run `npm run build` for code changes and `npm run check` for generator
  changes. The check builds every scene across a sweep of seeds and fails on
  generation errors and routes that climb more than one terrain layer per
  tread. `npm run check -- --hash` fingerprints each landscape, so a refactor
  can show it changes nothing.
- For visual changes, inspect the actual render at wallpaper size and as a
  320-pixel-wide thumbnail. At thumbnail size you should still be able to name
  the scene and find its building. Try a few seeds to catch clipped peaks,
  overlapping crowns, or paths that miss their destinations. Check the saved
  PNG when changing framing or rendering.

## Building scenes

Woodland streams, hillsides, bays, and future floating islands should feel
like places in the same game.

- Generate terrain first, choose an existing relatively flat site, and thin
  just enough trees for the building and access. Connect cottage paths to
  visible destinations, such as a water landing.
- Choose a voxel unit and align adjoining geometry to its grid. Check the
  faces where pieces meet. Give paths full coloured terrain voxels, stairs
  whole-voxel rises and runs, and bridges a usable approach on both banks.
  Smooth a path by choosing a gentler route and cutting whole terrain layers
  from high spots. Keep its surface on the surrounding voxel grid.
- Select crossings and occupied sites from the terrain. Rank bridge sites by
  span and bank access, and check the whole footprint of props such as stacked
  firewood. Place them beside the activity that explains their presence.
- Reuse `src/cottage.ts`, `src/trees.ts`, `src/water.ts`, and the seeded
  generation and instancing helpers in `src/voxels.ts`. Describe a new scene's
  framing and focus in `src/scenes.ts`. Refine shared models across their
  scenes.
- Draw scene colours from the shared material families in `src/palette.ts`,
  naming new families for what they colour.
- Draw per-cell variation that should not disturb the rest of a landscape,
  such as foam, from a positional hash rather than the seeded sequence.

## Choosing assets

- Choose simple, low-poly wildlife built from a few chunky shapes. Inspect
  the preview art for voxel density before recommending a pack.
- Judge third-party assets at the intended camera distance, beside a familiar
  object. Compare a tree to the cottage door, an animal to the path width,
  or a bench seat to a stair riser. Check both physical proportions and visible
  voxel size. Free and paid assets are both candidates. Verify the creator's
  link, available 3D formats, and licence before integrating a pack.
