import * as THREE from "three";
import { buildHillside } from "./hillside";
import { buildIsland } from "./island";
import { buildMillpond } from "./millpond";
import type { orchardSeason } from "./day";
import { palette } from "./palette";
import type { DepthMap } from "./water";
import { buildWoods } from "./woods";

export type Options = {
  seed: number;
  model: boolean;
  grid: number;
  season: ReturnType<typeof orchardSeason>;
  water: THREE.Material;
};

// What the page needs to show a generated landscape, independent of scene.
export type Landscape = {
  mesh: ReturnType<typeof buildWoods>["mesh"];
  depth: DepthMap;
  chimney?: THREE.Vector3;
  // Shown alongside the voxels and disposed with them.
  extras: THREE.Mesh[];
  // The bounded water surface of a rectangular model, when it has one.
  waterBounds?: { x: number; z: number; width: number; depth: number };
  vistaSeaExtent?: number;
  sea: boolean;
  deepWater: number;
  // The building or crossing the eye should settle on.
  focus: THREE.Vector3;
  // The direction the focus faces, as an azimuth from +z.
  facade: number;
  // Restrict orbiting to the front and both front corners of the building.
  frontOnly: boolean;
  // Model framing: the point to centre and the frame half-height per grid unit.
  modelTarget: THREE.Vector3;
  modelHeight: number;
  modelRise?: number;
  // Vista framing: whether to place the focus on a third or centre the whole place.
  thirds: boolean;
};

type Scene = {
  name: string;
  description: string;
  build: (options: Options) => Landscape;
};

export const scenes: Record<string, Scene> = {
  island: {
    name: "Island",
    description: "A crescent bay with a wooded ridge and a cottage above the beach",
    build({ seed, model, grid }) {
      const island = buildIsland(seed, model, grid);
      return {
        mesh: island.mesh,
        chimney: island.chimney,
        depth: island.depth,
        extras: [island.floor],
        waterBounds: island.bounds,
        vistaSeaExtent: island.seaExtent,
        sea: true,
        deepWater: palette.water.sea,
        focus: model ? new THREE.Vector3() : new THREE.Vector3(0, 1, 0),
        facade: island.facadeAngle,
        frontOnly: true,
        modelTarget: new THREE.Vector3(0, -3, 0),
        modelHeight: 14,
        modelRise: 27,
        thirds: false,
      };
    },
  },
  woods: {
    name: "Woods",
    description: "A stream winding through woodland with a timber footbridge",
    build({ seed, model, grid }) {
      const woods = buildWoods(seed, model, grid);
      return {
        mesh: woods.mesh,
        depth: woods.depth,
        extras: [],
        waterBounds: woods.bounds,
        sea: true,
        deepWater: palette.water.river,
        focus: woods.bridge.clone(),
        facade: 0,
        frontOnly: false,
        modelTarget: new THREE.Vector3(woods.bounds.x, 2, woods.bounds.z),
        modelHeight: 19,
        thirds: true,
      };
    },
  },
  millpond: {
    name: "Millpond",
    description: "An orchard track leading to a watermill beside a duck pond",
    build({ seed, model, grid, season }) {
      const pond = buildMillpond(seed, model, grid, undefined, season);
      return {
        mesh: pond.mesh,
        depth: pond.depth,
        extras: [],
        waterBounds: pond.bounds,
        sea: true,
        deepWater: palette.water.river,
        focus: pond.focus,
        facade: 0,
        frontOnly: true,
        modelTarget: new THREE.Vector3(0, 1, 0),
        modelHeight: 13,
        thirds: true,
      };
    },
  },
  hillside: {
    name: "Hillside",
    description: "A hillside cottage overlooking a waterfall and its winding river",
    build({ seed, model, grid, water }) {
      const hillside = buildHillside(seed, model, grid);
      const surface = new THREE.Mesh(hillside.water, water);
      surface.renderOrder = 1;
      surface.receiveShadow = true;
      return {
        mesh: hillside.mesh,
        chimney: hillside.chimney,
        depth: hillside.depth,
        extras: [surface, hillside.foam],
        sea: false,
        deepWater: palette.water.river,
        focus: hillside.focus,
        facade: 0,
        frontOnly: true,
        modelTarget: new THREE.Vector3(-1, 3, -2),
        modelHeight: 13,
        thirds: true,
      };
    },
  },
};

export function disposeLandscape(landscape: Landscape, shared: THREE.Material) {
  for (const part of [landscape.mesh, ...landscape.extras]) {
    part.removeFromParent();
    if (part instanceof THREE.InstancedMesh) part.dispose();
    part.geometry.dispose();
    for (const material of [part.material].flat()) if (material !== shared) material.dispose();
  }
  landscape.depth.texture.dispose();
}
