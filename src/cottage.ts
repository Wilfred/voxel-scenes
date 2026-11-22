import { palette } from "./palette";
import type { Box } from "./voxels";

// Facades are read from left to right. D is the door, W a pane, and | a mullion.
type House = { front: string; roof: "gable" | "hip" | "saltbox"; tiers: number; chimney: number; detail?: "awning" | "gable" | "shutters" | "stone" | "bay" | "store" };
const houses: House[] = [
  { front: ".WW.DD.WW.", roof: "gable", tiers: 4, chimney: 2 },
  { front: ".DD..WW|WW", roof: "gable", tiers: 4, chimney: -4, detail: "awning" },
  { front: "WW|WW..DD.", roof: "saltbox", tiers: 4, chimney: 2, detail: "shutters" },
  { front: ".W.DD...W.", roof: "hip", tiers: 3, chimney: -4, detail: "stone" },
  { front: ".DD.WW.WW.", roof: "hip", tiers: 4, chimney: 2, detail: "awning" },
  { front: "WWW...DD.W", roof: "gable", tiers: 4, chimney: -3, detail: "bay" },
  { front: "W.DD.WW|WW", roof: "saltbox", tiers: 3, chimney: -4, detail: "awning" },
  { front: ".W.W..DD.W", roof: "gable", tiers: 3, chimney: 3, detail: "stone" },
  { front: "WWW|WW.DD.", roof: "hip", tiers: 4, chimney: 0, detail: "gable" },
  { front: ".DD..W.WW.", roof: "saltbox", tiers: 4, chimney: 3, detail: "store" },
];

export function cottageDoor(design: number) {
  return (houses[design].front.indexOf("DD") - 4) / 4;
}

export function buildCottage(box: Box, design = 0) {
  const house = houses[design];
  const { plaster, tile, glass, smoke } = palette.cottage;
  const wood = palette.wood;
  const stone = palette.ground.stone;
  function bricks(x: number, y: number, z: number, w: number, h: number, d: number, color: number) {
    box((x + w / 2) / 4, 0.4 + (y + h / 2) / 4, (z + d / 2) / 4, w / 4, h / 4, d / 4, color);
  }
  bricks(-5, -3, -4, 10, 3, 8, stone);
  bricks(-5, 0, -4, 10, 5, 7, plaster);
  for (let i = 0; i < house.front.length; i++) {
    const opening = house.front[i];
    const x = i - 5;
    if (opening === "D") {
      bricks(x, 0, 3, 1, 4, 1, wood);
    } else {
      bricks(x, 0, 3, 1, 2, 1, house.detail === "stone" ? stone : plaster);
      bricks(x, 2, 3, 1, 2, 1, opening === "W" ? glass : opening === "|" ? wood : plaster);
    }
  }
  bricks(-5, 4, 3, 10, 1, 1, plaster);
  bricks(5, 2, -1, 1, 2, 2, glass);
  for (let tier = 0; tier < house.tiers; tier++) {
    const inset = house.roof === "hip" ? tier : 0;
    const back = -5 + (house.roof === "saltbox" ? Math.floor(tier / 2) : tier);
    bricks(-6 + inset, 5 + tier, back, 12 - 2 * inset, 1, 5 - tier - back, tile);
  }
  const door = house.front.indexOf("DD") - 5;
  if (house.detail === "awning") {
    bricks(door - 1, 4, 4, 4, 1, 2, wood);
    bricks(door - 1, 0, 5, 1, 4, 1, wood);
  } else if (house.detail === "gable") {
    bricks(door - 1, 5, 3, 4, 2, 2, plaster);
    bricks(door, 5, 5, 2, 1, 1, glass);
    for (let i = 0; i < 3; i++) bricks(door - 2 + i, 7 + i, 1, 6 - i * 2, 1, 5, tile);
  } else if (house.detail === "bay") {
    bricks(-5, 0, 4, 4, 2, 1, stone);
    bricks(-5, 2, 4, 4, 2, 1, glass);
    bricks(-4, 2, 5, 1, 2, 1, wood);
    bricks(-5, 4, 4, 5, 1, 2, tile);
  } else if (house.detail === "store") {
    bricks(5, 3, -3, 2, 1, 6, tile);
    bricks(7, 2, -3, 1, 1, 6, tile);
    bricks(7, 0, 2, 1, 2, 1, wood);
    bricks(5, 0, -2, 2, 1, 4, wood);
  } else if (house.detail === "shutters") {
    bricks(-5, 2, 4, 1, 2, 1, wood);
    bricks(0, 2, 4, 1, 2, 1, wood);
  }
  bricks(house.chimney, 6, -1, 2, 5, 2, stone);
  for (let i = 0; i < 3; i++) {
    box((house.chimney + 1) / 4 + i * 0.24, 3.44 + i * 0.45, 0, 0.27 + i * 0.06, 0.26, 0.3, smoke);
  }
}
