import * as THREE from "three";
import { palette } from "./palette";

export function lightScene(scene: THREE.Scene) {
  const sun = new THREE.DirectionalLight(palette.light.sun, 2.4);
  sun.position.set(-26, 21, 18);
  const sky = new THREE.HemisphereLight(palette.light.skyLight, palette.light.groundLight, 1.2);
  scene.add(sun, sun.target, sky);
  return sun;
}
