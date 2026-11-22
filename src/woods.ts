import { addNatureProp, type NatureProp } from "./tiny-nature";
import { treePlanter } from "./trees";
import { seededRandom, voxelBatch } from "./voxels";
import * as THREE from "three";

export function buildWoods(seed: number, model: boolean, importedProps: boolean) {
  const random = seededRandom(seed);

  const phase = random() * 2 * Math.PI;
  const amplitude = 5 + random() * 3;
  function riverX(z: number) {
    return amplitude * Math.sin(z * 0.12 + phase) + 2 * Math.sin(z * 0.22 + phase);
  }
  function elevation(x: number, z: number) {
    const bank = Math.abs(x - riverX(z)) - 3 - 0.8 * Math.cos(z * 0.19);
    const rise = 0.42 + 0.15 * Math.sin(z * 0.19 + phase) + 0.14 * Math.cos(x * 0.24);
    return Math.max(-3, Math.min(8, Math.floor(bank * rise * 2) / 2 + 0.25));
  }
  const { box, buildMesh } = voxelBatch();

  const bridgeZ = -3;
  let west = Math.round(riverX(bridgeZ));
  let east = west;
  while (elevation(west, bridgeZ) < 0) west--;
  while (elevation(east, bridgeZ) < 0) east++;

  const centreX = (west + east) / 2;
  const centreZ = bridgeZ;
  const width = 35;
  const depth = 25;
  // Snap the sides to terrain cell boundaries.
  const left = Math.floor(centreX) - 17.5;
  const back = centreZ - 12.5;
  const inside = (x: number, z: number) => x > left && x < left + width && z > back && z < back + depth;
  const plantTree = treePlanter(box, 0.5);
  // Route each approach over dry, face-adjacent terrain. Prefer gentle grades
  // and a diagonal traverse; leave the height of every path voxel intact.
  const trail = new Set<string>();
  function approach(start: number, direction: number) {
    type Step = { x: number; z: number; cost: number; viaZ: number; previous?: Step };
    let front = new Map<number, Step>([[bridgeZ, { x: start, z: bridgeZ, cost: 0, viaZ: bridgeZ }]]);
    for (let x = start + direction; Math.abs(x) <= 49; x += direction) {
      const next = new Map<number, Step>();
      const distance = Math.abs(x - start);
      const guide = bridgeZ - direction * (0.45 * distance + 2 * Math.sin(distance / 5));
      for (const step of front.values()) {
        const h = elevation(x, step.z);
        if (h < 0 || Math.abs(h - elevation(step.x, step.z)) > 0.5) continue;
        for (const dz of [0, -1, 1]) {
          const z = step.z + dz;
          const end = elevation(x, z);
          if (Math.abs(z) > 49 || end < 0 || Math.abs(end - h) > 0.5) continue;
          const cost = step.cost + Math.abs(z - guide) * 0.16 + Math.abs(dz) * 0.3
            + Math.abs(end - h) + Math.abs(h - elevation(step.x, step.z));
          if (cost < (next.get(z)?.cost ?? Infinity)) {
            next.set(z, { x, z, cost, viaZ: step.z, previous: step });
          }
        }
      }
      if (!next.size) break;
      front = next;
    }
    let end: Step | undefined = [...front.values()].reduce((a, b) => a.cost < b.cost ? a : b);
    while (end) {
      trail.add(end.x + "," + end.z);
      trail.add(end.x + "," + end.viaZ);
      end = end.previous;
    }
  }
  approach(west, -1);
  approach(east, 1);

  const propSites: { x: number; z: number }[] = [];
  if (importedProps) {
    // Two canopy heights frame the stream, with a cut stump beside the crossing.
    const landmarks: [NatureProp, number, number][] = [
      ["tree01", west - 5, bridgeZ - 5],
      ["tree02", east + 4, bridgeZ + 4],
      ["treeStump", west - 2, bridgeZ + 2],
    ];
    for (const [prop, targetX, targetZ] of landmarks) {
      let site: { x: number; z: number } | undefined;
      let nearest = Infinity;
      for (let z = targetZ - 4; z <= targetZ + 4; z++) {
        for (let x = targetX - 4; x <= targetX + 4; x++) {
          if (!inside(x - 1, z - 1) || !inside(x + 1, z + 1)) continue;
          if (elevation(x, z) < 0.5 || trail.has(x + "," + z)) continue;
          if (propSites.some(p => Math.hypot(p.x - x, p.z - z) < 3)) continue;
          const distance = Math.hypot(x - targetX, z - targetZ);
          if (distance < nearest) {
            nearest = distance;
            site = { x, z };
          }
        }
      }
      if (site) {
        propSites.push(site);
        addNatureProp(box, prop, site.x, elevation(site.x, site.z), site.z);
      }
    }
  }

  // Seed stands along each bank independently, with gaps between seed sources.
  const groves: { x: number; z: number; radius: number }[] = [];
  for (const side of [-1, 1]) {
    for (let z = -49; z < 50; z += 9 + random() * 13) {
      groves.push({ x: riverX(z) + side * (7 + random() * 10), z, radius: 4 + random() * 6 });
      groves.push({ x: riverX(z) + side * (19 + random() * 22), z: z + 5, radius: 5 + random() * 6 });
    }
  }
  const candidates: { x: number; z: number; leafPatch: number }[] = [];
  for (let z = -49; z <= 49; z++) {
    for (let x = -49; x <= 49; x++) {
      const h = elevation(x, z);
      const leafPatch = Math.sin(x * 0.20 + phase) + Math.sin(z * 0.16);
      const onTrail = trail.has(x + "," + z);
      if (!model || inside(x, z)) {
        const ground = h < 0 ? 0x8e967b : h < 1 ? 0xabaa7b : leafPatch > 0 ? 0x91945b : 0x7e8c5d;
        const tint = onTrail ? 0xad906a : ground;
        const edge = model && (x - 0.5 === left || x + 0.5 === left + width ||
          z - 0.5 === back || z + 0.5 === back + depth);
        if (edge) {
          box(x, (h - 4.5) / 2, z, 1, h + 3.5, 1, 0x886f58);
          box(x, h - 0.25, z, 1, 0.5, 1, tint);
          if (h < 0) box(x, h / 2, z, 1, -h, 1, 0x508782);
        } else {
          box(x, (h - 4) / 2, z, 1, h + 4, 1, tint);
        }
      }
      if (onTrail || h < 0.5 || (Math.abs(z - bridgeZ) < 3 && x >= west - 2 && x <= east + 2)) continue;

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
    if (propSites.some(p => Math.abs(x - p.x) <= 2 && Math.abs(z - p.z) <= 2)) continue;
    plantTree(x, elevation(x, z), z, pine ? "pine" : "broadleaf", sapling);
  }

  // All timber faces sit on the quarter-unit grid, including the submerged
  // posts. The deck meets the higher bank with one step on the lower side.
  const deck = Math.max(elevation(east, bridgeZ), elevation(west, bridgeZ));
  const span = east - west - 1;
  const middle = (west + east) / 2;
  box(middle, deck - 0.25, bridgeZ, span, 0.5, 1.5, 0x947457);
  for (const side of [-0.75, 0.5]) {
    const z = bridgeZ + side + 0.125;
    box(middle, deck + 0.875, z, span, 0.25, 0.25, 0x806447);
    const bays = Math.ceil(span / 3);
    for (let i = 0; i <= bays; i++) {
      const left = west + 0.5 + Math.round((span - 0.25) * i / bays * 4) / 4;
      const bottom = elevation(Math.round(left + 0.125), Math.round(z)) - 0.5;
      box(left + 0.125, (bottom + deck + 0.75) / 2, z, 0.25, deck + 0.75 - bottom, 0.25, 0x776047);
    }
  }

  // The existing water shader samples a 64-unit square centered at the origin.
  const samples = new Uint8Array(128 * 128);
  for (let i = 0; i < samples.length; i++) {
    const x = Math.floor((i % 128 + 0.5) / 2 - 31.5);
    const z = Math.floor((Math.floor(i / 128) + 0.5) / 2 - 31.5);
    samples[i] = Math.round(255 * Math.max(0, -elevation(x, z)) / 6);
  }
  const depthMap = new THREE.DataTexture(samples, 128, 128, THREE.RedFormat);
  depthMap.magFilter = depthMap.minFilter = THREE.LinearFilter;
  depthMap.needsUpdate = true;
  const mesh = buildMesh();
  return { mesh, depth: depthMap, bounds: { x: left + width / 2, z: back + depth / 2, width, depth }, bridge: new THREE.Vector3(middle, deck, bridgeZ) };
}
