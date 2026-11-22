import type { Box } from "./voxels";

type TreeBox = {
  width: number;
  height: number;
  depth: number;
  part: "trunk" | "leaf" | "tip";
};

// Dimensions count whole voxels. Odd widths keep each box centered on the trunk.
const trees: Record<"pine" | "broadleaf", { adult: TreeBox[]; sapling: TreeBox[] }> = {
  pine: {
    adult: [
      { width: 1, height: 2, depth: 1, part: "trunk" },
      { width: 3, height: 1, depth: 3, part: "leaf" },
      { width: 5, height: 3, depth: 3, part: "leaf" },
      { width: 3, height: 2, depth: 3, part: "tip" },
    ],
    sapling: [
      { width: 1, height: 1, depth: 1, part: "trunk" },
      { width: 3, height: 1, depth: 1, part: "leaf" },
      { width: 1, height: 2, depth: 1, part: "tip" },
    ],
  },
  broadleaf: {
    adult: [
      { width: 1, height: 2, depth: 1, part: "trunk" },
      { width: 3, height: 1, depth: 5, part: "leaf" },
      { width: 5, height: 2, depth: 5, part: "leaf" },
      { width: 5, height: 1, depth: 3, part: "tip" },
    ],
    sapling: [
      { width: 1, height: 2, depth: 1, part: "trunk" },
      { width: 3, height: 1, depth: 1, part: "leaf" },
      { width: 1, height: 1, depth: 3, part: "tip" },
    ],
  },
};

export function treePlanter(box: Box, voxel: number) {
  const occupied = new Set<string>();
  const adultRoots = new Set<string>();
  return (x: number, ground: number, z: number, species: keyof typeof trees, sapling: boolean) => {
    const model = trees[species][sapling ? "sapling" : "adult"];
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
    const palette = species === "pine"
      ? { trunk: 0x635440, leaf: 0x416950, tip: 0x547b5b }
      : { trunk: 0x635440, leaf: 0x52774f, tip: 0x658861 };
    const keys: string[] = [];
    let base = 0;
    const parts = model.map(part => {
      const height = part.height + (part.part === "trunk" && crowded ? 1 : 0);
      const bottom = base;
      base += height;
      return { ...part, height, bottom };
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
        part.width * voxel, part.height * voxel, part.depth * voxel, palette[part.part]);
    }
  };
}
