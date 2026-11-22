type Box = (x: number, y: number, z: number, w: number, h: number, d: number, color: number) => void;

export function buildCottage(box: Box, stone: number) {
  // Build in quarter-unit bricks, with the doorstep as the vertical origin.
  function bricks(x: number, y: number, z: number, w: number, h: number, d: number, color: number) {
    box((x + w / 2) / 4, 0.4 + (y + h / 2) / 4, (z + d / 2) / 4, w / 4, h / 4, d / 4, color);
  }
  const plaster = 0xbda98b;
  const roof = 0x956b53;
  const glass = 0x99aaa4;
  const timber = 0x948574;
  bricks(-5, -3, -4, 10, 3, 8, stone);
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
  bricks(2, 7, -1, 2, 4, 2, stone);
  bricks(2, 12, -1, 1, 1, 1, 0xdcd5c8);
  bricks(3, 14, -1, 1, 1, 1, 0xe2dbce);
  bricks(4, 16, -1, 2, 1, 1, 0xe7e0d5);
}
