// A study number is stable across seeds and between the gallery and the scene.
export const designNames = {
  pine: [
    "Woodland pine",
    "Stone pine",
    "Ridge pine",
    "Scots pine",
    "Black spruce",
    "Shore pine",
    "Highland fir",
    "Silver fir",
    "Cushion pine",
    "Cedar",
  ],
  broadleaf: ["Woodland oak", "Field maple", "Birch", "Hornbeam", "Linden", "Alder", "Elm", "Beech", "Hazel", "Willow"],
  cottage: [
    "Original cottage",
    "Crofter’s cottage",
    "Net mender’s house",
    "Stone bothy",
    "Gardener’s cottage",
    "Orchard house",
    "Fisher’s cottage",
    "Longhouse",
    "Mill keeper’s house",
    "Forester’s cottage",
  ],
};
export type Family = keyof typeof designNames;
export const defaultDesigns = { pine: 0, broadleaf: 0, cottage: 3 };
