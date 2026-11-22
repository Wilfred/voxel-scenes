import { palette } from "./palette";
import type { Box } from "./voxels";

export function addDuck(box: Box, x: number, z: number, heading: number, drake: boolean) {
  // The body sits partly below the waterline. Each part follows the same local X axis.
  function part(forward: number, y: number, length: number, height: number, width: number, color: number) {
    box(x + forward * Math.cos(heading), y, z - forward * Math.sin(heading),
      length, height, width, color, heading);
  }
  part(0, 0.0625, 0.75, 0.25, 0.375, drake ? palette.duck.breast : palette.duck.hen);
  part(-0.125, 0.1875, 0.5, 0.125, 0.375, drake ? palette.duck.wing : palette.duck.henWing);
  part(0.25, 0.3125, 0.25, 0.25, 0.25, drake ? palette.duck.head : palette.duck.henHead);
  part(0.4375, 0.25, 0.125, 0.125, 0.25, palette.duck.bill);
}
