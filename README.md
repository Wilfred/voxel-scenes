# Voxel Scenes

Generate a cosy voxel landscape in the browser and save it as a desktop wallpaper.
Choose Crescent bay, Woodland stream, Hillside falls or Orchard millpond.
[Open the generator](https://www.wilfred.me.uk/voxel-scenes/) or
[rotate the models in the asset library](https://www.wilfred.me.uk/voxel-scenes/assets.html).

## Running the generator

With Node.js 22.12 or newer installed, run `npm ci` and `npm run dev -- --port 5173 --strictPort`,
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
Each landscape draws from four cottages, ten pines, ten broadleaves and three
palms using its seed, so
every design appears across the days. The asset library shows them all, each
tree with its adult and sapling. Scroll over the preview or use the − and +
buttons to zoom from 50% to 300%. Click Reset camera, double-click the preview,
or press Home while the preview has focus to restore the opening view.
The controls fade after a few idle seconds and return when you move. Press Space
to toggle them at any time. Hiding them with Space or × keeps them out of the
way for a minute while you move around.

The opening seed comes from the local calendar date. Reload to revisit today's
landscape, or use the New button in the top bar for a random seed. The `scene`,
`framing`, `weather` and `seed` URL parameters open a particular composition,
for example `?scene=woods&framing=model&weather=overcast&seed=123`. In Orchard millpond, follow
the headrace past the waterwheel to the duck pond and the cart track to the
orchard stall. The orchard blossoms in April and May, and a small wreath hangs
on the mill door in December. Weather changes the lighting and water while preserving the view.

Four short voxel rays estimate contact shade around opaque surfaces. Larger
landscapes use coarser tracing cells. Three.js Reflector captures the landscape
for flat water, with the weather sky filling the gaps. The falling faces of the
waterfall scatter the reflected sky. Shallow water shows the bed through it.
Direct sunlight uses shadow maps.

## Updating your wallpaper on macOS

With Google Chrome installed on your Mac, run `npm ci` once from this checkout.

Run `npm run wallpaper:mac` whenever you want to apply today's wallpaper.
The script opens the published generator in headless Google Chrome, saves its
2560 × 1440 PNG under `~/Pictures/Voxel Scenes`, and applies it to the connected
displays in your macOS desktop session. To choose a scene, framing, or weather,
pass a quoted generator URL:

```sh
npm run wallpaper:mac -- 'https://www.wilfred.me.uk/voxel-scenes/?scene=woods&framing=model&weather=overcast'
```

The script uses the Mac's local calendar date for the seed.

## Weather studies

The light presets span sunrise, morning sun, clear daylight, evening light
and sunset. Bright overcast softens shadows. Clearing rain leaves a scattering
of slanted drops over the land and rings on the water. The wallpaper captures
a still moment, including the rain. Vista skies and water reflections share a
cloud map. Rectangular models keep their plain backdrop.

Compare the woodland bridge at seed 123 in [sunrise](https://www.wilfred.me.uk/voxel-scenes/?scene=woods&framing=vista&weather=sunrise&seed=123),
[sunset](https://www.wilfred.me.uk/voxel-scenes/?scene=woods&framing=vista&weather=sunset&seed=123)
and [clearing rain](https://www.wilfred.me.uk/voxel-scenes/?scene=woods&framing=vista&weather=clearing&seed=123).
Change weather in place to keep the camera, animals and buildings fixed.

## Picking up the project

The current milestone is manual PNG generation on the web, with Linux as the
first desktop target. CI checks formatting, builds the static site and deploys
`main` to GitHub Pages. Scheduled wallpaper updates, wider
desktop integration and floating-island terrain are future work.

The next visual review is the sky at wallpaper and thumbnail sizes. Compare the
height and spacing of cloud banks, the visibility of rain over dark trees,
and how much sky the vista leaves above its focal building. The current study
uses stepped banks. Two alternatives worth comparing on that same seed are a
few taller broken cumulus clusters and long thin evening clouds with warm lit
edges. The art direction and development workflow live in [ART_STYLE.md](ART_STYLE.md)
and [AGENTS.md](AGENTS.md).
