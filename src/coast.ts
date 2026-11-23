import * as THREE from "three";
import { dinghyOffshore, mooredBoat } from "./boats";
import { buildCottage, cottageDoor } from "./cottage";
import { designsFor } from "./designs";
import { gullsInFlight, waterfowl } from "./ducks";
import { fencedField } from "./fences";
import { grassShade, palette } from "./palette";
import { treeVoxel } from "./scale";
import { findSite } from "./sites";
import { terrainField } from "./terrain";
import { footbridge, pier } from "./trail-details";
import { terrainTrail } from "./trails";
import { standDensity, treePlanter } from "./trees";
import { at, chicken, cow, deer, mill, rabbit, sheep, villageYard } from "./village";
import { seededRandom, voxelBatch } from "./voxels";
import { riverDepthMap } from "./water";

// A whole valley in one diorama: a river leaves the wooded hills through a
// millpond, turns a watermill, passes under a footbridge between the fields
// and reaches the sea at a beach, where a cottage keeps a landing.
// The water lies at sea level throughout, as in a tidal creek.
export function buildCoast(seed: number, model: boolean, grid = 1, designs = designsFor(seed)) {
  const random = seededRandom(seed),
    relief = terrainField(seed);
  const wildlife = seededRandom(seed ^ 0x67ab39);
  const harbour = seededRandom(seed ^ 0x3c6ef372);
  const phase = random() * Math.PI * 2;
  const radiusX = Math.ceil((model ? 24 : 46) * grid),
    radiusZ = model ? Math.ceil(16 * grid) : radiusX;
  const inBounds = (x: number, z: number) => Math.abs(x) <= radiusX && Math.abs(z) <= radiusZ;

  // The coast runs across the front of the model; the sea lies toward +z.
  const coastZ = (x: number) => 8 * grid + 2.5 * grid * Math.sin(x / (9 * grid) + phase) + 2 * relief(x, 91);
  // The river runs straight past the mill and winds above and below it.
  const pondZ = -Math.round(7 * grid),
    millZ = pondZ + Math.round(3 * grid) + 3;
  const millRiverX = -Math.round(4 * grid);
  function riverX(z: number) {
    const straight = THREE.MathUtils.smoothstep(Math.abs(z - millZ), 2, 4 * grid + 2);
    const wander = 5 * grid * Math.sin(z / (8 * grid) + phase) + 3 * grid * relief(33, z);
    return millRiverX + straight * (wander - 5 * grid * Math.sin(millZ / (8 * grid) + phase));
  }
  // The river widens toward its mouth.
  const riverHalf = (z: number) => 1.6 + Math.max(0, (z - coastZ(riverX(z)) + 10 * grid) / (10 * grid)) * 2 * grid;
  const pondX = millRiverX + Math.round(grid);
  const millX = Math.round(millRiverX - riverHalf(millZ)) - 2.5;
  const millYard = (x: number, z: number) => x >= millX - 3 && x <= millX + 2 && Math.abs(z - millZ) <= 1.5;
  // The wheel turns in a pit cut from the bank to the river.
  const wheelPit = (x: number, z: number) => Math.abs(z - millZ) <= 1 && x >= millX + 2 && x <= riverX(z);

  function water(x: number, z: number) {
    const sea = coastZ(x) - z;
    const river = z > coastZ(riverX(z)) + 2 ? Infinity : Math.abs(x - riverX(z)) - riverHalf(z);
    const pond = (Math.hypot((x - pondX) / 1.5, z - pondZ) - grid * (3.2 + 0.5 * relief(x, z))) * 1.2;
    return Math.min(sea, river, pond);
  }
  function natural(x: number, z: number) {
    if (wheelPit(x, z)) return -1;
    if (millYard(x, z)) return 0.5;
    const bank = water(x, z);
    if (bank <= 0) {
      // The sea shelves more deeply than the river and pond.
      const sea = coastZ(x) - z < 0 && Math.abs(x - riverX(z)) > riverHalf(z) + 2;
      const deepest = sea ? 4 : 2.5;
      return -0.5 - Math.min(deepest, Math.floor(-bank * (sea ? 1 : 2)) / 2);
    }
    // Hills rise toward the back of the valley.
    const back = THREE.MathUtils.clamp((-z + 4 * grid) / (20 * grid), 0, 1);
    const rise = (3 + 9 * back + 6 * relief(x, z)) * (1 - Math.exp(-Math.max(0, bank - 3) / (10 * grid)));
    return 0.5 + Math.max(0, Math.round(rise * 2) / 2);
  }
  // Elevation is sampled many times per cell, so cache the lattice.
  const span = 2 * Math.max(radiusX, radiusZ) + 21;
  const cache = new Float32Array(span * span).fill(NaN);
  function elevation(x: number, z: number) {
    const i = Math.round(x) + (span - 1) / 2,
      j = Math.round(z) + (span - 1) / 2;
    if (i < 0 || j < 0 || i >= span || j >= span) return natural(Math.round(x), Math.round(z));
    const k = i + j * span;
    if (Number.isNaN(cache[k])) cache[k] = natural(Math.round(x), Math.round(z));
    return cache[k];
  }

  const { box, terrainLayer, buildMesh } = voxelBatch();
  const ground = terrainLayer(),
    soil = terrainLayer();
  mill(at(box, millX, 0.5, millZ));
  const millDoor = { x: Math.round(millX - 1), z: millZ + 2 };

  // Cross where the river is narrow and both banks are easy to reach.
  function banks(z: number) {
    let west = Math.round(riverX(z)),
      east = west;
    while (elevation(west, z) < 0 && west > -radiusX) west--;
    while (elevation(east, z) < 0 && east < radiusX) east++;
    return { west, east };
  }
  const coastAtRiver = Math.floor(coastZ(riverX(millZ + 10)));
  const crossing = findSite(0, 0, millZ + 6, coastAtRiver - 6 * grid, 1, (_, z) => {
    const { west, east } = banks(z);
    if (east - west > 9) return Infinity;
    const approach =
      Math.abs(elevation(west - 2, z) - elevation(west, z)) + Math.abs(elevation(east + 2, z) - elevation(east, z));
    return east - west + approach * 2 + Math.abs(z - (millZ + coastAtRiver) / 2) * 0.1;
  });
  const bridgeZ = crossing?.z ?? millZ + 6;
  const { west, east } = banks(bridgeZ);

  // The cottage takes a level shelf above the beach east of the river.
  const shelf = findSite(
    east + 5,
    Math.min(radiusX - 4, east + 18 * grid),
    bridgeZ,
    coastAtRiver + 4 * grid,
    1,
    (x, z) => {
      if (water(x, z) < 4 || water(x, z + 6) > 4 * grid + 6) return Infinity;
      const footprint: number[] = [];
      for (let dz = -1; dz <= 1; dz++) for (let dx = -2; dx <= 2; dx++) footprint.push(elevation(x + dx, z + dz));
      const high = Math.max(...footprint);
      return (high - Math.min(...footprint)) * 8 + (high - elevation(x, z + 2)) * 5 + Math.abs(x - east - 9) * 0.2;
    },
  )!;
  const cabinX = shelf.x,
    cabinZ = shelf.z;
  const homeDoor = { x: Math.round(cabinX + cottageDoor(designs.cottage)), z: cabinZ + 2 };
  const floor = elevation(homeDoor.x, homeDoor.z);
  const cabinFootprint = (x: number, z: number) => Math.abs(x - cabinX) <= 2.5 && Math.abs(z - cabinZ) <= 1.5;
  const chimney = buildCottage(
    (x, y, z, w, h, d, color) => box(cabinX + x, floor + y, cabinZ + z, w, h, d, color),
    designs.cottage,
  ).add(new THREE.Vector3(cabinX, floor, cabinZ));

  // The landing runs straight out from the beach below the cottage.
  let beachZ = homeDoor.z;
  while (elevation(homeDoor.x, beachZ + 1) >= 0 && beachZ < radiusZ) beachZ++;
  const end = { x: homeDoor.x, z: beachZ };
  pier(box, { x: end.x, z: end.z + 0.25 }, 0, 1, elevation);

  const trail = terrainTrail(
    elevation,
    (x, z) => elevation(x, z) > 0 && inBounds(x, z) && !millYard(x, z) && !cabinFootprint(x, z),
  );
  trail.route([
    [homeDoor.x, homeDoor.z],
    [end.x, end.z],
  ]);
  trail.route([
    [homeDoor.x, homeDoor.z],
    [east, bridgeZ],
  ]);
  trail.route([
    [west, bridgeZ],
    [millDoor.x, millDoor.z],
  ]);
  const onTrail = (x: number, z: number) => trail.tiles.has(x + "," + z);
  const deck = footbridge(box, west, east, bridgeZ, elevation);

  // Fields lie on gentle ground near the tracks: cattle by the mill and
  // sheep above the cottage. Each gate faces the nearest track.
  const fields: { x: number; z: number; size: number }[] = [];
  function paddock(near: { x: number; z: number }, reach: number, size: number) {
    const site = findSite(near.x - reach, near.x + reach, near.z - reach, near.z + reach, 1, (x, z) => {
      let low = Infinity,
        high = -Infinity;
      for (let dz = -size; dz <= size; dz++)
        for (let dx = -size; dx <= size; dx++) {
          const px = x + dx,
            pz = z + dz,
            h = elevation(px, pz);
          if (
            h <= 0.5 ||
            water(px, pz) < 2 ||
            !inBounds(px, pz) ||
            Math.abs(px) >= radiusX - 1 ||
            Math.abs(pz) >= radiusZ - 1 ||
            millYard(px, pz) ||
            Math.hypot(px - cabinX, pz - cabinZ) < 4 ||
            trail.near(px, pz) ||
            fields.some(f => Math.abs(px - f.x) <= f.size + 2 && Math.abs(pz - f.z) <= f.size + 2)
          )
            return Infinity;
          low = Math.min(low, h);
          high = Math.max(high, h);
        }
      return high - low <= 1 ? 6 * (high - low) + Math.hypot(x - near.x, z - near.z) * 0.3 : Infinity;
    });
    if (!site) return;
    fields.push({ ...site, size });
    const track = [...trail.tiles.keys()].map(key => {
      const [x, z] = key.split(",").map(Number);
      return { x, z };
    });
    fencedField(box, (px, pz) => elevation(Math.round(px), Math.round(pz)), site, size, track);
    return { ...site, size };
  }
  const cattle = paddock({ x: millX - 8, z: millZ + 5 }, 8, 3);
  const flock = paddock({ x: cabinX + 4, z: cabinZ - 9 }, 8, 2);
  const inField = (x: number, z: number, margin: number) =>
    fields.some(f => Math.abs(x - f.x) <= f.size + margin && Math.abs(z - f.z) <= f.size + margin);

  const yard = villageYard(
    box,
    (x, z) => elevation(Math.round(x), Math.round(z)),
    (x, z) =>
      inBounds(x, z) &&
      !millYard(Math.round(x), Math.round(z)) &&
      !cabinFootprint(x, z) &&
      !onTrail(Math.round(x), Math.round(z)) &&
      !inField(x, z, 0.5),
  );
  yard.place(chicken, homeDoor.x + 2, homeDoor.z + 1, 0.4, false, { random: wildlife });
  yard.place(chicken, homeDoor.x - 2, homeDoor.z + 1, 0.4, true, { random: wildlife });
  for (const [field, draw, count, radius] of [
    [cattle, cow, 3, 1.2],
    [flock, sheep, 3, 0.65],
  ] as const) {
    if (!field) continue;
    const herd = villageYard(
      box,
      (px, pz) => elevation(Math.round(px), Math.round(pz)),
      (px, pz) => Math.abs(px - field.x) < field.size - 0.2 && Math.abs(pz - field.z) < field.size - 0.2,
    );
    for (let i = 0; i < count; i++)
      herd.place(draw, field.x + (i - 1) * 1.5, field.z + (i % 2), radius, wildlife() < 0.5, { random: wildlife });
  }

  // Water life: ducks on the pond, a rowing boat moored at the landing,
  // gulls along a far stretch of beach and over the fields, and a dinghy
  // heading out to sea. Each keeps clear of the cottage and the mill.
  const depth = (x: number, z: number) => (inBounds(x, z) ? -elevation(Math.round(x), Math.round(z)) : 0);
  waterfowl(box, pondX, pondZ, phase, depth, wildlife, Math.ceil(3 * grid));
  const landing = { x: end.x, z: end.z + 1.25 };
  const home = { x: cabinX, z: cabinZ };
  const buildings = [home, { x: millX, z: millZ }];
  const awayFromBuildings = (x: number, z: number, distance: number) =>
    buildings.every(b => Math.hypot(x - b.x, z - b.z) > distance);
  let raft = landing,
    total = 0;
  for (let x = -radiusX + 4; x <= radiusX - 4; x++) {
    const z = Math.round(coastZ(x)) + 2;
    const weight =
      inBounds(x, z + 3) && awayFromBuildings(x, z, 10 * grid) && Math.abs(x - riverX(z)) > riverHalf(z) + 6 ? 1 : 0;
    total += weight;
    if (weight > 0 && wildlife() * total < weight) raft = { x, z };
  }
  waterfowl(box, raft.x, raft.z, -0.4, depth, wildlife, 4, { avoid: [landing, home] });
  const moored = mooredBoat(box, landing, [0, 1], depth);
  const coastline = coastZ(0);
  dinghyOffshore(
    box,
    {
      left: -radiusX + 6,
      right: radiusX - 6,
      back: coastline,
      front: Math.min(radiusZ - 3, coastline + 14 * grid),
    },
    depth,
    harbour,
    [
      ...buildings.map(b => ({ ...b, radius: 14 * grid })),
      { ...landing, radius: 6 * grid },
      { ...raft, radius: 8 * grid },
      ...(moored ? [{ ...moored, radius: 4 }] : []),
    ],
    () => [0, 1],
    () => 1,
    3 * grid,
  );
  // Gulls fly over the land, preferring ground far from the buildings and
  // leaving the floating flock to itself.
  gullsInFlight(
    box,
    { left: -radiusX + 2, right: radiusX - 2, back: -radiusZ + 2, front: radiusZ - 2 },
    elevation,
    (x, z) => {
      if (elevation(x, z) < 1 || !awayFromBuildings(x, z, 8 * grid) || Math.hypot(x - raft.x, z - raft.z) < 8 * grid)
        return 0;
      const distance = Math.min(1, Math.min(...buildings.map(b => Math.hypot(x - b.x, z - b.z))) / (20 * grid));
      return distance * distance;
    },
    harbour,
    3,
  );

  // Woods grow in stands across the hills, leaving the fields, tracks
  // and the beach open, with deer and rabbits at their edges.
  const cover = (x: number, z: number) => relief(x + 41, z - 67) + 0.25 * Math.min(1, Math.max(0, -z / (15 * grid)));
  const edge = (x: number, z: number) => 0.05 + 1 / (1 + 8 * Math.abs(cover(x, z) - 0.1));
  yard.place(deer, millX - 6, millZ - 8, 0.45, true, { random: wildlife, habitat: edge });
  yard.place(rabbit, cabinX - 4, cabinZ - 5, 0.45, false, { random: wildlife, habitat: edge });
  yard.place(rabbit, cabinX - 6, cabinZ - 4, 0.45, true, { random: wildlife, habitat: edge });

  const plant = treePlanter(box, treeVoxel, designs, seed);
  for (let z = -radiusZ; z <= radiusZ; z++)
    for (let x = -radiusX; x <= radiusX; x++) {
      const path = trail.tiles.get(x + "," + z),
        h = path ?? elevation(x, z);
      const beach = h <= 1 && coastZ(x) - z < 4 && Math.abs(x - riverX(z)) > riverHalf(z) + 1;
      const color =
        path !== undefined
          ? palette.ground.path
          : h < 0
            ? coastZ(x) - z < 0
              ? palette.ground.sand
              : palette.ground.riverbed
            : beach
              ? palette.ground.sand
              : grassShade(h / 14 + 0.25 * relief(x - 29, z + 47));
      soil(x, (h - 4.5) / 2, z, 1, h + 3.5, 1, palette.ground.soil);
      ground(x, h - 0.25, z, 1, 0.5, 1, color);
      if (model && h < 0 && (Math.abs(x) === radiusX || Math.abs(z) === radiusZ))
        box(x, h / 2, z, 1, -h, 1, palette.water.cutFace);
      if (
        h <= 0.5 ||
        beach ||
        Math.abs(x) >= radiusX - 1 ||
        Math.abs(z) >= radiusZ - 1 ||
        millYard(x, z) ||
        Math.hypot(x - millX, z - millZ) < 5 ||
        Math.hypot(x - cabinX, z - cabinZ) < 5 ||
        inField(x, z, 1.5) ||
        trail.near(x, z) ||
        yard.near(x, z, 1.5) ||
        (Math.abs(z - bridgeZ) < 3 && x >= west - 2 && x <= east + 2)
      )
        continue;
      const c = cover(x, z);
      if (random() < standDensity(c)) plant(x, h, z, c > 0.45 ? "pine" : "broadleaf", random() < 0.23);
    }

  return {
    mesh: buildMesh(),
    routes: trail.routes,
    chimney,
    focus: new THREE.Vector3((west + east) / 2, deck, bridgeZ),
    depth: riverDepthMap((x, z) => -elevation(x, z), 2 * Math.max(radiusX, radiusZ) + 1),
    bounds: { x: 0, z: 0, width: radiusX * 2 + 1, depth: radiusZ * 2 + 1 },
  };
}
