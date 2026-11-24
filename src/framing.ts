import * as THREE from "three";

// Use small bounds so empty corners of an irregular outline don't dictate the
// framing. A model shows everything down to its base. A vista fits the land
// within a radius of its focus and lets the deeper beds fade out.
export function framingPoints(
  mesh: THREE.InstancedMesh,
  grid: number,
  vista?: { focus: THREE.Vector3; radius: number },
) {
  const tiles = new Map<string, THREE.Box3>();
  const unit = new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5));
  const bounds = new THREE.Box3();
  const matrix = new THREE.Matrix4();
  const tileSize = 2 * grid;
  const framingFloor = vista ? -1.5 : -Infinity;
  mesh.traverse(batch => {
    if (!(batch instanceof THREE.InstancedMesh)) return;
    for (let i = 0; i < batch.count; i++) {
      batch.getMatrixAt(i, matrix);
      const x = matrix.elements[12];
      const y = matrix.elements[13];
      const z = matrix.elements[14];
      if (vista && Math.hypot(x - vista.focus.x, z - vista.focus.z) > vista.radius) continue;
      bounds.copy(unit).applyMatrix4(matrix);
      if (bounds.max.y < framingFloor) continue;
      bounds.min.y = Math.max(bounds.min.y, framingFloor);
      const key = `${Math.floor(x / tileSize)},${Math.floor(y / tileSize)},${Math.floor(z / tileSize)}`;
      const tile = tiles.get(key);
      if (tile) tile.union(bounds);
      else tiles.set(key, bounds.clone());
    }
  });
  const points: THREE.Vector3[] = [];
  for (const { min, max } of tiles.values()) {
    for (const x of [min.x, max.x]) {
      for (const y of [min.y, max.y]) {
        for (const z of [min.z, max.z]) points.push(new THREE.Vector3(x, y, z));
      }
    }
  }
  return points;
}

export function zoomToFit(camera: THREE.Camera, points: readonly THREE.Vector3[], centerVertically: boolean) {
  camera.updateMatrixWorld();
  const viewProjection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const projected = new THREE.Vector3();
  let extentX = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    projected.copy(point).applyMatrix4(viewProjection);
    extentX = Math.max(extentX, Math.abs(projected.x));
    minY = Math.min(minY, projected.y);
    maxY = Math.max(maxY, projected.y);
  }
  const centerY = centerVertically ? (minY + maxY) / 2 : 0;
  const extent = Math.max(extentX, maxY - centerY, centerY - minY);
  // Leave six percent of the image on each edge.
  return { zoom: 0.88 / extent, centerY };
}
