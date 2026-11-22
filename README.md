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
The range is 0.75× to 5× in quarter steps. At 5×, five times as many cells fit
across the wallpaper. The export remains 2560 × 1440.
Open **Design studies** to compare ten cottages, ten pines, or ten broadleaf trees.
Selecting a card applies that model wherever it occurs in the landscape.
Each tree card includes its adult and sapling. Use the − and + buttons to frame
the current landscape at 50% to 300%. Double-click the canvas or press Home
while it has focus to restore the opening camera angle and zoom.

The opening seed comes from the local calendar date. Reload to revisit today's
landscape, or use the New button for a random seed. In Orchard millpond, follow
the headrace past the waterwheel to the duck pond and the cart track to the
orchard stall. The orchard blossoms in April and May, and a small wreath hangs
on the mill door in December. Weather changes the lighting and water while preserving the view.

Ray tracing is enabled by default. Four short rays estimate contact shade around
opaque surfaces. Ripples on the sea, stream, millpond and waterfall reflect nearby
voxel colours, fading into the weather sky beyond the tracing distance. Shallow
water shows the bed through it. Direct sunlight uses shadow maps. Large landscapes
use coarser tracing cells. The checkbox also controls the saved PNG.
