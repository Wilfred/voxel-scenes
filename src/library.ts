import { fenceBuilder } from "./fences";
import { contactRays } from "./contact-rays";
import { animals, village } from "./village";
import { buildOutbuilding, buildingNames } from "./outbuildings";
import * as THREE from "three";
import { buildCottage } from "./cottage";
import { designNames } from "./designs";
import { addBird } from "./ducks";
import { boats } from "./boats";
import { lightScene } from "./lighting";
import { palette } from "./palette";
import { firewood, footbridge, pier, shoreStairs, waypost } from "./trail-details";
import { reedbed, treeStudy, type Species } from "./trees";
import { voxelBatch, type Box } from "./voxels";

type Asset = { name: string; draw: (box: Box) => void };

function trees(species: Species): Asset[] {
  return designNames[species].map((name, index) => ({
    name,
    draw(box) {
      treeStudy(box, species, index);
    },
  }));
}

function library(renderer: THREE.WebGLRenderer) {
  const collection = document.querySelector<HTMLElement>("#collection")!;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(palette.light.forestSky);
  lightScene(scene);
  const camera = new THREE.OrthographicCamera();
  const draws = new Map<Element, () => void>();
  const observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          draws.get(entry.target)!();
          observer.unobserve(entry.target);
          draws.delete(entry.target);
        }
      }
    },
    { rootMargin: "200px" },
  );

  function section(id: string, title: string, assets: Asset[], sameScale = true) {
    const section = document.createElement("section");
    section.id = id;
    const heading = document.createElement("h2");
    heading.textContent = title;
    const grid = document.createElement("div");
    grid.className = "asset-grid";
    section.append(heading, grid);
    collection.append(section);

    const models = assets.map(({ name, draw }) => {
      const { box, buildMesh } = voxelBatch();
      draw(box);
      const mesh = buildMesh();
      contactRays(mesh);
      const bounds = new THREE.Box3().setFromObject(mesh);
      return { name, mesh, sphere: bounds.getBoundingSphere(new THREE.Sphere()) };
    });
    const familyRadius = Math.max(...models.map(model => model.sphere.radius));

    for (const { name, mesh, sphere } of models) {
      const figure = document.createElement("figure");
      const canvas = document.createElement("canvas");
      const caption = document.createElement("figcaption");
      caption.textContent = name;
      canvas.tabIndex = 0;
      canvas.setAttribute("aria-label", name);
      canvas.setAttribute("aria-describedby", "instructions");
      canvas.width = 480;
      canvas.height = 360;
      figure.append(canvas, caption);
      grid.append(figure);
      const context = canvas.getContext("2d")!;
      let yaw = 0.5,
        pitch = 0.35;
      function render() {
        const radius = (sameScale ? familyRadius : sphere.radius) * 1.04;
        const horizontal = Math.cos(pitch);
        camera.position
          .set(Math.sin(yaw) * horizontal, Math.sin(pitch), Math.cos(yaw) * horizontal)
          .multiplyScalar(radius * 3)
          .add(sphere.center);
        camera.lookAt(sphere.center);
        camera.top = radius;
        camera.bottom = -radius;
        camera.right = (radius * 4) / 3;
        camera.left = -camera.right;
        camera.updateProjectionMatrix();
        scene.add(mesh);
        renderer.render(scene, camera);
        context.drawImage(renderer.domElement, 0, 0);
        scene.remove(mesh);
      }
      function rotate(dx: number, dy: number) {
        yaw += dx;
        pitch = THREE.MathUtils.clamp(pitch + dy, -1.45, 1.45);
        render();
      }
      let lastX = 0,
        lastY = 0;
      canvas.onpointerdown = e => {
        if (!e.isPrimary || e.button !== 0) return;
        lastX = e.clientX;
        lastY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
      };
      canvas.onpointermove = e => {
        if (!canvas.hasPointerCapture(e.pointerId)) return;
        rotate((lastX - e.clientX) * 0.018, (e.clientY - lastY) * 0.014);
        lastX = e.clientX;
        lastY = e.clientY;
      };
      canvas.onkeydown = e => {
        const steps: Record<string, [number, number]> = {
          ArrowLeft: [-0.2, 0],
          ArrowRight: [0.2, 0],
          ArrowUp: [0, 0.15],
          ArrowDown: [0, -0.15],
        };
        if (!steps[e.key]) return;
        e.preventDefault();
        rotate(...steps[e.key]);
      };
      draws.set(canvas, render);
      observer.observe(canvas);
    }
  }

  section("pines", "Pines · adult and sapling", trees("pine"));
  section("broadleaf", "Broadleaf trees · adult and sapling", trees("broadleaf"));
  section("palms", "Palms · adult and sapling", trees("palm"));
  section("tropical", "Tropical trees · adult and sapling", trees("tropical"));
  section("shrubs", "Shrubs · adult and young", trees("shrub"));
  section("water-plants", "Water plants", [{ name: "Reed clump", draw: box => reedbed(box, 0, 0, -0.5, 0, 0, 1) }]);
  section(
    "cottages",
    "Cottages",
    designNames.cottage.map((name, i) => ({ name, draw: box => buildCottage(box, i) })),
  );
  section(
    "outbuildings",
    "Working buildings",
    (Object.keys(buildingNames) as (keyof typeof buildingNames)[]).map(kind => ({
      name: buildingNames[kind],
      draw: box => buildOutbuilding(box, kind),
    })),
  );
  section(
    "birds",
    "Water birds",
    (["drake", "hen", "gull", "flying gull"] as const).map((species, i) => ({
      name: ["Mallard drake", "Mallard hen", "Seagull", "Gull in flight"][i],
      draw: box => addBird(box, 0, 0, 0, species),
    })),
  );
  section("animals", "Land animals", animals);
  section("boats", "Boats", boats, false);
  section("village", "Village and orchard", village, false);
  section(
    "structures",
    "Structures and props",
    [
      {
        name: "Pasture fence and gate",
        draw: box => {
          const fence = fenceBuilder(box, () => 0);
          fence.bay(-2, 0, 0, 0);
          fence.bay(0, 0, 2, 0, true);
          fence.finish();
        },
      },
      { name: "Timber footbridge", draw: box => footbridge(box, -3, 3, 0, x => (Math.abs(x) >= 3 ? 0 : -1)) },
      { name: "Landing pier", draw: box => pier(box, { x: 0, z: 0 }, 1, 0, () => -1) },
      {
        name: "Shore stairs",
        draw: box =>
          shoreStairs(
            box,
            [0, 0.5, 1, 1.5].map(x => ({ x, z: 0 })),
            2,
            3,
          ),
      },
      { name: "Waypost", draw: box => waypost(box, 0, 0, 0) },
      { name: "Stacked firewood", draw: box => firewood(box, 0, 0, 0) },
    ],
    false,
  );
}

const canvas = document.createElement("canvas");
const context = canvas.getContext("webgl2", { antialias: true });
if (context) {
  const renderer = new THREE.WebGLRenderer({ canvas, context });
  renderer.setSize(480, 360, false);
  library(renderer);
} else {
  document.querySelector("#instructions")!.textContent =
    "Viewing the models requires WebGL 2. Check that hardware acceleration is enabled.";
}
