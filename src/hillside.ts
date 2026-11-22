import { placeOutbuildings } from "./outbuildings";
import { treeVoxel } from "./scale";
import { defaultDesigns } from "./designs";
import { findSite } from "./sites";
import { waterfowl } from "./ducks";
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
  const { box, terrainLayer, buildMesh } = voxelBatch();
  const base = terrainLayer(), ground = terrainLayer();
  const plantTree = treePlanter(box, treeVoxel, designs);

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
      for (let dx = -2; dx <= 2; dx++) footprint.push(elevation(x + dx, z + dz));
    }
    const high = Math.max(...footprint);
    return (high - Math.min(...footprint)) * 8 + (high - elevation(x, z + 1)) * 5
      + Math.hypot(x + 8, z + 8) * 0.35;
  })!;
  const { x: cabinX, z: cabinZ } = cabin;
  const doorX = cabinX + cottageDoor(designs.cottage);
  const pathX = Math.round(doorX);
  const floor = elevation(pathX, cabinZ + 2);
  const landingZ = lip - 1;
  let landingX = Math.floor(channel(landingZ));
  while (bankDistance(landingX, landingZ) < 0) landingX--;
  const trail = terrainTrail(elevation, (x, z) => z >= cabinZ + 2 && bankDistance(x, z) >= 0);
  trail.route([[pathX, cabinZ + 2], [landingX, landingZ]]);
  buildCottage((x, y, z, w, h, d, color) => {
    box(cabinX + x, floor + y, cabinZ + z, w, h, d, color);
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
  const approaches = [...trail.tiles.keys()].map(key => {
    const [x, z] = key.split(",").map(Number);
    return { x, z };
  });
  const yards = placeOutbuildings(box, grid >= 6 ? ["store", "shelter"] : grid >= 3 ? ["store"] : [],
    approaches, 1, (x, z) => elevation(Math.round(x), Math.round(z)), (x, z) =>
      bankDistance(x, z) > 1 && Math.hypot(x - cabinX, z - cabinZ) > 3 &&
      !trail.tiles.has(Math.round(x) + "," + Math.round(z)) && (!stack || Math.hypot(x - stack.x, z - stack.z) > 1.5));
  waterfowl(box, channel(lip + 6) - 0.75, lip + 6, -0.7, (x, z) => {
    const cx = Math.round(x), cz = Math.round(z);
    return level(cx, cz) === 0 ? -elevation(cx, cz) : 0;
  });

  const radius = Math.ceil((grid > 2 ? 36 : 54) * grid);
  const radiusX = model ? Math.round(15 * grid) : radius, radiusZ = model ? Math.round(10 * grid) : radius;
  const vertices: number[] = [];
  const spray = voxelBatch();
  for (let z = -radius; z <= radius; z++) {
    for (let x = -radius; x <= radius; x++) {
      const chance = random(), sapling = random() < 0.25;
      if (Math.abs(x) > radiusX || Math.abs(z) > radiusZ) continue;
      const bank = bankDistance(x, z);
      const path = trail.tiles.get(x + "," + z);
      const h = path ?? elevation(x, z);
      const ledge = bank >= 0 && bank < 2 && Math.abs(z - lip) <= 2;
      const grove = Math.sin(x * 0.3 + phase) + Math.cos(z * 0.23);
      const grass = palette.green.grass;
      const waterStep = x === landingX && z === landingZ;
      const color = waterStep ? palette.ground.stone : path !== undefined || yards.paths.has(x + "," + z) ? palette.ground.path : bank < 0 ? palette.ground.riverbed
        : ledge ? palette.ground.stone : grass;
      base(x, (h - 4.5) / 2, z, 1, h + 3.5, 1, ledge ? palette.ground.stone : palette.ground.soil);
      ground(x, h - 0.25, z, 1, 0.5, 1, color);
      if (bank < 0) {
        const y = level(x, z);
        const l = x - 0.5, r = x + 0.5, b = z - 0.5, f = z + 0.5;
        vertices.push(l,y,b, l,y,f, r,y,b, r,y,b, l,y,f, r,y,f);
        // Draw the exposed faces of water blocks, omitting shared faces so
        // transparency does not accumulate between neighboring river cells.
        for (const [dx, dz] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) {
          const nx = x + dx, nz = z + dz;
          const cut = Math.abs(nx) > radiusX || Math.abs(nz) > radiusZ;
          const wet = !cut && bankDistance(nx, nz) < 0;
          const low = Math.max(h, cut ? h : wet ? level(nx, nz) : elevation(nx, nz));
          if (low >= y) continue;
          const faceX = x + dx * 0.5, faceZ = z + dz * 0.5;
          const ax = faceX - dz * 0.5, az = faceZ + dx * 0.5;
          const bx = faceX + dz * 0.5, bz = faceZ - dx * 0.5;
          const foot = wet ? level(nx, nz) : low;
          vertices.push(ax,foot,az, bx,foot,bz, ax,y,az, bx,foot,bz, bx,y,bz, ax,y,az);
          if (!wet) continue;
          // A narrow aerated crest traces the entire lip, including the notch.
          spray.box(faceX - dx / 16, y, faceZ - dz / 16,
            dz ? 1 : 0.125, 0.125, dx ? 1 : 0.125, palette.water.foam);
          if (dz === 1) {
            const ripple = Math.sin(x * 4.1 + z + phase);
            const spread = ripple > 0 ? 0.75 : 0.5;
            spray.box(x, foot + 0.0625, faceZ + spread / 2, 0.75, 0.125, spread, palette.water.foam);
            const run = (y - foot) * (0.45 + 0.2 * ripple);
            spray.box(x + ripple * 0.25, y - run / 2, faceZ + 0.0625, 0.125, run, 0.125, palette.water.froth);
            spray.box(x - 0.25, foot + 0.125, faceZ + spread, 0.25, 0.25, 0.25, palette.water.froth);
          }
        }
        continue;
      }
      if (yards.near(x, z) || yards.paths.has(x + "," + z) || Math.abs(x) >= radiusX - 1 || Math.abs(z) >= radiusZ - 1 || bank < 2 ||
        Math.hypot(x - cabinX, z - cabinZ) < 3.5 || (stack && Math.hypot(x - stack.x, z - stack.z) < 2) || trail.near(x, z)) continue;
      if (chance < 0.024 + 0.105 * Math.max(0, grove)) plantTree(x, h, z, grove > 1 ? "pine" : "broadleaf", sapling);
    }
  }
  const water = new THREE.BufferGeometry();
  water.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  water.computeVertexNormals();
  const foam = spray.buildMesh();
  foam.material.transparent = true;
  foam.material.opacity = 0.55;
  foam.material.depthWrite = false;
  foam.castShadow = false;
  foam.renderOrder = 2;
  return { mesh: buildMesh(), water, foam };
}
