import { seededRandom } from "./voxels";

// Each design keeps its number in the asset library and in generated scenes.
export const designNames = {
  pine: ["Scots pine", "Black spruce", "Highland fir", "Cedar"],
  broadleaf: ["Woodland oak", "Birch", "Hornbeam", "Alder"],
  cottage: ["Stone bothy", "Orchard house", "Net mender’s house", "Crofter’s cottage"],
  palm: ["Coconut palm", "Royal palm", "Fan palm"],
  tropical: ["Sea almond", "Banana plant", "Breadfruit"],
  shrub: ["Hazel", "Gorse", "Bramble"],
};
// Tropical trees and shrubs each have their own role, such as a banana
// garden by a house or bramble along a wood's edge, so scenes plant them by
// name rather than by seed.
export type Designs = Record<Exclude<keyof typeof designNames, "tropical" | "shrub">, number>;

// A landscape draws its cottage and tree designs from its seed, so every
// design appears across the days. A separate stream leaves the terrain alone.
export function designsFor(seed: number): Designs {
  const random = seededRandom(seed ^ 0x5bd1e995);
  const pick = (names: readonly string[]) => Math.floor(random() * names.length);
  return {
    pine: pick(designNames.pine),
    broadleaf: pick(designNames.broadleaf),
    cottage: pick(designNames.cottage),
    palm: pick(designNames.palm),
  };
}
