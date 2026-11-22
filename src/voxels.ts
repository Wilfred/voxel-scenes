import * as THREE from "three";

export type Box = (x: number, y: number, z: number, width: number, height: number, depth: number, color: number) => void;

export function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function voxelBatch() {
  const blocks: { matrix: THREE.Matrix4; color: number }[] = [];
  const box: Box = (x, y, z, w, h, d, color) => {
    blocks.push({ matrix: new THREE.Matrix4().makeScale(w, h, d).setPosition(x, y, z), color });
  };
  function buildMesh() {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshLambertMaterial(), blocks.length);
    const tint = new THREE.Color();
    blocks.forEach(({ matrix, color }, i) => {
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, tint.setHex(color));
    });
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  }
  return { box, buildMesh };
}
