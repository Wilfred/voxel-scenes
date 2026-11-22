import { palette } from "./palette";
import * as THREE from "three";
import { buildHillside } from "./hillside";
import { buildWoods } from "./woods";
import { createWater } from "./water";
import { buildIsland, bayBounds } from "./island";

const canvas = document.querySelector("canvas")!;
const status = document.querySelector<HTMLElement>("#status")!;
const controls = document.querySelector<HTMLElement>(".controls")!;
const context = canvas.getContext("webgl2", { antialias: true });

if (!context) {
  canvas.hidden = true;
  canvas.style.display = "none";
  controls.hidden = true;
  controls.style.display = "none";
  status.textContent = "This preview requires WebGL 2. Check that hardware acceleration is enabled in your browser.";
} else {
  const renderer = new THREE.WebGLRenderer({ canvas, context });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const cameraTarget = new THREE.Vector3(0, 2, 0);
  const camera = new THREE.OrthographicCamera(-24, 24, 14, -14, 0.1, 350);
  const { sea, surface } = createWater();
  scene.add(sea);

  const sun = new THREE.DirectionalLight(palette.light.sun, 1.9);
  sun.position.set(-26, 21, 18);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 24, bottom: -24, far: 100 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.normalBias = 0.035;
  const skylight = new THREE.HemisphereLight(palette.light.skyLight, palette.light.groundLight, 1.8);
  scene.add(sun, sun.target, skylight);

  let seed = 1846;
  const sceneSelect = document.querySelector<HTMLSelectElement>("#scene")!;
  const framing = document.querySelector<HTMLSelectElement>("#framing")!;
  const ducks = document.querySelector<HTMLInputElement>("#ducks")!;
  const generate = document.querySelector<HTMLButtonElement>("#generate")!;
  const islandDescription = canvas.getAttribute("aria-label")!;
  let island: ReturnType<typeof buildIsland> | undefined;
  let riverDepth: THREE.Texture | undefined;
  let mesh: ReturnType<typeof buildHillside>["mesh"] | undefined;
  let hillsideWater: THREE.Mesh<THREE.BufferGeometry> | undefined;
  function preview() {
    const width = Math.max(1, Math.round(canvas.clientWidth * Math.min(devicePixelRatio, 2)));
    renderer.setSize(width, Math.round(width * 9 / 16), false);
    renderer.render(scene, camera);
  }
  function update() {
    if (hillsideWater) {
      scene.remove(hillsideWater);
      hillsideWater.geometry.dispose();
      hillsideWater = undefined;
    }
    riverDepth?.dispose();
    riverDepth = undefined;
    if (island) {
      scene.remove(island.floor);
      island.floor.geometry.dispose();
      island.floor.material.dispose();
      island.depth.dispose();
      island = undefined;
    }
    if (mesh) {
      scene.remove(mesh);
      mesh.dispose();
      mesh.geometry.dispose();
      mesh.material.dispose();
    }

    const hill = sceneSelect.value === "hillside";
    const woodland = sceneSelect.value === "woods";
    const model = framing.value === "model";
    const inland = hill || woodland;
    const sky = inland ? palette.light.forestSky : palette.light.coastalSky;
    ducks.parentElement!.hidden = !woodland;
    sea.visible = !hill;
    sea.position.set(0, 0, 0);
    sea.scale.setScalar(1);
    cameraTarget.set(0, 2, 0);
    let waterBounds = bayBounds;
    if (hill) {
      const hillside = buildHillside(seed, model);
      mesh = hillside.mesh;
      hillsideWater = new THREE.Mesh(hillside.water, sea.material);
      hillsideWater.receiveShadow = true;
      scene.add(hillsideWater);
      riverDepth = hillside.depth;
      cameraTarget.set(-1, model ? 3 : 5, model ? -2 : -5);
      camera.top = model ? 28 : 13;
    } else if (woodland) {
      const woods = buildWoods(seed, model, ducks.checked);
      mesh = woods.mesh;
      riverDepth = woods.depth;
      waterBounds = woods.bounds;
      cameraTarget.copy(woods.bridge).add(new THREE.Vector3(4, 1, 2));
      if (model) cameraTarget.set(waterBounds.x, 2, waterBounds.z);
      camera.top = model ? 23 : 19;
    } else {
      island = buildIsland(seed, model);
      mesh = island.mesh;
      scene.add(island.floor);
      if (model) cameraTarget.y = -2;
      camera.top = model ? 28 : 12.5;
    }
    if (model && !hill) {
      sea.position.set(waterBounds.x, 0.002, waterBounds.z);
      sea.scale.set(waterBounds.width / sea.geometry.parameters.width, waterBounds.depth / sea.geometry.parameters.height, 1);
    }
    if (model) camera.position.set(26, 30, 42);
    else if (inland) camera.position.set(16, 30, 40);
    else camera.position.set(8, 27, 43);
    camera.position.add(cameraTarget);
    scene.background = new THREE.Color(model ? palette.light.backdrop : sky);
    scene.fog = new THREE.FogExp2(sky, 0.005);
    surface.depth.value = riverDepth ?? island?.depth ?? null;
    surface.deep.value.setHex(inland ? palette.water.river : palette.water.sea);
    surface.sky.value.setHex(sky);
    surface.sun.value.copy(sun.position).normalize();
    surface.eye.value.copy(camera.position).sub(cameraTarget).normalize();
    surface.phase.value = (seed % 997) / 53;
    scene.add(mesh);
    canvas.setAttribute("aria-label", hill ? "A hillside cottage overlooking a waterfall and its winding river" : woodland ? "A stream winding through woodland with a timber footbridge" : islandDescription);
    generate.textContent = hill ? "New hillside" : woodland ? "New woods" : "New island";
    camera.lookAt(cameraTarget);
    camera.bottom = -camera.top;
    camera.right = camera.top * 16 / 9;
    camera.left = -camera.right;
    camera.updateProjectionMatrix();
    document.querySelector("#seed")!.textContent = (hill ? "Hillside " : woodland ? "Woods " : "Island ") + seed;
    preview();
  }

  ducks.onchange = framing.onchange = sceneSelect.onchange = update;
  generate.onclick = () => {
    seed = crypto.getRandomValues(new Uint32Array(1))[0];
    update();
  };
  document.querySelector<HTMLButtonElement>("#save")!.onclick = () => {
    const variant = `-${framing.value}${sceneSelect.value === "woods" && ducks.checked ? "-ducks" : ""}`;
    const filename = `${sceneSelect.value}-${seed}-graphic${variant}.png`;
    renderer.setSize(2560, 1440, false);
    renderer.render(scene, camera);
    canvas.toBlob(blob => {
      if (!blob) {
        status.textContent = "The browser could not export this image.";
        return;
      }
      const link = document.createElement("a");
      link.download = filename;
      link.href = URL.createObjectURL(blob);
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 60000);
    }, "image/png");
    preview();
  };
  const requested = new URLSearchParams(location.search).get("scene");
  if (requested === "woods" || requested === "hillside") sceneSelect.value = requested;
  if (requested === "mountains") sceneSelect.value = "hillside";
  update();
  new ResizeObserver(preview).observe(canvas);
}
