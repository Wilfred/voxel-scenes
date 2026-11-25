import * as THREE from "three";
import { buildCoast, coastVistaRadius } from "./coast";
import { buildHillside } from "./hillside";
import { buildIsland } from "./island";
import type { IslandKind } from "./islands";
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
  water: (geometry: THREE.BufferGeometry, height?: number) => THREE.Mesh;
};

// What the page needs to show a generated landscape, independent of scene.
export type Landscape = {
  mesh: ReturnType<typeof buildWoods>["mesh"];
  depth: DepthMap;
  chimney?: THREE.Vector3;
  // Shown alongside the voxels and disposed with them.
  extras: THREE.Mesh[];
  water?: THREE.Mesh[];
  // The bounded water surface of a rectangular model, when it has one.
  waterBounds?: { x: number; z: number; width: number; depth: number };
  vistaSeaExtent?: number;
  sea: boolean;
  // Open sea under a coastal sky.
  coastal?: boolean;
  deepWater: number;
  // The building or crossing the eye should settle on.
  focus: THREE.Vector3;
  // The direction the focus faces, as an azimuth from +z.
  facade: number;
  // Restrict orbiting to the front and both front corners of the building.
  frontOnly: boolean;
  // Model framing: the point to aim at and the frame half-height per grid unit,
  // which also sets the vista's distance. The opening view then fits the place.
  modelTarget: THREE.Vector3;
  modelHeight: number;
  modelRise?: number;
  // Vista framing: whether to place the focus on a third or centre the whole place.
  thirds: boolean;
  // The radius in grid units of the land around the focus that a vista fits in
  // its frame. A rectangular model fits the whole model.
  focusRadius: number;
};

type Scene = {
  name: string;
  description: string;
  build: (options: Options) => Landscape;
};

function islandScene(name: string, description: string, kind: IslandKind): Scene {
  return {
    name,
    description,
    build({ seed, model, grid }) {
      const island = buildIsland(seed, model, grid, undefined, kind);
      return {
        mesh: island.mesh,
        chimney: island.chimney,
        depth: island.depth,
        extras: [island.floor],
        waterBounds: island.bounds,
        vistaSeaExtent: island.seaExtent,
        sea: true,
        coastal: true,
        deepWater: palette.water.sea,
        focus: model ? new THREE.Vector3() : new THREE.Vector3(0, 1, 0),
        facade: island.facadeAngle,
        frontOnly: true,
        modelTarget: new THREE.Vector3(0, -3, 0),
        modelHeight: 14,
        modelRise: 27,
        thirds: false,
        // Take in the whole island.
        focusRadius: 22,
      };
    },
  };
}

export const scenes: Record<string, Scene> = {
  island: islandScene(
    "Island",
    "A palm-fringed crescent bay with a wooded ridge and a cottage above the beach",
    "crescent",
  ),
  lagoon: islandScene(
    "Lagoon",
    "A ring of palms and sand around a shallow lagoon, with a cottage on its knoll",
    "lagoon",
  ),
  isles: islandScene("Isles", "A chain of wooded islets joined by a sand spit, with a cottage on the largest", "isles"),
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
        focusRadius: 12,
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
        focusRadius: 12,
      };
    },
  },
  coast: {
    name: "Coast",
    description:
      "A river from wooded hills past a millpond, watermill and weir, under a footbridge and out to a beach landing",
    build({ seed, model, grid, water }) {
      const coast = buildCoast(seed, model, grid);
      // The millpond and the weir above the tidal reach have their own surfaces.
      const surfaces = [water(coast.pond, coast.head), water(coast.weir)];
      for (const surface of surfaces) surface.renderOrder = 1;
      return {
        mesh: coast.mesh,
        depth: coast.depth,
        extras: [coast.foam],
        water: surfaces,
        waterBounds: coast.bounds,
        sea: true,
        coastal: true,
        deepWater: palette.water.sea,
        focus: coast.focus,
        chimney: coast.chimney,
        facade: 0,
        frontOnly: true,
        modelTarget: new THREE.Vector3(0, 1, 0),
        modelHeight: 19,
        thirds: false,
        // Come close enough for the valley to fill the frame, with the pond,
        // mill, bridge and cottage in view.
        focusRadius: coastVistaRadius,
      };
    },
  },
  hillside: {
    name: "Hillside",
    description: "A hillside cottage overlooking a waterfall and its winding river",
    build({ seed, model, grid, water }) {
      const hillside = buildHillside(seed, model, grid);
      const surfaces = hillside.waterLevels.map(({ geometry, height }) => water(geometry, height));
      surfaces.push(water(hillside.fallingWater));
      for (const surface of surfaces) surface.renderOrder = 1;
      return {
        mesh: hillside.mesh,
        chimney: hillside.chimney,
        depth: hillside.depth,
        extras: [hillside.foam],
        water: surfaces,
        sea: false,
        deepWater: palette.water.river,
        focus: hillside.focus,
        facade: 0,
        frontOnly: true,
        modelTarget: new THREE.Vector3(-1, 3, -2),
        modelHeight: 13,
        thirds: true,
        focusRadius: 12,
      };
    },
  },
};

export function disposeLandscape(landscape: Landscape) {
  for (const part of [landscape.mesh, ...landscape.extras, ...(landscape.water ?? [])]) {
    part.removeFromParent();
    if (part instanceof THREE.InstancedMesh) part.dispose();
    part.geometry.dispose();
    for (const material of [part.material].flat()) material.dispose();
  }
  landscape.depth.texture.dispose();
}
