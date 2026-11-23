import { palette } from "./palette";
import { constructionVoxel as timber } from "./scale";
import type { Elevation } from "./sites";
import type { Box } from "./voxels";

// Each post is shared by the bays that meet there. Step the rails at a post
// when neighbouring bays sit on different terrain courses.
export function fenceBuilder(box: Box, elevation: Elevation) {
  const posts = new Map<string, { x: number; z: number; bottom: number; top: number }>();
  function bay(x: number, z: number, endX: number, endZ: number, gate = false) {
    const floor = Math.max(elevation(x, z), elevation(endX, endZ));
    const top = floor + 3 * timber;
    for (const [px, pz] of [
      [x, z],
      [endX, endZ],
    ]) {
      const key = px + "," + pz;
      const existing = posts.get(key);
      posts.set(key, { x: px, z: pz, bottom: elevation(px, pz), top: Math.max(existing?.top ?? top, top) });
    }
    const alongX = x !== endX;
    const span = Math.abs(endX - x) + Math.abs(endZ - z) - timber;
    const cx = (x + endX) / 2,
      cz = (z + endZ) / 2;
    const thickness = gate ? timber / 2 : timber;
    for (const offset of [timber, 2.5 * timber]) {
      box(
        cx,
        floor + offset + timber / 4,
        cz,
        alongX ? span : thickness,
        timber / 2,
        alongX ? thickness : span,
        palette.wood,
      );
    }
    if (gate) box(cx, floor + 2 * timber, cz, timber, timber, timber, palette.wood);
  }
  function finish() {
    for (const { x, z, bottom, top } of posts.values())
      box(x, (bottom + top) / 2, z, timber, top - bottom, timber, palette.wood);
  }
  return { bay, finish };
}

// Fence a square field reaching `half` cells either side of its centre in
// two-cell bays, and hang the gate in the bay nearest the track.
export function fencedField(
  box: Box,
  elevation: Elevation,
  centre: { x: number; z: number },
  half: number,
  track: { x: number; z: number }[],
) {
  const { x, z } = centre;
  const corners: [number, number][] = [];
  for (let i = -half; i < half; i += 2) corners.push([i, -half]);
  for (let i = -half; i < half; i += 2) corners.push([half, i]);
  for (let i = half; i > -half; i -= 2) corners.push([i, half]);
  for (let i = half; i > -half; i -= 2) corners.push([-half, i]);
  const distances = corners.map(([a, b], i) => {
    const [c, d] = corners[(i + 1) % corners.length];
    return Math.min(...track.map(p => Math.hypot(p.x - x - (a + c) / 2, p.z - z - (b + d) / 2)));
  });
  const gate = distances.indexOf(Math.min(...distances));
  const fence = fenceBuilder(box, elevation);
  corners.forEach(([a, b], i) => {
    const [c, d] = corners[(i + 1) % corners.length];
    fence.bay(x + a, z + b, x + c, z + d, i === gate);
  });
  fence.finish();
}
