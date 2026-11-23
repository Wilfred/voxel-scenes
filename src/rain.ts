import * as THREE from "three";
import { seededRandom } from "./voxels";

// A still exposure of a passing shower. Geometry gives near drops a longer
// streak and lets the terrain occlude rain behind a ridge or cottage.
export function createShower() {
  const count = 1500;
  const drops = new THREE.InstancedMesh(
    new THREE.BoxGeometry(),
    new THREE.MeshBasicMaterial({
      color: 0xe0e9e9,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    }),
    count,
  );
  drops.renderOrder = 4;
  function place(
    seed: number,
    grid: number,
    model: boolean,
    centre: THREE.Vector3,
    bounds?: { x: number; z: number; width: number; depth: number },
  ) {
    const random = seededRandom(seed ^ 0x91ab72);
    const width = model ? (bounds?.width ?? 28 * grid) : 72 * grid;
    const depth = model ? (bounds?.depth ?? 18 * grid) : 72 * grid;
    const x = model && bounds ? bounds.x : centre.x,
      z = model && bounds ? bounds.z : centre.z;
    const matrix = new THREE.Matrix4(),
      spin = new THREE.Matrix4().makeRotationZ(-0.18);
    drops.count = model ? Math.floor(count / 3) : count;
    for (let i = 0; i < drops.count; i++) {
      const sx = random() - 0.5,
        sz = random() - 0.5;
      const y = random() * (model ? 8 : 15) * grid + 0.8;
      const size = (0.75 + random() * 0.6) * grid;
      matrix
        .makeScale(0.035 * size, 0.47 * size, 0.035 * size)
        .premultiply(spin)
        .setPosition(x + sx * width, y, z + sz * depth);
      drops.setMatrixAt(i, matrix);
    }
    drops.instanceMatrix.needsUpdate = true;
    drops.computeBoundingSphere();
  }
  return { drops, place };
}
