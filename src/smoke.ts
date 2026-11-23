import * as THREE from "three";
import { palette } from "./palette";
import { masonry } from "./scale";

export function createSmoke() {
  const plume = new THREE.Group();
  const geometry = new THREE.BoxGeometry(masonry, masonry, masonry);
  const puffs = Array.from({ length: 4 }, () => {
    const material = new THREE.MeshLambertMaterial({
      color: palette.cottage.smoke,
      transparent: true,
      depthWrite: false,
    });
    return new THREE.Mesh(geometry, material);
  });
  plume.add(...puffs);
  function update(seconds: number) {
    puffs.forEach((puff, i) => {
      const age = (seconds / 5 + i / puffs.length) % 1;
      puff.position.set(1.2 * age * age, 2.2 * age, 0.16 * Math.sin(age * 5));
      puff.scale.setScalar(0.7 + 0.8 * age);
      puff.material.opacity = 0.85 * Math.min(age * 12, 1) * (1 - age * age);
    });
  }
  return { plume, update };
}
