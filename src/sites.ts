export type Elevation = (x: number, z: number) => number;

// Infinite cost excludes a site (water, an occupied footprint, or an unsafe slope).
export function findSite(left: number, right: number, back: number, front: number, step: number, cost: Elevation) {
  let best = Infinity;
  let site: { x: number; z: number } | undefined;
  for (let z = back; z <= front; z += step) {
    for (let x = left; x <= right; x += step) {
      const score = cost(x, z);
      if (score < best) {
        best = score;
        site = { x, z };
      }
    }
  }
  return site;
}
