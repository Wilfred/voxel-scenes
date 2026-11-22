import { treePlanter } from "./trees";
import { seededRandom, voxelBatch } from "./voxels";
import { buildCottage } from "./cottage";
import * as THREE from "three";

export const islandPalette = {
  sea: 0x397e92, sky: 0xffd1a4, beach: 0xffcd85, turf: 0xc1ac60, rock: 0xbd8468,
  sun: [-35, 16, 14], eye: [8, 29, 43], span: 25,
};

export function buildIsland(seed: number) {
  const p = islandPalette;
  const random = seededRandom(seed);

  const phase = random() * Math.PI * 2;
  const bayX = 1 + random() * 2;
  const bayZ = 5 + random() * 1.5;
  const bayWidth = 8 + random() * 2;
  const ridgeX = -10 - random() * 2;

  function naturalHeight(x: number, z: number) {
    // Offset the bay toward the eastern tip to leave a longer western arm.
    const angle = Math.atan2(z / 12, x / 17);
    const edge = 1 + 0.055 * Math.sin(3 * angle + phase) + 0.04 * Math.cos(5 * angle - phase);
    const outer = (edge - Math.hypot(x / 17, (z + 0.20 * x) / 12)) * 12;
    const inner = (Math.hypot((x - bayX) / bayWidth, (z - bayZ) / 10) - 1) * 9;
    const inland = Math.min(outer, inner);
    const ridge = Math.exp(-((x - ridgeX) ** 2 / 36 + (z + 1) ** 2 / 68));
    return Math.floor(inland * (0.7 + 1.55 * ridge) * 4) / 4;
  }

  // Follow the inner shoreline onto the wooded headland, then step inland.
  const cottageX = Math.round(bayX - bayWidth * 0.84);
  let landingZ = Math.floor(bayZ);
  while (naturalHeight(cottageX, landingZ) < 0) landingZ -= 0.5;
  let cottageZ = landingZ - 1.5;
  while (naturalHeight(cottageX, cottageZ) < 1.75) cottageZ -= 0.5;
  const terrace = naturalHeight(cottageX, cottageZ);
  const unit = 0.25;
  const cottageScale = 0.75;
  const foundationTop = terrace + 2 * unit;
  const dockTop = unit;
  const stairStart = cottageZ + 1;
  const risers = (foundationTop - dockTop) / unit;
  // Whole voxel runs reach the shoreline; every tread drops exactly one voxel.
  const treadDepth = unit * Math.max(1, Math.ceil((landingZ + unit - stairStart) / (risers * unit)));
  const stairEnd = stairStart + risers * treadDepth;
  function height(x: number, z: number) {
    if (Math.abs(x - cottageX) <= 1 && Math.abs(z - cottageZ) <= 0.5) return terrace;
    return naturalHeight(x, z);
  }

  const { box, buildMesh } = voxelBatch();
  const plantTree = treePlanter(box, 0.25);

  for (let z = -14; z <= 14; z += 0.5) {
    for (let x = -21; x <= 21; x += 0.5) {
      let h = height(x, z);
      if (h < 0) continue;
      // Cut the bank below the lowest tread overlapping each voxel.
      const stairCorridor = Math.abs(x - cottageX) <= 0.5
        && z + 0.25 >= stairStart && z - 0.25 <= stairEnd;
      if (stairCorridor) {
        const step = Math.min(risers, Math.floor((z + 0.25 - stairStart) / treadDepth) + 1);
        h = Math.min(h, foundationTop - (step + 2) * unit);
      }
      const top = h + unit;
      const soilTop = h >= 1 && !stairCorridor ? h : top;
      box(x, (soilTop - unit) / 2, z, 0.5, soilTop + unit, 0.5, h < 1 ? p.beach : p.rock);
      if (stairCorridor) continue;
      if (h < 1) continue;
      box(x, top - unit / 2, z, 0.5, unit, 0.5, p.turf);
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
  buildCottage(cottageBox, p.rock);

  const doorZ = cottageZ + cottageScale;
  box(cottageX, foundationTop - unit / 2, (doorZ + stairStart) / 2,
    1, unit, stairStart - doorZ, 0xa7835b);
  for (let i = 0; i < risers; i++) {
    const z = stairStart + (i + 0.5) * treadDepth;
    const top = foundationTop - (i + 1) * unit;
    const stoneTop = top - unit;
    box(cottageX, (stoneTop - unit) / 2, z, 1, stoneTop + unit, treadDepth, p.rock);
    box(cottageX, top - unit / 2, z, 1, unit, treadDepth, 0xad865a);
  }
  const dockLength = 1.75;
  box(cottageX, dockTop - unit / 2, stairEnd + dockLength / 2, 1, unit, dockLength, 0x926a47);
  for (const side of [-1, 1]) {
    const x = cottageX + side * (0.5 + unit / 2);
    const z = stairEnd + dockLength - unit / 2;
    const foot = Math.min(-unit, naturalHeight(x, z) - unit);
    const postTop = dockTop + unit;
    box(x, (postTop + foot) / 2, z, unit, postTop - foot, unit, 0x624832);
  }

  // The floor mesh and the water's absorption map use the same soundings.
  const resolution = 128;
  const floorGeometry = new THREE.PlaneGeometry(64, 64, resolution - 1, resolution - 1);
  floorGeometry.rotateX(-Math.PI / 2);
  const positions = floorGeometry.getAttribute("position");
  const samples = new Uint8Array(resolution * resolution);
  const colors = new Float32Array(positions.count * 3);
  const wetSand = new THREE.Color(p.beach);
  const silt = new THREE.Color(0x506d60);
  const floorColor = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const y = THREE.MathUtils.clamp(naturalHeight(x, z), -7, -0.14);
    samples[i] = Math.round(255 * Math.min(-y / 6, 1));
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
    box(x, y, z, size, size * 0.7, size * 0.8, p.rock);
  }
  const depth = new THREE.DataTexture(samples, resolution, resolution, THREE.RedFormat);
  depth.magFilter = depth.minFilter = THREE.LinearFilter;
  depth.needsUpdate = true;

  const mesh = buildMesh();
  return { mesh, floor, depth };
}
