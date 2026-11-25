import * as THREE from "three";
import { dinghyOffshore, mooredBoat } from "./boats";
import { buildCottage, cottageDoor } from "./cottage";
import { designsFor } from "./designs";
import { gullsInFlight, waterfowl } from "./ducks";
import { stockedField, type Stock } from "./fences";
import { placeOutbuildings } from "./outbuildings";
import { grassShade, palette } from "./palette";
import { treeVoxel } from "./scale";
import { findSite } from "./sites";
import { terrainField } from "./terrain";
import { footbridge, pier } from "./trail-details";
import { terrainTrail } from "./trails";
import { standDensity, treePlanter } from "./trees";
import { appleTree, at, cart, cow, deer, horse, mill, sheep, villageYard } from "./village";
import { seededRandom, voxelBatch } from "./voxels";
import { riverDepthMap } from "./water";

// A whole valley in one diorama: a river leaves the wooded hills through a
// millpond, turns a watermill, drops over a weir to the tidal reach, passes
// under a footbridge between the fields and reaches the sea at a beach,
// where a cottage keeps a landing.
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
  // A weir below the mill holds the millpond and the river above it at
  // `head` above the tidal reach. Upstream of the weir the land stands as
  // much higher, and it eases back down over the next few rows, where the
  // river runs in a short gorge.
  const head = 2;
  const weirZ = millZ + 3;
  const upstream = (z: number) => z < weirZ;
  const lift = (z: number) => head * (1 - THREE.MathUtils.smoothstep(z, weirZ, weirZ + 5 * grid));

  // Distance to the sea, negative in it. In a vista the land also falls to
  // a distant shore near the edge, rather than ending in a cliff.
  function seaward(x: number, z: number) {
    const edge = model ? Infinity : radiusX - Math.max(Math.abs(x), Math.abs(z)) - 4;
    return Math.min(coastZ(x) - z, edge);
  }
  // Distance to the nearest water, negative in it.
  function water(x: number, z: number) {
    // The river ends at the shore, where the sea takes over.
    const river = z > coastZ(x) ? Infinity : Math.abs(x - riverX(z)) - riverHalf(z);
    const pond = (Math.hypot((x - pondX) / 1.5, z - pondZ) - grid * (3.2 + 0.5 * relief(x, z))) * 1.2;
    return Math.min(seaward(x, z), river, pond);
  }
  const wet = (x: number, z: number) => wheelPit(x, z) || water(x, z) <= 0;
  // The water surface over a wet cell: the millpond above the weir, and the
  // tidal river and the sea below it.
  const surface = (x: number, z: number) => (upstream(z) && seaward(x, z) > 0 ? head : 0);
  function natural(x: number, z: number) {
    if (wheelPit(x, z)) return head - 1;
    if (millYard(x, z)) return head + 0.5;
    const bank = water(x, z);
    if (bank <= 0) {
      const sea = seaward(x, z);
      // Water wears the land in proportion to its force. Surf cuts the beach
      // into a short step, so the sea is a unit deep off the sand and then
      // shelves away. The river's current deepens its channel toward the
      // mouth, where more water flows, and carries on out to sea, scouring a
      // channel through the bar it would otherwise leave, fading offshore.
      const current = Math.max(0, riverHalf(z) + 1 - Math.abs(x - riverX(z)));
      if (sea <= 0) {
        const shelf = 1 + Math.floor(-sea) / 2;
        const scour = current > 0 ? (2.5 + 0.3 * current) * Math.exp(sea / (6 * grid)) : 0;
        return -0.5 - Math.min(4.5, Math.floor(2 * Math.max(shelf, scour)) / 2);
      }
      // Above the weir the bed stays above sea level, so the pond hides the
      // sea surface beneath it.
      const mouth = THREE.MathUtils.clamp(1 - sea / (12 * grid), 0, 1);
      const deepest = upstream(z) ? 1 : 2.5 + mouth;
      const bed = -0.5 - Math.min(deepest, Math.floor(-bank * 2) / 2);
      return surface(x, z) + bed;
    }
    // Hills rise toward the back of the valley.
    const back = THREE.MathUtils.clamp((-z + 4 * grid) / (20 * grid), 0, 1);
    const rise = (3 + 9 * back + 6 * relief(x, z)) * (1 - Math.exp(-Math.max(0, bank - 3) / (10 * grid)));
    return 0.5 + Math.round(2 * lift(z)) / 2 + Math.max(0, Math.round(rise * 2) / 2);
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
  const dry = (x: number, z: number) => !wet(Math.round(x), Math.round(z));
  // The sea bed darkens from sand toward silt with depth, in a few steps.
  const sand = new THREE.Color(palette.ground.sand),
    silt = new THREE.Color(palette.ground.silt),
    tint = new THREE.Color();
  const seabed = (h: number) =>
    tint
      .copy(sand)
      .lerp(silt, Math.round(Math.min(1, -h / 6) * 6) / 6)
      .getHex();

  const { box, terrainLayer, buildMesh } = voxelBatch();
  const ground = terrainLayer(),
    soil = terrainLayer();
  mill(at(box, millX, head + 0.5, millZ));
  const millDoor = { x: Math.round(millX - 1), z: millZ + 2 };

  // Cross the tidal river where it is narrow and both banks are easy to reach.
  function banks(z: number) {
    let west = Math.round(riverX(z)),
      east = west;
    while (wet(west, z) && west > -radiusX) west--;
    while (wet(east, z) && east < radiusX) east++;
    return { west, east };
  }
  const coastAtRiver = Math.floor(coastZ(riverX(millZ + 10)));
  const crossing = findSite(0, 0, weirZ + 3 * grid, coastAtRiver - 5 * grid, 1, (_, z) => {
    const { west, east } = banks(z);
    if (east - west > 9) return Infinity;
    const approach =
      Math.abs(elevation(west - 2, z) - elevation(west, z)) + Math.abs(elevation(east + 2, z) - elevation(east, z));
    return east - west + approach * 2 + 2 * Math.abs(elevation(west, z) - elevation(east, z));
  });
  const bridgeZ = crossing?.z ?? weirZ + 3 * grid;
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
  while (!wet(homeDoor.x, beachZ + 1) && beachZ < radiusZ) beachZ++;
  const end = { x: homeDoor.x, z: beachZ };
  pier(box, { x: end.x, z: end.z + 0.25 }, 0, 1, elevation);

  const trail = terrainTrail(
    elevation,
    (x, z) => dry(x, z) && inBounds(x, z) && !millYard(x, z) && !cabinFootprint(x, z),
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
  const track = [...trail.tiles.keys()].map(key => {
    const [x, z] = key.split(",").map(Number);
    return { x, z };
  });
  footbridge(box, west, east, bridgeZ, elevation);

  // A net loft stands beside the track down to the landing.
  const lofts = placeOutbuildings(
    box,
    ["nets"],
    track.filter(p => p.z > cabinZ + 2),
    1,
    elevation,
    (x, z) => dry(x, z) && inBounds(x, z) && !cabinFootprint(x, z) && Math.hypot(x - cabinX, z - cabinZ) > 4,
  );
  const level = (x: number, z: number) => trail.tiles.get(x + "," + z) ?? elevation(x, z);
  const free = (x: number, z: number) =>
    dry(x, z) &&
    inBounds(x, z) &&
    !millYard(Math.round(x), Math.round(z)) &&
    !cabinFootprint(x, z) &&
    !onTrail(Math.round(x), Math.round(z)) &&
    !lofts.near(x, z) &&
    !lofts.paths.has(Math.round(x) + "," + Math.round(z));

  // Fields lie on gentle ground near the tracks: a horse paddock by the
  // cottage, cattle by the mill and sheep above the cottage. Each gate faces
  // the nearest track, and the farmland gathers near the buildings and the
  // other fields. A field is only fenced where its animals fit; otherwise the
  // next best site is tried.
  const fields: { x: number; z: number; size: number }[] = [];
  const inField = (x: number, z: number, margin: number) =>
    fields.some(f => Math.abs(x - f.x) <= f.size + margin && Math.abs(z - f.z) <= f.size + margin);
  const anchors = () => [{ x: millX, z: millZ }, { x: cabinX, z: cabinZ }, ...fields];
  function paddock(near: { x: number; z: number }, reach: number, size: number, stock: Stock, stream: number) {
    const rejected: { x: number; z: number }[] = [];
    for (let attempt = 0; attempt < 4; attempt++) {
      const site = findSite(near.x - reach, near.x + reach, near.z - reach, near.z + reach, 1, (x, z) => {
        if (rejected.some(r => Math.hypot(x - r.x, z - r.z) < 2)) return Infinity;
        let low = Infinity,
          high = -Infinity;
        for (let dz = -size; dz <= size; dz++)
          for (let dx = -size; dx <= size; dx++) {
            const px = x + dx,
              pz = z + dz,
              h = elevation(px, pz);
            if (
              water(px, pz) < 2 ||
              !free(px, pz) ||
              Math.abs(px) >= radiusX - 1 ||
              Math.abs(pz) >= radiusZ - 1 ||
              Math.hypot(px - cabinX, pz - cabinZ) < 4 ||
              trail.near(px, pz) ||
              inField(px, pz, 2)
            )
              return Infinity;
            low = Math.min(low, h);
            high = Math.max(high, h);
          }
        const nearest = Math.min(...anchors().map(p => Math.hypot(x - p.x, z - p.z)));
        return high - low <= 1 ? 6 * (high - low) + Math.hypot(x - near.x, z - near.z) * 0.3 + 0.2 * nearest : Infinity;
      });
      if (!site) return;
      const level = (px: number, pz: number) => elevation(Math.round(px), Math.round(pz));
      if (stockedField(box, level, site, size, track, stock, seed ^ stream)) {
        fields.push({ ...site, size });
        return site;
      }
      rejected.push(site);
    }
  }
  paddock({ x: cabinX - 4, z: cabinZ - 5 }, 8, 3, { draw: horse, count: 2, radius: 0.9 }, 0x7f4a7c15);
  paddock({ x: millX - 8, z: millZ + 5 }, 8, 3, { draw: cow, count: 3, radius: 0.8 }, 0x2545f491);
  paddock({ x: cabinX + 4, z: cabinZ - 9 }, 8, 2, { draw: sheep, count: 3, radius: 0.65 }, 0x1b873593);

  // An orchard of apple trees in rows beside the mill track.
  const orchardCells = (x: number, z: number) =>
    [0, 1, 2].flatMap(row => [0, 1, 2, 3].map(col => ({ x: x - col * 3, z: z + row * 3 })));
  const plantable = (x: number, z: number, base: number) =>
    free(x, z) && !inField(x, z, 1.5) && !trail.near(x, z) && Math.abs(elevation(x, z) - base) <= 1;
  const orchardSite = findSite(millX - 14, millX - 4, millZ - 6, millZ + 8, 1, (x, z) => {
    const fit = orchardCells(x, z).filter(p => plantable(p.x, p.z, elevation(x, z))).length;
    return fit >= 8 ? 12 - fit + Math.hypot(x - millDoor.x, z - millDoor.z) * 0.1 : Infinity;
  });
  const orchard = orchardSite
    ? orchardCells(orchardSite.x, orchardSite.z).filter(p =>
        plantable(p.x, p.z, elevation(orchardSite.x, orchardSite.z)),
      )
    : [];
  for (const p of orchard) appleTree(at(box, p.x, elevation(p.x, p.z), p.z, random() < 0.5));
  const inOrchard = (x: number, z: number, margin: number) =>
    orchard.some(p => Math.abs(x - p.x) <= 1 + margin && Math.abs(z - p.z) <= 1 + margin);

  const yard = villageYard(
    box,
    (x, z) => elevation(Math.round(x), Math.round(z)),
    (x, z) => free(x, z) && !inField(x, z, 0.5) && !inOrchard(x, z, 0.5),
  );
  // The mill yard keeps a handcart by the door.
  yard.place(cart, millDoor.x - 1, millDoor.z + 2, 1.2, true);

  // Water life: ducks on the millpond, a rowing boat moored at the landing,
  // gulls along a far stretch of beach and over the fields, and a dinghy
  // heading out to sea. Each keeps clear of the cottage and the mill.
  const depth = (x: number, z: number) => {
    const cx = Math.round(x),
      cz = Math.round(z);
    return inBounds(cx, cz) && wet(cx, cz) ? surface(cx, cz) - elevation(cx, cz) : 0;
  };
  const tidal = (x: number, z: number) => (upstream(Math.round(z)) ? 0 : depth(x, z));
  const millpond = (x: number, z: number) => (upstream(Math.round(z)) ? depth(x, z) : 0);
  waterfowl(box, pondX, pondZ, phase, millpond, wildlife, Math.ceil(3 * grid), undefined, head);
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
  waterfowl(box, raft.x, raft.z, -0.4, tidal, wildlife, 4, { avoid: [landing, home] });
  const moored = mooredBoat(box, landing, [0, 1], tidal);
  const coastline = coastZ(0);
  dinghyOffshore(
    box,
    {
      left: -radiusX + 6,
      right: radiusX - 6,
      back: coastline,
      front: Math.min(radiusZ - 3, coastline + 14 * grid),
    },
    tidal,
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
    { left: -radiusX + 8, right: radiusX - 8, back: -radiusZ + 8, front: radiusZ - 8 },
    elevation,
    (x, z) => {
      if (!dry(x, z) || !awayFromBuildings(x, z, 8 * grid) || Math.hypot(x - raft.x, z - raft.z) < 8 * grid) return 0;
      const distance = Math.min(1, Math.min(...buildings.map(b => Math.hypot(x - b.x, z - b.z))) / (20 * grid));
      return distance * distance;
    },
    harbour,
    3,
  );

  // Woods grow in stands on both sides of the valley, thinning toward the
  // river, fields, tracks and beach, with deer at their edges.
  // Sampling the stands by distance from the river balances the two sides.
  const cover = (x: number, z: number) =>
    relief(Math.abs(x - riverX(z)) + 41, z - 67) +
    0.25 * Math.min(1, Math.max(0, -z / (15 * grid))) +
    0.3 * THREE.MathUtils.smoothstep(Math.abs(x - riverX(z)), 6 * grid, 16 * grid) -
    0.35;
  const edge = (x: number, z: number) => 0.05 + 1 / (1 + 8 * Math.abs(cover(x, z) - 0.1));
  yard.place(deer, millX - 6, millZ - 8, 0.45, true, { random: wildlife, habitat: edge });

  // The millpond's surface and the face of the weir sit over the water
  // cells above it; the sea surface serves the tidal river and the sea.
  const pond: number[] = [];
  const falling: number[] = [];
  const spray = voxelBatch();
  const plant = treePlanter(box, treeVoxel, designs, seed);
  for (let z = -radiusZ; z <= radiusZ; z++)
    for (let x = -radiusX; x <= radiusX; x++) {
      const path = trail.tiles.get(x + "," + z);
      const h = level(x, z);
      const isWet = path === undefined && wet(x, z);
      const beach = !isWet && h <= 1 && coastZ(x) - z < 4 && Math.abs(x - riverX(z)) > riverHalf(z) + 1;
      const color =
        path !== undefined || lofts.paths.has(x + "," + z)
          ? palette.ground.path
          : isWet
            ? seaward(x, z) <= 0
              ? seabed(h)
              : palette.ground.riverbed
            : beach
              ? palette.ground.sand
              : grassShade((h - lift(z)) / 14 + 0.25 * relief(x - 29, z + 47));
      soil(x, (h - 4.5) / 2, z, 1, h + 3.5, 1, palette.ground.soil);
      ground(x, h - 0.25, z, 1, 0.5, 1, color);
      const top = isWet ? surface(x, z) : h;
      const cut = model && (Math.abs(x) === radiusX || Math.abs(z) === radiusZ);
      if (isWet && cut && top > h) box(x, (h + top) / 2, z, 1, top - h, 1, palette.water.cutFace);
      if (isWet && top > 0) {
        // prettier-ignore
        pond.push(x - 0.5,0,z - 0.5, x - 0.5,0,z + 0.5, x + 0.5,0,z - 0.5, x + 0.5,0,z - 0.5, x - 0.5,0,z + 0.5, x + 0.5,0,z + 0.5);
        if (z + 1 === weirZ && wet(x, z + 1)) {
          // The weir: a stone sill under a falling sheet of water, broken into
          // whitewater, with a churned pad at its foot. Positional noise
          // leaves the seeded sequence alone.
          const faceZ = z + 0.5;
          // prettier-ignore
          falling.push(x - 0.5,0,faceZ, x + 0.5,0,faceZ, x - 0.5,top,faceZ, x + 0.5,0,faceZ, x + 0.5,top,faceZ, x - 0.5,top,faceZ);
          box(x, top - 0.375, faceZ - 0.125, 1, 0.25, 0.25, palette.ground.stone);
          const noise = (k: number) => {
            const v = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719 + phase) * 43758.5453;
            return v - Math.floor(v);
          };
          for (const side of [-0.25, 0.25]) {
            const width = noise(side + 1) > 0.5 ? 0.5 : 0.25;
            const run = top * (0.6 + 0.35 * noise(side + 2));
            spray.box(x + side, top - run / 2, faceZ + 0.125, width, run, 0.25, palette.water.foam);
          }
          const pad = 0.75 + 0.5 * Math.round(noise(3));
          spray.box(x, 0.125, faceZ + pad / 2, 1, 0.25, pad, palette.water.froth);
        }
      }
      if (
        isWet ||
        h <= 0.5 ||
        beach ||
        Math.abs(x) >= radiusX - 1 ||
        Math.abs(z) >= radiusZ - 1 ||
        !free(x, z) ||
        Math.hypot(x - millX, z - millZ) < 5 ||
        Math.hypot(x - cabinX, z - cabinZ) < 5 ||
        inField(x, z, 1.5) ||
        inOrchard(x, z, 1.5) ||
        trail.near(x, z) ||
        yard.near(x, z, 1.5) ||
        (Math.abs(z - bridgeZ) < 3 && x >= west - 2 && x <= east + 2)
      )
        continue;
      const c = cover(x, z);
      if (random() < standDensity(c)) plant(x, h, z, c > 0.45 ? "pine" : "broadleaf", random() < 0.23);
    }

  const geometry = (vertices: number[]) => {
    const shape = new THREE.BufferGeometry();
    shape.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    shape.computeVertexNormals();
    return shape;
  };
  const foam = spray.buildMesh();
  foam.material.transparent = true;
  foam.material.opacity = 0.55;
  foam.material.depthWrite = false;
  foam.castShadow = false;
  foam.renderOrder = 2;
  return {
    mesh: buildMesh(),
    routes: trail.routes,
    chimney,
    pond: geometry(pond),
    head,
    weir: geometry(falling),
    foam,
    // The mill stands at the heart of the valley, between the hills and
    // the beach, so a vista centred on it fills the frame with land.
    focus: new THREE.Vector3(millX, head + 0.5, millZ),
    depth: riverDepthMap(
      (x, z) => (wet(x, z) ? surface(x, z) - elevation(x, z) : 0),
      2 * Math.max(radiusX, radiusZ) + 1,
    ),
    bounds: { x: 0, z: 0, width: radiusX * 2 + 1, depth: radiusZ * 2 + 1 },
  };
}
