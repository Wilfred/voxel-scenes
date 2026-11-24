import { weightedSite, type Elevation } from "./sites";
import { palette } from "./palette";
import type { Box } from "./voxels";

export function addBird(
  box: Box,
  x: number,
  z: number,
  heading: number,
  species: "gull" | "drake" | "hen" | "flying gull",
  altitude = 0,
) {
  // The body sits partly below the waterline. Each part follows the same local X axis.
  function part(forward: number, y: number, length: number, height: number, width: number, color: number, side = 0) {
    const scale = 0.5;
    box(
      x + scale * (forward * Math.cos(heading) + side * Math.sin(heading)),
      altitude + scale * y,
      z + scale * (side * Math.cos(heading) - forward * Math.sin(heading)),
      length * scale,
      height * scale,
      width * scale,
      color,
      heading,
    );
  }
  if (species === "flying gull") {
    // Long, narrow wings held flat, with dark tips.
    part(0, 0, 0.75, 0.25, 0.25, palette.gull.white);
    part(0.3125, 0.125, 0.25, 0.25, 0.25, palette.gull.white);
    part(0.5, 0.125, 0.125, 0.125, 0.125, palette.duck.bill);
    for (const side of [-1, 1]) {
      part(0, 0.0625, 0.375, 0.125, 0.5, palette.gull.wing, side * 0.375);
      part(-0.0625, 0.0625, 0.25, 0.125, 0.25, palette.gull.wing, side * 0.75);
      part(-0.0625, 0.0625, 0.25, 0.125, 0.125, palette.gull.tip, side * 0.9375);
    }
    return;
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
  // Gulls float in a loose raft along the shore, clear of these points.
  gulls?: { avoid: { x: number; z: number }[] },
) {
  const placed: { x: number; z: number }[] = [];
  for (let i = 0; i < (gulls ? 6 : 3); i++) {
    // Pick the first bird by habitat, then keep companions within swimming
    // distance.
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
        // Gulls rest in the shallows near the shore; ducks swim out on open
        // water, clear of the bank.
        const clearance = gulls ? 0.3 : 0.6;
        for (const dx of [-clearance, clearance])
          for (const dz of [-clearance, clearance]) if (depth(cx + dx, cz + dz) < (gulls ? 0.25 : 0.5)) return 0;
        if (gulls) {
          if (gulls.avoid.some(p => Math.hypot(cx - p.x, cz - p.z) < 4)) return 0;
          const shallow = 1 / (1 + (depth(cx, cz) - 0.75) ** 2);
          return 0.02 + shallow * shallow;
        }
        // Count open water on a ring around the site, so ducks favour the
        // middle of a pond yet can still use a narrow stream.
        let open = 0;
        for (let k = 0; k < 8; k++) {
          const angle = (k / 8) * Math.PI * 2;
          if (depth(cx + 2 * Math.cos(angle), cz + 2 * Math.sin(angle)) >= 0.5) open++;
        }
        return 0.02 + (open / 8) ** 4;
      },
      random,
    );
    if (!site) continue;
    placed.push(site);
    // Resting gulls all face into the wind, which carries the chimney smoke
    // toward +x; ducks paddle about in any direction.
    const turn = (random() - 0.5) * (gulls ? 0.5 : 1.5);
    addBird(box, site.x, site.z, (gulls ? Math.PI : heading) + turn, gulls ? "gull" : i % 2 ? "hen" : "drake");
  }
}

// Gulls fly high over open land, where they show white against the grass.
// `habitat` weighs each site; birds keep well apart so they spread across
// the scene.
export function gullsInFlight(
  box: Box,
  bounds: { left: number; right: number; back: number; front: number },
  ground: Elevation,
  habitat: Elevation,
  random: () => number,
  count = 2,
) {
  const placed: { x: number; z: number }[] = [];
  for (let i = 0; i < count; i++) {
    const site = weightedSite(
      bounds.left,
      bounds.right,
      bounds.back,
      bounds.front,
      1,
      (x, z) => (placed.some(p => Math.hypot(x - p.x, z - p.z) < 10) ? 0 : habitat(x, z)),
      random,
    );
    if (!site) return;
    placed.push(site);
    // Fly well clear of the tallest crowns.
    const altitude = Math.max(0, ground(site.x, site.z)) + 6 + random();
    addBird(box, site.x, site.z, random() * Math.PI * 2, "flying gull", altitude);
  }
}
