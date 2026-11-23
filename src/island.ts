import { chicken, creel, villageYard } from "./village";
import { terrainField } from "./terrain";
import { placeOutbuildings } from "./outbuildings";
import { treeVoxel } from "./scale";
import { pier, shoreStairs } from "./trail-details";
import { designsFor } from "./designs";
import { findSite } from "./sites";
import { gullsInFlight, waterfowl } from "./ducks";
import { dinghyOffshore, mooredBoat } from "./boats";
import { grassShade, palette } from "./palette";
import { depthTexture } from "./water";
import { treePlanter } from "./trees";
import { islandShape, type IslandKind } from "./islands";
import { seededRandom, voxelBatch } from "./voxels";
import { buildCottage, cottageDoor } from "./cottage";
import * as THREE from "three";

export function buildIsland(
  seed: number,
  model: boolean,
  grid = 1,
  designs = designsFor(seed),
  kind: IslandKind = "crescent",
) {
  const bounds = { x: 0, z: 0, width: 38 * grid, depth: 28 * grid };
  const depthExtent = 64 * grid;
  const oceanDepth = 7;
  // Cover the far corners of the vista frustum even at the widest zoom.
  const seaExtent = 1600 * grid;
  const random = seededRandom(seed);
  const relief = terrainField(seed);

  const wildlife = seededRandom(seed ^ 0x67ab39);
  const shape = islandShape(kind, random, grid, relief);
  const unit = 0.5;
  // Let offshore shallows grade into the deep floor before the depth map ends.
  function naturalHeight(worldX: number, worldZ: number) {
    const height = shape.height(worldX, worldZ);
    const radius = Math.hypot(worldX, worldZ) / grid;
    if (model || radius <= 22) return height;
    return Math.min(height, Math.floor((-oceanDepth * THREE.MathUtils.smoothstep(radius, 22, 31)) / unit) * unit);
  }

  // Survey water cells touching dry land. Ranking the nearest one for each
  // shelf lets the house face a short, visible route into the sheltered cove.
  const shoreline: { x: number; z: number }[] = [];
  for (let z = -Math.ceil(15 * grid); z <= 15 * grid; z += unit) {
    for (let x = -Math.ceil(20 * grid); x <= 20 * grid; x += unit) {
      if (naturalHeight(x, z) >= 0) continue;
      if (
        [
          [unit, 0],
          [-unit, 0],
          [0, unit],
          [0, -unit],
        ].some(([dx, dz]) => naturalHeight(x + dx, z + dz) >= 0)
      ) {
        shoreline.push({ x, z });
      }
    }
  }
  function nearestWater(x: number, z: number) {
    let closest = shoreline[0],
      best = Infinity;
    for (const cell of shoreline) {
      const distance = (cell.x - x) ** 2 + (cell.z - z) ** 2;
      if (distance < best) {
        best = distance;
        closest = cell;
      }
    }
    return closest;
  }
  const { search, cove } = shape;
  const cottage = findSite(
    Math.round(search.left / unit) * unit,
    Math.round(search.right / unit) * unit,
    Math.round(search.back / unit) * unit,
    Math.round(search.front / unit) * unit,
    unit,
    (x, z) => {
      const h = naturalHeight(x, z);
      if (h < 2) return Infinity;
      const shore = nearestWater(x, z);
      const dx = shore.x - x,
        dz = shore.z - z;
      const corners = [-1, 1].flatMap(ox => [-0.5, 0.5].map(oz => naturalHeight(x + ox, z + oz)));
      const shelf = Math.max(...corners) - Math.min(...corners);
      const bayDistance = Math.hypot(shore.x / grid - cove.x, shore.z / grid - cove.z);
      const facesAway = Math.abs(dx) > Math.abs(dz) ? dx < 0 : dz < 0;
      return (
        shelf +
        Math.abs(h - 2.5) +
        bayDistance * 0.7 +
        (facesAway ? 8 : 0) +
        shape.siteBias(x, z) +
        Math.hypot(dx, dz) * 0.25
      );
    },
  )!;
  const { x: cottageX, z: cottageZ } = cottage;
  const terrace = naturalHeight(cottageX, cottageZ);
  const foundationTop = terrace + unit;
  const dockTop = unit;
  const shore = nearestWater(cottageX, cottageZ);
  const dx = shore.x - cottageX,
    dz = shore.z - cottageZ;
  const forwardX = Math.abs(dx) > Math.abs(dz) ? Math.sign(dx) : 0;
  const forwardZ = forwardX === 0 ? Math.sign(dz) : 0;
  const sideX = forwardZ,
    sideZ = -forwardX;
  let x = cottageX + forwardX * 1.5,
    z = cottageZ + forwardZ * 1.5;
  const route = [{ x, z }];
  while (x !== shore.x || z !== shore.z) {
    if (Math.abs(shore.x - x) > Math.abs(shore.z - z)) x += Math.sign(shore.x - x) * unit;
    else z += Math.sign(shore.z - z) * unit;
    route.push({ x, z });
  }
  // Very steep banks need a few more cells of run out over the water.
  const risers = Math.round((foundationTop - dockTop) / unit);
  while (route.length <= risers) {
    x += forwardX * unit;
    z += forwardZ * unit;
    route.push({ x, z });
  }
  const stairs = new Set(route.map(p => p.x + "," + p.z));
  const facadeAngle = Math.atan2(forwardX, forwardZ);
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
  const base = terrainLayer(),
    ground = terrainLayer(),
    seabed = terrainLayer();
  // Shallows clear enough to see the bed show it as stepped voxels. Deeper
  // water hides a smooth floor beneath.
  const shelfDepth = 3.5;
  const wetSand = new THREE.Color(palette.ground.sand);
  const silt = new THREE.Color(palette.ground.silt);
  const bedColor = new THREE.Color();
  const patches = (x: number, z: number) => Math.sin(x * 0.8 + shape.phase) * Math.sin(z * 0.64 + x * 0.24);
  function bedTint(x: number, z: number, y: number, steps = 0) {
    const t = THREE.MathUtils.clamp(-y / 7 + patches(x, z) * 0.13, 0, 1);
    return bedColor.copy(wetSand).lerp(silt, steps ? Math.round(t * steps) / steps : t);
  }
  const plantTree = treePlanter(box, treeVoxel, designs, seed);

  // Follow a walkable contour inland from the shore stairs before looking
  // for a loft site. The selected approach becomes the path to its door.
  type Approach = { x: number; z: number; approach: { x: number; z: number }[] };
  const approaches: Approach[] = route.map(p => ({ ...p, approach: [] }));
  const surveyed = new Set(stairs);
  for (let i = 0; grid >= 3 && i < approaches.length; i++) {
    const p = approaches[i];
    if (p.approach.length >= 28) continue;
    const top = p.approach.length
      ? height(p.x, p.z) + unit
      : foundationTop - unit * Math.floor((i * risers) / (route.length - 1));
    for (const [ox, oz] of [
      [unit, 0],
      [-unit, 0],
      [0, unit],
      [0, -unit],
    ]) {
      const x = p.x + ox,
        z = p.z + oz,
        key = x + "," + z;
      const h = height(x, z);
      if (
        surveyed.has(key) ||
        h < 0 ||
        Math.abs(h + unit - top) > unit ||
        (Math.abs((x - centreX) * sideX + (z - centreZ) * sideZ) < 2 &&
          Math.abs((x - centreX) * forwardX + (z - centreZ) * forwardZ) < 1.5)
      )
        continue;
      surveyed.add(key);
      approaches.push({ x, z, approach: [...p.approach, { x, z }] });
    }
  }
  const yards = placeOutbuildings(
    box,
    grid >= 6 ? ["nets", "store"] : grid >= 3 ? ["nets"] : [],
    approaches,
    unit,
    (x, z) => height(x, z) + unit,
    (x, z) => Math.hypot(x - centreX, z - centreZ) > 2.5 && !stairs.has(x + "," + z),
  );
  const snap = (v: number) => Math.round(v * 2) / 2;
  const yard = villageYard(
    box,
    (x, z) => height(snap(x), snap(z)) + unit,
    (x, z) => Math.hypot(x - centreX, z - centreZ) > 2.5 && !stairs.has(snap(x) + "," + snap(z)) && !yards.near(x, z),
  );
  yard.place(creel, shore.x, shore.z, 0.32);
  yard.place(chicken, centreX + 2, centreZ + 2, 0.4, false, { random: wildlife });
  const landX = Math.ceil(21 * grid),
    landZ = Math.ceil(14 * grid);
  // Survey the shallow shelf across the depth map so its steps
  // follow the coast all the way into deep water.
  const bedX = model ? landX : depthExtent / 2;
  const bedZ = model ? landZ : depthExtent / 2;
  for (let z = -bedZ; z <= bedZ; z += unit) {
    for (let x = -bedX; x <= bedX; x += unit) {
      const h = height(x, z);
      if (h < 0) {
        const inside =
          !model || (Math.abs(x) + unit / 2 <= bounds.width / 2 && Math.abs(z) + unit / 2 <= bounds.depth / 2);
        if (h >= -shelfDepth && inside) seabed(x, h - 0.75, z, unit, 1.5, unit, bedTint(x, z, h, 10).getHex());
        continue;
      }
      if (Math.abs(x) > landX || Math.abs(z) > landZ) continue;
      // The landing and stairs replace entire columns in the bank. Their
      // supports fill those columns down to the same base as the terrain.
      if (stairs.has(x + "," + z)) continue;
      const top = h + unit;
      const soilTop = h >= 1 ? h : top;
      base(
        x,
        (soilTop - unit) / 2,
        z,
        unit,
        soilTop + unit,
        unit,
        h < 1 ? (yards.paths.has(x + "," + z) ? palette.ground.path : palette.ground.sand) : palette.ground.stone,
      );
      if (h < 1 && !(shape.beachTrees && h > 0)) continue;
      if (h >= 1)
        ground(
          x,
          top - unit / 2,
          z,
          unit,
          unit,
          unit,
          yards.paths.has(x + "," + z) ? palette.ground.path : grassShade(h / 8 + 0.25 * relief(x - 29, z + 47)),
        );
      const density = shape.density(x, z, h);
      if (
        yard.near(x, z, 1.25) ||
        yards.near(x, z) ||
        yards.paths.has(x + "," + z) ||
        Math.hypot(x - centreX, z - centreZ) < 3.5 ||
        random() > density
      )
        continue;
      const { species, design } = shape.tree(x, z, h, Math.hypot(x - centreX, z - centreZ));
      plantTree(x, top, z, species, random() < 0.25, design);
    }
  }

  function cottageBox(x: number, y: number, z: number, w: number, h: number, d: number, color: number) {
    box(
      centreX + (x * sideX + z * forwardX),
      foundationTop + y,
      centreZ + (x * sideZ + z * forwardZ),
      forwardX ? d : w,
      h,
      forwardX ? w : d,
      color,
    );
  }
  const outlet = buildCottage(cottageBox, designs.cottage);
  const chimney = new THREE.Vector3(
    centreX + outlet.x * sideX + outlet.z * forwardX,
    foundationTop + outlet.y,
    centreZ + outlet.x * sideZ + outlet.z * forwardZ,
  );
  shoreStairs(box, route, foundationTop, risers);
  const end = route[route.length - 1];
  // Prefer a straight pier, provided its entire deck is over open water.
  const previous = route[route.length - 2];
  const incoming = [Math.sign(end.x - previous.x), Math.sign(end.z - previous.z)];
  const headings = [incoming, [incoming[1], -incoming[0]], [-incoming[1], incoming[0]]];
  const [pierX, pierZ] =
    headings.find(([dx, dz]) =>
      [1, 2, 3].every(i =>
        [-0.375, 0.375].every(
          side => naturalHeight(end.x + dx * unit * i + dz * side, end.z + dz * unit * i - dx * side) < 0,
        ),
      ),
    ) ?? incoming;
  pier(box, end, pierX, pierZ, naturalHeight);

  // The floor mesh and the water's absorption map use the same soundings.
  const resolution = 128;
  const floorGeometry = new THREE.PlaneGeometry(
    model ? bounds.width : depthExtent,
    model ? bounds.depth : depthExtent,
    resolution - 1,
    resolution - 1,
  );
  floorGeometry.rotateX(-Math.PI / 2);
  const positions = floorGeometry.getAttribute("position");
  const samples = new Uint8Array(resolution * resolution);
  const colors = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const natural = naturalHeight(x, z);
    // Sink the smooth floor below the stepped shallows so it never pokes through.
    const y = natural >= -shelfDepth - unit ? natural - 1.5 : THREE.MathUtils.clamp(natural, -oceanDepth, -0.14);
    // The floor and water sample the same world-space footprint at every grid setting.
    const col = i % resolution;
    const row = Math.floor(i / resolution);
    const sampleX = (col / (resolution - 1) - 0.5) * depthExtent;
    const sampleZ = (row / (resolution - 1) - 0.5) * depthExtent;
    samples[i] = Math.round(255 * THREE.MathUtils.clamp(-naturalHeight(sampleX, sampleZ) / 6, 0.14 / 6, 1));
    // The outer ring is deep ocean and continues beneath the full sea surface.
    const outerX = !model && (col === 0 || col === resolution - 1);
    const outerZ = !model && (row === 0 || row === resolution - 1);
    positions.setXYZ(
      i,
      outerX ? (Math.sign(x) * seaExtent) / 2 : x,
      outerX || outerZ ? -oceanDepth : y,
      outerZ ? (Math.sign(z) * seaExtent) / 2 : z,
    );
    (outerX || outerZ ? silt : bedTint(x, z, Math.min(natural, -0.14))).toArray(colors, i * 3);
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
  const landing = { x: end.x + pierX, z: end.z + pierZ };
  const home = { x: centreX, z: centreZ };
  const awayFromHome = (x: number, z: number, distance: number) => Math.hypot(x - home.x, z - home.z) > distance;
  const inFrame = (x: number, z: number, margin: number) =>
    Math.abs(x) + margin < bounds.width / 2 && Math.abs(z) + margin < bounds.depth / 2;
  // The camera looks at the cottage front, so favour the side it sees.
  const towardX = Math.sin(facadeAngle),
    towardZ = Math.cos(facadeAngle);
  const facing = (x: number, z: number) => Math.max(0, (x * towardX + z * towardZ) / Math.hypot(x, z) + 0.2);
  // Gulls float in the shallows along a stretch of shore away from the
  // cottage and its landing.
  let raft = landing,
    total = 0;
  for (const cell of shoreline) {
    const weight = inFrame(cell.x, cell.z, 3) && awayFromHome(cell.x, cell.z, 8 * grid) ? facing(cell.x, cell.z) : 0;
    total += weight;
    if (weight > 0 && wildlife() * total < weight) raft = cell;
  }
  waterfowl(
    box,
    raft.x,
    raft.z,
    -0.45,
    (x, z) => {
      if (Math.abs(x) >= bounds.width / 2 || Math.abs(z) >= bounds.depth / 2 || stairs.has(snap(x) + "," + snap(z)))
        return 0;
      return -naturalHeight(snap(x), snap(z));
    },
    wildlife,
    4,
    { avoid: [landing, home] },
  );
  // Boats and gulls in flight draw from their own stream so they leave
  // the landscape and the other wildlife in place.
  const harbour = seededRandom(seed ^ 0x3c6ef372);
  const sounding = (x: number, z: number) => (model && !inFrame(x, z, 1) ? 0 : -naturalHeight(snap(x), snap(z)));
  const moored = mooredBoat(box, landing, [pierX, pierZ], sounding);
  const halfWidth = bounds.width / 2 - 2,
    halfDepth = bounds.depth / 2 - 2;
  const frame = { left: -halfWidth, right: halfWidth, back: -halfDepth, front: halfDepth };
  // The dinghy sails clear of the cottage and landing, heading out to sea.
  dinghyOffshore(
    box,
    frame,
    sounding,
    harbour,
    [
      { ...home, radius: 14 * grid },
      { ...landing, radius: 5 * grid },
      { ...raft, radius: 4 },
      ...(moored ? [{ ...moored, radius: 4 }] : []),
    ],
    (x, z) => [x / Math.hypot(x, z), z / Math.hypot(x, z)],
    // Further from the cottage spreads the scene's interest.
    (x, z) => facing(x, z) * Math.min(2, Math.hypot(x - home.x, z - home.z) / (10 * grid)),
  );
  // Gulls in flight cross low land away from the cottage, on the side nearer
  // the camera, so higher ground rather than the sky lies behind them.
  gullsInFlight(
    box,
    frame,
    (x, z) => naturalHeight(snap(x), snap(z)),
    (x, z) => {
      const h = naturalHeight(snap(x), snap(z));
      return h >= 1 && h <= 3 && awayFromHome(x, z, 6 * grid) ? facing(x, z) ** 2 : 0;
    },
    harbour,
    2,
  );
  const depth = { texture: depthTexture(samples, resolution), extent: depthExtent };

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
  const steps = route.map((p, i) => ({
    ...p,
    y: foundationTop - unit * Math.floor((i * risers) / (route.length - 1)),
  }));
  return {
    mesh,
    chimney,
    routes: [steps],
    floor,
    depth,
    bounds,
    seaExtent,
    facadeAngle,
    focus: new THREE.Vector3(centreX, foundationTop, centreZ),
  };
}
