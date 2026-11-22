import { terrainField } from "./terrain";
import { placeOutbuildings } from "./outbuildings";
import { treeVoxel } from "./scale";
import { defaultDesigns } from "./designs";
import { findSite } from "./sites";
import { riverDepthMap } from "./water";
import { terrainTrail } from "./trails";
import { footbridge, waypost } from "./trail-details";
import { palette } from "./palette";
import { waterfowl } from "./ducks";
import { treePlanter } from "./trees";
import { seededRandom, voxelBatch } from "./voxels";
import * as THREE from "three";

export function buildWoods(seed: number, model: boolean, grid = 1, designs = defaultDesigns) {
  const random = seededRandom(seed);
  const relief = terrainField(seed);

  const phase = random() * 2 * Math.PI;
  const radius = Math.round(49 * grid);
  const bends = new Map<number, number>();
  function riverX(z: number) {
    let x = bends.get(z);
    if (x === undefined) {
      x = 14 * relief(33, z) + 4 * Math.sin(z * 0.1 + phase);
      bends.set(z, x);
    }
    return x;
  }
  function elevation(x: number, z: number) {
    const bank = Math.abs(x - riverX(z)) - 3 - 0.8 * Math.cos(z * 0.19);
    const shoulder = 1 - Math.exp(-Math.max(0, bank) / 17);
    const height = bank < 0 ? bank * 0.75 : shoulder * (16 + 14 * relief(x, z));
    return Math.floor(height * 2) / 2 + 0.25;
  }
  const { box, terrainLayer, buildMesh } = voxelBatch();
  const base = terrainLayer(), ground = terrainLayer();

  function banks(z: number) {
    let west = Math.round(riverX(z)), east = west;
    while (elevation(west, z) < 0) west--;
    while (elevation(east, z) < 0) east++;
    return { west, east };
  }
  const crossing = findSite(0, 0, -7, 0, 1, (_, z) => {
    const { west, east } = banks(z);
    const approach = Math.abs(elevation(west - 2, z) - elevation(west, z))
      + Math.abs(elevation(east + 2, z) - elevation(east, z));
    if (elevation(east, z + 1) <= 0 && elevation(east, z - 1) <= 0) return Infinity;
    return east - west + approach + Math.abs(z + 3) * 0.22;
  })!;
  const bridgeZ = crossing.z;
  const { west, east } = banks(bridgeZ);

  const centreX = (west + east) / 2;
  const centreZ = bridgeZ;
  const width = 2 * Math.round(17 * grid) + 1;
  const depth = 2 * Math.round(12 * grid) + 1;
  // Snap the sides to terrain cell boundaries.
  const left = Math.floor(centreX) - width / 2;
  const back = centreZ - depth / 2;
  const inside = (x: number, z: number) => x > left && x < left + width && z > back && z < back + depth;
  const plantTree = treePlanter(box, treeVoxel, designs, seed);
  // Start on each bridge landing. Stay on the bank until the route has
  // climbed out of the channel, then turn towards the forest tracks.
  const signZ = elevation(east, bridgeZ + 1) > 0 ? bridgeZ + 1 : bridgeZ - 1;
  const sign = { x: east, z: signZ };
  const trail = terrainTrail(elevation, (x, z) => elevation(x, z) > 0 && Math.abs(x) <= radius &&
    (x !== sign.x || z !== sign.z));
  const forkX = east + 9;
  for (const [bank, side] of [[west, -1], [east, 1]]) {
    let x = bank + 9 * side, z = bridgeZ;
    const points: [number, number][] = [[bank, z], [x, z]];
    // Survey successive passes across the hills. Local slope and distance
    // determine the tread between these longer-distance destinations.
    while (Math.abs(x) < radius) {
      x = side * Math.min(radius, side * x + 12);
      const line = bridgeZ + side * (6 + 26 * relief(x, 51));
      const pass = findSite(x, x, z - 9, z + 9, 1, (px, pz) =>
        side * (px - riverX(pz)) < 5 ? Infinity :
        elevation(px, pz) + 0.45 * Math.abs(pz - line));
      if (pass) z = pass.z;
      points.push([x, z]);
    }
    trail.route(points);
  }
  // The river track departs the eastern trail for the upstream woods.
  const branch: [number, number][] = [[forkX, bridgeZ]];
  for (let z = bridgeZ - 8; z >= -radius; z -= 8) {
    branch.push([Math.round(riverX(z) + 13 + 6 * relief(73, z)), z]);
  }
  trail.route(branch);
  const occupied = (x: number, z: number) => trail.tiles.has(x + "," + z);
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const junction = findSite(forkX - 12, forkX + 12, bridgeZ - 10, bridgeZ + 10, 1, (x, z) =>
    occupied(x, z) && directions.filter(([dx, dz]) => occupied(x + dx, z + dz)).length >= 3
      ? Math.hypot(x - forkX, z - bridgeZ) : Infinity);
  const signs = [sign];
  if (junction) {
    const verge = [...directions, [-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dz]) => ({ x: junction.x + dx, z: junction.z + dz }))
      .find(p => !occupied(p.x, p.z) && elevation(p.x, p.z) > 0 && Math.abs(p.x - east) > 2);
    if (verge) signs.push(verge);
  }
  for (const p of signs) waypost(box, p.x, elevation(p.x, p.z), p.z, true);
  const bendZ = bridgeZ + 5;
  const slope = (riverX(bendZ + 1) - riverX(bendZ - 1)) / 2;
  waterfowl(box, riverX(bendZ) - 0.75, bendZ, Math.atan2(-1, slope),
    (x, z) => -elevation(Math.round(x), Math.round(z)));

  const tracks = [...trail.tiles.keys()].map(key => {
    const [x, z] = key.split(",").map(Number);
    return { x, z };
  }).filter(p => Math.abs(p.x - centreX) < 15 * grid && Math.abs(p.z - centreZ) < 10 * grid);
  const yards = placeOutbuildings(box, grid >= 3 ? ["shelter", "store"] : [], tracks, 1,
    (x, z) => elevation(Math.round(x), Math.round(z)), (x, z) =>
      inside(x, z) && Math.abs(x - riverX(z)) > 5 && !trail.tiles.has(Math.round(x) + "," + Math.round(z)) &&
      signs.every(p => Math.hypot(x - p.x, z - p.z) > 1));
  // Seed stands along each bank independently, with gaps between seed sources.
  const groves: { x: number; z: number; radius: number }[] = [];
  for (const side of [-1, 1]) {
    for (let z = -radius; z <= radius; z += 9 + random() * 13) {
      groves.push({ x: riverX(z) + side * (7 + random() * 10), z, radius: 4 + random() * 6 });
      groves.push({ x: riverX(z) + side * (19 + random() * 22), z: z + 5, radius: 5 + random() * 6 });
    }
  }
  const candidates: { x: number; z: number; leafPatch: number }[] = [];
  for (let z = -radius; z <= radius; z++) {
    const nearbyGroves = groves.filter(grove => Math.abs(z - grove.z) < grove.radius);
    for (let x = -radius; x <= radius; x++) {
      const pathHeight = trail.tiles.get(x + "," + z);
      const h = pathHeight ?? elevation(x, z);
      const leafPatch = 2 * relief(x + 93, z - 71);
      const onTrail = yards.paths.has(x + "," + z) || pathHeight !== undefined;
      if (!model || inside(x, z)) {
        const groundColor = h < 0 ? palette.ground.riverbed : h < 1 ? palette.ground.sand : palette.green.grass;
        const tint = onTrail ? palette.ground.path : groundColor;
        const edge = model && (x - 0.5 === left || x + 0.5 === left + width ||
          z - 0.5 === back || z + 0.5 === back + depth);
        if (edge) {
          base(x, (h - 4.5) / 2, z, 1, h + 3.5, 1, palette.ground.soil);
          ground(x, h - 0.25, z, 1, 0.5, 1, tint);
          if (h < 0) box(x, h / 2, z, 1, -h, 1, palette.water.cutFace);
        } else {
          ground(x, (h - 4) / 2, z, 1, h + 4, 1, tint);
        }
      }
      if (yards.near(x, z) || onTrail || trail.near(x, z) || signs.some(p => Math.hypot(x - p.x, z - p.z) < 2) || h < 0.5 || (Math.abs(z - bridgeZ) < 3 && x >= west - 2 && x <= east + 2)) continue;

      const bankDistance = Math.abs(x - riverX(z));
      const slope = Math.hypot(elevation(x + 1, z) - h, elevation(x, z + 1) - h);
      const moisture = Math.exp(-((bankDistance - 9) ** 2) / 65);
      let density = 0.009 + 0.35 * Math.max(0, leafPatch) ** 2 / (1 + slope);
      for (const grove of nearbyGroves) {
        const distance = Math.hypot(x - grove.x, z - grove.z) / grove.radius;
        if (distance < 1) density += (1 - distance) ** 2 * (0.95 + moisture) / (1 + slope);
      }
      if (random() < density) candidates.push({ x, z, leafPatch });
    }
  }
  // Work in half-unit cubes for every trunk, branch and leaf. Check actual
  // occupied cells so a sapling can grow beside a high canopy on a slope.
  while (candidates.length) {
    const index = Math.floor(random() * candidates.length);
    const { x, z, leafPatch } = candidates[index];
    candidates[index] = candidates[candidates.length - 1];
    candidates.pop();
    const sapling = random() < 0.27;
    const pine = leafPatch < 0.45;
    if (model && (!inside(x - 1.25, z - 1.25) || !inside(x + 1.25, z + 1.25))) continue;
    plantTree(x, elevation(x, z), z, pine ? "pine" : "broadleaf", sapling);
  }

  const deck = footbridge(box, west, east, bridgeZ, elevation);
  const middle = (west + east) / 2;

  const depthMap = riverDepthMap((x, z) => -elevation(x, z), grid);
  const mesh = buildMesh();
  return { mesh, depth: depthMap, bounds: { x: left + width / 2, z: back + depth / 2, width, depth }, bridge: new THREE.Vector3(middle, deck, bridgeZ) };
}
