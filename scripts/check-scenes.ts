// Generate each scene across a sweep of seeds and check properties the art
// direction relies on. Run with `npm run check` (add `--hash` to print a
// fingerprint of every landscape, for confirming a refactor changes nothing).
import { createHash } from "node:crypto";
import { createServer } from "vite";
import type * as THREE from "three";

type Point = { x: number; z: number; y: number };
type Built = { mesh: THREE.InstancedMesh; routes: Point[][] };

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
const load = (path: string) => server.ssrLoadModule(path);
const { buildIsland } = await load("/src/island.ts");
const { buildWoods } = await load("/src/woods.ts");
const { buildMillpond } = await load("/src/millpond.ts");
const { buildHillside } = await load("/src/hillside.ts");
const { dailySeed } = await load("/src/day.ts");
const { Matrix4, Color } = await load("three");

const scenes: Record<string, (seed: number, model: boolean, grid: number) => Built> = {
  island: (seed, model, grid) => buildIsland(seed, model, grid),
  lagoon: (seed, model, grid) => buildIsland(seed, model, grid, undefined, "lagoon"),
  isles: (seed, model, grid) => buildIsland(seed, model, grid, undefined, "isles"),
  woods: (seed, model, grid) => buildWoods(seed, model, grid),
  millpond: (seed, model, grid) => buildMillpond(seed, model, grid),
  hillside: (seed, model, grid) => buildHillside(seed, model, grid),
};

const hashOnly = process.argv.includes("--hash");
const seeds = [dailySeed(new Date(2026, 10, 22)), ...Array.from({ length: 11 }, (_, i) => 1000 + i * 7919)];
const failures: string[] = [];

function instances(mesh: THREE.InstancedMesh, visit: (matrix: number[], color: number) => void) {
  const matrix = new Matrix4(),
    color = new Color();
  mesh.traverse(part => {
    if (!(part as THREE.InstancedMesh).isInstancedMesh) return;
    const batch = part as THREE.InstancedMesh;
    for (let i = 0; i < batch.count; i++) {
      batch.getMatrixAt(i, matrix);
      batch.getColorAt(i, color);
      visit(matrix.elements, color.getHex());
    }
  });
}

for (const [name, build] of Object.entries(scenes)) {
  for (const seed of seeds) {
    for (const model of [false, true]) {
      const label = `${name} seed ${seed} ${model ? "model" : "vista"}`;
      let scene: Built;
      try {
        scene = build(seed, model, 2);
      } catch (error) {
        failures.push(`${label}: generation failed: ${error}`);
        continue;
      }
      const hash = createHash("sha256");
      const colors = new Set<number>();
      let count = 0;
      instances(scene.mesh, (m, color) => {
        hash.update(new Float64Array([...m, color]));
        colors.add(color);
        count++;
        if (!m.every(Number.isFinite)) failures.push(`${label}: instance ${count} has a non-finite transform`);
      });
      if (hashOnly) {
        console.log(label, count, hash.digest("hex").slice(0, 16));
        continue;
      }
      // The ray volume stores colour ids in eight bits.
      if (colors.size > 255) failures.push(`${label}: ${colors.size} colours exceed the ray palette`);
      // Walkers climb at most one terrain layer between neighbouring treads.
      for (const route of scene.routes) {
        for (let i = 1; i < route.length; i++) {
          const a = route[i - 1],
            b = route[i];
          const step = Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
          if (step > 1 || Math.abs(a.y - b.y) > 0.5) {
            failures.push(`${label}: route jumps from (${a.x}, ${a.y}, ${a.z}) to (${b.x}, ${b.y}, ${b.z})`);
            break;
          }
        }
      }
    }
  }
}
await server.close();
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
if (!hashOnly) console.log(`Checked ${Object.keys(scenes).length} scenes across ${seeds.length} seeds.`);
