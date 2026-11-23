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

// Weighted reservoir sampling keeps one eligible location, with probability
// proportional to its habitat score, without allocating a list of candidates.
export function weightedSite(
  left: number,
  right: number,
  back: number,
  front: number,
  step: number,
  weight: Elevation,
  random: () => number,
) {
  let total = 0;
  let site: { x: number; z: number } | undefined;
  for (let z = back; z <= front; z += step)
    for (let x = left; x <= right; x += step) {
      const w = weight(x, z);
      if (w <= 0) continue;
      total += w;
      if (random() * total < w) site = { x, z };
    }
  return site;
}
