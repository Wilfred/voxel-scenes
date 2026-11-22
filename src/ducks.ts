import { findSite, type Elevation } from "./sites";
import { palette } from "./palette";
import type { Box } from "./voxels";

export function addBird(box: Box, x: number, z: number, heading: number, species: "gull" | "drake" | "hen") {
  // The body sits partly below the waterline. Each part follows the same local X axis.
  function part(forward: number, y: number, length: number, height: number, width: number, color: number) {
    box(x + forward * Math.cos(heading), y, z - forward * Math.sin(heading),
      length, height, width, color, heading);
  }
  if (species === "gull") {
    part(0, 0.0625, 0.75, 0.25, 0.375, palette.gull.white);
    part(-0.0625, 0.1875, 0.375, 0.125, 0.375, palette.gull.wing);
    part(-0.3125, 0.1875, 0.125, 0.125, 0.25, palette.gull.tip);
    part(0.25, 0.3125, 0.25, 0.25, 0.25, palette.gull.white);
    part(0.4375, 0.3125, 0.125, 0.125, 0.125, palette.duck.bill);
    return;
  }
  const drake = species === "drake";
  part(0, 0.0625, 0.75, 0.25, 0.375, drake ? palette.duck.breast : palette.duck.hen);
  part(-0.125, 0.1875, 0.5, 0.125, 0.375, drake ? palette.duck.wing : palette.duck.henWing);
  part(0.25, 0.3125, 0.25, 0.25, 0.25, drake ? palette.duck.head : palette.duck.henHead);
  part(0.4375, 0.25, 0.125, 0.125, 0.25, palette.duck.bill);
}

export function waterfowl(box: Box, x: number, z: number, heading: number, depth: Elevation, coastal = false) {
  // Keep the pair together with clear water under the full body of each bird.
  const offsetX = Math.cos(heading) < 0 ? -1 : 1;
  const site = findSite(x - 2, x + 2, z - 2, z + 2, 0.5, (cx, cz) => {
    for (const [dx, dz] of [[0, 0], [offsetX, 1.5]]) {
      for (const ox of [-0.5, 0.5]) for (const oz of [-0.5, 0.5]) {
        if (depth(cx + dx + ox, cz + dz + oz) < 0.25) return Infinity;
      }
    }
    return Math.hypot(cx - x, cz - z);
  });
  if (!site) return;
  addBird(box, site.x, site.z, heading + 0.32, coastal ? "gull" : "drake");
  addBird(box, site.x + offsetX, site.z + 1.5, heading - 0.23, coastal ? "gull" : "hen");
}
