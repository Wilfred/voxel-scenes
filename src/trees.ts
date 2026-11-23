import { treeVoxel } from "./scale";
import type { Designs } from "./designs";
import { palette } from "./palette";
import type { Box } from "./voxels";

type Species = "pine" | "broadleaf";
// Trees share the half-metre construction voxel with buildings. Each tier is
// width, height and depth in voxels, from the trunk up, centred on a trunk
// one voxel across. Odd widths keep every crown symmetric about its trunk.
// A one-voxel tier below the top is bare trunk; a one-voxel top is a leader.
// Saplings have their own profiles rather than scaled-down adults.
type Tier = [number, number, number];
type Profile = Tier[];
// prettier-ignore
const profiles: Record<Species, [Profile, Profile][]> = {
  pine: [
    // Woodland pine: a tiered cone on a short trunk.
    [[[1,3,1],[7,3,7],[5,3,5],[3,2,3],[1,2,1]], [[1,1,1],[5,1,5],[3,2,3],[1,2,1]]],
    // Stone pine: a flat umbrella high on a bare trunk.
    [[[1,6,1],[5,1,5],[9,2,9],[7,1,7]], [[1,3,1],[5,1,5],[3,1,3]]],
    // Ridge pine: slender, with alternating whorls of branches.
    [[[1,2,1],[5,2,5],[3,1,3],[5,2,5],[3,1,3],[3,2,3],[1,2,1]], [[1,1,1],[5,1,5],[3,2,3],[1,2,1]]],
    // Scots pine: a long bare trunk under a high, flattened crown.
    [[[1,5,1],[5,2,5],[7,2,7],[3,1,3]], [[1,3,1],[5,2,5],[3,1,3]]],
    // Black spruce: a narrow spire.
    [[[1,2,1],[5,2,5],[3,3,3],[3,2,3],[1,3,1]], [[1,1,1],[3,2,3],[3,2,3],[1,2,1]]],
    // Shore pine: low and wind-spread.
    [[[1,2,1],[7,2,5],[9,2,7],[5,1,3]], [[1,1,1],[5,2,3],[3,1,3]]],
    // Highland fir: a broad, even cone.
    [[[1,2,1],[9,2,9],[7,2,7],[5,2,5],[3,2,3],[1,2,1]], [[1,1,1],[5,2,5],[3,2,3],[1,1,1]]],
    // Silver fir: a tall, narrower cone.
    [[[1,2,1],[7,3,7],[5,3,5],[3,3,3],[1,2,1]], [[1,2,1],[5,2,5],[3,3,3],[1,1,1]]],
    // Cushion pine: a low dome.
    [[[1,2,1],[7,2,7],[9,2,9],[7,1,7]], [[1,1,1],[5,2,5],[3,1,3]]],
    // Cedar: flat layers spaced up the trunk.
    [[[1,2,1],[9,1,9],[1,1,1],[7,1,7],[1,1,1],[5,1,5],[3,1,3]], [[1,1,1],[5,1,5],[1,1,1],[3,1,3],[1,1,1]]],
  ],
  broadleaf: [
    // Woodland oak: a broad, rounded crown.
    [[[1,3,1],[7,2,7],[9,3,9],[7,2,7],[3,1,3]], [[1,2,1],[5,2,5],[3,1,3]]],
    // Field maple: a compact round head.
    [[[1,3,1],[5,2,5],[7,3,7],[5,2,5]], [[1,2,1],[3,1,3],[5,2,5],[3,1,3]]],
    // Birch: a tall pale trunk under a narrow oval crown.
    [[[1,5,1],[3,2,3],[5,4,5],[3,2,3]], [[1,3,1],[3,3,3],[1,1,1]]],
    // Hornbeam: a dense, upright egg on a short trunk.
    [[[1,2,1],[5,2,5],[7,4,7],[5,3,5],[3,1,3]], [[1,1,1],[3,2,3],[5,2,5],[3,1,3]]],
    // Linden: a tall dome narrowing upward.
    [[[1,3,1],[9,2,9],[7,3,7],[5,2,5],[3,1,3]], [[1,2,1],[5,2,5],[3,2,3]]],
    // Alder: a narrow cone of leaves.
    [[[1,3,1],[5,3,5],[3,3,3],[1,1,1]], [[1,2,1],[3,2,3],[3,1,3],[1,1,1]]],
    // Elm: a vase widening to a flat top.
    [[[1,4,1],[5,1,5],[7,2,7],[9,2,9]], [[1,3,1],[3,1,3],[5,1,5]]],
    // Beech: a great low dome.
    [[[1,2,1],[9,3,9],[9,2,9],[5,2,5]], [[1,1,1],[5,2,5],[5,1,5],[3,1,3]]],
    // Hazel: a low, rounded understorey shrub.
    [[[1,2,1],[5,1,5],[7,2,7],[5,1,5]], [[1,1,1],[5,2,5],[3,1,3]]],
    // Willow: a wide crown over a short trunk.
    [[[1,3,1],[9,3,9],[7,2,7],[3,1,3]], [[1,2,1],[5,2,5],[3,1,3]]],
  ],
};

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
  return (x: number, ground: number, z: number, species: Species, sapling: boolean) => {
    const model = profiles[species][designs[species]][sapling ? 1 : 0];
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
    const foliage =
      species === "pine"
        ? { trunk: palette.wood, leaf: palette.green.pine, tip: palette.green.pineTip }
        : { trunk: palette.wood, leaf: palette.green.leaf, tip: palette.green.leafTip };

    const twist = Math.imul(gx ^ seed, 73856093) ^ Math.imul(gz, 19349663);
    const quarterTurn = ((twist ^ (twist >>> 16)) & 1) === 1;
    let base = 0;
    const parts = model.map(([width, layers, depth], i) => {
      const top = i === model.length - 1;
      const part = i === 0 || (!top && width === 1 && depth === 1) ? "trunk" : top ? "tip" : "leaf";
      const height = layers + (i === 0 && crowded ? 2 : 0);
      const bottom = base;
      base += height;
      return {
        width: quarterTurn ? depth : width,
        depth: quarterTurn ? width : depth,
        height,
        bottom,
        color: foliage[part],
      };
    });
    const boxes = parts.map(p => ({
      x: gx,
      y: gy + p.bottom + p.height / 2,
      z: gz,
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
      tier(box, cx, ground + (part.bottom + part.height / 2) * voxel, cz, part, voxel);
    }
  };
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
  const plant = treePlanter(box, treeVoxel, { pine: 0, broadleaf: 0, cottage: 0, [species]: index });
  plant(-0.75, 0, 0, species, false);
  plant(1.5, 0, 0, species, true);
}
