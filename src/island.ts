import { chicken, creel, villageYard } from "./village";
import { terrainField } from "./terrain";
import { placeOutbuildings } from "./outbuildings";
import { treeVoxel } from "./scale";
import { pier, shoreStairs } from "./trail-details";
import { defaultDesigns } from "./designs";
import { findSite } from "./sites";
import { waterfowl } from "./ducks";
import { grassShade, palette } from "./palette";
import { depthTexture } from "./water";
import { treePlanter } from "./trees";
import { seededRandom, voxelBatch } from "./voxels";
import { buildCottage, cottageDoor } from "./cottage";
import * as THREE from "three";

export function buildIsland(seed: number, model: boolean, grid = 1, designs = defaultDesigns) {
  const bounds = { x: 0, z: 0, width: 38 * grid, depth: 28 * grid };
  const random = seededRandom(seed);
  const relief = terrainField(seed);

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
    return Math.floor(inland * (0.7 + 1.55 * ridge + 0.6 * relief(worldX, worldZ)) / unit) * unit;
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
  const foundationTop = terrace + unit;
  const dockTop = unit;
  const shore = nearestWater(cottageX, cottageZ);
  const dx = shore.x - cottageX, dz = shore.z - cottageZ;
  const forwardX = Math.abs(dx) > Math.abs(dz) ? Math.sign(dx) : 0;
  const forwardZ = forwardX === 0 ? Math.sign(dz) : 0;
  const sideX = forwardZ, sideZ = -forwardX;
  let x = cottageX + forwardX * 1.5, z = cottageZ + forwardZ * 1.5;
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
  const doorOffset = cottageDoor(designs.cottage);
  const centreX = cottageX - sideX * doorOffset;
  const centreZ = cottageZ - sideZ * doorOffset;
  function height(x: number, z: number) {
    const across = (x - centreX) * sideX + (z - centreZ) * sideZ;
    const along = (x - centreX) * forwardX + (z - centreZ) * forwardZ;
    if (Math.abs(across) <= 1.75 && Math.abs(along) <= 1.25) return terrace;
    return naturalHeight(x, z);
  }

  const { box, terrainLayer, buildMesh } = voxelBatch();
  const base = terrainLayer(), ground = terrainLayer();
  const plantTree = treePlanter(box, treeVoxel, designs, seed);

  // Follow a walkable contour inland from the shore stairs before looking
  // for a loft site. The selected approach becomes the path to its door.
  type Approach = { x: number; z: number; approach: { x: number; z: number }[] };
  const approaches: Approach[] = route.map(p => ({ ...p, approach: [] }));
  const surveyed = new Set(stairs);
  for (let i = 0; grid >= 3 && i < approaches.length; i++) {
    const p = approaches[i];
    if (p.approach.length >= 28) continue;
    const top = p.approach.length ? height(p.x, p.z) + unit
      : foundationTop - unit * Math.floor(i * risers / (route.length - 1));
    for (const [ox, oz] of [[unit, 0], [-unit, 0], [0, unit], [0, -unit]]) {
      const x = p.x + ox, z = p.z + oz, key = x + "," + z;
      const h = height(x, z);
      if (surveyed.has(key) || h < 0 || Math.abs(h + unit - top) > unit ||
        (Math.abs((x - centreX) * sideX + (z - centreZ) * sideZ) < 2 &&
         Math.abs((x - centreX) * forwardX + (z - centreZ) * forwardZ) < 1.5)) continue;
      surveyed.add(key);
      approaches.push({ x, z, approach: [...p.approach, { x, z }] });
    }
  }
  const yards = placeOutbuildings(box, grid >= 6 ? ["nets", "store"] : grid >= 3 ? ["nets"] : [],
    approaches, unit, (x, z) => height(x, z) + unit, (x, z) =>
      Math.hypot(x - centreX, z - centreZ) > 2.5 && !stairs.has(x + "," + z));
  const yard = villageYard(box, (x,z) => height(Math.round(x*2)/2,Math.round(z*2)/2)+unit,
    (x,z) => Math.hypot(x-centreX,z-centreZ)>2.5 && !stairs.has(Math.round(x*2)/2+","+Math.round(z*2)/2) && !yards.near(x,z));
  yard.place(creel, shore.x,shore.z,0.32);
  yard.place(chicken, centreX+2,centreZ+2,0.2);
  for (let z = -Math.ceil(14 * grid); z <= Math.ceil(14 * grid); z += 0.5) {
    for (let x = -Math.ceil(21 * grid); x <= Math.ceil(21 * grid); x += 0.5) {
      const h = height(x, z);
      if (h < 0) continue;
      // The landing and stairs replace entire columns in the bank. Their
      // supports fill those columns down to the same base as the terrain.
      if (stairs.has(x + "," + z)) continue;
      const top = h + unit;
      const soilTop = h >= 1 ? h : top;
      base(x, (soilTop - unit) / 2, z, unit, soilTop + unit, unit, h < 1 ? (yards.paths.has(x + "," + z) ? palette.ground.path : palette.ground.sand) : palette.ground.stone);
      if (h < 1) continue;
      ground(x, top - unit / 2, z, unit, unit, unit, yards.paths.has(x + "," + z) ? palette.ground.path : grassShade(h / 8 + 0.25 * relief(x - 29, z + 47)));
      const grove = (1 + Math.sin(x * 0.8 + phase) * Math.cos(z * 0.6)) / 2;
      const density = (x < -6 ? 0.10 : 0.055) * grove;
      if (yard.near(x,z,1.25) || yards.near(x, z) || yards.paths.has(x + "," + z) || Math.hypot(x - centreX, z - centreZ) < 3.5 || random() > density) continue;
      plantTree(x, top, z, "pine", random() < 0.25);
    }
  }

  function cottageBox(x: number, y: number, z: number, w: number, h: number, d: number, color: number) {
    box(centreX + (x * sideX + z * forwardX),
      foundationTop + y, centreZ + (x * sideZ + z * forwardZ),
      (forwardX ? d : w), h, (forwardX ? w : d), color);
  }
  buildCottage(cottageBox, designs.cottage);
  shoreStairs(box, route, foundationTop, risers);
  const end = route[route.length - 1];
  // Prefer a straight pier, provided its entire deck is over open water.
  const previous = route[route.length - 2];
  const incoming = [Math.sign(end.x - previous.x), Math.sign(end.z - previous.z)];
  const headings = [incoming, [incoming[1], -incoming[0]], [-incoming[1], incoming[0]]];
  const [pierX, pierZ] = headings.find(([dx, dz]) =>
    [1, 2, 3].every(i => [-0.375, 0.375].every(side =>
      naturalHeight(end.x + dx * unit * i + dz * side, end.z + dz * unit * i - dx * side) < 0))) ?? incoming;
  pier(box, end, pierX, pierZ, naturalHeight);

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
    if (model && (Math.abs(x) + 0.5 >= bounds.width / 2 || Math.abs(z) + 0.5 >= bounds.depth / 2)) continue;
    const size = 0.22 + random() * 0.52;
    box(x, y, z, size, size * 0.7, size * 0.8, palette.ground.stone);
  }
  waterfowl(box, bayX * grid - 0.5, bayZ * grid + 0.5, -0.45, (x, z) => -naturalHeight(x, z), true);
  const depth = { texture: depthTexture(samples, resolution), extent: 64 * grid };

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
  const steps = route.map((p, i) => ({ ...p, y: foundationTop - unit * Math.floor(i * risers / (route.length - 1)) }));
  return { mesh, routes: [steps], floor, depth, bounds, facadeAngle: Math.atan2(forwardX, forwardZ),
    focus: new THREE.Vector3(centreX, foundationTop, centreZ) };
}
