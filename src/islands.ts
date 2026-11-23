import { tropicalGrove, type Species } from "./trees";

// The outline and planting of one kind of island. Heights are in world
// units on the island's half-unit terrain lattice; zero is sea level.
export type IslandShape = {
  // A seeded angle that varies the coastline and the seabed patches.
  phase: number;
  height: (x: number, z: number) => number;
  // A sheltered water point, in grid units, that the cottage stairs should reach.
  cove: { x: number; z: number };
  // The area to search for a cottage terrace, in world units.
  search: { left: number; right: number; back: number; front: number };
  // An extra cost for a cottage terrace, such as distance from a headland.
  siteBias: (x: number, z: number) => number;
  // The chance of a tree in a grass or sand cell, and which kind grows there,
  // given its distance from the cottage. A design is named when the kind of
  // tree depends on its role rather than the seed.
  density: (x: number, z: number, h: number) => number;
  tree: (x: number, z: number, h: number, home: number) => { species: Species; design?: number };
  // Whether trees also grow from the beach, as palms do.
  beachTrees: boolean;
};

export type IslandKind = "crescent" | "lagoon" | "isles";

const unit = 0.5;

export function islandShape(
  kind: IslandKind,
  random: () => number,
  grid: number,
  relief: (x: number, z: number) => number,
): IslandShape {
  const phase = random() * Math.PI * 2;
  if (kind === "lagoon") return lagoon(random, phase, grid, relief);
  if (kind === "isles") return isles(random, phase, grid, relief);
  const bayX = 1 + random() * 2;
  const bayZ = 5 + random() * 1.5;
  const bayWidth = 8 + random() * 2;
  const ridgeX = -10 - random() * 2;
  const headlandX = Math.round((bayX - bayWidth * 0.9) * grid);
  return {
    phase,
    height(worldX, worldZ) {
      const x = worldX / grid,
        z = worldZ / grid;
      // Offset the bay toward the eastern tip to leave a longer western arm.
      const angle = Math.atan2(z / 12, x / 17);
      const edge = 1 + 0.055 * Math.sin(3 * angle + phase) + 0.04 * Math.cos(5 * angle - phase);
      const outer = (edge - Math.hypot(x / 17, (z + 0.2 * x) / 12)) * 12;
      const inner = (Math.hypot((x - bayX) / bayWidth, (z - bayZ) / 10) - 1) * 9;
      const inland = Math.min(outer, inner);
      const ridge = Math.exp(-((x - ridgeX) ** 2 / 36 + (z + 1) ** 2 / 68));
      return Math.floor((inland * (0.7 + 1.55 * ridge + 0.6 * relief(worldX, worldZ))) / unit) * unit;
    },
    cove: { x: bayX, z: bayZ },
    search: {
      left: headlandX - 4 * grid,
      right: headlandX + 3 * grid,
      back: -Math.ceil(10 * grid),
      front: 5 * grid,
    },
    siteBias: x => Math.abs(x - headlandX) * 0.15,
    density(x, z, h) {
      const grove = (1 + Math.sin(x * 0.8 + phase) * Math.cos(z * 0.6)) / 2;
      // Palms stand more sparsely along the beach than in the woods above it.
      return (x < -6 ? 0.1 : 0.055) * grove * (h < 1 ? 0.5 : 1);
    },
    tree: tropicalGrove(relief),
    beachTrees: true,
  };
}

// A low ring of sand and palms around a shallow lagoon, broken by a channel
// to the open sea, with one wooded knoll where the cottage stands.
function lagoon(
  random: () => number,
  phase: number,
  grid: number,
  relief: (x: number, z: number) => number,
): IslandShape {
  const ring = 0.84;
  // The knoll rises on the far side of the ring and the channel opens on
  // one of the near flanks, so the lagoon shows from the cottage.
  const knollAngle = -Math.PI / 2 + (random() - 0.5) * 1.6;
  const channelAngle = knollAngle + Math.PI + (random() < 0.5 ? -1 : 1) * (0.5 + random() * 0.7);
  const knollX = ring * 16 * Math.cos(knollAngle),
    knollZ = ring * 11 * Math.sin(knollAngle);
  const islet = { angle: channelAngle + Math.PI + (random() - 0.5) * 1.2, size: 1.5 + random() };
  const circular = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  return {
    phase,
    height(worldX, worldZ) {
      const x = worldX / grid,
        z = worldZ / grid;
      const angle = Math.atan2(z / 11, x / 16);
      const edge = 1 + 0.05 * Math.sin(3 * angle + phase) + 0.035 * Math.cos(5 * angle - phase);
      const r = Math.hypot(x / 16, z / 11) / edge;
      // Sample smooth noise along the ring, so the rim varies as it goes round:
      // wooded islets in places, elsewhere a bare sand bar or a reef awash.
      const along = (offset: number, scale: number) =>
        relief(scale * Math.cos(angle) + offset, scale * Math.sin(angle) - offset);
      const rim = along(311, 40) + 0.35 * along(97, 90);
      const band = 1 - Math.abs(r - ring) / (0.1 + 0.04 * along(53, 30));
      const channel = Math.exp(-(circular(angle, channelAngle) ** 2) / 0.02);
      const knoll = Math.exp(-((x - knollX) ** 2 / 34 + (z - knollZ) ** 2 / 22));
      const motu = Math.exp(-(circular(angle, islet.angle) ** 2) / 0.05) * islet.size;
      const rough = relief(worldX, worldZ);
      const crest = 0.7 + 2.4 * Math.max(0, rim) + 0.6 * motu + 0.3 * rough;
      let h = Math.max(band * crest + 0.8 * Math.min(0, rim) - 3.5 * channel, knoll * (9 + 3 * rough) - 1.5);
      // The lagoon floor is patchy: sand banks and coral heads rise near the
      // surface between deeper holes, and it deepens toward the channel.
      if (h < 0 && r < ring) {
        const bed = relief(1.7 * worldX + 500, 1.7 * worldZ - 300);
        const floor = bed > 0.35 ? -0.5 : -1.75 + 1.6 * bed + 0.4 * rough;
        h = Math.max(h, floor - 1.6 * channel);
      }
      return Math.floor(h / unit) * unit;
    },
    cove: { x: 0, z: 0 },
    search: {
      left: (knollX - 7) * grid,
      right: (knollX + 7) * grid,
      back: (knollZ - 6) * grid,
      front: (knollZ + 6) * grid,
    },
    siteBias: () => 0,
    density(x, z, h) {
      // Palms line the beaches; broadleaves crowd the knoll.
      const grove = (1 + Math.sin(x * 0.7 + phase) * Math.cos(z * 0.55)) / 2;
      return h < 1 ? 0.05 * grove : h < 2.5 ? 0.09 * grove : 0.16 * grove;
    },
    tree: tropicalGrove(relief),
    beachTrees: true,
  };
}

// A chain of wooded islets, the largest with the cottage, joined to its
// nearest neighbour by a sand spit at low tide.
function isles(
  random: () => number,
  phase: number,
  grid: number,
  relief: (x: number, z: number) => number,
): IslandShape {
  const main = { x: -3 + random() * 2, z: -1 - random() * 2, rx: 8 + random() * 2, rz: 5.5 + random(), top: 8 };
  const islets = [main];
  // Space the smaller islands round the main one, leaving open sounds
  // between them, and keep every islet inside the rectangular model's frame.
  const count = 3 + Math.floor(random() * 2);
  const start = random() * Math.PI * 2;
  const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));
  for (let i = 0; i < count; i++) {
    const angle = start + (i / count) * Math.PI * 2 + (random() - 0.5) * 0.6;
    const size = 2 + random() * 2.5;
    const rx = size * (1 + random() * 0.4);
    const cos = Math.cos(angle),
      sin = Math.sin(angle);
    const reach = Math.hypot(cos * main.rx, sin * main.rz) + Math.hypot(cos * rx, sin * size) + 2.5 + random() * 3;
    islets.push({
      x: clamp(main.x + cos * reach, 17.5 - rx),
      z: clamp(main.z + sin * reach, 12.5 - size),
      rx,
      rz: size,
      // Some islets are bare skerries barely clear of the water.
      top: random() < 0.3 ? 0.5 + random() : 2 + random() * 5,
    });
  }
  // The spit joins the main island to its nearest neighbour.
  const neighbour = islets
    .slice(1)
    .reduce((a, b) => (Math.hypot(a.x - main.x, a.z - main.z) < Math.hypot(b.x - main.x, b.z - main.z) ? a : b));
  function spit(x: number, z: number) {
    const dx = neighbour.x - main.x,
      dz = neighbour.z - main.z;
    const t = Math.max(0, Math.min(1, ((x - main.x) * dx + (z - main.z) * dz) / (dx * dx + dz * dz)));
    const bend = Math.sin(t * Math.PI) * 1.5;
    const px = main.x + dx * t - (dz / Math.hypot(dx, dz)) * bend,
      pz = main.z + dz * t + (dx / Math.hypot(dx, dz)) * bend;
    return 0.9 - Math.hypot(x - px, z - pz) * 0.45;
  }
  return {
    phase,
    height(worldX, worldZ) {
      const x = worldX / grid,
        z = worldZ / grid;
      const rough = relief(worldX, worldZ);
      let h = -Infinity;
      for (const isle of islets) {
        const angle = Math.atan2((z - isle.z) / isle.rz, (x - isle.x) / isle.rx);
        const edge = 1 + 0.08 * Math.sin(3 * angle + phase + isle.x) + 0.05 * Math.cos(5 * angle - phase);
        const f = edge - Math.hypot((x - isle.x) / isle.rx, (z - isle.z) / isle.rz);
        // Land rises in a dome; the seabed falls away more steeply.
        const v = f > 0 ? (f * (1.6 + isle.top * (1 + 0.5 * rough))) / (0.4 + f) : f * 9;
        h = Math.max(h, v);
      }
      h = Math.max(h, Math.min(0.5, spit(x, z) + 0.2 * rough));
      return Math.floor(h / unit) * unit;
    },
    cove: { x: (main.x + neighbour.x) / 2, z: (main.z + neighbour.z) / 2 },
    search: {
      left: (main.x - main.rx) * grid,
      right: (main.x + main.rx) * grid,
      back: (main.z - main.rz) * grid,
      front: (main.z + main.rz) * grid,
    },
    siteBias: () => 0,
    density(x, z) {
      const grove = (1 + Math.sin(x * 0.6 + phase) * Math.cos(z * 0.5 - phase)) / 2;
      return 0.11 * grove * grove;
    },
    tree: (x, z) => ({ species: relief(x + 41, z - 67) > 0.1 ? "pine" : "broadleaf" }),
    beachTrees: false,
  };
}
