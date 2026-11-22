import type { Box } from "./voxels";

export function addDuck(box: Box, x: number, z: number, heading: number, drake: boolean) {
  // The body sits partly below the waterline. Each part follows the same local X axis.
  function part(forward: number, y: number, length: number, height: number, width: number, color: number) {
    box(x + forward * Math.cos(heading), y, z - forward * Math.sin(heading),
      length, height, width, color, heading);
  }
  part(0, 0.0625, 0.75, 0.25, 0.375, drake ? 0xb6ac90 : 0x957452);
  part(-0.125, 0.1875, 0.5, 0.125, 0.375, drake ? 0x786956 : 0x775a43);
  part(0.25, 0.3125, 0.25, 0.25, 0.25, drake ? 0x355b4c : 0x886646);
  part(0.4375, 0.25, 0.125, 0.125, 0.25, 0xb89052);
}
