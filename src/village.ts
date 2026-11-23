import { casement, masonryCourses, pitchedRoof } from "./building";
import { palette as p } from "./palette";
import { findSite, type Elevation } from "./sites";
import type { Box } from "./voxels";

type Model = (box: Box) => void;
export function at(box: Box, x: number, y: number, z: number, turn = false): Box {
  return (a, b, c, w, h, d, color, yaw = 0) =>
    box(x + (turn ? c : a), y + b, z + (turn ? -a : c), w, h, d, color, yaw + (turn ? Math.PI / 2 : 0));
}

// Lay out a small model on its own lattice of `unit`-sized cells, giving the
// opposite corners of each block in cells. One lattice keeps one detail scale.
function lattice(box: Box, unit: number) {
  return (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number) =>
    box(
      ((x0 + x1) / 2) * unit,
      ((y0 + y1) / 2) * unit,
      ((z0 + z1) / 2) * unit,
      (x1 - x0) * unit,
      (y1 - y0) * unit,
      (z1 - z0) * unit,
      color,
    );
}

// Farm and woodland animals face +x. Sheep and deer use eighth-metre cells.
export const sheep: Model = box => {
  const cell = lattice(box, 1 / 16);
  for (const x of [-3.5, 2.5]) for (const z of [-1, 1]) cell(x - 0.5, 0, z - 0.5, x + 0.5, 2, z + 0.5, p.animal.dark);
  cell(-5, 2, -2.5, 4, 7, 2.5, p.animal.fleece);
  cell(4, 3, -1.5, 7, 6, 1.5, p.animal.dark);
  for (const z of [-2, 2]) cell(4, 5, z - 0.5, 5, 6, z + 0.5, p.animal.dark);
};
// A roe deer: long legs, an upright neck, large ears and a pale rump.
export const deer: Model = box => {
  const cell = lattice(box, 1 / 16);
  for (const x of [-3.5, 2.5]) for (const z of [-1, 1]) cell(x - 0.5, 0, z - 0.5, x + 0.5, 4, z + 0.5, p.animal.dark);
  cell(-4, 4, -1.5, 4, 7, 1.5, p.animal.fur);
  cell(3, 7, -0.5, 4, 9, 0.5, p.animal.fur);
  cell(3, 9, -0.5, 6, 11, 0.5, p.animal.fur);
  for (const z of [-1, 1]) cell(3, 11, z - 0.5, 4, 12, z + 0.5, p.animal.dark);
  cell(-5, 5, -0.5, -4, 7, 0.5, p.animal.pale);
};
export const creel: Model = box => {
  for (const x of [-0.21, 0.21]) box(x, 0.14, 0, 0.08, 0.28, 0.36, p.wood);
  for (const z of [-0.15, 0.15]) box(0, 0.14, z, 0.36, 0.28, 0.06, p.wood);
  box(0, 0.04, 0, 0.36, 0.08, 0.24, p.ground.soil);
  box(0, 0.31, 0, 0.08, 0.06, 0.36, p.cloth.canvas);
};
// Rabbits and hens use sixteenth-metre cells.
export const rabbit: Model = box => {
  const cell = lattice(box, 1 / 32);
  cell(-3, 0, -1.5, 2, 3, 1.5, p.animal.fur);
  cell(2, 2, -1.5, 5, 5, 1.5, p.animal.fur);
  for (const z of [-1, 1]) cell(2, 5, z - 0.5, 3, 9, z + 0.5, p.animal.fur);
  cell(-4, 1, -0.5, -3, 3, 0.5, p.animal.pale);
};
export const chicken: Model = box => {
  const cell = lattice(box, 1 / 32);
  for (const z of [-1, 1]) cell(-0.5, 0, z - 0.5, 0.5, 2, z + 0.5, p.animal.beak);
  cell(-2.5, 2, -1.5, 2.5, 6, 1.5, p.animal.pale);
  cell(-3.5, 4, -1.5, -2.5, 8, 1.5, p.animal.dark);
  cell(-2.5, 6, -1.5, -1.5, 8, 1.5, p.animal.dark);
  cell(1.5, 6, -0.5, 3.5, 9, 0.5, p.animal.pale);
  cell(1.5, 9, -0.5, 3.5, 10, 0.5, p.animal.comb);
  cell(3.5, 7, -0.5, 4.5, 8, 0.5, p.animal.beak);
};

// An apple crate about half a metre long, heaped with fruit, on eighth-metre cells.
export const crate: Model = box => {
  const cell = lattice(box, 1 / 16);
  cell(-2, 0, -1.5, 2, 2, 1.5, p.wood);
  for (const [x, z] of [
    [-1.5, -1],
    [0.5, -1],
    [-0.5, 0],
    [1.5, 0],
    [-1.5, 1],
    [0.5, 1],
  ]) {
    cell(x - 0.5, 2, z - 0.5, x + 0.5, 3, z + 0.5, p.harvest.apple);
  }
};
// A hive a metre tall on a post, with an overhanging roof, on quarter-metre cells.
export const hive: Model = box => {
  const cell = lattice(box, 1 / 8);
  cell(-0.5, 0, -0.5, 0.5, 1, 0.5, p.wood);
  cell(-1, 1, -1, 1, 3, 1, p.cottage.plaster);
  cell(-1.5, 3, -1.5, 1.5, 4, 1.5, p.cottage.tile);
};
// A two-metre handcart on eighth-metre cells. The wheels stand clear of the
// bed on the ground, and a pair of legs props the handles.
export const cart: Model = box => {
  const cell = lattice(box, 1 / 16);
  cell(-3, 4, -4, 3, 5, 4, p.wood);
  for (const side of [-1, 1]) {
    const [inner, outer] = side > 0 ? [2, 3] : [-3, -2];
    cell(inner, 5, -4, outer, 7, 4, p.wood);
    cell(inner, 4, 4, outer, 5, 12, p.wood);
    cell(inner, 0, 10, outer, 4, 11, p.wood);
    const [hub, rim] = side > 0 ? [3, 4] : [-4, -3];
    cell(hub, 0, -2, rim, 2, 2, p.wood);
    cell(hub, 2, -4, rim, 6, 4, p.wood);
    cell(hub, 6, -2, rim, 8, 2, p.wood);
  }
  cell(-2, 5, -4, 2, 7, -3, p.wood);
  crate(at(box, 0, 5 / 16, 0));
};
export const stall: Model = box => {
  for (const x of [-0.875, 0.875]) for (const z of [-0.4375, 0.4375]) box(x, 0.6875, z, 0.125, 1.375, 0.125, p.wood);
  box(0, 0.5625, 0, 1.875, 0.125, 1, p.wood);
  // Five stripes of the awning rest on the posts, flush with their outer faces.
  for (let i = 0; i < 5; i++)
    box((i - 2) * 0.375, 1.4375, 0, 0.375, 0.125, 1.25, i % 2 ? p.cloth.canvas : p.cloth.dyed);
  crate(at(box, -0.5, 0.625, 0));
};

export function appleTree(box: Box, blossom = false) {
  box(0, 0.65, 0, 0.5, 1.3, 0.5, p.wood);
  box(0, 1.75, 0, 2, 1, 1.5, p.green.leaf);
  box(0, 2, 0, 1.5, 1.5, 2, p.green.leaf);
  box(0, 2.875, 0, 1, 0.25, 1, p.green.leafTip);
  for (const [x, y, z] of [
    [0.75, 1.75, 0.8],
    [-0.8, 1.5, 0.65],
    [0.25, 2.25, 1],
    [1, 1.75, -0.5],
  ])
    box(x, y, z, 0.25, 0.25, 0.25, blossom ? p.harvest.blossom : p.harvest.apple);
}
export const mill: Model = box => {
  const course = masonryCourses(box);
  course(-8, -4, -5, 16, 4, 10, p.ground.stone);
  course(-8, 0, -5, 16, 8, 9, p.cottage.plaster);
  for (let x = -8; x < 8; x++) {
    const door = x >= -5 && x <= -3;
    course(x, 0, 4, 1, 2, 1, door ? p.wood : p.ground.stone);
    if (x < 1 || x > 5) course(x, 2, 4, 1, 3, 1, door ? p.wood : p.cottage.plaster);
    course(x, 5, 4, 1, 3, 1, p.cottage.plaster);
  }
  casement(course, 1, 2, 4, 5, 3, p.cottage.plaster);
  pitchedRoof(course, "gable", 9, 6, 8, 6, p.cottage.plaster);
  // Two timber rims joined by paddles on the stream side of the mill.
  for (let y = -4; y <= 4; y++)
    for (let z = -4; z <= 4; z++) {
      const r = Math.hypot(y, z);
      if (r > 4.6 || (r < 3.4 && y !== 0 && z !== 0)) continue;
      for (const x of [8, 11]) course(x, 2 + y, z, 1, 1, 1, p.wood);
      if (r >= 3.4 && (y + z) % 2 === 0) course(9, 2 + y, z, 2, 1, 1, p.wood);
    }
};

export const animals = [
  { name: "Roe deer", draw: deer },
  { name: "Grazing sheep", draw: sheep },
  { name: "Field rabbit", draw: rabbit },
  { name: "Farmyard hen", draw: chicken },
];
export const village = [
  { name: "Fishing creel", draw: creel },
  { name: "Orchard mill", draw: mill },
  { name: "Apple tree", draw: appleTree },
  { name: "Handcart", draw: cart },
  { name: "Produce stall", draw: stall },
  { name: "Apple crate", draw: crate },
  { name: "Beehive", draw: hive },
];

// Reserve a dry, level footprint near the activity the prop belongs to.
export function villageYard(box: Box, elevation: Elevation, free: (x: number, z: number) => boolean) {
  const occupied: { x: number; z: number; radius: number }[] = [];
  const near = (x: number, z: number, margin = 0) =>
    occupied.some(p => Math.hypot(x - p.x, z - p.z) < p.radius + margin);
  function place(draw: Model, tx: number, tz: number, radius: number, turn = false) {
    const site = findSite(Math.round(tx) - 3, Math.round(tx) + 3, Math.round(tz) - 3, Math.round(tz) + 3, 1, (x, z) => {
      if (near(x, z, radius)) return Infinity;
      const h = elevation(x, z);
      for (const dx of [-radius, 0, radius])
        for (const dz of [-radius, 0, radius]) {
          if (h <= 0 || !free(x + dx, z + dz) || elevation(x + dx, z + dz) !== h) return Infinity;
        }
      return Math.hypot(x - tx, z - tz);
    });
    if (!site) return;
    draw(at(box, site.x, elevation(site.x, site.z), site.z, turn));
    occupied.push({ ...site, radius });
  }
  return { place, near };
}
