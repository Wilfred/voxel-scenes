# Voxel Scenes

A simple website for generating scenic voxel images for desktop
wallpapers.

## Local development

With Node.js 22.12 or newer installed, run `npm ci` and `npm run dev`,
then open the local URL printed by Vite. Choose a scene and generate a landscape.
Each scene supports Vista and Rectangular model framing and saves a 2560 × 1440 PNG.

Run `npm run build` to type-check the TypeScript and create the static site
in `dist/`. Run `npm run preview` to serve that build locally.

Grid resolution controls how many terrain cells fit across the wallpaper.
The range is 1× to 10× in quarter steps. At 10×, ten times as many cells fit
across the wallpaper. The export remains 2560 × 1440.
Open **Design studies** to compare ten cottages, ten pines, or ten broadleaf trees.
Selecting a card applies that model wherever it occurs in the landscape.
Each tree card includes its adult and sapling.
