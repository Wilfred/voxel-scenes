import { palette } from "./palette";
import { casement, masonryCourses, pitchedRoof } from "./building";
import type { Elevation } from "./sites";
import type { Box } from "./voxels";

export const buildingNames = { nets: "Net loft", store: "Stone storehouse", shelter: "Forester’s shelter" };
type Kind = keyof typeof buildingNames;
type Cell = { x: number; z: number };

export function buildOutbuilding(box: Box, kind: Kind) {
  const course = masonryCourses(box);
  const { wood, ground, cottage } = palette;
  course(-5, -4, -3, 10, 4, 6, ground.stone);
  if (kind === "shelter") {
    course(-5, 0, -3, 10, 4, 1, wood);
    for (const x of [-5, 4]) course(x, 0, 2, 1, 6, 1, wood);
    course(-4, 0, -2, 6, 1, 2, wood);
    for (let i = 0; i < 3; i++) course(-6, 4 + i, -4 + i * 2, 12, 1, 4, cottage.tile);
  } else {
    const wall = kind === "store" ? ground.stone : wood;
    course(-5, 0, -3, 10, 5, 1, wall);
    for (const x of [-5, 4]) course(x, 0, -2, 1, 5, 4, wall);
    course(-4, 0, -2, 8, 1, 4, ground.stone);
    course(-5, 0, 2, 3, 5, 1, wall);
    if (kind === "store") course(-2, 0, 2, 3, 4, 1, wood);
    course(-2, 4, 2, 3, 1, 1, wall);
    course(1, 0, 2, 4, 2, 1, wall);
    casement(course, 1, 2, 2, 3, 3, wall);
    course(4, 2, 2, 1, 3, 1, wall);
    pitchedRoof(course, kind === "store" ? "hip" : "gable", 6, 4, 5, 4, wall);
  }
}

// Survey short spurs from the existing route. The front faces the approach,
// and the foundation can bridge at most one terrain layer across its footprint.
export function placeOutbuildings(
  box: Box,
  kinds: Kind[],
  route: (Cell & { approach?: Cell[] })[],
  step: number,
  elevation: Elevation,
  available: (x: number, z: number) => boolean,
) {
  const buildings: Cell[] = [];
  const paths = new Set<string>();
  const near = (x: number, z: number) => buildings.some(p => Math.hypot(x - p.x, z - p.z) < 3.5);
  for (const kind of kinds) {
    let best: { x: number; z: number; dx: number; dz: number; floor: number; spur: Cell[] } | undefined;
    let score = Infinity;
    for (const start of route) {
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const spur: Cell[] = [];
        let previous = elevation(start.x, start.z);
        for (let distance = step; distance <= 10; distance += step) {
          const x = start.x + dx * distance,
            z = start.z + dz * distance;
          const h = elevation(x, z);
          if (h <= 0 || Math.abs(h - previous) > 0.5 || near(x, z)) break;
          previous = h;
          const walk = distance + (start.approach?.length ?? 0) * step;
          if (walk >= score) break;
          if (!available(x, z)) break;
          if (distance >= 3) {
            let low = h,
              high = h,
              clear = true;
            for (let a = -1.5; a <= 1.5; a += 0.5) {
              for (let b = -1; b <= 1; b += 0.5) {
                const px = x + dz * a + dx * b,
                  pz = z - dx * a + dz * b;
                const ground = elevation(px, pz);
                low = Math.min(low, ground);
                high = Math.max(high, ground);
                if (!available(px, pz)) clear = false;
              }
            }
            const cost = walk + 10 * (high - low);
            if (clear && low > 0 && high - low <= 0.5 && cost < score) {
              best = {
                x,
                z,
                dx,
                dz,
                floor: high,
                spur: [...(start.approach ?? []), ...spur.filter(p => Math.abs(p.x - x) + Math.abs(p.z - z) >= 1)],
              };
              score = cost;
            }
          }
          spur.push({ x, z });
        }
      }
    }
    if (!best) continue;
    const { x, z, floor, dx, dz, spur } = best;
    buildOutbuilding(
      (a, y, b, w, h, d, tint) =>
        box(x - dz * a - dx * b, floor + y, z + dx * a - dz * b, dx ? d : w, h, dx ? w : d, tint),
      kind,
    );
    buildings.push({ x, z });
    for (const p of spur) paths.add(p.x + "," + p.z);
  }
  return { near, paths };
}
