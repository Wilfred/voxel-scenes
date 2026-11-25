import { findSite } from "./sites";
import { fencedField } from "./fences";
import type { orchardSeason } from "./day";
import { designsFor } from "./designs";
import { waterfowl } from "./ducks";
import { grassShade, palette } from "./palette";
import { treeVoxel } from "./scale";
import { terrainField } from "./terrain";
import { terrainTrail } from "./trails";
import { standDensity, treePlanter } from "./trees";
import { appleTree, at, cart, cow, mill, sheep, stall, villageYard } from "./village";
import { seededRandom, voxelBatch } from "./voxels";
import { riverDepthMap } from "./water";
import * as THREE from "three";

export function buildMillpond(
  seed: number,
  model: boolean,
  grid: number,
  designs = designsFor(seed),
  season: ReturnType<typeof orchardSeason> = "harvest",
) {
  const random = seededRandom(seed),
    relief = terrainField(seed);
  const wildlife = seededRandom(seed ^ 0x67ab39);
  const phase = random() * Math.PI * 2;
  const pondX = 2 * grid,
    pondZ = grid;
  const wheelZ = -Math.round(2.4 * grid),
    wheelX = -Math.round(3.5 * grid);
  const millX = wheelX - 2.65;
  const radiusX = Math.ceil((model ? 16 : 43) * grid),
    radiusZ = model ? Math.ceil(11 * grid) : radiusX;

  function elevation(x: number, z: number) {
    const shoreline = Math.hypot((x - pondX) / 1.4, z - pondZ) - grid * (4.5 + 0.6 * relief(x, z));
    // The headrace straightens at the wheel. Its tail empties into the pond.
    const bend = Math.max(0, wheelZ - 2 - z);
    const leatX = wheelX + Math.min(1, bend / 7) * (2.2 * Math.sin(bend * 0.14 + phase));
    const leat = Math.max(Math.abs(x - leatX) - 0.9, z - pondZ);
    const outletZ = pondZ + 1.5 * Math.sin((x - pondX) * 0.18 + phase);
    const outlet = Math.max(Math.abs(z - outletZ) - 1.1, pondX - x);
    const bank = Math.min(shoreline, leat, outlet);
    if (bank <= 0) return -0.5 - Math.min(2.5, Math.floor(-bank * 2) / 2);
    const rise = (7 + 7 * relief(x, z)) * (1 - Math.exp(-Math.max(0, bank - 3) / 16));
    return 0.5 + Math.round(rise * 2) / 2;
  }

  const { box, terrainLayer, buildMesh } = voxelBatch();
  const ground = terrainLayer(),
    soil = terrainLayer();
  const millBox = at(box, millX, 0.5, wheelZ);
  mill(millBox);
  if (season === "wreath") {
    for (const [x, y] of [
      [-1, 0.65],
      [-1, 0.95],
      [-1.15, 0.8],
      [-0.85, 0.8],
    ])
      millBox(x, y, 1.3, 0.15, 0.15, 0.1, palette.green.pine);
  }
  const doorX = Math.round(millX - 1);
  const orchardX = doorX - Math.round(4 * grid);
  const orchardZ = wheelZ + Math.round(3 * grid);
  const trail = terrainTrail(elevation, (x, z) => elevation(x, z) > 0 && x <= doorX + 1);
  trail.route([
    [doorX, wheelZ + 2],
    [doorX - 3, wheelZ + 2],
    [orchardX, orchardZ],
    [orchardX - 3, orchardZ + 4],
  ]);
  const millFootprint = (x: number, z: number) => Math.abs(x - millX) <= 2.25 && Math.abs(z - wheelZ) <= 1.5;
  const yard = villageYard(
    box,
    (x, z) => elevation(Math.round(x), Math.round(z)),
    (x, z) =>
      Math.abs(x) <= radiusX &&
      Math.abs(z) <= radiusZ &&
      !millFootprint(x, z) &&
      !trail.tiles.has(Math.round(x) + "," + Math.round(z)),
  );
  yard.place(cart, doorX - 1, wheelZ + 3, 1.2, true);
  yard.place(stall, orchardX, orchardZ + 2, 1.1);
  // Reserve grazing fields beside the cart track: a small one for sheep and
  // a larger one for cattle. Each gate occupies the bay nearest the track,
  // and the whole enclosure must fit on dry, nearly level ground.
  const fields: { x: number; z: number; half: number }[] = [];
  const inField = (x: number, z: number, margin: number) =>
    fields.some(f => Math.abs(x - f.x) <= f.half + margin && Math.abs(z - f.z) <= f.half + margin);
  const track = [...trail.tiles.keys()].map(key => {
    const [x, z] = key.split(",").map(Number);
    return { x, z };
  });
  const level = (px: number, pz: number) => elevation(Math.round(px), Math.round(pz));
  function field(
    search: { left: number; right: number; back: number; front: number },
    half: number,
    target: { x: number; z: number },
  ) {
    const site = findSite(search.left, search.right, search.back, search.front, 1, (x, z) => {
      let low = Infinity,
        high = -Infinity;
      for (let dz = -half; dz <= half; dz++)
        for (let dx = -half; dx <= half; dx++) {
          const px = x + dx,
            pz = z + dz,
            h = elevation(px, pz);
          if (
            h <= 0 ||
            Math.abs(px) >= radiusX ||
            Math.abs(pz) >= radiusZ ||
            millFootprint(px, pz) ||
            trail.tiles.has(px + "," + pz) ||
            yard.near(px, pz, 0.75) ||
            inField(px, pz, 1)
          )
            return Infinity;
          low = Math.min(low, h);
          high = Math.max(high, h);
        }
      return high - low <= 0.5 ? 8 * (high - low) + Math.hypot(x - target.x, z - target.z) : Infinity;
    });
    if (!site) return;
    fencedField(box, level, site, half, track);
    fields.push({ ...site, half });
    const herd = villageYard(
      box,
      level,
      (px, pz) => Math.abs(px - site.x) < half - 0.1 && Math.abs(pz - site.z) < half - 0.1,
    );
    return { ...site, herd };
  }
  const flock = field({ left: orchardX - 8, right: orchardX + 8, back: orchardZ + 2, front: orchardZ + 9 }, 2, {
    x: orchardX - 3,
    z: orchardZ + 4,
  });
  if (flock)
    for (const dx of [-1, 1]) flock.herd.place(sheep, flock.x + dx, flock.z, 0.65, dx > 0, { random: wildlife });
  // Cattle draw from their own stream so the rest of the farm stays in place.
  const cattle = field({ left: orchardX - 10, right: radiusX - 4, back: wheelZ - 4, front: radiusZ - 4 }, 3, {
    x: doorX + 2,
    z: wheelZ + 9,
  });
  if (cattle) {
    const herd = seededRandom(seed ^ 0x2545f491);
    for (const dx of [-1.5, 0, 1.5])
      cattle.herd.place(cow, cattle.x + dx, cattle.z + dx / 1.5, 0.8, herd() < 0.5, { random: herd });
  }

  const orchard = new Set<string>();
  for (let row = 0; row < Math.min(6, 2 + Math.floor(grid)); row++)
    for (let col = 0; col < 4; col++) {
      const x = orchardX - col * 3,
        z = orchardZ - row * 3;
      if (
        Math.abs(x) + 2 >= radiusX ||
        Math.abs(z) + 2 >= radiusZ ||
        inField(x, z, 1.5) ||
        trail.near(x, z) ||
        yard.near(x, z, 1.2) ||
        elevation(x, z) < 0
      )
        continue;
      appleTree(at(box, x, elevation(x, z), z, random() < 0.5), season === "blossom");
      for (let dz = -3; dz <= 3; dz++)
        for (let dx = -3; dx <= 3; dx++) {
          if (dx * dx + dz * dz < 3.5 ** 2) orchard.add(x + dx + "," + (z + dz));
        }
    }
  waterfowl(
    box,
    pondX,
    pondZ,
    phase,
    (x, z) => -elevation(Math.round(x), Math.round(z)),
    wildlife,
    Math.ceil(5 * grid),
  );
  const plant = treePlanter(box, treeVoxel, designs, seed);
  for (let z = -radiusZ; z <= radiusZ; z++)
    for (let x = -radiusX; x <= radiusX; x++) {
      const path = trail.tiles.get(x + "," + z),
        h = path ?? elevation(x, z);
      const bank = h < 0 ? palette.ground.riverbed : grassShade(h / 12 + 0.25 * relief(x - 29, z + 47));
      soil(x, (h - 4.5) / 2, z, 1, h + 3.5, 1, palette.ground.soil);
      ground(x, h - 0.25, z, 1, 0.5, 1, path === undefined ? bank : palette.ground.path);
      if (model && h < 0 && (Math.abs(x) === radiusX || Math.abs(z) === radiusZ))
        box(x, h / 2, z, 1, -h, 1, palette.water.cutFace);
      if (
        h <= 0 ||
        Math.abs(x) >= radiusX - 1 ||
        Math.abs(z) >= radiusZ - 1 ||
        Math.hypot(x - millX, z - wheelZ) < 5 ||
        inField(x, z, 1.5) ||
        trail.near(x, z) ||
        yard.near(x, z, 1.5) ||
        orchard.has(x + "," + z)
      )
        continue;
      const cover = relief(x + 41, z - 67);
      if (random() < standDensity(cover)) plant(x, h, z, cover > 0.4 ? "pine" : "broadleaf", random() < 0.23);
    }
  return {
    mesh: buildMesh(),
    routes: trail.routes,
    focus: new THREE.Vector3(millX, 1, wheelZ),
    depth: riverDepthMap((x, z) => -elevation(x, z), 2 * Math.max(radiusX, radiusZ) + 1),
    bounds: { x: 0, z: 0, width: radiusX * 2 + 1, depth: radiusZ * 2 + 1 },
  };
}
