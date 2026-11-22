import { casement, masonryCourses, pitchedRoof, type Roof } from "./building";
import { masonry } from "./scale";
import { palette } from "./palette";
import type { Box } from "./voxels";

// Facades are read from left to right. D is the door, W a pane, and | a mullion.
type House = { front: string; roof: Roof; tiers: number; chimney: number; detail?: "stone" | "bay" };
const houses: House[] = [
  { front: ".WW.DD.WW.", roof: "gable", tiers: 4, chimney: 2 },
  { front: ".DD..WW|WW", roof: "gable", tiers: 4, chimney: -4 },
  { front: "WW|WW..DD.", roof: "saltbox", tiers: 4, chimney: 2 },
  { front: "WWW.DD.WWW", roof: "hip", tiers: 3, chimney: -4, detail: "stone" },
  { front: ".DD.WW.WW.", roof: "hip", tiers: 4, chimney: 2 },
  { front: "WWW...DD..", roof: "gable", tiers: 4, chimney: -3, detail: "bay" },
  { front: "..DD.WW|WW", roof: "saltbox", tiers: 3, chimney: -4 },
  { front: ".WWW..DD..", roof: "gable", tiers: 3, chimney: 3, detail: "stone" },
  { front: "WWW|WW.DD.", roof: "hip", tiers: 4, chimney: 0 },
  { front: ".DD..WW.WW", roof: "saltbox", tiers: 4, chimney: 3 },
];

export function cottageDoor(design: number) {
  return (houses[design].front.indexOf("DD") - 4) * masonry;
}

export function buildCottage(box: Box, design = 0) {
  const house = houses[design];
  const { plaster, tile, smoke } = palette.cottage;
  const wood = palette.wood;
  const stone = palette.ground.stone;
  const bricks = masonryCourses(box);
  // The facade occupies the front course. Openings replace wall blocks.
  const front = ".." + house.front + "..";
  const wall = house.detail === "stone" ? stone : plaster;
  bricks(-7, -3, -5, 14, 3, 10, stone);
  bricks(-7, 0, -5, 13, 6, 8, wall);
  // Rotate the same opening around the east wall, facing the other visible elevation.
  const side: typeof bricks = (u, y, v, w, h, d, tint) => bricks(v, y, -u - w, d, h, w, tint);
  side(-4, 0, 6, 9, 2, 1, wall);
  side(-4, 2, 6, 3, 3, 1, wall);
  casement(side, -1, 2, 6, 3, 3, wall);
  side(2, 2, 6, 3, 3, 1, wall);
  side(-4, 5, 6, 9, 1, 1, wall);
  for (let i = 0; i < front.length; i++) {
    const x = i - 7, opening = front[i];
    if (opening === "W") {
      let width = 1;
      while (front[i + width] === "W" || front[i + width] === "|") width++;
      const bay = house.detail === "bay" && x === -5;
      bricks(x, 0, 3, width, 6, 1, wall);
      bricks(x, 0, 4, width, 2, bay ? 2 : 1, bay ? stone : wall);
      if (bay) bricks(x, 2, 4, width, 3, 1, wall);
      casement(bricks, x, 2, bay ? 5 : 4, width, 3, wall);
      bricks(x, 5, 4, width, 1, bay ? 2 : 1, bay ? tile : wall);
      i += width - 1;
      continue;
    }
    const door = opening === "D";
    const z = door ? 3 : 4;
    if (!door && i < front.length - 1) bricks(x, 0, 3, 1, 6, 1, wall);
    bricks(x, 0, z, 1, 4, 1, door ? wood : wall);
    if (door) bricks(x, 0, 4, 1, 0.5, 1, stone);
    bricks(x, 4, door ? 3 : 4, 1, 1, door ? 2 : 1, door ? wood : wall);
    bricks(x, 5, door ? 3 : 4, 1, 1, door ? 2 : 1, wall);
  }
  pitchedRoof(bricks, house.roof, 8, 6, 6, house.tiers + 1, wall);
  bricks(house.chimney, 8, -2, 2, 5, 2, stone);
  for (let i = 0; i < 3; i++) bricks(house.chimney + i, 14 + i * 2, -2, 1, 1, 1, smoke);
  // A smaller, higher puff drifts downwind as the smoke thins.
  bricks(house.chimney + 3.25, 20.25, -1.75, 0.5, 0.5, 0.5, smoke);
}
