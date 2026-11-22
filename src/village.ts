import { casement, masonryCourses, pitchedRoof } from "./building";
import { palette as p } from "./palette";
import { findSite, type Elevation } from "./sites";
import type { Box } from "./voxels";

type Model = (box: Box) => void;
export function at(box: Box, x: number, y: number, z: number, turn = false): Box {
  return (a, b, c, w, h, d, color, yaw = 0) =>
    box(x + (turn ? c : a), y + b, z + (turn ? -a : c), w, h, d, color, yaw + (turn ? Math.PI / 2 : 0));
}

export const sheep: Model = (box) => {
  for (const x of [-0.2, 0.2]) for (const z of [-0.125, 0.125]) box(x, 0.09, z, 0.09, 0.18, 0.09, p.wood);
  box(0, 0.3, 0, 0.65, 0.35, 0.38, p.cottage.smoke);
  box(0.32, 0.36, 0, 0.22, 0.22, 0.2, p.wood);
  box(0.28, 0.445, 0, 0.125, 0.07, 0.32, p.wood);
};
export const deer: Model = (box) => {
  for (const x of [-0.23, 0.23]) for (const z of [-0.09, 0.09]) box(x, 0.17, z, 0.08, 0.34, 0.08, p.wood);
  box(0, 0.45, 0, 0.66, 0.27, 0.24, p.ground.soil);
  box(0.27, 0.64, 0, 0.16, 0.26, 0.16, p.ground.soil);
  box(0.37, 0.79, 0, 0.25, 0.15, 0.16, p.ground.soil);
  for (const z of [-0.09, 0.09]) box(0.29, 0.9, z, 0.09, 0.16, 0.07, p.wood);
  box(-0.31, 0.5, 0, 0.12, 0.16, 0.18, p.cottage.plaster);
};
export const creel: Model = (box) => {
  for (const x of [-0.21, 0.21]) box(x, 0.14, 0, 0.08, 0.28, 0.36, p.wood);
  for (const z of [-0.15, 0.15]) box(0, 0.14, z, 0.36, 0.28, 0.06, p.wood);
  box(0, 0.04, 0, 0.36, 0.08, 0.24, p.ground.soil);
  box(0, 0.31, 0, 0.08, 0.06, 0.36, p.cottage.plaster);
};
export const rabbit: Model = (box) => {
  box(0, 0.1, 0, 0.26, 0.2, 0.16, p.ground.soil);
  box(0.13, 0.19, 0, 0.13, 0.13, 0.13, p.ground.soil);
  for (const z of [-0.045, 0.045]) box(0.1, 0.32, z, 0.06, 0.16, 0.045, p.ground.soil);
  box(-0.14, 0.13, 0, 0.075, 0.08, 0.08, p.cottage.plaster);
};
export const chicken: Model = (box) => {
  box(0, 0.055, 0, 0.09, 0.11, 0.12, p.duck.bill);
  box(0, 0.18, 0, 0.28, 0.19, 0.18, p.cottage.plaster);
  box(-0.145, 0.24, 0, 0.09, 0.18, 0.14, p.wood);
  box(0.12, 0.3, 0, 0.14, 0.18, 0.13, p.cottage.plaster);
  box(0.12, 0.405, 0, 0.09, 0.04, 0.06, p.harvest.apple);
  box(0.207, 0.31, 0, 0.045, 0.05, 0.07, p.duck.bill);
};

export const crate: Model = (box) => {
  box(0, 0.15, 0, 0.55, 0.3, 0.42, p.wood);
  for (const x of [-0.16, 0, 0.16])
    for (const z of [-0.09, 0.09]) box(x, 0.31, z, 0.13, 0.13, 0.13, p.harvest.apple);
};
export const hive: Model = (box) => {
  box(0, 0.12, 0, 0.45, 0.24, 0.45, p.wood);
  box(0, 0.42, 0, 0.5, 0.38, 0.5, p.cottage.plaster);
  box(0, 0.67, 0, 0.62, 0.12, 0.62, p.cottage.tile);
  box(0, 0.28, 0.27, 0.24, 0.06, 0.12, p.wood);
};
export const cart: Model = (box) => {
  for (const x of [-0.39, 0.39]) {
    box(x, 0.26, 0, 0.12, 0.5, 0.28, p.wood);
    box(x, 0.26, 0, 0.12, 0.28, 0.5, p.wood);
    box(x * 0.7, 0.31, 0.67, 0.09, 0.1, 1.15, p.wood);
  }
  box(0, 0.39, 0, 0.7, 0.14, 0.95, p.wood);
  for (const x of [-0.31, 0.31]) box(x, 0.57, 0, 0.08, 0.24, 0.95, p.wood);
  crate(at(box, 0, 0.46, -0.1));
};
export const stall: Model = (box) => {
  for (const x of [-0.875, 0.875]) for (const z of [-0.45, 0.45]) box(x, 0.7, z, 0.125, 1.4, 0.125, p.wood);
  box(0, 0.55, 0, 1.875, 0.125, 1, p.wood);
  for (let i = 0; i < 5; i++)
    box((i - 2) * 0.45, 1.44, 0, 0.45, 0.125, 1.25, i % 2 ? p.cottage.plaster : p.green.leaf);
  crate(at(box, -0.45, 0.6125, 0));
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
export const mill: Model = (box) => {
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
    occupied.some((p) => Math.hypot(x - p.x, z - p.z) < p.radius + margin);
  function place(draw: Model, tx: number, tz: number, radius: number, turn = false) {
    const site = findSite(
      Math.round(tx) - 3,
      Math.round(tx) + 3,
      Math.round(tz) - 3,
      Math.round(tz) + 3,
      1,
      (x, z) => {
        if (near(x, z, radius)) return Infinity;
        const h = elevation(x, z);
        for (const dx of [-radius, 0, radius])
          for (const dz of [-radius, 0, radius]) {
            if (h <= 0 || !free(x + dx, z + dz) || elevation(x + dx, z + dz) !== h) return Infinity;
          }
        return Math.hypot(x - tx, z - tz);
      },
    );
    if (!site) return;
    draw(at(box, site.x, elevation(site.x, site.z), site.z, turn));
    occupied.push({ ...site, radius });
  }
  return { place, near };
}
