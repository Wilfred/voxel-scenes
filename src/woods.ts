import { defaultDesigns } from "./designs";
import { findSite } from "./sites";
import { riverDepthMap } from "./water";
import { terrainTrail } from "./trails";
import { waypost } from "./trail-details";
import { palette } from "./palette";
import { waterfowl } from "./ducks";
import { treePlanter } from "./trees";
import { seededRandom, voxelBatch } from "./voxels";
import * as THREE from "three";

export function buildWoods(seed: number, model: boolean, grid = 1, designs = defaultDesigns) {
  const random = seededRandom(seed);

  const phase = random() * 2 * Math.PI;
  const amplitude = 5 + random() * 3;
  function riverX(z: number) {
    return amplitude * Math.sin(z * 0.12 + phase) + 2 * Math.sin(z * 0.22 + phase);
  }
  function elevation(x: number, z: number) {
    const bank = Math.abs(x - riverX(z)) - 3 - 0.8 * Math.cos(z * 0.19);
    const rise = 0.42 + 0.15 * Math.sin(z * 0.19 + phase) + 0.14 * Math.cos(x * 0.24);
    return Math.max(-3, Math.min(7.75, Math.floor(bank * rise * 2) / 2 + 0.25));
  }
  const { box, buildMesh } = voxelBatch();

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
    return east - west + approach + Math.abs(z + 3) * 0.22;
  })!;
  const bridgeZ = crossing.z;
  const { west, east } = banks(bridgeZ);

  const centreX = (west + east) / 2;
  const centreZ = bridgeZ;
  const radius = Math.round(49 * grid);
  const width = 2 * Math.round(17 * grid) + 1;
  const depth = 2 * Math.round(12 * grid) + 1;
  // Snap the sides to terrain cell boundaries.
  const left = Math.floor(centreX) - width / 2;
  const back = centreZ - depth / 2;
  const inside = (x: number, z: number) => x > left && x < left + width && z > back && z < back + depth;
  const plantTree = treePlanter(box, 0.5, designs);
  // Start on each bridge landing. Stay on the bank until the route has
  // climbed out of the channel, then turn towards the forest tracks.
  const trail = terrainTrail(elevation, (x, z) => elevation(x, z) > 0 && Math.abs(x) <= radius);
  for (const [bank, side] of [[west, -1], [east, 1]]) {
    trail.route([[bank, bridgeZ], [bank + 4 * side, bridgeZ],
      [bank + 10 * side, bridgeZ - 3 * side], [bank + 18 * side, bridgeZ - 4 * side],
      [radius * side, bridgeZ - 15 * side]]);
  }
  // Stand the sign beside the eastern landing, clear of the walking surface.
  const sign = findSite(east + 2, east + 5, bridgeZ - 3, bridgeZ + 3, 1, (x, z) =>
    trail.near(x, z) && !trail.tiles.has(x + "," + z) && elevation(x, z) > 0
      ? Math.hypot(x - east - 3, z - bridgeZ - 1) : Infinity);
  if (sign) waypost(box, sign.x, elevation(sign.x, sign.z), sign.z);
  const bendZ = bridgeZ + 5;
  const slope = (riverX(bendZ + 1) - riverX(bendZ - 1)) / 2;
  waterfowl(box, riverX(bendZ) - 0.75, bendZ, Math.atan2(-1, slope),
    (x, z) => -elevation(Math.round(x), Math.round(z)));

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
    for (let x = -radius; x <= radius; x++) {
      const pathHeight = trail.tiles.get(x + "," + z);
      const h = pathHeight ?? elevation(x, z);
      const leafPatch = Math.sin(x * 0.20 + phase) + Math.sin(z * 0.16);
      const onTrail = pathHeight !== undefined;
      if (!model || inside(x, z)) {
        const ground = h < 0 ? palette.ground.riverbed : h < 1 ? palette.ground.sand : leafPatch > 0 ? palette.green.meadow : palette.green.grass;
        const tint = onTrail ? palette.ground.path : ground;
        const edge = model && (x - 0.5 === left || x + 0.5 === left + width ||
          z - 0.5 === back || z + 0.5 === back + depth);
        if (edge) {
          box(x, (h - 4.5) / 2, z, 1, h + 3.5, 1, palette.ground.soil);
          box(x, h - 0.25, z, 1, 0.5, 1, tint);
          if (h < 0) box(x, h / 2, z, 1, -h, 1, palette.water.cutFace);
        } else {
          box(x, (h - 4) / 2, z, 1, h + 4, 1, tint);
        }
      }
      if (trail.near(x, z) || (sign && Math.hypot(x - sign.x, z - sign.z) < 2) || h < 0.5 || (Math.abs(z - bridgeZ) < 3 && x >= west - 2 && x <= east + 2)) continue;

      const bankDistance = Math.abs(x - riverX(z));
      const slope = Math.hypot(elevation(x + 1, z) - h, elevation(x, z + 1) - h);
      const moisture = Math.exp(-((bankDistance - 9) ** 2) / 65);
      let density = 0.011;
      for (const grove of groves) {
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

  // All timber faces sit on the quarter-unit grid, including the submerged
  // posts. The deck meets the higher bank with one step on the lower side.
  const deck = Math.max(elevation(east, bridgeZ), elevation(west, bridgeZ));
  const span = east - west - 1;
  const middle = (west + east) / 2;
  box(middle, deck - 0.25, bridgeZ, span, 0.5, 1.5, palette.wood);
  for (const side of [-0.75, 0.5]) {
    const z = bridgeZ + side + 0.125;
    box(middle, deck + 0.875, z, span, 0.25, 0.25, palette.wood);
    const bays = Math.ceil(span / 3);
    for (let i = 0; i <= bays; i++) {
      const left = west + 0.5 + Math.round((span - 0.25) * i / bays * 4) / 4;
      const bottom = elevation(Math.round(left + 0.125), Math.round(z)) - 0.5;
      box(left + 0.125, (bottom + deck + 0.75) / 2, z, 0.25, deck + 0.75 - bottom, 0.25, palette.wood);
    }
  }

  const depthMap = riverDepthMap((x, z) => -elevation(x, z), grid);
  const mesh = buildMesh();
  return { mesh, depth: depthMap, bounds: { x: left + width / 2, z: back + depth / 2, width, depth }, bridge: new THREE.Vector3(middle, deck, bridgeZ) };
}
