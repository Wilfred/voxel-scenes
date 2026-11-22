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

- Commit completed, coherent changes regularly as local checkpoints.
- Work in small visual iterations and pause for feedback between experiments.
  Compare alternatives in one setting with the same seed and camera. When the
  camera itself is the experiment, keep the terrain and assets fixed.
- Use one localhost preview for discussion. Reuse the running server for this
  checkout. To start it on the usual port, run
  `npm run dev -- --port 5173 --strictPort`. Share the URL, scene, framing,
  and seed so the user can see the same composition.
- Run `npm run build` for code changes. For visual changes, inspect the actual
  render at wallpaper size and as a thumbnail. Try a few seeds to catch clipped
  peaks, overlapping crowns, or paths that miss their destinations. Check the
  saved PNG when changing framing or rendering.

## Composition and materials

Read [ART_STYLE.md](ART_STYLE.md) for the visual references and overall art
direction. Use the **Graphic landscape** style across scenes. Woodland streams, hillsides,
bays, and future floating islands should feel like places in the same game.

- Compose pulled-back vistas and dioramas. Show the roof and two faces of a
  cottage from an elevated angle. Try a focal point near a third of the frame,
  with a path, shore, or stream leading the eye toward it. Leave breathing room
  above a summit and around the silhouette of a rectangular model on its plain
  background.
- Give the land a coherent shape. Connect cottage paths to visible destinations, such as a water landing.
  Generate terrain first, choose an existing
  relatively flat site, and thin just enough trees for the building and access.
- Draw scene colours from the shared material families in `src/palette.ts`.
  Use one wood colour for living trunks and built timber. Give skies and
  water more natural depth. Keep skybox clouds clear of the ground, align cast
  shadows with the depicted sun, and let shallow water show the bed through
  actual transparency. Keep silhouettes clear through changes in weather.
- Keep habitation sparse. Chimney smoke, one animal at the treeline, or a few
  walkers can give a landscape scale. Vary weather and use occasional seasonal
  cues, such as Christmas snow or longer Halloween shadows.

## Terrain and assets

- Choose a voxel unit and align adjoining geometry to its grid. Check the
  faces where pieces meet. Give paths full coloured terrain voxels, stairs
  whole-voxel rises and runs, and bridges a usable approach on both banks.
  Trace the route from the cottage door to the pier to catch abrupt drops.
- Reuse `src/cottage.ts`, `src/trees.ts`, `src/water.ts`, and the seeded
  generation and instancing helpers in `src/voxels.ts`. Refine shared models
  across their scenes. Give the cottage a legible entrance, softly contrasting
  windows, and its familiar chimney smoke.
- Give woodland trees short visible trunks and simple, full upper crowns.
  Model saplings and adults separately. Use the same voxel resolution for
  trunk and foliage. Place trees in stands with irregular gaps and room for
  their crowns. Use restrained greens for ordinary woodland and reserve yellow
  foliage for a seasonal scene.
- Choose simple, low-poly wildlife built from a few chunky shapes. Look for a
  silhouette that identifies the animal at wallpaper scale, such as a rabbit's
  long ears. Inspect the preview art for voxel density before recommending a pack.
- Judge third-party assets at the intended camera distance, beside a familiar
  object. Compare a tree to the cottage door, an animal to the path width,
  or a bench seat to a stair riser. Check both physical proportions and visible
  voxel size. Free and paid assets are both candidates. Verify the creator's
  link, available 3D formats, and licence before integrating a pack.
