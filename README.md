# Voxel Scenes

A simple website for generating scenic voxel images for desktop
wallpapers.

## Local development

With Node.js 22.12 or newer installed, run `npm ci` and `npm run dev`,
then open the local URL printed by Vite. Choose Crescent bay, Mountain vista, or Woodland stream,
generate a new landscape, or save the view as a 2560 × 1440 PNG.

Run `npm run build` to type-check the TypeScript and create the static site
in `dist/`. Run `npm run preview` to serve that build locally.

The mountain sky uses a tone-mapped copy of the CC0 panorama
[Kloofendal 48d Partly Cloudy from Poly Haven](https://polyhaven.com/a/kloofendal_48d_partly_cloudy).

The woodland **Cut stump** checkbox previews a stump from Luminous Dice's
[Tiny Voxel Nature Pack](https://luminous-dice.itch.io/tiny-voxel-nature-pack).
Its wood tones match the woodland palette. The creator's asset licence applies
to the adapted model.
