import { SimplexNoise } from "three/addons/math/SimplexNoise.js";
import { seededRandom } from "./voxels";

// Sample in world coordinates so revealing more terrain also reveals new hills.
export function terrainField(seed: number) {
  const field = new SimplexNoise({ random: seededRandom(seed) });
  return (x: number, z: number) =>
    0.57 * field.noise(x / 86, z / 86) +
    0.31 * field.noise(x / 34 + 19, z / 34 - 11) +
    0.12 * field.noise(x / 13 - 7, z / 13 + 31);
}
