// Full terrain tiles share faces around bends, with at most a half-tile rise.
export function terrainTrail(elevation: (x: number, z: number) => number) {
  const tiles = new Map<string, number>();
  return {
    tiles,
    route(waypoints: [number, number][]) {
      let [x, z] = waypoints[0];
      let h = elevation(x, z);
      tiles.set(x + "," + z, h);
      for (const [toX, toZ] of waypoints.slice(1)) {
        const dx = toX - x, dz = toZ - z;
        const length = Math.max(Math.abs(dx), Math.abs(dz));
        const fromX = x, fromZ = z;
        function step(nextX: number, nextZ: number) {
          x = nextX;
          z = nextZ;
          h = Math.max(h - 0.5, Math.min(h + 0.5, elevation(x, z)));
          tiles.set(x + "," + z, h);
        }
        for (let i = 1; i <= length; i++) {
          const nextX = fromX + Math.round(dx * i / length);
          const nextZ = fromZ + Math.round(dz * i / length);
          if (x !== nextX) step(nextX, z);
          if (z !== nextZ) step(x, nextZ);
        }
      }
    },
    near(x: number, z: number) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (tiles.has((x + dx) + "," + (z + dz))) return true;
        }
      }
      return false;
    },
  };
}
