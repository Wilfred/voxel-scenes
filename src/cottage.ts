import { palette } from "./palette";
import type { Box } from "./voxels";

export function buildCottage(box: Box) {
  // Build in quarter-unit bricks, with the doorstep as the vertical origin.
  function bricks(x: number, y: number, z: number, w: number, h: number, d: number, color: number) {
    box((x + w / 2) / 4, 0.4 + (y + h / 2) / 4, (z + d / 2) / 4, w / 4, h / 4, d / 4, color);
  }
  const plaster = palette.cottage.plaster;
  const roof = palette.cottage.tile;
  const glass = palette.cottage.glass;
  const timber = palette.wood.weathered;
  bricks(-5, -3, -4, 10, 3, 8, palette.ground.stone);
  bricks(-5, 0, -4, 10, 5, 7, plaster);

  // Inlay the door and panes flush into the front wall.
  bricks(-5, 0, 3, 4, 2, 1, plaster);
  bricks(1, 0, 3, 4, 2, 1, plaster);
  bricks(-1, 0, 3, 2, 4, 1, timber);
  for (const edge of [-5, 1]) {
    bricks(edge, 2, 3, 1, 2, 1, plaster);
    bricks(edge + 1, 2, 3, 2, 2, 1, glass);
    bricks(edge + 3, 2, 3, 1, 2, 1, plaster);
  }
  bricks(-5, 4, 3, 10, 1, 1, plaster);
  bricks(5, 2, -1, 1, 2, 2, glass);
  for (let tier = 0; tier < 4; tier++) {
    bricks(-6, 5 + tier, -5 + tier, 12, 1, 10 - 2 * tier, roof);
  }
  bricks(2, 7, -1, 2, 4, 2, palette.ground.stone);
  for (let i = 0; i < 3; i++) {
    box(0.75 + i * 0.24, 3.44 + i * 0.45, 0, 0.27 + i * 0.06, 0.26, 0.3, palette.cottage.smoke);
  }
}
