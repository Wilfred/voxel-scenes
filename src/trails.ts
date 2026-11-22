import type { Elevation } from "./sites";

type Point = [number, number];
type Step = { x: number; z: number; cost: number; previous?: Step };

// Between destinations, prefer dry, gently sloping ground. A short search
// corridor lets the trail skirt a ledge without taking it across the valley.
function connect(from: Point, to: Point, elevation: Elevation, dry: (x: number, z: number) => boolean) {
  const queue: Step[] = [{ x: from[0], z: from[1], cost: 0 }];
  const costs = new Map<string, number>([[from.join(","), 0]]);
  while (queue.length) {
    queue.sort((a, b) => b.cost - a.cost);
    const here = queue.pop()!;
    if (here.cost !== costs.get(here.x + "," + here.z)) continue;
    if (here.x === to[0] && here.z === to[1]) {
      const segment: Point[] = [];
      for (let p: Step | undefined = here; p?.previous; p = p.previous) segment.push([p.x, p.z]);
      return segment.reverse();
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = here.x + dx, z = here.z + dz;
      if (x < Math.min(from[0], to[0]) - 4 || x > Math.max(from[0], to[0]) + 4 ||
          z < Math.min(from[1], to[1]) - 4 || z > Math.max(from[1], to[1]) + 4 || !dry(x, z)) continue;
      const rise = Math.abs(elevation(x, z) - elevation(here.x, here.z));
      const cost = here.cost + 1 + rise * rise * 5 + Math.hypot(x - to[0], z - to[1]) * 0.015;
      const key = x + "," + z;
      if (cost >= (costs.get(key) ?? Infinity)) continue;
      costs.set(key, cost);
      queue.push({ x, z, cost, previous: here });
    }
  }
  throw new Error("No dry approach to trail destination");
}

export function terrainTrail(elevation: Elevation, dry: (x: number, z: number) => boolean) {
  const verge = new Set<string>();
  const tiles = new Map<string, number>();
  return {
    tiles,
    route(waypoints: Point[]) {
      const route = [waypoints[0]];
      for (let i = 1; i < waypoints.length; i++) {
        route.push(...connect(waypoints[i - 1], waypoints[i], elevation, dry));
      }
      const points: Point[] = [];
      const indices = new Map<string, number>();
      for (const p of route) {
        const key = p.join(",");
        const previous = indices.get(key);
        if (previous !== undefined) {
          for (const loop of points.splice(previous + 1)) indices.delete(loop.join(","));
        } else {
          indices.set(key, points.length);
          points.push(p);
        }
      }
      const existing = points.map(p => tiles.get(p.join(",")));
      const heights = points.map(([x, z], i) => existing[i] ?? elevation(x, z));
      // Wear down a local crest by one terrain layer. Level ground keeps its
      // original surface, including the woodland grid offset at the waterline.
      const layer = 0.5;
      const tread = heights.map((h, i) => {
        if (existing[i] !== undefined || i === 0 || i === heights.length - 1) return h;
        return h > heights[i - 1] && h > heights[i + 1] ? h - layer : h;
      });
      // Grade isolated high spots from both approaches. Endpoints meet the
      // existing doorstep or bridge landing; wear is cut into the terrain.
      for (let i = 1; i < tread.length - 1; i++) tread[i] = Math.min(tread[i], tread[i - 1] + layer);
      for (let i = tread.length - 2; i > 0; i--) tread[i] = Math.min(tread[i], tread[i + 1] + layer);
      const last = tread.length - 1;
      // An existing tread is a fixed landing anywhere the two routes meet.
      const approach = existing.map((h, i) => i === 0 || i === last ? heights[i] : h ?? -Infinity);
      for (let i = 1; i <= last; i++) approach[i] = Math.max(approach[i], approach[i - 1] - layer);
      for (let i = last - 1; i >= 0; i--) approach[i] = Math.max(approach[i], approach[i + 1] - layer);
      for (let i = 0; i <= last; i++) {
        if (existing[i] !== undefined) continue;
        const [x, z] = points[i];
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) verge.add((x + dx) + "," + (z + dz));
        }
        tiles.set(points[i].join(","), Math.max(tread[i], approach[i]));
      }
    },
    near(x: number, z: number) {
      return verge.has(x + "," + z);
    },
  };
}
