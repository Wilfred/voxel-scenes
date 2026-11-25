import { treeVoxel } from "./scale";
import { designsFor, type Designs } from "./designs";
import { palette } from "./palette";
import type { Box } from "./voxels";

export type Species = "pine" | "broadleaf" | "palm" | "tropical" | "shrub";
// Trees share the half-metre construction voxel with buildings. Each tier is
// width, height and depth in voxels, from the trunk up, centred on a trunk
// one voxel across. Odd widths keep every crown symmetric about its trunk.
// A one-voxel tier below the top is bare trunk; a one-voxel top is a leader.
// Saplings have their own profiles rather than scaled-down adults.
type Tier = [number, number, number];
type Profile = Tier[];
// prettier-ignore
const profiles: Record<"pine" | "broadleaf", [Profile, Profile][]> = {
  pine: [
    // Scots pine: a long bare trunk under a high, flattened crown.
    [[[1,5,1],[5,2,5],[7,2,7],[3,1,3]], [[1,3,1],[5,2,5],[3,1,3]]],
    // Black spruce: a narrow spire.
    [[[1,2,1],[5,2,5],[3,3,3],[3,2,3],[1,3,1]], [[1,1,1],[3,2,3],[3,2,3],[1,2,1]]],
    // Highland fir: a broad, even cone.
    [[[1,2,1],[9,2,9],[7,2,7],[5,2,5],[3,2,3],[1,2,1]], [[1,1,1],[5,2,5],[3,2,3],[1,1,1]]],
    // Cedar: flat layers spaced up the trunk.
    [[[1,2,1],[9,1,9],[1,1,1],[7,1,7],[1,1,1],[5,1,5],[3,1,3]], [[1,1,1],[5,1,5],[1,1,1],[3,1,3],[1,1,1]]],
  ],
  broadleaf: [
    // Woodland oak: a broad, rounded crown.
    [[[1,3,1],[7,2,7],[9,3,9],[7,2,7],[3,1,3]], [[1,2,1],[5,2,5],[3,1,3]]],
    // Birch: a tall pale trunk under a narrow oval crown.
    [[[1,5,1],[3,2,3],[5,4,5],[3,2,3]], [[1,3,1],[3,3,3],[1,1,1]]],
    // Hornbeam: a dense, upright egg on a short trunk.
    [[[1,2,1],[5,2,5],[7,4,7],[5,3,5],[3,1,3]], [[1,1,1],[3,2,3],[5,2,5],[3,1,3]]],
    // Alder: a narrow cone of leaves.
    [[[1,3,1],[5,3,5],[3,3,3],[1,1,1]], [[1,2,1],[3,2,3],[3,1,3],[1,1,1]]],
  ],
};

// A part of a free-form tree, in voxels: the centre offset from the trunk
// and ground, its size, and whether to round its corners like a crown tier.
type Part = {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  part: "trunk" | "leaf" | "tip" | "fruit";
  round?: boolean;
};

// Palm fronds spring from the crown and droop toward their tips. Each step
// is one voxel out from the crown; `fall` lists the drop at each step.
function frond(parts: Part[], top: [number, number], y: number, dx: number, dz: number, fall: number[]) {
  fall.forEach((drop, i) => {
    const step = i + 2;
    // Extend each voxel down to the next one's top, so the leaf stays joined
    // face to face where it bends.
    const bottom = y - Math.max(drop, fall[i + 1] ?? drop);
    const upper = y + 1 - drop;
    const cell = { y: (upper + bottom) / 2, width: 1, height: upper - bottom, depth: 1 };
    const part = i === fall.length - 1 ? "tip" : "leaf";
    parts.push({ x: top[0] + dx * step, z: top[1] + dz * step, ...cell, part });
    // Diagonal fronds fill the inside corner of each step so they read as
    // one leaf rather than a dotted line.
    if (dx && dz) parts.push({ x: top[0] + dx * step, z: top[1] + dz * (step - 1), ...cell, part: "leaf" });
  });
}

// A trunk of one voxel, stepping sideways at each listed height to lean.
function palmTrunk(parts: Part[], height: number, lean: number[]): [number, number] {
  let x = 0,
    bottom = 0;
  for (const bend of [...lean, height]) {
    parts.push({ x, y: (bottom + bend) / 2, z: 0, width: 1, height: bend - bottom, depth: 1, part: "trunk" });
    // Overlap each bend by one voxel so the leaning trunk stays joined.
    bottom = bend - 1;
    if (bend < height) x++;
  }
  return [x, 0];
}

const cardinal = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const diagonal = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function palmCrown(parts: Part[], top: [number, number], y: number, long: number[], short: number[], nuts: boolean) {
  parts.push({ x: top[0], y: y + 0.5, z: top[1], width: 3, height: 1, depth: 3, part: "leaf" });
  parts.push({ x: top[0], y: y + 1.5, z: top[1], width: 1, height: 1, depth: 1, part: "tip" });
  for (const [dx, dz] of cardinal) frond(parts, top, y, dx, dz, long);
  for (const [dx, dz] of diagonal) frond(parts, top, y, dx, dz, short);
  if (nuts)
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [-1, 0],
    ])
      parts.push({ x: top[0] + dx, y: y - 0.5, z: top[1] + dz, width: 1, height: 1, depth: 1, part: "fruit" });
}

// Banana leaves are long paddles two voxels wide that arch out and down.
function bananaLeaves(parts: Part[], y: number, length: number) {
  for (const [dx, dz] of cardinal) {
    for (let i = 1; i <= length; i++) {
      const drop = i <= 1 ? -1 : i - 2;
      const along = i + 0.5;
      // Offset each paddle to one side of its rib, so the leaves turn like a pinwheel.
      parts.push({
        x: dx * along - dz * 0.5,
        y: y - drop + 0.5,
        z: dz * along + dx * 0.5,
        width: dx ? 1 : 2,
        height: 1,
        depth: dz ? 1 : 2,
        part: i === length ? "tip" : "leaf",
      });
    }
  }
}

type Builder = (sapling: boolean) => Part[];
// prettier-ignore
const freeForms: Record<"palm" | "tropical" | "shrub", (Builder | [Profile, Profile])[]> = {
  palm: [
    // Coconut palm: a tall, leaning trunk under drooping fronds and nuts.
    sapling => {
      const parts: Part[] = [];
      const top = palmTrunk(parts, sapling ? 4 : 13, sapling ? [] : [5, 10]);
      palmCrown(parts, top, sapling ? 4 : 13, sapling ? [0, 1] : [0, 0, 1, 2], sapling ? [1] : [0, 1, 2], !sapling);
      return parts;
    },
    // Royal palm: a straight trunk, a green crownshaft and arching fronds.
    sapling => {
      const parts: Part[] = [];
      const height = sapling ? 4 : 12;
      palmTrunk(parts, height, []);
      if (!sapling) parts.push({ x: 0, y: height + 1, z: 0, width: 1, height: 2, depth: 1, part: "leaf" });
      palmCrown(parts, [0, 0], sapling ? height : height + 2, sapling ? [0, 1] : [-1, 0, 1, 2, 3], sapling ? [1] : [0, 1, 2], false);
      return parts;
    },
    // Fan palm: a short, stout trunk with a full, upright head.
    sapling => {
      const parts: Part[] = [];
      const height = sapling ? 2 : 6;
      parts.push({ x: 0, y: height / 2, z: 0, width: 1, height, depth: 1, part: "trunk" });
      parts.push({ x: 0, y: height + 1, z: 0, width: 3, height: 2, depth: 3, part: "leaf" });
      for (const [dx, dz] of [...cardinal, ...diagonal])
        frond(parts, [0, 0], height + 2, dx, dz, sapling ? [-1] : [-2, -1, 0]);
      parts.push({ x: 0, y: height + 2.5, z: 0, width: 1, height: 1, depth: 1, part: "tip" });
      return parts;
    },
  ],
  tropical: [
    // Sea almond: flat, widely spaced tiers like a pagoda.
    [[[1,4,1],[9,1,9],[1,1,1],[7,1,7],[1,1,1],[5,1,5],[3,1,3]], [[1,2,1],[5,1,5],[1,1,1],[3,1,3]]],
    // Banana plant: a short stem below broad, arching paddle leaves.
    sapling => {
      const parts: Part[] = [];
      const height = sapling ? 2 : 4;
      parts.push({ x: 0, y: height / 2, z: 0, width: 1, height, depth: 1, part: "leaf" });
      parts.push({ x: 0, y: height + 1, z: 0, width: 1, height: 2, depth: 1, part: "tip" });
      bananaLeaves(parts, height, sapling ? 2 : 4);
      if (!sapling) parts.push({ x: 1, y: height - 1, z: 0, width: 1, height: 2, depth: 1, part: "fruit" });
      return parts;
    },
    // Breadfruit: a dense, glossy dome hung with round green fruit.
    sapling => {
      const tiers: Tier[] = sapling ? [[1,2,1],[5,2,5],[3,1,3]] : [[1,3,1],[7,1,7],[9,3,9],[7,1,7],[3,1,3]];
      const parts = stack(tiers, false);
      if (!sapling) for (const [x, y, z] of [[5,5.5,1],[-1,6.5,5],[-5,4.5,-2],[2,5.5,-5]]) parts.push({ x, y, z, width: 1, height: 1, depth: 1, part: "fruit" });
      return parts;
    },
  ],
  // Shrubs grow straight from the ground, without a trunk of their own.
  shrub: [
    // Hazel: a full, rounded crown on a few short stems.
    sapling => {
      const tiers: Tier[] = sapling ? [[3,1,3],[5,1,5],[3,1,3]] : [[5,1,5],[7,2,7],[5,1,5]];
      const crown = stack(tiers, false).map(p => ({ ...p, y: p.y + 1, part: p.part === "trunk" ? "leaf" as const : p.part }));
      const stems: Part[] = [[-1,0],[1,-1],[0,1]].map(([x, z]) => ({ x, y: 0.5, z, width: 1, height: 1, depth: 1, part: "trunk" }));
      return [...stems, ...crown];
    },
    // Gorse: a dark, dense dome of columns, the top of a few in flower.
    sapling => {
      const parts: Part[] = [];
      const reach = sapling ? 1 : 2;
      const flowers = sapling ? [] : ["-1,1", "1,-1", "2,0", "-2,-1", "0,2", "0,0"];
      for (let x = -reach; x <= reach; x++)
        for (let z = -reach; z <= reach; z++) {
          if (Math.abs(x) === reach && Math.abs(z) === reach) continue;
          const height = Math.abs(x) < reach && Math.abs(z) < reach ? reach + 1 : reach;
          const bloom = flowers.includes(x + "," + z);
          const leaves = bloom ? height - 1 : height;
          if (leaves > 0) parts.push({ x, y: leaves / 2, z, width: 1, height: leaves, depth: 1, part: "leaf" });
          if (bloom) parts.push({ x, y: height - 0.5, z, width: 1, height: 1, depth: 1, part: "fruit" });
        }
      return parts;
    },
    // Bramble: a low, spreading thicket.
    sapling => {
      const tiers: Tier[] = sapling ? [[5,1,3],[3,1,1]] : [[7,1,5],[5,1,3]];
      return stack(tiers, false).map(p => ({ ...p, part: p.part === "trunk" ? "leaf" as const : p.part }));
    },
  ],
};

// Shrub designs, in designNames order.
const [hazel, gorse, bramble] = [0, 1, 2];

// Shrubs fill the ground the trees leave, by role: hazel in the woods,
// bramble along their edges, and gorse scattered on open ground. `cover` is
// the smooth woodland field that standDensity reads, and `chance` a draw
// from the scene's sequence. Returns the design to plant, if any.
export function shrubFor(cover: number, chance: number) {
  if (cover > 0.3) return chance < 0.04 ? hazel : undefined;
  if (cover > -0.05) return chance < 0.05 ? bramble : undefined;
  return chance < 0.004 ? gorse : undefined;
}

// Tropical designs, in designNames order.
const [seaAlmond, banana, breadfruit] = [0, 1, 2];

// Plant tropical trees by role: bananas in the cottage garden, sea almonds
// in patches behind the beach and breadfruit on higher ground, all among
// palms, which also line the beach. `home` is the distance to the cottage.
export function tropicalGrove(relief: (x: number, z: number) => number) {
  return (x: number, z: number, h: number, home: number): { species: Species; design?: number } => {
    if (home < 7 && h >= 1) return { species: "tropical", design: banana };
    const patch = relief(x + 61, z - 13);
    if (h < 1 || (h < 2.5 && patch < 0.2)) return { species: "palm" };
    if (h < 2.5) return { species: "tropical", design: seaAlmond };
    return patch < -0.2 ? { species: "palm" } : { species: "tropical", design: breadfruit };
  };
}

// Woodland grows in stands separated by open meadows, with the odd lone
// tree between them. `cover` is a smooth field, roughly -1 to 1, and the
// result is the chance of planting in one terrain cell.
export function standDensity(cover: number) {
  const edge = 0.08;
  return cover < edge ? 0.003 : Math.min(0.5, 0.05 + 0.9 * (cover - edge));
}

export function treePlanter(box: Box, voxel: number, designs: Designs, seed = 0) {
  type CrownBox = { x: number; y: number; z: number; width: number; height: number; depth: number };
  const stands = new Map<string, CrownBox[]>();
  const adultRoots = new Set<string>();
  const patchSize = 8;
  // Pines, broadleaves and palms take the seed's design unless the caller
  // names one. Tropical trees and shrubs fill different roles, so callers
  // always name them.
  return (x: number, ground: number, z: number, species: Species, sapling: boolean, design?: number) => {
    // Centre the trunk on a construction voxel so every tier edge lies on the grid.
    const gx = Math.floor(x / voxel);
    const gy = Math.round(ground / voxel);
    const gz = Math.floor(z / voxel);
    const cx = (gx + 0.5) * voxel;
    const cz = (gz + 0.5) * voxel;

    // A crown growing beside an established adult starts a metre higher.
    // Bin roots into patches as wide as the widest crown to sample the stand.
    const patchX = Math.floor(gx / patchSize);
    const patchZ = Math.floor(gz / patchSize);
    let crowded = false;
    if (!sapling) {
      for (let dz = -1; dz <= 1 && !crowded; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (adultRoots.has(patchX + dx + "," + (patchZ + dz))) {
            crowded = true;
            break;
          }
        }
      }
    }
    const index = design ?? (species === "tropical" || species === "shrub" ? 0 : designs[species]);
    // Gorse takes the darker pine greens, flecked with the banana's yellow.
    const foliage =
      species === "shrub" && index === gorse ? { ...colours.pine, fruit: palette.harvest.banana } : colours[species];
    const twist = Math.imul(gx ^ seed, 73856093) ^ Math.imul(gz, 19349663);
    const turn = (twist ^ (twist >>> 16)) & 3;
    const parts = treeParts(species, index, sapling, crowded).map(p => {
      // Turn the model a whole number of quarter turns about its trunk.
      let { x, z, width, depth } = p;
      for (let i = 0; i < turn; i++) [x, z, width, depth] = [z, -x, depth, width];
      return { ...p, x, z, width, depth, color: foliage[p.part] };
    });
    const boxes = parts.map(p => ({
      x: gx + p.x,
      y: gy + p.y,
      z: gz + p.z,
      width: p.width,
      height: p.height,
      depth: p.depth,
    }));
    // Only roots in adjoining patches can intersect; check whole tiers
    // instead of storing every leaf cell.
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const neighbors = stands.get(patchX + dx + "," + (patchZ + dz));
        if (
          neighbors?.some(a =>
            boxes.some(
              b =>
                2 * Math.abs(a.x - b.x) < a.width + b.width &&
                2 * Math.abs(a.y - b.y) < a.height + b.height &&
                2 * Math.abs(a.z - b.z) < a.depth + b.depth,
            ),
          )
        )
          return;
      }
    }
    const key = patchX + "," + patchZ;
    const patch = stands.get(key);
    if (patch) patch.push(...boxes);
    else stands.set(key, boxes);
    if (!sapling) adultRoots.add(patchX + "," + patchZ);
    for (const part of parts) {
      const at = [cx + part.x * voxel, ground + part.y * voxel, cz + part.z * voxel] as const;
      if (part.round) tier(box, ...at, part, voxel);
      else box(...at, part.width * voxel, part.height * voxel, part.depth * voxel, part.color);
    }
  };
}

const colours: Record<Species, Record<Part["part"], number>> = {
  pine: { trunk: palette.wood, leaf: palette.green.pine, tip: palette.green.pineTip, fruit: palette.wood },
  broadleaf: { trunk: palette.wood, leaf: palette.green.leaf, tip: palette.green.leafTip, fruit: palette.wood },
  palm: { trunk: palette.wood, leaf: palette.green.palm, tip: palette.green.palmTip, fruit: palette.harvest.coconut },
  tropical: {
    trunk: palette.wood,
    leaf: palette.green.tropical,
    tip: palette.green.tropicalTip,
    fruit: palette.harvest.banana,
  },
  // Shrubs share the broadleaves' greens; gorse is darker, below.
  shrub: { trunk: palette.wood, leaf: palette.green.leaf, tip: palette.green.leafTip, fruit: palette.harvest.banana },
};

// Stack a profile's tiers from the ground, or draw a free-form model.
function treeParts(species: Species, index: number, sapling: boolean, crowded: boolean): Part[] {
  const design = species === "pine" || species === "broadleaf" ? profiles[species][index] : freeForms[species][index];
  if (typeof design === "function") return design(sapling);
  return stack(design[sapling ? 1 : 0], crowded);
}

function stack(model: Profile, crowded: boolean): Part[] {
  let base = 0;
  return model.map(([width, layers, depth], i) => {
    const top = i === model.length - 1;
    const part = i === 0 || (!top && width === 1 && depth === 1) ? "trunk" : top ? "tip" : "leaf";
    const height = layers + (i === 0 && crowded ? 2 : 0);
    const bottom = base;
    base += height;
    return { x: 0, y: bottom + height / 2, z: 0, width, height, depth, part, round: true };
  });
}

// Round the corners of wide tiers in whole voxels: one step from five
// voxels across, two from nine. Rows never overlap.
function tier(
  box: Box,
  x: number,
  y: number,
  z: number,
  part: { width: number; height: number; depth: number; color: number },
  voxel: number,
) {
  const { width, height, depth, color } = part;
  const steps = Math.min(width, depth) >= 9 ? 2 : Math.min(width, depth) >= 5 ? 1 : 0;
  const core = depth - 2 * steps;
  box(x, y, z, width * voxel, height * voxel, core * voxel, color);
  for (let step = 1; step <= steps; step++) {
    for (const side of [-1, 1]) {
      const offset = (core / 2 + step - 0.5) * side;
      box(x, y, z + offset * voxel, (width - 2 * step) * voxel, height * voxel, voxel, color);
    }
  }
}

export function treeStudy(box: Box, species: Species, index: number) {
  const plant = treePlanter(box, treeVoxel, designsFor(0));
  plant(-0.75, 0, 0, species, false, index);
  plant(species === "palm" ? 2.75 : 1.5, 0, 0, species, true, index);
}
