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
Each tree card includes its adult and sapling.

The opening seed comes from the local calendar date. Reload to revisit today's
landscape, or use the New button for a random seed. In Orchard millpond, follow
the headrace past the waterwheel to the duck pond and the cart track to the
orchard stall. The orchard blossoms in April and May, and a small wreath hangs
on the mill door in December. Weather changes the lighting and water while preserving the view.

Ray-traced contact shading is an optional visual comparison. It traces four
short rays per opaque voxel surface sample through a 3D occupancy texture to
estimate how much ambient light reaches corners and the ground under objects.
The normal renderer supplies direct light, shadows and water reflections.
Large landscapes use coarser tracing cells. PNG export uses the selected settings.
