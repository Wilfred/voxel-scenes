import { findSite, type Elevation } from "./sites";
import { palette } from "./palette";
import type { Box } from "./voxels";

export function addBird(box: Box, x: number, z: number, heading: number, species: "gull" | "drake" | "hen") {
  // The body sits partly below the waterline. Each part follows the same local X axis.
  function part(forward: number, y: number, length: number, height: number, width: number, color: number) {
    const scale = 0.375;
    box(
      x + scale * forward * Math.cos(heading),
      scale * y,
      z - scale * forward * Math.sin(heading),
      length * scale,
      height * scale,
      width * scale,
      color,
      heading,
    );
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
  const flock = coastal
    ? [
        [0, 0],
        [1.5, 0.5],
        [-1, 1],
        [2.25, -1],
        [-2, -0.75],
        [0.75, 2],
      ]
    : [
        [0, 0],
        [0.75, 1],
        [-0.75, 1.75],
      ];
  const placed: { x: number; z: number }[] = [];
  for (const [i, [dx, dz]] of flock.entries()) {
    const tx = x + dx,
      tz = z + dz;
    const site = findSite(tx - 2, tx + 2, tz - 2, tz + 2, 0.5, (cx, cz) => {
      if (placed.some(p => Math.hypot(cx - p.x, cz - p.z) < 0.8)) return Infinity;
      for (const ox of [-0.2, 0.2])
        for (const oz of [-0.2, 0.2]) {
          if (depth(cx + ox, cz + oz) < 0.25) return Infinity;
        }
      return Math.hypot(cx - tx, cz - tz);
    });
    if (!site) continue;
    placed.push(site);
    addBird(box, site.x, site.z, heading + 0.45 * Math.cos(i * 2.4), coastal ? "gull" : i % 2 ? "hen" : "drake");
  }
}
