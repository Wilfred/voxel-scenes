import { palette } from "./palette";
import { masonry } from "./scale";
import type { Box } from "./voxels";

export function masonryCourses(box: Box) {
  return (x: number, y: number, z: number, w: number, h: number, d: number, color: number) => {
    box(
      (x + w / 2) * masonry,
      (y + h / 2) * masonry,
      (z + d / 2) * masonry,
      w * masonry,
      h * masonry,
      d * masonry,
      color,
    );
  };
}

// The opening replaces the outer wall course. A half-course reveal catches
// light under the head and along the jambs, even in a small facade.
export function casement(
  course: ReturnType<typeof masonryCourses>,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  surround: number,
) {
  const trim = 0.5;
  course(x, y, z, width, trim, 1, surround);
  course(x, y + height - trim, z, width, trim, 1, surround);
  const bottom = y + trim,
    clear = height - 2 * trim;
  course(x, bottom, z, trim, clear, 1, surround);
  course(x + width - trim, bottom, z, trim, clear, 1, surround);
  course(x + trim, bottom, z, width - 2 * trim, clear, trim, palette.cottage.glass);
  if (width >= 4) course(x + Math.floor(width - trim) / 2, bottom, z + trim, trim, clear, trim, surround);
}

export type Roof = "gable" | "hip" | "saltbox";

export function pitchedRoof(
  course: ReturnType<typeof masonryCourses>,
  shape: Roof,
  halfWidth: number,
  halfDepth: number,
  eaves: number,
  tiers: number,
  endWall: number,
) {
  for (let i = 0; i < tiers; i++) {
    const inset = shape === "hip" ? i : 0;
    const back = -halfDepth + (shape === "saltbox" ? Math.floor(i / 2) : i);
    const length = halfDepth - i - back;
    const width = 2 * (halfWidth - inset);
    // Leave the gable ends in the wall material beneath the top course.
    if (shape === "hip" || length <= 2 || i + 1 === tiers) {
      course(-halfWidth + inset, eaves + i, back, width, 1, length, palette.cottage.tile);
    } else {
      course(-halfWidth, eaves + i, back, width, 1, 1, palette.cottage.tile);
      course(-halfWidth, eaves + i, back + length - 1, width, 1, 1, palette.cottage.tile);
      course(-halfWidth + 1, eaves + i, back + 1, width - 2, 1, length - 2, endWall);
    }
  }
}
