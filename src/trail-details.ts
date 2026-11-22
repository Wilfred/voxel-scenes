import { palette } from "./palette";
import type { Box } from "./voxels";

export function firewood(box: Box, x: number, h: number, z: number) {
  for (const offset of [-0.25, 0.25]) {
    box(x, h + 0.25, z + offset, 1.75, 0.5, 0.5, palette.wood);
  }
  box(x - 0.125, h + 0.625, z, 1.5, 0.25, 0.5, palette.wood);
}

export function waypost(box: Box, x: number, h: number, z: number) {
  box(x, h + 0.75, z, 0.25, 1.5, 0.25, palette.wood);
  box(x, h + 1.5, z + 0.125, 1.5, 0.5, 0.25, palette.wood);
}
