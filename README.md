# Voxel Scenes

A simple website for generating scenic voxel images for desktop
wallpapers.

## Local development

With Node.js 22.12 or newer installed, run `npm ci` and `npm run dev`,
then open the local URL printed by Vite. Choose a scene and generate a landscape.
Vista framing looks across the land in perspective toward a hazy horizon.
Rectangular model framing shows the whole place as a miniature block. Either
saves a 2560 × 1440 PNG.

Run `npm run build` to type-check the TypeScript and create the static site
in `dist/`. Run `npm run preview` to serve that build locally. Run
`npm run check` to generate every scene across a sweep of seeds and check
that each builds and that its paths climb at most one terrain layer per step.

Grid resolution controls how many terrain cells fit across the wallpaper.
The range is 0.75× to 5× in quarter steps. At 5×, five times as many cells fit
across the wallpaper. The export remains 2560 × 1440.
Each landscape draws its cottage, pine and broadleaf designs from its seed, so
every design appears across the days. The asset library shows them all, each
tree with its adult and sapling. Use the − and + buttons to frame
the current landscape at 50% to 300%. Double-click the canvas or press Home
while it has focus to restore the opening camera angle and zoom.
The controls fade after a few idle seconds and return when you move. Press ×
to keep them hidden for a minute while you turn the scene.

The opening seed comes from the local calendar date. Reload to revisit today's
landscape, or use the New button beside Save PNG for a random seed. The `scene`,
`framing`, `weather` and `seed` URL parameters open a particular composition,
for example `?scene=woods&framing=model&weather=overcast&seed=123`. In Orchard millpond, follow
the headrace past the waterwheel to the duck pond and the cart track to the
orchard stall. The orchard blossoms in April and May, and a small wreath hangs
on the mill door in December. Weather changes the lighting and water while preserving the view.

Ray tracing is enabled by default. Four short rays estimate contact shade around
opaque surfaces. Ripples on the sea, stream, millpond and waterfall reflect nearby
voxel colours, fading into the weather sky beyond the tracing distance. Shallow
water shows the bed through it. Direct sunlight uses shadow maps. Large landscapes
use coarser tracing cells. The checkbox also controls the saved PNG.
