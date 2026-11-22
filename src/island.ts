import { findSite } from "./sites";
import { waterfowl } from "./ducks";
import { palette } from "./palette";
import { treePlanter } from "./trees";
import { seededRandom, voxelBatch } from "./voxels";
import { buildCottage } from "./cottage";
import * as THREE from "three";

export const bayBounds = { x: 0, z: 0, width: 44, depth: 34 };

export function buildIsland(seed: number, model: boolean) {
  const random = seededRandom(seed);

  const phase = random() * Math.PI * 2;
  const bayX = 1 + random() * 2;
  const bayZ = 5 + random() * 1.5;
  const bayWidth = 8 + random() * 2;
  const ridgeX = -10 - random() * 2;

  const unit = 0.5;
  function naturalHeight(x: number, z: number) {
    // Offset the bay toward the eastern tip to leave a longer western arm.
    const angle = Math.atan2(z / 12, x / 17);
    const edge = 1 + 0.055 * Math.sin(3 * angle + phase) + 0.04 * Math.cos(5 * angle - phase);
    const outer = (edge - Math.hypot(x / 17, (z + 0.20 * x) / 12)) * 12;
    const inner = (Math.hypot((x - bayX) / bayWidth, (z - bayZ) / 10) - 1) * 9;
    const inland = Math.min(outer, inner);
    const ridge = Math.exp(-((x - ridgeX) ** 2 / 36 + (z + 1) ** 2 / 68));
    return Math.floor(inland * (0.7 + 1.55 * ridge) / unit) * unit;
  }

  // Follow the inner shoreline onto the wooded headland, then step inland.
  const headlandX = Math.round(bayX - bayWidth * 0.84) + unit / 2;
  let landingZ = Math.floor(bayZ);
  while (naturalHeight(headlandX, landingZ) < 0) landingZ -= unit;
  const cottage = findSite(headlandX - 1, headlandX + 1, landingZ - 8, landingZ - 2, unit, (x, z) => {
    const h = naturalHeight(x, z);
    if (h < 2) return Infinity;
    const corners = [-1, 1].flatMap(dx => [-0.5, 0.5].map(dz => naturalHeight(x + dx, z + dz)));
    return Math.max(...corners) - Math.min(...corners) + Math.abs(h - 2.5) +
      Math.abs(x - headlandX) + Math.abs(z - landingZ + 4) * 0.25;
  })!;
  const { x: cottageX, z: cottageZ } = cottage;
  const terrace = naturalHeight(cottageX, cottageZ);
  const cottageScale = 0.75;
  const foundationTop = terrace + unit;
  const dockTop = unit;
  // Terrain cells are centred on multiples of 0.5, so their faces are at ±0.25.
  const stairStart = cottageZ + 1.25;
  landingZ = stairStart;
  while (naturalHeight(cottageX, landingZ) >= 0) landingZ += unit;
  const risers = (foundationTop - dockTop) / unit;
  // Divide the distance to the water into whole-cell runs, keeping the
  // last tread at the shoreline even when the run isn't divisible by the rise.
  const runCells = Math.max(risers, Math.ceil((landingZ - stairStart) / unit));
  const steps = Array.from({ length: risers }, (_, i) => ({
    start: stairStart + unit * Math.floor(i * runCells / risers),
    end: stairStart + unit * Math.floor((i + 1) * runCells / risers),
    top: foundationTop - (i + 1) * unit,
  }));
  const stairEnd = steps[steps.length - 1].end;
  const doorZ = cottageZ + cottageScale;
  function height(x: number, z: number) {
    if (Math.abs(x - cottageX) <= 1 && Math.abs(z - cottageZ) <= 0.5) return terrace;
    return naturalHeight(x, z);
  }

  const { box, buildMesh } = voxelBatch();
  const plantTree = treePlanter(box, 0.25);

  for (let z = -14; z <= 14; z += 0.5) {
    for (let x = -21; x <= 21; x += 0.5) {
      const h = height(x, z);
      if (h < 0) continue;
      // The landing and stairs replace entire columns in the bank. Their
      // supports fill those columns down to the same base as the terrain.
      if (Math.abs(x - cottageX) < unit && z > doorZ && z < stairEnd) continue;
      const top = h + unit;
      const soilTop = h >= 1 ? h : top;
      box(x, (soilTop - unit) / 2, z, unit, soilTop + unit, unit, h < 1 ? palette.ground.sand : palette.ground.stone);
      if (h < 1) continue;
      box(x, top - unit / 2, z, unit, unit, unit, palette.green.meadow);
      const grove = (1 + Math.sin(x * 0.8 + phase) * Math.cos(z * 0.6)) / 2;
      const density = (x < -6 ? 0.26 : 0.14) * grove;
      if (Math.hypot(x - cottageX, z - cottageZ) < 2 || random() > density) continue;
      plantTree(x, top, z, "pine", random() < 0.25);
    }
  }

  function cottageBox(x: number, y: number, z: number, w: number, h: number, d: number, color: number) {
    box(cottageX + x * cottageScale, foundationTop + (y - 0.4) * cottageScale, cottageZ + z * cottageScale,
      w * cottageScale, h * cottageScale, d * cottageScale, color);
  }
  buildCottage(cottageBox);

  for (const { start, end, top } of [{ start: doorZ, end: stairStart, top: foundationTop }, ...steps]) {
    const z = (start + end) / 2;
    const stoneTop = top - unit;
    box(cottageX, (stoneTop - unit) / 2, z, 1, stoneTop + unit, end - start, palette.ground.stone);
    box(cottageX, top - unit / 2, z, 1, unit, end - start, palette.wood);
  }
  const dockLength = 2;
  box(cottageX, dockTop - unit / 2, stairEnd + dockLength / 2, 1, unit, dockLength, palette.wood);
  for (const side of [-1, 1]) {
    const x = cottageX + side * (0.5 + unit / 2);
    const z = stairEnd + dockLength - unit / 2;
    const foot = Math.min(-unit, naturalHeight(x, z) - unit);
    const postTop = dockTop + unit;
    box(x, (postTop + foot) / 2, z, unit, postTop - foot, unit, palette.wood);
  }

  // The floor mesh and the water's absorption map use the same soundings.
  const resolution = 128;
  const floorGeometry = new THREE.PlaneGeometry(model ? bayBounds.width : 64, model ? bayBounds.depth : 64, resolution - 1, resolution - 1);
  floorGeometry.rotateX(-Math.PI / 2);
  const positions = floorGeometry.getAttribute("position");
  const samples = new Uint8Array(resolution * resolution);
  const colors = new Float32Array(positions.count * 3);
  const wetSand = new THREE.Color(palette.ground.sand);
  const silt = new THREE.Color(palette.ground.silt);
  const floorColor = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const y = THREE.MathUtils.clamp(naturalHeight(x, z), -7, -0.14);
    // The shader samples a fixed 64-unit footprint in both framings.
    const sampleX = ((i % resolution) / (resolution - 1) - 0.5) * 64;
    const sampleZ = (Math.floor(i / resolution) / (resolution - 1) - 0.5) * 64;
    samples[i] = Math.round(255 * THREE.MathUtils.clamp(-naturalHeight(sampleX, sampleZ) / 6, 0.14 / 6, 1));
    // Extend the outer ring under the whole view so the horizon has a bottom.
    positions.setXYZ(i, Math.abs(x) === 32 ? x * 8 : x, y, Math.abs(z) === 32 ? z * 8 : z);
    const patches = Math.sin(x * 0.8 + phase) * Math.sin(z * 0.64 + x * 0.24);
    floorColor.copy(wetSand).lerp(silt, THREE.MathUtils.clamp(-y / 7 + patches * 0.13, 0, 1));
    floorColor.toArray(colors, i * 3);
  }
  floorGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  floorGeometry.computeVertexNormals();
  const floor = new THREE.Mesh(floorGeometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
  floor.receiveShadow = true;

  // Submerged stones give the transparent shallows visible depth cues.
  for (let i = 0; i < 550; i++) {
    const x = random() * 44 - 22;
    const z = random() * 32 - 16;
    const y = naturalHeight(x, z);
    if (y > -0.5 || y < -2.5) continue;
    const size = 0.22 + random() * 0.52;
    box(x, y, z, size, size * 0.7, size * 0.8, palette.ground.stone);
  }
  waterfowl(box, bayX - 0.5, bayZ + 0.5, -0.45, (x, z) => -naturalHeight(x, z));
  const depth = new THREE.DataTexture(samples, resolution, resolution, THREE.RedFormat);
  depth.magFilter = depth.minFilter = THREE.LinearFilter;
  depth.needsUpdate = true;

  if (model) {
    // Enclose the bounded seabed and water on the four exposed cut faces.
    const { width, depth } = bayBounds;
    box(0, -7.5, 0, width, 1, depth, palette.ground.soil);
    for (const side of [-1, 1]) {
      box(side * (width / 2 - 0.01), -3.5, 0, 0.02, 7, depth, palette.water.cutFace);
      box(0, -3.5, side * (depth / 2 - 0.01), width, 7, 0.02, palette.water.cutFace);
    }
  }
  const mesh = buildMesh();
  return { mesh, floor, depth };
}
