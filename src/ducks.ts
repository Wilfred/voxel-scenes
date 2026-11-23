import { weightedSite, type Elevation } from "./sites";
import { palette } from "./palette";
import type { Box } from "./voxels";

export function addBird(box: Box, x: number, z: number, heading: number, species: "gull" | "drake" | "hen") {
  // The body sits partly below the waterline. Each part follows the same local X axis.
  function part(forward: number, y: number, length: number, height: number, width: number, color: number) {
    const scale = 0.5;
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

export function waterfowl(
  box: Box,
  x: number,
  z: number,
  heading: number,
  depth: Elevation,
  random: () => number,
  radius = 4,
  pier?: { x: number; z: number },
) {
  const placed: { x: number; z: number }[] = [];
  for (let i = 0; i < (pier ? 6 : 3); i++) {
    // Pick the first bird by habitat, then keep companions within swimming
    // distance. Quiet shallows draw ducks; gulls also gather off the landing.
    const centre = placed[0] ?? { x, z };
    const reach = i === 0 ? radius : 3;
    const site = weightedSite(
      centre.x - reach,
      centre.x + reach,
      centre.z - reach,
      centre.z + reach,
      0.5,
      (cx, cz) => {
        if (placed.some(p => Math.hypot(cx - p.x, cz - p.z) < 0.85)) return 0;
        for (const dx of [-0.3, 0.3]) for (const dz of [-0.3, 0.3]) if (depth(cx + dx, cz + dz) < 0.25) return 0;
        const shallow = 1 / (1 + (depth(cx, cz) - 0.75) ** 2);
        if (!pier) return 0.02 + shallow * shallow;
        const distance = Math.hypot(cx - pier.x, cz - pier.z);
        if (distance < 1.5) return 0;
        return 0.015 + shallow + 6 / (1 + (distance / 3) ** 2);
      },
      random,
    );
    if (!site) continue;
    placed.push(site);
    addBird(box, site.x, site.z, heading + (random() - 0.5) * 1.5, pier ? "gull" : i % 2 ? "hen" : "drake");
  }
}
