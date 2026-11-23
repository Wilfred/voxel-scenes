export const palette = {
  wood: 0x766048,
  // The pale cut face of sawn and split timber.
  sawnWood: 0xa3845f,
  green: {
    pine: 0x3b6454,
    pineTip: 0x4c7762,
    leaf: 0x5a7f4e,
    leafTip: 0x6f9157,
    // Palm fronds are lighter and yellower than temperate leaves.
    palm: 0x648f45,
    palmTip: 0x7ea354,
    // Glossy tropical broadleaves, between the palms and the pines.
    tropical: 0x46784a,
    tropicalTip: 0x5a8c52,
    grass: 0x7e8c5d,
    // One grass hue, cooler and darker in hollows and warmer on crests.
    grassShades: [0x6c7f56, 0x76875a, 0x7e8c5d, 0x89935f, 0x959b63],
  },
  ground: {
    sand: 0xd9bc8b,
    stone: 0x8a8880,
    snow: 0xf4e6ce,
    soil: 0x886f58,
    path: 0xad906a,
    silt: 0x506d60,
    riverbed: 0x8e967b,
  },
  cottage: {
    plaster: 0xb9ab92,
    tile: 0x9a6a50,
    glass: 0x778e89,
    smoke: 0xe4ddd0,
  },
  water: {
    sea: 0x397e92,
    river: 0x477f82,
    froth: 0xa6c3be,
    foam: 0xc4d5c7,
    cutFace: 0x508782,
  },
  light: {
    horizon: 0xddeaf2,
    zenith: 0x89bfe1,
    sunGlint: 0xfff2d7,
    coastalSky: 0xd5e4ea,
    forestSky: 0xe4e9d9,
    clearSky: 0xdde8e6,
    backdrop: 0x39494f,
    sun: 0xffeed5,
    skyLight: 0xfff7e9,
    groundLight: 0xadb9bb,
  },
  harvest: { apple: 0xac5142, blossom: 0xe8cec1, coconut: 0x6b5238, banana: 0xb7a24e },
  // Coats and feathers of farm and woodland animals.
  animal: { fleece: 0xe4ddd0, fur: 0x886f58, pale: 0xb9ab92, dark: 0x766048, beak: 0xb89052, comb: 0xac5142 },
  cloth: { canvas: 0xb9ab92, dyed: 0x5a7f4e },
  gull: { white: 0xf1efe3, wing: 0xabb6b8, tip: 0x4d5657 },
  duck: {
    breast: 0xb6ac90,
    hen: 0x957452,
    wing: 0x786956,
    henWing: 0x775a43,
    head: 0x355b4c,
    henHead: 0x886646,
    bill: 0xb89052,
  },
} as const;

// Pick a grass shade from 0 (low, sheltered) to 1 (high, exposed).
export function grassShade(t: number) {
  const shades = palette.green.grassShades;
  return shades[Math.max(0, Math.min(shades.length - 1, Math.round(t * (shades.length - 1))))];
}
