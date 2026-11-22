import * as THREE from "three";

export type Box = (
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  color: number,
  yaw?: number,
) => void;

export function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function voxelBatch() {
  // Store eight numbers per box; build GPU transforms only once at upload.
  const blocks: number[] = [];
  const box: Box = (x, y, z, w, h, d, color, yaw = 0) => {
    blocks.push(x, y, z, w, h, d, color, yaw);
  };
  // A contiguous run of identical columns has the same silhouette and shading.
  function terrainLayer(): Box {
    let last = -1;
    return (x, y, z, w, h, d, color) => {
      if (
        last >= 0 &&
        blocks[last + 1] === y &&
        blocks[last + 2] === z &&
        blocks[last + 4] === h &&
        blocks[last + 5] === d &&
        blocks[last + 6] === color &&
        blocks[last] + blocks[last + 3] / 2 === x - w / 2
      ) {
        blocks[last] += w / 2;
        blocks[last + 3] += w;
      } else {
        last = blocks.length;
        box(x, y, z, w, h, d, color);
      }
    };
  }
  function buildMesh() {
    const geometry = new THREE.BoxGeometry(),
      material = new THREE.MeshLambertMaterial();
    // Limit each draw so even a software WebGL driver can render large grids.
    const batchSize = 8192;
    const count = blocks.length / 8;
    const mesh = new THREE.InstancedMesh(geometry, material, Math.min(batchSize, count));
    let batch = mesh;
    const tint = new THREE.Color(),
      matrix = new THREE.Matrix4(),
      rotation = new THREE.Matrix4();
    for (let i = 0; i < blocks.length; i += 8) {
      const index = (i / 8) % batchSize;
      if (index === 0 && i > 0) {
        const next = new THREE.InstancedMesh(geometry, material, Math.min(batchSize, count - i / 8));
        next.castShadow = next.receiveShadow = true;
        mesh.add(next);
        mesh.addEventListener("dispose", () => next.dispose());
        batch = next;
      }
      matrix.makeScale(blocks[i + 3], blocks[i + 4], blocks[i + 5]);
      if (blocks[i + 7]) matrix.premultiply(rotation.makeRotationY(blocks[i + 7]));
      batch.setMatrixAt(index, matrix.setPosition(blocks[i], blocks[i + 1], blocks[i + 2]));
      batch.setColorAt(index, tint.setHex(blocks[i + 6]));
    }
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  }
  return { box, terrainLayer, buildMesh };
}
