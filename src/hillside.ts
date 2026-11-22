import { defaultDesigns } from "./designs";
import { findSite } from "./sites";
import { waterfowl } from "./ducks";
import { riverDepthMap } from "./water";
import * as THREE from "three";
import { buildCottage, cottageDoor } from "./cottage";
import { palette } from "./palette";
import { firewood } from "./trail-details";
import { terrainTrail } from "./trails";
import { treePlanter } from "./trees";
import { seededRandom, voxelBatch } from "./voxels";

export function buildHillside(seed: number, model: boolean, grid = 1, designs = defaultDesigns) {
  const random = seededRandom(seed);
  const phase = random() * Math.PI * 2;
  const drop = 3 + Math.floor(random() * 3) * 0.5;
  const lip = -2;
  const { box, buildMesh } = voxelBatch();
  const plantTree = treePlanter(box, 0.5, designs);

  function channel(z: number) {
    return 3 + 3.5 * Math.sin(z * 0.11 + phase) + 1.5 * Math.sin(z * 0.23);
  }
  function bankDistance(x: number, z: number) {
    const pool = 1.75 * Math.exp(-((z - lip - 3) ** 2) / 12);
    return Math.abs(x - channel(z)) - (1.8 + pool + 0.35 * Math.cos(z * 0.27));
  }
  const crestX = channel(lip);
  function level(x: number, z: number) {
    // A notch on the near bank splits the rock sill into two short cascades.
    const crest = lip + (x < crestX - 0.5 ? 1 : 0);
    if (z <= crest) return drop;
    if (z <= crest + (x > crestX ? 1 : 2)) return 1;
    return 0;
  }
  function elevation(x: number, z: number) {
    const bank = bankDistance(x, z);
    if (bank < 0) return level(x, z) - 0.5 - Math.floor(-bank * 1.5) / 2;
    // The rock sill cuts across the stream. On either side it eases into a hillside.
    const shoulder = Math.min(1, Math.max(0, 0.5 + (lip + 0.5 - z) / (1 + bank * 1.6)));
    const hill = 5 + 2.5 * Math.sin(x * 0.11 + phase) + 2 * Math.cos(z * 0.12);
    return 0.5 + Math.round(2 * (drop * shoulder + hill * (1 - Math.exp(-bank / 10)))) / 2;
  }

  // Find an existing shelf above the pool, with a level step at the door.
  const cabin = findSite(-14, -4, -12, -6, 1, (x, z) => {
    if (x > channel(z) - 6) return Infinity;
    const footprint = [];
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) footprint.push(elevation(x + dx, z + dz));
    }
    const high = Math.max(...footprint);
    return (high - Math.min(...footprint)) * 8 + (high - elevation(x, z + 1)) * 5
      + Math.hypot(x + 8, z + 8) * 0.35;
  })!;
  const { x: cabinX, z: cabinZ } = cabin;
  const doorX = cabinX + cottageDoor(designs.cottage);
  const pathX = Math.round(doorX);
  const floor = elevation(pathX, cabinZ + 1);
  const landingZ = lip - 1;
  let landingX = Math.floor(channel(landingZ));
  while (bankDistance(landingX, landingZ) < 0) landingX--;
  const trail = terrainTrail(elevation, (x, z) => z >= cabinZ + 1 && bankDistance(x, z) >= 0);
  trail.route([[pathX, cabinZ + 1], [landingX, landingZ]]);
  buildCottage((x, y, z, w, h, d, color) => {
    box(cabinX + x, floor + y - 0.4, cabinZ + z, w, h, d, color);
  }, designs.cottage);
  // The stack spans exactly two cells. Both must support the cut ends,
  // outside the cottage walls and away from the walked route.
  const stack = findSite(cabinX - 3.5, cabinX + 3.5, cabinZ - 3, cabinZ + 3, 1, (x, z) => {
    if (Math.abs(x - cabinX) < 2.5 && Math.abs(z - cabinZ) < 2) return Infinity;
    for (const ox of [-0.5, 0.5]) {
      if (trail.tiles.has((x + ox) + "," + z) || bankDistance(x + ox, z) < 0) return Infinity;
    }
    return elevation(x - 0.5, z) === elevation(x + 0.5, z)
      ? Math.hypot(x - cabinX + 2.5, z - cabinZ) : Infinity;
  });
  if (stack) firewood(box, stack.x, elevation(stack.x - 0.5, stack.z), stack.z);
  waterfowl(box, channel(lip + 6) - 0.75, lip + 6, -0.7, (x, z) => {
    const cx = Math.round(x), cz = Math.round(z);
    return level(cx, cz) === 0 ? -elevation(cx, cz) : 0;
  });

  const radius = Math.ceil(54 * grid);
  const radiusX = model ? Math.round(21 * grid) : radius, radiusZ = model ? Math.round(16 * grid) : radius;
  const vertices: number[] = [];
  for (let z = -radius; z <= radius; z++) {
    for (let x = -radius; x <= radius; x++) {
      const chance = random(), sapling = random() < 0.25;
      if (Math.abs(x) > radiusX || Math.abs(z) > radiusZ) continue;
      const bank = bankDistance(x, z);
      const path = trail.tiles.get(x + "," + z);
      const h = path ?? elevation(x, z);
      const ledge = bank >= 0 && bank < 2 && Math.abs(z - lip) <= 2;
      const grove = Math.sin(x * 0.3 + phase) + Math.cos(z * 0.23);
      const grass = grove > 0 ? palette.green.grass : palette.green.meadow;
      const waterStep = x === landingX && z === landingZ;
      const color = waterStep ? palette.ground.stone : path !== undefined ? palette.ground.path : bank < 0 ? palette.ground.riverbed
        : ledge ? palette.ground.stone : grass;
      box(x, (h - 4.5) / 2, z, 1, h + 3.5, 1, ledge ? palette.ground.stone : palette.ground.soil);
      box(x, h - 0.25, z, 1, 0.5, 1, color);
      if (bank < 0) {
        const y = level(x, z);
        const l = x - 0.5, r = x + 0.5, b = z - 0.5, f = z + 0.5;
        vertices.push(l,y,b, l,y,f, r,y,b, r,y,b, l,y,f, r,y,f);
        // Fill every exposed edge between levels, including the notch's side.
        for (const [dx, dz] of [[0, 1], [-1, 0], [1, 0]]) {
          const low = level(x + dx, z + dz);
          if (low >= y || bankDistance(x + dx, z + dz) >= 0) continue;
          const faceX = x + dx * 0.5, faceZ = z + dz * 0.5;
          // A vertical sheet shares the translucent river material. Wind the
          // face towards the lower pool, including the two sides of the notch.
          const ax = faceX - dz * 0.5, az = faceZ + dx * 0.5;
          const bx = faceX + dz * 0.5, bz = faceZ - dx * 0.5;
          vertices.push(ax,low,az, bx,low,bz, ax,y,az, bx,low,bz, bx,y,bz, ax,y,az);
          if (dz) {
            const ripple = Math.sin(x * 4.1 + z + phase);
            const spread = ripple > 0 ? 0.75 : 0.5;
            box(x, low + 0.0625, faceZ + spread / 2, 0.75, 0.125, spread, palette.water.foam);
            // A broken glint follows each falling sheet down to its splash.
            const run = (y - low) * (0.45 + 0.2 * ripple);
            box(x + ripple * 0.25, y - run / 2, faceZ + 0.13, 0.125, run, 0.0625, palette.water.froth);
            box(x - 0.25, low + 0.125, faceZ + spread, 0.25, 0.25, 0.25, palette.water.froth);
          }
        }
        if (model && Math.abs(z) === radiusZ) box(x, (h + y) / 2, z, 1, y - h, 1, palette.water.cutFace);
        continue;
      }
      if (Math.abs(x) >= radiusX - 1 || Math.abs(z) >= radiusZ - 1 || bank < 2 ||
        Math.hypot(x - cabinX, z - cabinZ) < 3.5 || (stack && Math.hypot(x - stack.x, z - stack.z) < 2) || trail.near(x, z)) continue;
      if (chance < 0.024 + 0.105 * Math.max(0, grove)) plantTree(x, h, z, grove > 1 ? "pine" : "broadleaf", sapling);
    }
  }
  const water = new THREE.BufferGeometry();
  water.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  water.computeVertexNormals();
  const depth = riverDepthMap((x, z) => level(x, z) - elevation(x, z), grid);
  return { mesh: buildMesh(), water, depth };
}
