import { defaultDesigns } from "./designs";
import { findSite } from "./sites";
import { waterfowl } from "./ducks";
import { palette } from "./palette";
import { treePlanter } from "./trees";
import { seededRandom, voxelBatch } from "./voxels";
import { buildCottage, cottageDoor } from "./cottage";
import * as THREE from "three";

export function buildIsland(seed: number, model: boolean, grid = 1, designs = defaultDesigns) {
  const bounds = { x: 0, z: 0, width: 44 * grid, depth: 34 * grid };
  const random = seededRandom(seed);

  const phase = random() * Math.PI * 2;
  const bayX = 1 + random() * 2;
  const bayZ = 5 + random() * 1.5;
  const bayWidth = 8 + random() * 2;
  const ridgeX = -10 - random() * 2;

  const unit = 0.5;
  function naturalHeight(worldX: number, worldZ: number) {
    const x = worldX / grid, z = worldZ / grid;
    // Offset the bay toward the eastern tip to leave a longer western arm.
    const angle = Math.atan2(z / 12, x / 17);
    const edge = 1 + 0.055 * Math.sin(3 * angle + phase) + 0.04 * Math.cos(5 * angle - phase);
    const outer = (edge - Math.hypot(x / 17, (z + 0.20 * x) / 12)) * 12;
    const inner = (Math.hypot((x - bayX) / bayWidth, (z - bayZ) / 10) - 1) * 9;
    const inland = Math.min(outer, inner);
    const ridge = Math.exp(-((x - ridgeX) ** 2 / 36 + (z + 1) ** 2 / 68));
    return Math.floor(inland * (0.7 + 1.55 * ridge) / unit) * unit;
  }

  // Survey water cells touching dry land. Ranking the nearest one for each
  // shelf lets the house face a short, visible route into the sheltered cove.
  const shoreline: { x: number; z: number }[] = [];
  for (let z = -Math.ceil(15 * grid); z <= 15 * grid; z += unit) {
    for (let x = -Math.ceil(20 * grid); x <= 20 * grid; x += unit) {
      if (naturalHeight(x, z) >= 0) continue;
      if ([[unit, 0], [-unit, 0], [0, unit], [0, -unit]].some(([dx, dz]) => naturalHeight(x + dx, z + dz) >= 0)) {
        shoreline.push({ x, z });
      }
    }
  }
  function nearestWater(x: number, z: number) {
    let closest = shoreline[0], best = Infinity;
    for (const cell of shoreline) {
      const distance = (cell.x - x) ** 2 + (cell.z - z) ** 2;
      if (distance < best) { best = distance; closest = cell; }
    }
    return closest;
  }
  const headlandX = Math.round((bayX - bayWidth * 0.9) * grid);
  const cottage = findSite(headlandX - 4 * grid, headlandX + 3 * grid, -Math.ceil(10 * grid), 5 * grid, unit, (x, z) => {
    const h = naturalHeight(x, z);
    if (h < 2) return Infinity;
    const shore = nearestWater(x, z);
    const dx = shore.x - x, dz = shore.z - z;
    const corners = [-1, 1].flatMap(ox => [-0.5, 0.5].map(oz => naturalHeight(x + ox, z + oz)));
    const shelf = Math.max(...corners) - Math.min(...corners);
    const bayDistance = Math.hypot(shore.x / grid - bayX, shore.z / grid - bayZ);
    const facesAway = Math.abs(dx) > Math.abs(dz) ? dx < 0 : dz < 0;
    return shelf + Math.abs(h - 2.5) + bayDistance * 0.7 + (facesAway ? 8 : 0)
      + Math.abs(x - headlandX) * 0.15 + Math.hypot(dx, dz) * 0.25;
  })!;
  const { x: cottageX, z: cottageZ } = cottage;
  const terrace = naturalHeight(cottageX, cottageZ);
  const cottageScale = 0.75;
  const foundationTop = terrace + unit;
  const dockTop = unit;
  const shore = nearestWater(cottageX, cottageZ);
  const dx = shore.x - cottageX, dz = shore.z - cottageZ;
  const forwardX = Math.abs(dx) > Math.abs(dz) ? Math.sign(dx) : 0;
  const forwardZ = forwardX === 0 ? Math.sign(dz) : 0;
  const sideX = forwardZ, sideZ = -forwardX;
  let x = cottageX + forwardX, z = cottageZ + forwardZ;
  const route = [{ x, z }];
  while (x !== shore.x || z !== shore.z) {
    if (Math.abs(shore.x - x) > Math.abs(shore.z - z)) x += Math.sign(shore.x - x) * unit;
    else z += Math.sign(shore.z - z) * unit;
    route.push({ x, z });
  }
  // Very steep banks need a few more cells of run out over the water.
  const risers = Math.round((foundationTop - dockTop) / unit);
  while (route.length <= risers) {
    x += forwardX * unit; z += forwardZ * unit;
    route.push({ x, z });
  }
  const stairs = new Set(route.map(p => p.x + "," + p.z));
  const doorOffset = cottageDoor(designs.cottage) * cottageScale;
  const centreX = cottageX - sideX * doorOffset;
  const centreZ = cottageZ - sideZ * doorOffset;
  function height(x: number, z: number) {
    const across = (x - centreX) * sideX + (z - centreZ) * sideZ;
    const along = (x - centreX) * forwardX + (z - centreZ) * forwardZ;
    if (Math.abs(across) <= 1 && Math.abs(along) <= 0.75) return terrace;
    return naturalHeight(x, z);
  }

  const { box, terrainLayer, buildMesh } = voxelBatch();
  const base = terrainLayer(), ground = terrainLayer();
  const plantTree = treePlanter(box, 0.25, designs);

  for (let z = -Math.ceil(14 * grid); z <= Math.ceil(14 * grid); z += 0.5) {
    for (let x = -Math.ceil(21 * grid); x <= Math.ceil(21 * grid); x += 0.5) {
      const h = height(x, z);
      if (h < 0) continue;
      // The landing and stairs replace entire columns in the bank. Their
      // supports fill those columns down to the same base as the terrain.
      if (stairs.has(x + "," + z)) continue;
      const top = h + unit;
      const soilTop = h >= 1 ? h : top;
      base(x, (soilTop - unit) / 2, z, unit, soilTop + unit, unit, h < 1 ? palette.ground.sand : palette.ground.stone);
      if (h < 1) continue;
      ground(x, top - unit / 2, z, unit, unit, unit, palette.green.meadow);
      const grove = (1 + Math.sin(x * 0.8 + phase) * Math.cos(z * 0.6)) / 2;
      const density = (x < -6 ? 0.26 : 0.14) * grove;
      if (Math.hypot(x - centreX, z - centreZ) < 2 || random() > density) continue;
      plantTree(x, top, z, "pine", random() < 0.25);
    }
  }

  function cottageBox(x: number, y: number, z: number, w: number, h: number, d: number, color: number) {
    box(centreX + (x * sideX + z * forwardX) * cottageScale,
      foundationTop + (y - 0.4) * cottageScale, centreZ + (x * sideZ + z * forwardZ) * cottageScale,
      (forwardX ? d : w) * cottageScale, h * cottageScale, (forwardX ? w : d) * cottageScale, color);
  }
  buildCottage(cottageBox, designs.cottage);
  route.forEach((p, i) => {
    const top = foundationTop - unit * Math.floor(i * risers / (route.length - 1));
    const stoneTop = top - unit;
    box(p.x, (stoneTop - unit) / 2, p.z, unit, stoneTop + unit, unit, palette.ground.stone);
    box(p.x, top - unit / 2, p.z, unit, unit, unit, palette.wood);
  });
  const end = route[route.length - 1];
  // Prefer a straight pier, provided its entire deck is over open water.
  const previous = route[route.length - 2];
  const incoming = [Math.sign(end.x - previous.x), Math.sign(end.z - previous.z)];
  const headings = [incoming, [incoming[1], -incoming[0]], [-incoming[1], incoming[0]]];
  const [pierX, pierZ] = headings.find(([dx, dz]) =>
    [1, 2, 3].every(i => naturalHeight(end.x + dx * unit * i, end.z + dz * unit * i) < 0)) ?? incoming;
  for (let i = 1; i <= 3; i++) {
    box(end.x + pierX * unit * i, dockTop - unit / 2, end.z + pierZ * unit * i, unit, unit, unit, palette.wood);
  }
  const tipX = end.x + pierX * unit * 3, tipZ = end.z + pierZ * unit * 3;
  for (const side of [-1, 1]) {
    const px = tipX + side * pierZ * unit, pz = tipZ - side * pierX * unit;
    const foot = Math.min(-unit, naturalHeight(px, pz));
    box(px, (dockTop + unit + foot) / 2, pz, unit, dockTop + unit - foot, unit, palette.wood);
  }

  // The floor mesh and the water's absorption map use the same soundings.
  const resolution = 128;
  const floorGeometry = new THREE.PlaneGeometry(model ? bounds.width : 64 * grid, model ? bounds.depth : 64 * grid, resolution - 1, resolution - 1);
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
    // The floor and water sample the same world-space footprint at every grid setting.
    const sampleX = ((i % resolution) / (resolution - 1) - 0.5) * 64 * grid;
    const sampleZ = (Math.floor(i / resolution) / (resolution - 1) - 0.5) * 64 * grid;
    samples[i] = Math.round(255 * THREE.MathUtils.clamp(-naturalHeight(sampleX, sampleZ) / 6, 0.14 / 6, 1));
    // Extend the outer ring under the whole view so the horizon has a bottom.
    positions.setXYZ(i, Math.abs(x) === 32 * grid ? x * 8 : x, y, Math.abs(z) === 32 * grid ? z * 8 : z);
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
    const x = (random() * 44 - 22) * grid;
    const z = (random() * 32 - 16) * grid;
    const y = naturalHeight(x, z);
    if (y > -0.5 || y < -2.5) continue;
    const size = 0.22 + random() * 0.52;
    box(x, y, z, size, size * 0.7, size * 0.8, palette.ground.stone);
  }
  waterfowl(box, bayX * grid - 0.5, bayZ * grid + 0.5, -0.45, (x, z) => -naturalHeight(x, z), true);
  const depth = new THREE.DataTexture(samples, resolution, resolution, THREE.RedFormat);
  depth.magFilter = depth.minFilter = THREE.LinearFilter;
  depth.needsUpdate = true;

  if (model) {
    // Enclose the bounded seabed and water on the four exposed cut faces.
    const { width, depth } = bounds;
    box(0, -7.5, 0, width, 1, depth, palette.ground.soil);
    for (const side of [-1, 1]) {
      box(side * (width / 2 - 0.01), -3.5, 0, 0.02, 7, depth, palette.water.cutFace);
      box(0, -3.5, side * (depth / 2 - 0.01), width, 7, 0.02, palette.water.cutFace);
    }
  }
  const mesh = buildMesh();
  return { mesh, floor, depth, bounds };
}
