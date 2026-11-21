import * as THREE from "three";

export const styles = {
  miniature: { sea: 0x79b7ae, sky: 0xffe9ca, beach: 0xe4c893, turf: 0x99aa61, rock: 0xa79c85, pine: 0x426d49, tip: 0x73924f, roof: 0xa95837, sun: [24, 38, 18], eye: [31, 28, 40], span: 30 },
  vista: { sea: 0x418eac, sky: 0xb5dcf2, beach: 0xf1d593, turf: 0xa2c669, rock: 0xab9381, pine: 0x316c61, tip: 0x71a85c, roof: 0xc26040, sun: [-18, 30, 22], eye: [14, 14, 48], span: 23 },
  graphic: { sea: 0x397e92, sky: 0xffd1a4, beach: 0xffcd85, turf: 0xc1ac60, rock: 0xbd8468, pine: 0x235a59, tip: 0x387773, roof: 0xe06d3f, sun: [-35, 16, 14], eye: [8, 29, 43], span: 25 },
};
export type Style = keyof typeof styles;

export function buildIsland(seed: number, style: Style) {
  const p = styles[style];
  let state = seed;
  function random() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  }

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
  const cottageScale = 0.68;
  const foundationTop = terrace + 0.16 + 0.4 * cottageScale;
  const dockTop = 0.30;
  const stairStart = cottageZ + 1.0;
  const risers = Math.ceil((foundationTop - dockTop) / 0.14);
  const stairEnd = Math.max(landingZ + 0.25, stairStart + risers * 0.21);
  const treadDepth = (stairEnd - stairStart) / risers;
  const rise = (foundationTop - dockTop) / risers;
  function height(x: number, z: number) {
    if (Math.abs(x - cottageX) <= 1 && Math.abs(z - cottageZ) <= 0.5) return terrace;
    return naturalHeight(x, z);
  }

  const blocks: { matrix: THREE.Matrix4; color: number }[] = [];
  function box(x: number, y: number, z: number, w: number, h: number, d: number, color: number) {
    blocks.push({ matrix: new THREE.Matrix4().makeScale(w, h, d).setPosition(x, y, z), color });
  }

  for (let z = -14; z <= 14; z += 0.5) {
    for (let x = -21; x <= 21; x += 0.5) {
      let h = height(x, z);
      if (h < 0) continue;
      // Cut the bank below the lowest tread overlapping each voxel.
      const stairCorridor = Math.abs(x - cottageX) <= 0.5
        && z + 0.25 >= stairStart && z - 0.25 <= stairEnd;
      if (stairCorridor) {
        const step = Math.min(risers, Math.floor((z + 0.25 - stairStart) / treadDepth) + 1);
        h = Math.min(h, foundationTop - step * rise - 0.16);
      }
      const top = h + 0.09;
      box(x, (top - 0.25) / 2, z, 0.5, top + 0.25, 0.5, h < 1 ? p.beach : p.rock);
      if (stairCorridor) continue;
      if (h < 1) continue;
      box(x, top, z, 0.5, 0.12, 0.5, p.turf);
      const grove = (1 + Math.sin(x * 0.8 + phase) * Math.cos(z * 0.6)) / 2;
      const density = (x < -6 ? 0.26 : 0.14) * grove;
      if (Math.hypot(x - cottageX, z - cottageZ) < 2 || random() > density) continue;
      const size = 0.32 + random() * 0.43;
      box(x, top + 0.6 * size, z, size * 0.32, size, size * 0.32, 0x635345);
      for (let tier = 0; tier < 3; tier++) {
        const width = size * (1.65 - tier * 0.45);
        box(x, top + (1.1 + tier * 0.66) * size, z, width, size, width, tier === 2 ? p.tip : p.pine);
      }
    }
  }

  function cottageBox(x: number, y: number, z: number, w: number, h: number, d: number, color: number) {
    box(cottageX + x * cottageScale, terrace + 0.16 + y * cottageScale, cottageZ + z * cottageScale,
      w * cottageScale, h * cottageScale, d * cottageScale, color);
  }
  cottageBox(0, 0, 0, 2.5, 0.8, 1.9, p.rock);
  cottageBox(0, 0.85, 0, 2.3, 1.4, 1.7, 0xf4dcab);
  for (let i = 0; i < 4; i++) {
    cottageBox(0, 1.58 + i * 0.19, 0, 2.65, 0.22, 2.16 - i * 0.48, p.roof);
  }
  cottageBox(0.7, 2.1, 0.25, 0.37, 1, 0.4, p.rock);
  cottageBox(-0.4, 0.94, 0.87, 0.45, 0.5, 0.09, 0xedac59);
  for (let i = 0; i < 3; i++) {
    cottageBox(0.7 + i * 0.24, 2.94 + i * 0.45, 0.25, 0.27 + i * 0.06, 0.26, 0.3, 0xe4ddd0);
  }

  cottageBox(0, 0.86, 0.87, 0.46, 0.92, 0.10, 0x635345);

  const doorZ = cottageZ + 0.85 * cottageScale;
  box(cottageX, foundationTop - 0.06, (doorZ + stairStart) / 2,
    0.72, 0.12, stairStart - doorZ, 0xa7835b);
  for (let i = 0; i < risers; i++) {
    const z = stairStart + (i + 0.5) * treadDepth;
    const top = foundationTop - (i + 1) * rise;
    box(cottageX, (top - 0.17) / 2, z, 0.62, top + 0.03, treadDepth, p.rock);
    box(cottageX, top - 0.035, z, 0.72, 0.07, treadDepth, 0xad865a);
  }
  const dockLength = 1.7;
  box(cottageX, dockTop - 0.08, stairEnd + dockLength / 2, 0.72, 0.16, dockLength, 0x926a47);
  for (const side of [-0.29, 0.29]) {
    const z = stairEnd + dockLength - 0.16;
    const foot = Math.min(-0.25, naturalHeight(cottageX + side, z) - 0.3);
    box(cottageX + side, (0.48 + foot) / 2, z, 0.13, 0.48 - foot, 0.13, 0x624832);
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

  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshLambertMaterial(), blocks.length);
  blocks.forEach(({ matrix, color }, i) => {
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, new THREE.Color(color));
  });
  mesh.castShadow = mesh.receiveShadow = true;
  return { mesh, floor, depth };
}
