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
    [[[1,2,1],[3,1,3],[5,3,3],[3,2,3]], [[1,1,1],[3,1,1],[1,2,1]]],
    [[[1,3,1],[3,1,3],[5,2,5],[3,1,5]], [[1,1,1],[3,1,3],[3,1,1]]],
    [[[1,1,1],[3,2,3],[3,3,3],[1,2,1]], [[1,1,1],[1,2,3],[1,1,1]]],
    [[[1,3,1],[3,1,1],[5,2,3],[3,1,3]], [[1,2,1],[3,1,1],[1,1,1]]],
    [[[1,2,1],[3,3,3],[3,2,1],[1,2,1]], [[1,1,1],[1,3,1],[1,1,1]]],
    [[[1,1,1],[3,1,3],[5,2,3],[3,1,1]], [[1,1,1],[3,2,1],[1,1,1]]],
    [[[1,1,1],[5,2,5],[3,3,3],[1,2,1]], [[1,1,1],[3,1,3],[1,2,1]]],
    [[[1,2,1],[3,2,5],[3,3,3],[1,1,3]], [[1,1,1],[1,2,3],[1,2,1]]],
    [[[1,1,1],[5,1,3],[5,2,5],[3,1,3]], [[1,1,1],[3,1,3],[3,1,3]]],
    [[[1,2,1],[5,1,5],[3,2,3],[3,2,1]], [[1,1,1],[3,2,3],[1,1,3]]],
  ],
  broadleaf: [
    [[[1,2,1],[3,1,5],[5,2,5],[5,1,3]], [[1,2,1],[3,1,1],[1,1,3]]],
    [[[1,2,1],[3,1,3],[5,2,3],[3,1,3]], [[1,1,1],[3,1,3],[3,1,1]]],
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

export function treePlanter(box: Box, voxel: number, designs = defaultDesigns) {
  const occupied = new Set<string>();
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
    const keys: string[] = [];
    let base = 0;
    const parts = model.map(([width, layers, depth], i) => {
      const part = i === 0 ? "trunk" : i === model.length - 1 ? "tip" : "leaf";
      const height = layers + (i === 0 && crowded ? 1 : 0);
      const bottom = base;
      base += height;
      return { width, depth, height, bottom, color: foliage[part] };
    });
    for (const part of parts) {
      const rx = (part.width - 1) / 2;
      const rz = (part.depth - 1) / 2;
      for (let dy = 0; dy < part.height; dy++) {
        for (let dz = -rz; dz <= rz; dz++) {
          for (let dx = -rx; dx <= rx; dx++) {
            const key = (gx + dx) + "," + (gy + part.bottom + dy) + "," + (gz + dz);
            if (occupied.has(key)) return;
            keys.push(key);
          }
        }
      }
    }
    for (const key of keys) occupied.add(key);
    if (!sapling) adultRoots.add(patchX + "," + patchZ);
    for (const part of parts) {
      const y = ground + (part.bottom + part.height / 2) * voxel;
      box(x, y, z,
        part.width * voxel, part.height * voxel, part.depth * voxel, part.color);
    }
  };
}
