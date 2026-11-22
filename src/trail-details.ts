import type { Elevation } from "./sites";
import { palette } from "./palette";
import type { Box } from "./voxels";

export function firewood(box: Box, x: number, h: number, z: number) {
  for (const offset of [-0.25, 0.25]) {
    box(x, h + 0.25, z + offset, 1.75, 0.5, 0.5, palette.wood);
  }
  box(x - 0.125, h + 0.625, z, 1.5, 0.25, 0.5, palette.wood);
}

export function waypost(box: Box, x: number, h: number, z: number) {
  box(x, h + 0.75, z, 0.25, 1.5, 0.25, palette.wood);
  box(x, h + 1.5, z + 0.125, 1.5, 0.5, 0.25, palette.wood);
}

export function footbridge(box: Box, west: number, east: number, bridgeZ: number, elevation: Elevation) {
  // All timber faces sit on the quarter-unit grid, including the submerged
  // posts. The deck meets the higher bank with one step on the lower side.
  const deck = Math.max(elevation(east, bridgeZ), elevation(west, bridgeZ));
  const span = east - west - 1;
  const middle = (west + east) / 2;
  box(middle, deck - 0.25, bridgeZ, span, 0.5, 1.5, palette.wood);
  for (const side of [-0.75, 0.5]) {
    const z = bridgeZ + side + 0.125;
    box(middle, deck + 0.625, z, span, 0.25, 0.25, palette.wood);
    const bays = Math.ceil(span / 3);
    for (let i = 0; i <= bays; i++) {
      const left = west + 0.5 + Math.round((span - 0.25) * i / bays * 4) / 4;
      const bottom = elevation(Math.round(left + 0.125), Math.round(z)) - 0.5;
      box(left + 0.125, (bottom + deck + 0.5) / 2, z, 0.25, deck + 0.5 - bottom, 0.25, palette.wood);
    }
  }
  return deck;
}

type Cell = { x: number; z: number };

export function shoreStairs(box: Box, route: Cell[], foundationTop: number, risers: number) {
  const unit = 0.5;
  route.forEach((p, i) => {
    const top = foundationTop - unit * Math.floor(i * risers / (route.length - 1));
    const stoneTop = top - unit;
    box(p.x, (stoneTop - unit) / 2, p.z, unit, stoneTop + unit, unit, palette.ground.stone);
    box(p.x, top - unit / 2, p.z, unit, unit, unit, palette.wood);
  });
}

export function pier(box: Box, end: Cell, pierX: number, pierZ: number, naturalHeight: Elevation) {
  const unit = 0.5, dockTop = unit;
  for (let i = 1; i <= 3; i++) {
    box(end.x + pierX * unit * i, dockTop - unit / 2, end.z + pierZ * unit * i, unit, unit, unit, palette.wood);
  }
  const tipX = end.x + pierX * unit * 3, tipZ = end.z + pierZ * unit * 3;
  for (const side of [-1, 1]) {
    const px = tipX + side * pierZ * unit, pz = tipZ - side * pierX * unit;
    const foot = Math.min(-unit, naturalHeight(px, pz));
    box(px, (dockTop + unit + foot) / 2, pz, unit, dockTop + unit - foot, unit, palette.wood);
  }
}
