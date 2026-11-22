import { treePlanter } from "./trees";
import { seededRandom, voxelBatch } from "./voxels";
import { buildCottage } from "./cottage";
import * as THREE from "three";

export function buildMountains(seed: number) {
  const random = seededRandom(seed);

  const phase = random() * Math.PI * 2;
  const summitX = -14 + random() * 5;
  const summitZ = -35 - random() * 5;
  const summitHeight = 36 + random() * 4;
  const { box, buildMesh } = voxelBatch();
  const plantTree = treePlanter(box, 0.25);
  function elevation(x: number, z: number) {
    const dx = x - summitX;
    const dz = z - summitZ;
    const angle = Math.atan2(dz, dx);
    // Spurs radiate from one summit. The long southern spur carries the cabin.
    const spur = 1.02 + 0.18 * Math.cos(3 * angle + phase) + 0.12 * Math.cos(5 * angle)
      + 0.32 * Math.exp(-((angle - 2.12) ** 2) / 0.14);
    const radius = Math.hypot(dx, dz * 0.74) / spur;
    const outcrops = Math.sin(dx * 0.67 + dz * 0.31 + phase) + 0.5 * Math.sin(dz * 0.8);
    const base = summitHeight * Math.exp(-radius / 24);
    return Math.max(0.5, Math.round((base + outcrops * Math.min(1, radius / 5) * base / 18) * 2) / 2);
  }
  // The extra eastern and southern samples provide neighbors for slope shading.
  const width = 129;
  const heights = new Float32Array(width * 157);
  function cell(x: number, z: number) {
    return (z + 90) * width + x + 62;
  }
  for (let z = -90; z <= 66; z++) {
    for (let x = -62; x <= 66; x++) heights[cell(x, z)] = elevation(x, z);
  }

  // Rank three-by-three footprints by relief, then by access at the front
  // door. Among equally suitable shelves, prefer the near shoulder.
  let cabinX = -4;
  let cabinZ = 7;
  let bestScore = Infinity;
  let foundation = 0;
  for (let z = -1; z <= 18; z++) {
    for (let x = -15; x <= 5; x++) {
      let low = Infinity;
      let high = -Infinity;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const h = heights[cell(x + dx, z + dz)];
          low = Math.min(low, h);
          high = Math.max(high, h);
        }
      }
      const score = 100 * (high - low) + 20 * Math.abs(high - heights[cell(x, z + 1)])
        + Math.hypot(x + 4, z - 7);
      if (score < bestScore) {
        bestScore = score;
        foundation = high;
        cabinX = x;
        cabinZ = z;
      }
    }
  }
  // Walk existing ground in cardinal steps. Search around ledges instead of
  // grading them; the foreground edge is the destination.
  const start = cell(cabinX, cabinZ + 1);
  const parent = new Int32Array(heights.length).fill(-1);
  parent[start] = start;
  const queue = [start];
  let end = start;
  for (let i = 0; i < queue.length; i++) {
    const here = queue[i];
    const x = here % width - 62;
    const z = Math.floor(here / width) - 90;
    if (z > Math.floor(end / width) - 90) end = here;
    if (z === 65) break;
    const bend = cabinX + 4 * Math.sin((z - cabinZ) * 0.14);
    const side = x < bend ? 1 : -1;
    for (const next of [here + width, here + side, here - side, here - width]) {
      const nx = next % width - 62;
      if (Math.abs(nx - cabinX) > 14 || next < start - 14 || parent[next] !== -1) continue;
      if (Math.abs(heights[next] - heights[here]) > 0.5) continue;
      parent[next] = here;
      queue.push(next);
    }
  }
  const trail = new Set([start]);
  for (let at = end; at !== start; at = parent[at]) trail.add(at);

  for (let z = -90; z <= 65; z++) {
    for (let x = -62; x <= 65; x++) {
      const index = cell(x, z);
      const h = heights[index];
      const exposure = Math.sin(x * 0.27 + phase) + Math.cos(z * 0.33);
      const slope = Math.hypot(heights[index + 1] - h, heights[index + width] - h);
      const stone = h + slope * 2 + exposure > 13.5;
      const snow = h - slope * 1.6 + exposure > 17.2;
      const color = snow ? 0xf4e6ce : stone ? 0x867d80 : h + exposure > 9 ? 0xa29b76 : 0x808959;
      box(x, h / 2 - 1, z, 1, h + 2, 1, trail.has(index) ? 0xbc9870 : color);
      if (trail.has(index)) continue;
      const grove = Math.sin(x * 0.29 + phase) + Math.cos(z * 0.33);
      const distance = Math.hypot(x - cabinX, z - cabinZ);
      const density = (0.10 + 0.08 * grove) * (distance < 4 ? 0.75 : 1);
      if (stone || distance <= 2.25 || random() > density) continue;
      plantTree(x, h, z, "pine", random() < 0.25);
    }
  }
  buildCottage((x, y, z, w, h, d, color) => {
    box(cabinX + x, foundation + y - 0.4, cabinZ + z, w, h, d, color);
  }, 0x84776e);

  const mesh = buildMesh();
  return {
    mesh,
    cabin: new THREE.Vector3(cabinX, foundation + 1, cabinZ),
    peak: new THREE.Vector3(summitX, summitHeight + 0.5, summitZ),
  };
}
