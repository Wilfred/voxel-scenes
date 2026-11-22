import models from "./assets/tiny-nature.json";
import type { Box } from "./voxels";

export type NatureProp = keyof typeof models;

export function addNatureProp(box: Box, prop: NatureProp, x: number, ground: number, z: number) {
  // Source boxes use MagicaVoxel's Z-up axes. Eight source voxels span one terrain tile.
  const unit = 1 / 8;
  const radius = prop === "treeStump" ? 4 : 7;
  for (const [left, back, bottom, width, depth, height, color] of models[prop]) {
    box(x + (left + width / 2 - radius) * unit, ground + (bottom + height / 2) * unit,
      z - (back + depth / 2 - radius) * unit, width * unit, height * unit, depth * unit, color);
  }
}
