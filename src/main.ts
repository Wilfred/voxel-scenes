import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { lightScene } from "./lighting";
import { designGallery } from "./gallery";
import { defaultDesigns } from "./designs";
import { palette } from "./palette";
import * as THREE from "three";
import { buildHillside } from "./hillside";
import { buildWoods } from "./woods";
import { createWater } from "./water";
import { buildIsland } from "./island";

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
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const cameraTarget = new THREE.Vector3(0, 2, 0);
  const camera = new THREE.OrthographicCamera(-24, 24, 14, -14, 0.1, 350);
  const { sea, surface } = createWater();
  scene.add(sea);

  const blockWater = new THREE.MeshLambertMaterial({
    color: palette.water.river, transparent: true, opacity: 0.52, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const sun = lightScene(scene);
  const sunOffset = sun.position.clone();
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.normalBias = 0.035;
  let seed = 1846;
  const sceneSelect = document.querySelector<HTMLSelectElement>("#scene")!;
  const designs = { ...defaultDesigns };
  const resolution = document.querySelector<HTMLInputElement>("#resolution")!;
  const gridValue = document.querySelector<HTMLOutputElement>("#grid-value")!;
  const framing = document.querySelector<HTMLSelectElement>("#framing")!;
  const generate = document.querySelector<HTMLButtonElement>("#generate")!;
  const islandDescription = canvas.getAttribute("aria-label")!;
  let island: ReturnType<typeof buildIsland> | undefined;
  let riverDepth: THREE.Texture | undefined;
  let mesh: ReturnType<typeof buildHillside>["mesh"] | undefined;
  let hillsideWater: THREE.Mesh<THREE.BufferGeometry> | undefined;
  let foam: typeof mesh;
  const home = new THREE.Spherical(0);
  const orbit = new OrbitControls(camera, canvas);
  orbit.enableZoom = orbit.enablePan = false;
  orbit.minPolarAngle = 0.3;
  orbit.maxPolarAngle = 1.02;
  let frame = 0;
  orbit.addEventListener("change", () => {
    surface.eye.value.copy(camera.position).sub(orbit.target).normalize();
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0;
      renderer.render(scene, camera);
    });
  });
  canvas.ondblclick = () => orbit.reset();
  canvas.onkeydown = event => {
    switch (event.key) {
      case "ArrowLeft": orbit.rotateLeft(0.12); break;
      case "ArrowRight": orbit.rotateLeft(-0.12); break;
      case "ArrowUp": orbit.rotateUp(0.08); break;
      case "ArrowDown": orbit.rotateUp(-0.08); break;
      case "Home": orbit.reset(); break;
      default: return;
    }
    event.preventDefault();
    orbit.update();
  };
  function preview() {
    const width = Math.max(1, Math.round(canvas.clientWidth * Math.min(devicePixelRatio, 2)));
    renderer.setSize(width, Math.round(width * 9 / 16), false);
    renderer.render(scene, camera);
  }
  function update() {
    window.clearTimeout(pendingGrid);
    if (hillsideWater) {
      scene.remove(hillsideWater);
      hillsideWater.geometry.dispose();
      hillsideWater = undefined;
    }
    if (foam) {
      scene.remove(foam);
      foam.dispose();
      foam.geometry.dispose();
      foam.material.dispose();
      foam = undefined;
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

    const grid = Number(resolution.value) * 2;
    gridValue.value = resolution.value + "×";
    const hill = sceneSelect.value === "hillside";
    const woodland = sceneSelect.value === "woods";
    const model = framing.value === "model";
    const inland = hill || woodland;
    const sky = inland ? palette.light.forestSky : palette.light.coastalSky;
    sea.visible = !hill;
    sea.position.set(0, 0, 0);
    sea.scale.set(grid, grid, 1);
    cameraTarget.set(0, 2, 0);
    let waterBounds;
    if (hill) {
      const hillside = buildHillside(seed, model, grid, designs);
      mesh = hillside.mesh;
      hillsideWater = new THREE.Mesh(hillside.water, blockWater);
      hillsideWater.renderOrder = 1;
      hillsideWater.receiveShadow = true;
      scene.add(hillsideWater);
      foam = hillside.foam;
      scene.add(foam);
      cameraTarget.set(-1, model ? 3 : 5, model ? -2 : -5);
      camera.top = 13;
    } else if (woodland) {
      const woods = buildWoods(seed, model, grid, designs);
      mesh = woods.mesh;
      riverDepth = woods.depth;
      waterBounds = woods.bounds;
      cameraTarget.copy(woods.bridge).add(new THREE.Vector3(4, 1, 2));
      if (model) cameraTarget.set(waterBounds.x, 2, waterBounds.z);
      camera.top = 19;
    } else {
      island = buildIsland(seed, model, grid, designs);
      mesh = island.mesh;
      waterBounds = island.bounds;
      scene.add(island.floor);
      if (model) cameraTarget.y = -3;
      camera.top = 12.5;
    }
    if (model && waterBounds) {
      sea.position.set(waterBounds.x, 0.002, waterBounds.z);
      sea.scale.set(waterBounds.width / sea.geometry.parameters.width, waterBounds.depth / sea.geometry.parameters.height, 1);
    }
    const yaw = home.radius > 0 ? orbit.getAzimuthalAngle() - home.theta : 0;
    const tilt = home.radius > 0 ? orbit.getPolarAngle() - home.phi : 0;
    if (inland) camera.position.set(16, 30, 40);
    else camera.position.set(8, 27, 43);
    camera.top *= grid;
    camera.far = 350 * grid;
    home.setFromVector3(camera.position.multiplyScalar(grid));
    orbit.target.copy(cameraTarget);
    camera.position.add(cameraTarget);
    orbit.update();
    orbit.saveState();
    camera.position.setFromSpherical(new THREE.Spherical(home.radius, home.phi + tilt, home.theta + yaw)).add(cameraTarget);
    orbit.update();
    renderer.shadowMap.needsUpdate = true;
    scene.background = new THREE.Color(model ? palette.light.backdrop : sky);
    scene.fog = new THREE.FogExp2(sky, 0.005 / grid);
    sun.position.copy(sunOffset).multiplyScalar(grid);
    Object.assign(sun.shadow.camera, { left: -28 * grid, right: 28 * grid, top: 24 * grid, bottom: -24 * grid, far: 100 * grid });
    sun.shadow.camera.updateProjectionMatrix();
    surface.grid.value = grid;
    surface.depth.value = riverDepth ?? island?.depth ?? null;
    surface.deep.value.setHex(inland ? palette.water.river : palette.water.sea);
    surface.sky.value.setHex(sky);
    surface.sun.value.copy(sun.position).normalize();
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

  designGallery(designs, update);
  let pendingGrid = 0;
  resolution.oninput = () => {
    gridValue.value = resolution.value + "×";
    window.clearTimeout(pendingGrid);
    pendingGrid = window.setTimeout(update, 150);
  };
  framing.onchange = sceneSelect.onchange = update;
  generate.onclick = () => {
    seed = crypto.getRandomValues(new Uint32Array(1))[0];
    update();
  };
  document.querySelector<HTMLButtonElement>("#save")!.onclick = () => {
    if (surface.grid.value !== Number(resolution.value) * 2) update();
    const variant = `-${framing.value}-${resolution.value}x-p${designs.pine + 1}-b${designs.broadleaf + 1}-c${designs.cottage + 1}`;
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
  let idleTimer = 0;
  function wakeControls() {
    document.body.classList.remove("idle");
    clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => document.body.classList.add("idle"), 3200);
  }
  for (const event of ["pointermove", "pointerdown", "keydown", "focusin", "input", "change", "wheel"]) {
    document.addEventListener(event, wakeControls, { passive: true });
  }
  wakeControls();
  new ResizeObserver(preview).observe(canvas);
}
