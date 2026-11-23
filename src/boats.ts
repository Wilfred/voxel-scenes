import { weightedSite, type Elevation } from "./sites";
import { palette } from "./palette";
import type { Box } from "./voxels";

// Boats are built on the half-course, an eighth of a world unit, so a hull
// has planked sides and a seat. Each block gives opposite corners in cells,
// with the bow toward +x; `heading` turns the whole boat about its centre.
function hullLattice(box: Box, x: number, y: number, z: number, heading: number) {
  const cell = 1 / 8;
  const cos = Math.cos(heading),
    sin = Math.sin(heading);
  return (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number) => {
    const fx = ((x0 + x1) / 2) * cell,
      fz = ((z0 + z1) / 2) * cell;
    box(
      x + fx * cos + fz * sin,
      y + ((y0 + y1) / 2) * cell,
      z + fz * cos - fx * sin,
      (x1 - x0) * cell,
      (y1 - y0) * cell,
      (z1 - z0) * cell,
      color,
      heading,
    );
  };
}

// An open hull, built in runs of columns from the transom to the stem. Each
// entry in `beam` is the half-width of a column; the sides close in toward a
// pointed bow and rise there by one strake.
function hull(cell: ReturnType<typeof hullLattice>, beam: number[], colours: { hull: number; trim: number }) {
  const start = -beam.length / 2;
  for (let i = 0; i < beam.length;) {
    let j = i;
    while (j < beam.length && beam[j] === beam[i]) j++;
    const x0 = start + i,
      x1 = start + j,
      w = beam[i];
    const bow = j === beam.length;
    const top = bow ? 4 : 3;
    if (w > 1) cell(x0, 0, 1 - w, x1, 1, w - 1, palette.wood);
    for (const side of [-1, 1]) {
      const [inner, outer] = side > 0 ? [w - 1, w] : [-w, 1 - w];
      cell(x0, 0, inner, x1, top - 1, outer, colours.hull);
      cell(x0, top - 1, inner, x1, top, outer, colours.trim);
    }
    i = j;
  }
  // The transom closes the stern.
  const w = beam[0];
  cell(start - 1, 0, -w, start, 2, w, colours.hull);
  cell(start - 1, 2, -w, start, 3, w, colours.trim);
}

// A clinker rowing boat about three and a half metres long, with a thwart
// and a pair of oars shipped along the sides.
export function rowingBoat(box: Box, x: number, y: number, z: number, heading = 0) {
  const cell = hullLattice(box, x, y, z, heading);
  hull(cell, [2, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 1], { hull: palette.wood, trim: palette.sawnWood });
  cell(0, 1, -2, 2, 2, 2, palette.sawnWood);
  cell(-5, 1, -2, -3, 2, 2, palette.sawnWood);
  for (const side of [-1, 1]) cell(-3, 2, side * 2 - 1, 3, 2.5, side * 2, palette.sawnWood);
}

// A small sailing dinghy with a single tan sail sheeted along its boom.
export function sailingDinghy(box: Box, x: number, y: number, z: number, heading = 0) {
  const cell = hullLattice(box, x, y, z, heading);
  hull(cell, [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 1, 1], { hull: palette.boat.hull, trim: palette.wood });
  cell(1, 1, -2, 3, 2, 2, palette.sawnWood);
  cell(3, 1, -0.5, 4, 26, 0.5, palette.wood);
  cell(-8, 4, -0.5, 3, 5, 0.5, palette.wood);
  // The sail steps in from the boom to the masthead in two-cell courses.
  for (let row = 0; row < 10; row++) {
    const reach = Math.round(11 * (1 - row / 10));
    if (reach <= 0) break;
    cell(3 - reach, 5 + row * 2, -0.25, 3, 7 + row * 2, 0.25, palette.boat.sail);
  }
}

export const boats = [
  { name: "Rowing boat", draw: (box: Box) => rowingBoat(box, 0, 0, 0) },
  { name: "Sailing dinghy", draw: (box: Box) => sailingDinghy(box, 0, 0, 0) },
];

// Light open boats ride high, with only the bottom half-cell of the hull
// below the waterline.
const draught = -0.0625;

// Moor a rowing boat alongside a landing, parallel to its deck, on the
// first side with open water for the whole hull.
export function mooredBoat(box: Box, landing: { x: number; z: number }, along: [number, number], depth: Elevation) {
  const [dx, dz] = along;
  for (const side of [1, -1]) {
    const x = landing.x - dz * side * 1.05,
      z = landing.z + dx * side * 1.05;
    const clear = [-0.9, 0, 0.9].every(t =>
      [-0.4, 0.4].every(s => depth(x + dx * t - dz * s, z + dz * t + dx * s) > 0.3),
    );
    if (!clear) continue;
    rowingBoat(box, x, draught, z, Math.atan2(-dz, dx));
    return { x, z };
  }
}

// Sail a dinghy in open water well clear of the landing and buildings, its
// bow pointing out to sea. `outward` gives the seaward direction at a site,
// and `view` favours water the camera sees, in front of the land.
export function dinghyOffshore(
  box: Box,
  bounds: { left: number; right: number; back: number; front: number },
  depth: Elevation,
  random: () => number,
  avoid: { x: number; z: number; radius: number }[],
  outward: (x: number, z: number) => [number, number],
  view: Elevation = () => 1,
) {
  const site = weightedSite(
    bounds.left,
    bounds.right,
    bounds.back,
    bounds.front,
    0.5,
    (x, z) => {
      if (avoid.some(p => Math.hypot(x - p.x, z - p.z) < p.radius)) return 0;
      for (const dx of [-1.25, 0, 1.25]) for (const dz of [-1.25, 0, 1.25]) if (depth(x + dx, z + dz) < 0.6) return 0;
      const d = depth(x, z);
      return view(x, z) / (1 + (d - 2.5) ** 2);
    },
    random,
  );
  if (!site) return;
  const [dx, dz] = outward(site.x, site.z);
  // The bow lies along +x before the boat turns by its heading.
  const heading = Math.atan2(-dz, dx) + (random() - 0.5) * 0.5;
  sailingDinghy(box, site.x, draught, site.z, heading);
  return site;
}
