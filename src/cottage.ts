import { masonryCourses, pitchedRoof, type Roof } from "./building";
import { masonry } from "./scale";
import { palette } from "./palette";
import type { Box } from "./voxels";

// Facades are read from left to right. D is the door, W a pane, and | a mullion.
type House = { front: string; roof: Roof; tiers: number; chimney: number; detail?: "stone" | "bay" };
const houses: House[] = [
  { front: ".WW.DD.WW.", roof: "gable", tiers: 4, chimney: 2 },
  { front: ".DD..WW|WW", roof: "gable", tiers: 4, chimney: -4 },
  { front: "WW|WW..DD.", roof: "saltbox", tiers: 4, chimney: 2 },
  { front: ".W.DD...W.", roof: "hip", tiers: 3, chimney: -4, detail: "stone" },
  { front: ".DD.WW.WW.", roof: "hip", tiers: 4, chimney: 2 },
  { front: "WWW...DD.W", roof: "gable", tiers: 4, chimney: -3, detail: "bay" },
  { front: "W.DD.WW|WW", roof: "saltbox", tiers: 3, chimney: -4 },
  { front: ".W.W..DD.W", roof: "gable", tiers: 3, chimney: 3, detail: "stone" },
  { front: "WWW|WW.DD.", roof: "hip", tiers: 4, chimney: 0 },
  { front: ".DD..W.WW.", roof: "saltbox", tiers: 4, chimney: 3 },
];

export function cottageDoor(design: number) {
  return (houses[design].front.indexOf("DD") - 4) * masonry;
}

export function buildCottage(box: Box, design = 0) {
  const house = houses[design];
  const { plaster, tile, glass, smoke } = palette.cottage;
  const wood = palette.wood;
  const stone = palette.ground.stone;
  const bricks = masonryCourses(box);
  // The facade occupies the front course. Openings replace wall blocks.
  const front = ".." + house.front + "..";
  const wall = house.detail === "stone" ? stone : plaster;
  bricks(-7, -3, -5, 14, 3, 10, stone);
  bricks(-7, 0, -5, 13, 6, 8, wall);
  for (let z = -5; z < 4; z++) {
    bricks(6, 0, z, 1, 2, 1, wall);
    bricks(6, 2, z, 1, 2, 1, z === -2 || z === -1 ? glass : wall);
    bricks(6, 4, z, 1, 2, 1, wall);
  }
  for (let i = 0; i < front.length; i++) {
    const x = i - 7, opening = front[i];
    const door = opening === "D";
    const pane = opening === "W" || opening === "|";
    const z = door ? 3 : 4;
    if (!door && i < front.length - 1) bricks(x, 0, 3, 1, 6, 1, wall);
    bricks(x, 0, z, 1, 2, 1, door ? wood : wall);
    bricks(x, 2, z, 1, 2, 1, door || opening === "|" ? wood : pane ? glass : wall);
    if (door) bricks(x, 0, 4, 1, 0.5, 1, stone);
    bricks(x, 4, door ? 3 : 4, 1, 1, door ? 2 : 1, door ? wood : wall);
    bricks(x, 5, door ? 3 : 4, 1, 1, door ? 2 : 1, wall);
  }
  pitchedRoof(bricks, house.roof, 8, 6, 6, house.tiers + 1, wall);
  if (house.detail === "bay") {
    bricks(-5, 0, 5, 3, 2, 1, stone);
    bricks(-5, 2, 5, 3, 2, 1, glass);
    bricks(-5, 4, 5, 3, 1, 1, tile);
  }
  bricks(house.chimney, 8, -2, 2, 5, 2, stone);
  for (let i = 0; i < 3; i++) bricks(house.chimney + i, 14 + i * 2, -2, 1, 1, 1, smoke);
}
