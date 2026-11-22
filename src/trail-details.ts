import { constructionVoxel as timber } from "./scale";
import type { Elevation } from "./sites";
import { palette } from "./palette";
import type { Box } from "./voxels";

export function firewood(box: Box, x: number, h: number, z: number) {
  for (const offset of [-0.25, 0.25]) {
    box(x, h + 0.25, z + offset, 1.75, 0.5, 0.5, palette.wood);
  }
  box(x - 0.125, h + 0.625, z, 1.5, 0.25, 0.5, palette.wood);
}

export function waypost(box: Box, x: number, h: number, z: number, acrossBridge = false) {
  box(x, h + 0.375, z, 0.125, 0.75, 0.125, palette.wood);
  box(x, h + 0.8125, z, acrossBridge ? 0.125 : 0.75, 0.25, acrossBridge ? 0.75 : 0.125, palette.wood);
}

export function footbridge(box: Box, west: number, east: number, bridgeZ: number, elevation: Elevation) {
  // All timber faces sit on the quarter-unit grid, including the submerged
  // posts. The deck meets the higher bank with one step on the lower side.
  const deck = Math.max(elevation(east, bridgeZ), elevation(west, bridgeZ));
  const span = east - west - 1;
  const middle = (west + east) / 2;
  box(middle, deck - timber / 2, bridgeZ, span, timber, 6 * timber, palette.wood);
  for (const side of [-0.75, 0.5]) {
    const z = bridgeZ + side + 0.125;
    box(middle, deck + 0.625, z, span, timber, timber, palette.wood);
    const bays = Math.ceil(span / 3);
    for (let i = 0; i <= bays; i++) {
      const left = west + 0.5 + Math.round((((span - 0.25) * i) / bays) * 4) / 4;
      const bottom = elevation(Math.round(left + 0.125), Math.round(z)) - 0.5;
      box(left + 0.125, (bottom + deck + 0.5) / 2, z, timber, deck + 0.5 - bottom, timber, palette.wood);
    }
  }
  return deck;
}

type Cell = { x: number; z: number };

export function shoreStairs(box: Box, route: Cell[], foundationTop: number, risers: number) {
  const unit = 0.5;
  route.forEach((p, i) => {
    const top = foundationTop - unit * Math.floor((i * risers) / (route.length - 1));
    const stoneTop = top - unit;
    box(p.x, (stoneTop - unit) / 2, p.z, unit, stoneTop + unit, unit, palette.ground.stone);
    box(p.x, top - unit / 2, p.z, unit, unit, unit, palette.wood);
  });
}

export function pier(box: Box, end: Cell, pierX: number, pierZ: number, naturalHeight: Elevation) {
  const dockTop = 0.5,
    length = 6 * timber,
    width = 4 * timber;
  // The final stair ends half a terrain cell beyond its centre.
  const along = (forward: number, side: number) => ({
    x: end.x + pierX * forward + pierZ * side,
    z: end.z + pierZ * forward - pierX * side,
  });
  const middle = along(timber + length / 2, 0);
  box(middle.x, dockTop - timber / 2, middle.z, pierX ? length : width, timber, pierX ? width : length, palette.wood);
  for (const forward of [1.5 * timber, length + timber / 2]) {
    for (const side of [-1, 1]) {
      const p = along(forward, (side * (width - timber)) / 2);
      const foot = Math.min(-timber, Math.floor(naturalHeight(p.x, p.z) / timber) * timber);
      const cap = forward > length ? dockTop + timber : dockTop - timber;
      // Split the mooring bollard at deck level so no timber occupies the same space twice.
      box(p.x, (dockTop - timber + foot) / 2, p.z, timber, dockTop - timber - foot, timber, palette.wood);
      if (cap > dockTop) box(p.x, dockTop + timber / 2, p.z, timber, timber, timber, palette.wood);
    }
  }
}
