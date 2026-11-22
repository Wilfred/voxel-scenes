import { treeVoxel } from "./scale";
import { defaultDesigns } from "./designs";
import { palette } from "./palette";
import type { Box } from "./voxels";

type Species = "pine" | "broadleaf";
// Each tier is width, height, depth in voxels, from the trunk to the crown.
// Saplings have their own profiles. Thin saplings grow into quite different crowns.
type Tier = [number, number, number];
type Profile = Tier[];
const profiles: Record<Species, [Profile, Profile][]> = {
  pine: [
    [[[1,1,1],[3,2,3],[5,2,5],[3,2,3]], [[1,1,1],[3,2,1],[1,1,1]]],
    [[[1,2,1],[3,1,3],[5,2,5],[3,1,3]], [[1,1,1],[3,1,3],[3,1,1]]],
    [[[1,1,1],[3,2,3],[3,3,3],[1,1,1]], [[1,1,1],[1,2,3],[1,1,1]]],
    [[[1,3,1],[3,1,1],[5,2,3],[3,1,3]], [[1,2,1],[3,1,1],[1,1,1]]],
    [[[1,2,1],[3,3,3],[3,2,1],[1,2,1]], [[1,1,1],[1,3,1],[1,1,1]]],
    [[[1,1,1],[3,1,3],[5,2,3],[3,1,1]], [[1,1,1],[3,2,1],[1,1,1]]],
    [[[1,1,1],[5,2,5],[3,3,3],[1,2,1]], [[1,1,1],[3,1,3],[1,2,1]]],
    [[[1,2,1],[3,2,5],[3,3,3],[1,1,3]], [[1,1,1],[1,2,3],[1,2,1]]],
    [[[1,1,1],[5,1,3],[5,2,5],[3,1,3]], [[1,1,1],[3,1,3],[3,1,3]]],
    [[[1,2,1],[5,1,5],[3,2,3],[3,2,1]], [[1,1,1],[3,2,3],[1,1,3]]],
  ],
  broadleaf: [
    [[[1,1,1],[3,1,3],[5,3,5],[3,1,3]], [[1,1,1],[3,2,3],[1,1,3]]],
    [[[1,1,1],[3,2,3],[5,2,3],[3,2,3]], [[1,1,1],[3,1,3],[3,1,1]]],
    [[[1,3,1],[3,2,1],[3,2,3],[1,1,3]], [[1,2,1],[1,2,3],[1,1,1]]],
    [[[1,1,1],[3,2,3],[3,3,5],[3,1,3]], [[1,1,1],[1,2,3],[3,1,3]]],
    [[[1,2,1],[3,2,3],[5,2,5],[3,2,3]], [[1,1,1],[3,2,3],[1,1,1]]],
    [[[1,2,1],[3,1,3],[3,3,3],[1,1,3]], [[1,2,1],[3,1,3],[1,1,1]]],
    [[[1,3,1],[3,1,3],[5,2,5],[5,1,5]], [[1,2,1],[3,1,1],[3,1,3]]],
    [[[1,2,1],[5,1,3],[5,3,5],[3,1,5]], [[1,1,1],[3,1,3],[1,2,3]]],
    [[[1,1,1],[3,1,3],[5,2,3],[3,1,5]], [[1,1,1],[3,1,1],[3,1,3]]],
    [[[1,1,1],[5,2,5],[5,2,3],[3,1,3]], [[1,1,1],[3,2,3],[3,1,1]]],
  ],
};

export function treePlanter(box: Box, voxel: number, designs = defaultDesigns, seed = 0) {
  type CrownBox = { x: number; y: number; z: number; width: number; height: number; depth: number };
  const stands = new Map<string, CrownBox[]>();
  const adultRoots = new Set<string>();
  return (x: number, ground: number, z: number, species: Species, sapling: boolean) => {
    const model = profiles[species][designs[species]][sapling ? 1 : 0];
    const gx = Math.round(x / voxel);
    const gy = Math.round(ground / voxel);
    const gz = Math.round(z / voxel);

    // A crown growing beside an established adult starts one voxel higher.
    // Bin roots into four-voxel patches to sample the immediate stand.
    const patchX = Math.floor(gx / 4);
    const patchZ = Math.floor(gz / 4);
    let crowded = false;
    if (!sapling) {
      for (let dz = -1; dz <= 1 && !crowded; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (adultRoots.has((patchX + dx) + "," + (patchZ + dz))) {
            crowded = true;
            break;
          }
        }
      }
    }
    const foliage = species === "pine"
      ? { trunk: palette.wood, leaf: palette.green.pine, tip: palette.green.pineTip }
      : { trunk: palette.wood, leaf: palette.green.leaf, tip: palette.green.leafTip };

    const twist = Math.imul(gx ^ seed, 73856093) ^ Math.imul(gz, 19349663);
    const quarterTurn = ((twist ^ (twist >>> 16)) & 1) === 1;
    let base = 0;
    const parts = model.map(([width, layers, depth], i) => {
      const part = i === 0 ? "trunk" : i === model.length - 1 ? "tip" : "leaf";
      const height = layers + (i === 0 && crowded ? 1 : 0);
      const bottom = base;
      base += height;
      return { width: quarterTurn ? depth : width, depth: quarterTurn ? width : depth, height, bottom, color: foliage[part] };
    });
    const boxes = parts.map(p => ({
      x: gx, y: gy + p.bottom + p.height / 2, z: gz, width: p.width, height: p.height, depth: p.depth,
    }));
    // The widest crowns span five voxels. Only roots in adjoining four-voxel
    // patches can intersect; check whole tiers instead of storing every leaf cell.
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const neighbors = stands.get((patchX + dx) + "," + (patchZ + dz));
        if (neighbors?.some(a => boxes.some(b =>
          2 * Math.abs(a.x - b.x) < a.width + b.width &&
          2 * Math.abs(a.y - b.y) < a.height + b.height &&
          2 * Math.abs(a.z - b.z) < a.depth + b.depth))) return;
      }
    }
    const key = patchX + "," + patchZ;
    const patch = stands.get(key);
    if (patch) patch.push(...boxes);
    else stands.set(key, boxes);
    if (!sapling) adultRoots.add(patchX + "," + patchZ);
    for (const part of parts) {
      const y = ground + (part.bottom + part.height / 2) * voxel;
      if (part.width === 5 && part.depth === 5) {
        // Clip one leaf voxel from each corner of the widest boughs.
        box(x, y, z, 5 * voxel, part.height * voxel, 3 * voxel, part.color);
        for (const side of [-2, 2]) {
          box(x, y, z + side * voxel, 3 * voxel, part.height * voxel, voxel, part.color);
        }
      } else {
        box(x, y, z, part.width * voxel, part.height * voxel, part.depth * voxel, part.color);
      }
    }
  };
}

export function treeStudy(box: Box, species: Species, index: number) {
  const plant = treePlanter(box, treeVoxel, { ...defaultDesigns, [species]: index });
  plant(-0.75, 0, 0, species, false);
  plant(1.5, 0, 0, species, true);
}
