import { casement, masonryCourses, pitchedRoof } from "./building";
import { palette as p } from "./palette";
import { weightedSite, findSite, type Elevation } from "./sites";
import type { Box } from "./voxels";

type Model = (box: Box) => void;
// Place a model at a point, turned by `turn` quarter turns (or one for true).
// Each quarter turn takes the model's +x facing to -z.
export function at(box: Box, x: number, y: number, z: number, turn: boolean | number = false): Box {
  const quarter = turn === true ? 1 : turn === false ? 0 : ((turn % 4) + 4) % 4;
  return (a, b, c, w, h, d, color, yaw = 0) => {
    const [px, pz] = [
      [a, c],
      [c, -a],
      [-a, -c],
      [-c, a],
    ][quarter];
    box(x + px, y + b, z + pz, w, h, d, color, yaw + (quarter * Math.PI) / 2);
  };
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

// Farm and woodland animals face +x. Smaller animals are drawn larger than
// life, keeping their order of size, so the shapes that identify them read
// from the wallpaper camera. The sheep uses cells two fifths larger than
// eighth-metre ones.
export const sheep: Model = box => {
  const cell = lattice(box, 7 / 80);
  for (const x of [-3.5, 2.5]) for (const z of [-1, 1]) cell(x - 0.5, 0, z - 0.5, x + 0.5, 2, z + 0.5, p.animal.dark);
  cell(-5, 2, -2.5, 4, 7, 2.5, p.animal.fleece);
  cell(4, 3, -1.5, 7, 6, 1.5, p.animal.dark);
  for (const z of [-2, 2]) cell(4, 5, z - 0.5, 5, 6, z + 0.5, p.animal.dark);
};
// A belted cow at life size on eighth-metre cells: a dark body with a white
// band round its middle, which reads across a field.
export const cow: Model = box => {
  const cell = lattice(box, 1 / 16);
  for (const x of [-7, 5]) for (const z of [-2, 2]) cell(x - 1, 0, z - 1, x + 1, 5, z + 1, p.animal.hide);
  cell(-9, 5, -3, -3, 11, 3, p.animal.hide);
  cell(-3, 5, -3, 1, 11, 3, p.animal.fleece);
  cell(1, 5, -3, 7, 11, 3, p.animal.hide);
  cell(7, 7, -1.5, 11, 11, 1.5, p.animal.hide);
  cell(11, 7, -1.5, 12, 9, 1.5, p.animal.muzzle);
  for (const z of [-1, 1]) cell(8, 11, z * 2 - 0.5, 9, 12, z * 2 + 0.5, p.animal.hide);
  cell(-10, 6, -0.5, -9, 10, 0.5, p.animal.hide);
};
// A bay horse a little larger than life on eighth-metre cells, like the cow,
// in the proportions of a well-made horse: square, as tall at the withers as
// it is long from shoulder to buttock, with legs as long as the chest is deep
// and a level back. The neck runs up and forward at about 45 degrees under a
// dark mane, half as long again as the head, which angles down to a dark
// muzzle. It has dark lower legs, upright ears and a hanging tail.
export const horse: Model = box => {
  const cell = lattice(box, 1 / 16);
  // Each leg tapers from a bay forearm or thigh to a slim lower leg with a
  // dark hoof.
  for (const x of [-6, 4])
    for (const z of [-2, 1]) {
      cell(x, 0, z, x + 1, 2, z + 1, p.animal.hide);
      cell(x, 2, z, x + 1, 5, z + 1, p.animal.bay);
      cell(x, 5, z, x + 2, 7, z + 1, p.animal.bay);
    }
  cell(-7, 7, -2, 6, 13, 2, p.animal.bay);
  // The neck climbs in even steps, its crest carrying the mane.
  cell(3, 13, -1, 8, 15, 1, p.animal.bay);
  cell(5, 15, -1, 9, 17, 1, p.animal.bay);
  cell(6, 17, -1, 9, 19, 1, p.animal.bay);
  cell(2, 13, -0.5, 3, 15, 0.5, p.animal.hide);
  cell(4, 15, -0.5, 5, 17, 0.5, p.animal.hide);
  cell(5, 17, -0.5, 6, 19, 0.5, p.animal.hide);
  cell(6, 19, -0.5, 7, 21, 0.5, p.animal.hide);
  // The head runs down and forward at 45 degrees from the poll to a dark
  // nose, clear of the neck beneath the jaw.
  cell(7, 19, -0.75, 10, 21, 0.75, p.animal.bay);
  cell(9, 17, -0.75, 12, 19, 0.75, p.animal.bay);
  cell(11, 15, -0.75, 13, 17, 0.75, p.animal.bay);
  cell(13, 15, -0.75, 14, 17, 0.75, p.animal.hide);
  for (const z of [-0.75, 0.25]) cell(7, 21, z, 8, 23, z + 0.5, p.animal.bay);
  cell(-8, 7, -0.5, -7, 12, 0.5, p.animal.hide);
};
// A red deer stag a little larger than life, keeping its order of size above
// the sheep. Its body is built on the half-course, a quarter metre, so its
// blocks stay chunky at the wallpaper camera. Its legs are half a block
// wide, at the outer edges of the body, so each pair stands apart as the
// sheep's and cow's do. It has plain fur with no more than a stub of a tail,
// and branching antlers on eighth-metre cells, like the cow's head.
export const deer: Model = box => {
  const cell = lattice(box, 1 / 8);
  for (const x of [-2, 1]) for (const z of [-1, 0.5]) cell(x, 0, z, x + 1, 3, z + 0.5, p.animal.dark);
  cell(-3, 3, -1, 2, 5, 1, p.animal.fur);
  cell(1, 5, -1, 2, 7, 1, p.animal.fur);
  cell(1, 7, -1, 3, 8, 1, p.animal.fur);
  // Each beam rises from the crown of the head and sweeps back and out, with
  // a brow tine and a middle tine reaching forward and a forked crown.
  const fine = lattice(box, 1 / 16);
  for (const side of [-1, 1]) {
    const tine = (x0: number, y0: number, x1: number, y1: number, z0: number, z1: number) =>
      side > 0 ? fine(x0, y0, z0, x1, y1, z1, p.animal.dark) : fine(x0, y0, -z1, x1, y1, -z0, p.animal.dark);
    tine(2, 16, 3, 18, 1, 2);
    tine(1, 18, 2, 21, 2, 3);
    tine(0, 21, 1, 23, 3, 4);
    tine(3, 17, 5, 18, 1, 2);
    tine(2, 20, 4, 21, 2, 3);
    tine(1, 23, 2, 25, 3, 4);
    tine(-1, 23, 0, 25, 3, 4);
  }
};
// A slatted creel about 60 centimetres long with a rope handle, on
// sixteenth-metre cells.
export const creel: Model = box => {
  const cell = lattice(box, 1 / 32);
  cell(-5, 0, -3.5, 5, 1, 3.5, p.wood);
  for (const x of [-4.5, 4.5]) cell(x - 0.5, 1, -3.5, x + 0.5, 5, 3.5, p.wood);
  for (const z of [-3, 3]) cell(-4, 1, z - 0.5, 4, 5, z + 0.5, p.wood);
  cell(-0.5, 5, -3.5, 0.5, 6, 3.5, p.cloth.canvas);
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
};
export const stall: Model = box => {
  for (const x of [-0.875, 0.875]) for (const z of [-0.4375, 0.4375]) box(x, 0.6875, z, 0.125, 1.375, 0.125, p.wood);
  box(0, 0.5625, 0, 1.875, 0.125, 1, p.wood);
  // Five stripes of the awning rest on the posts, flush with their outer faces.
  for (let i = 0; i < 5; i++)
    box((i - 2) * 0.375, 1.4375, 0, 0.375, 0.125, 1.25, i % 2 ? p.cloth.canvas : p.cloth.dyed);
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
  { name: "Red deer", draw: deer },
  { name: "Grazing sheep", draw: sheep },
  { name: "Belted cow", draw: cow },
  { name: "Bay horse", draw: horse },
];
export const village = [
  { name: "Fishing creel", draw: creel },
  { name: "Orchard mill", draw: mill },
  { name: "Apple tree", draw: appleTree },
  { name: "Handcart", draw: cart },
  { name: "Produce stall", draw: stall },
];

// Reserve a dry, level footprint near the activity the prop belongs to.
export function villageYard(box: Box, elevation: Elevation, free: (x: number, z: number) => boolean) {
  const occupied: { x: number; z: number; radius: number }[] = [];
  const near = (x: number, z: number, margin = 0) =>
    occupied.some(p => Math.hypot(x - p.x, z - p.z) < p.radius + margin);
  function place(
    draw: Model,
    tx: number,
    tz: number,
    radius: number,
    turn: boolean | number = false,
    wildlife?: { random: () => number; habitat?: Elevation },
  ) {
    function eligible(x: number, z: number) {
      if (near(x, z, radius)) return false;
      const h = elevation(x, z);
      for (const dx of [-radius, 0, radius])
        for (const dz of [-radius, 0, radius])
          if (h <= 0 || !free(x + dx, z + dz) || elevation(x + dx, z + dz) !== h) return false;
      return true;
    }
    const x = Math.round(tx),
      z = Math.round(tz);
    const site = wildlife
      ? weightedSite(
          x - 5,
          x + 5,
          z - 5,
          z + 5,
          1,
          (cx, cz) =>
            eligible(cx, cz) ? (wildlife.habitat?.(cx, cz) ?? 1) / (1 + ((cx - tx) ** 2 + (cz - tz) ** 2) / 6) : 0,
          wildlife.random,
        )
      : findSite(x - 3, x + 3, z - 3, z + 3, 1, (cx, cz) =>
          eligible(cx, cz) ? Math.hypot(cx - tx, cz - tz) : Infinity,
        );
    if (!site) return false;
    draw(at(box, site.x, elevation(site.x, site.z), site.z, turn));
    occupied.push({ ...site, radius });
    return true;
  }
  return { place, near };
}
