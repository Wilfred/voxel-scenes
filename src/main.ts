import { palette } from "./palette";
import * as THREE from "three";
import { buildMountains } from "./mountains";
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
  const skyRotation = -2.16;
  // Direction of the sun in the sky-only panorama, before azimuth rotation.
  const azimuth = 0.627 - skyRotation;
  const elevation = 0.836;
  const alpineSun = new THREE.Vector3(
    Math.cos(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.sin(azimuth) * Math.cos(elevation),
  );
  const skyUrl = new URL("./assets/kloofendal-sky.jpg", import.meta.url);
  const alpineSky = new THREE.TextureLoader().load(skyUrl.href, () => preview());
  alpineSky.mapping = THREE.EquirectangularReflectionMapping;
  alpineSky.colorSpace = THREE.SRGBColorSpace;
  const alpineCamera = new THREE.PerspectiveCamera(44, 16 / 9, 0.1, 12000);
  alpineCamera.position.set(25, 29, 43);
  alpineCamera.lookAt(-3, 13, -16);
  const cameraTarget = new THREE.Vector3(0, 2, 0);
  const camera = new THREE.OrthographicCamera(-24, 24, 14, -14, 0.1, 350);
  const { sea, surface } = createWater();
  scene.add(sea);

  const sun = new THREE.DirectionalLight(palette.light.sun, 2.25);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 24, bottom: -24, far: 100 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.normalBias = 0.035;
  const skylight = new THREE.HemisphereLight(palette.light.skyLight, palette.light.groundLight, 1.55);
  scene.add(sun, sun.target, skylight);

  let seed = 1846;
  const sceneSelect = document.querySelector<HTMLSelectElement>("#scene")!;
  const framing = document.querySelector<HTMLSelectElement>("#framing")!;
  const ducks = document.querySelector<HTMLInputElement>("#ducks")!;
  const generate = document.querySelector<HTMLButtonElement>("#generate")!;
  const islandDescription = canvas.getAttribute("aria-label")!;
  let island: ReturnType<typeof buildIsland> | undefined;
  let woodlandDepth: THREE.Texture | undefined;
  let mesh: ReturnType<typeof buildMountains>["mesh"] | undefined;
  let activeCamera: THREE.Camera = camera;
  function preview() {
    const width = Math.max(1, Math.round(canvas.clientWidth * Math.min(devicePixelRatio, 2)));
    renderer.setSize(width, Math.round(width * 9 / 16), false);
    renderer.render(scene, activeCamera);
  }
  function update() {
    woodlandDepth?.dispose();
    woodlandDepth = undefined;
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

    const mountain = sceneSelect.value === "mountains";
    const woodland = sceneSelect.value === "woods";
    ducks.parentElement!.hidden = !woodland;
    const model = framing.value === "model";
    activeCamera = mountain && !model ? alpineCamera : camera;
    if (model) camera.position.set(26, 32, 42).multiplyScalar(mountain ? 2.5 : 1);
    sea.position.set(0, 0, 0);
    sea.scale.setScalar(1);
    sea.visible = !mountain;
    sun.color.setHex(woodland ? palette.light.forestSun : palette.light.sun);
    skylight.color.setHex(woodland ? palette.light.forestLight : palette.light.skyLight);
    scene.backgroundRotation.y = mountain ? skyRotation : 0;
    renderer.toneMapping = mountain && !model ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    const extent = mountain ? 52 : 28;
    Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: mountain ? 52 : 24,
      bottom: mountain ? -52 : -24, far: mountain ? 180 : 100 });
    sun.shadow.camera.updateProjectionMatrix();
    if (mountain) {
      const mountainScene = buildMountains(seed, model);
      mesh = mountainScene.mesh;
      if (model) {
        cameraTarget.set(-10.5, 10, -18.5);
        camera.position.add(cameraTarget);
        camera.top = 52;
        scene.background = new THREE.Color(palette.light.backdrop);
      } else {
        // Fit the landmarks in normalized screen coordinates, then shift the
        // frame to put the cabin on the lower-left third at every export size.
        alpineCamera.clearViewOffset();
        alpineCamera.zoom = 1;
        alpineCamera.updateProjectionMatrix();
        alpineCamera.updateMatrixWorld();
        const cabin = mountainScene.cabin.project(alpineCamera);
        const peak = mountainScene.peak.project(alpineCamera);
        const zoom = Math.min(1.15, 1.00 / (peak.y - cabin.y), (peak.x >= cabin.x ? 1.12 : 0.54) / Math.abs(peak.x - cabin.x));
        alpineCamera.zoom = zoom;
        alpineCamera.setViewOffset(16, 9, 8 * (zoom * cabin.x + 1 / 3),
          -4.5 * (zoom * cabin.y + 1 / 3), 16, 9);
        scene.background = alpineSky;
      }
      scene.fog = null;
      sun.target.position.set(-6, 10, -15);
      sun.position.copy(sun.target.position).addScaledVector(alpineSun, 95);
    } else {
      const p = woodland ? { sea: palette.water.river, sky: palette.light.forestSky, sun: [-26, 21, 18], eye: [16, 32, 40], span: 38 } : { sea: palette.water.sea, sky: palette.light.coastalSky, sun: [-35, 16, 14], eye: [8, 29, 43], span: 25 };
      cameraTarget.set(0, 2, 0);
      if (!model) camera.position.fromArray(p.eye);
      let waterBounds = bayBounds;
      if (woodland) {
        const woods = buildWoods(seed, model, ducks.checked);
        // Keep the crossing left of centre with the lit approach in view.
        cameraTarget.copy(woods.bridge).add(new THREE.Vector3(4, 1, 2));
        if (model) {
          waterBounds = woods.bounds;
          cameraTarget.set(waterBounds.x, 2, waterBounds.z);
        }
        camera.position.add(new THREE.Vector3(cameraTarget.x, cameraTarget.y - 2, cameraTarget.z));
        mesh = woods.mesh;
        woodlandDepth = woods.depth;
        surface.depth.value = woods.depth;
      } else {
        island = buildIsland(seed, model);
        if (model) {
          cameraTarget.y = -2;
          camera.position.y -= 4;
        }
        mesh = island.mesh;
        scene.add(island.floor);
        surface.depth.value = island.depth;
      }
      if (model) {
        sea.position.set(waterBounds.x, 0.002, waterBounds.z);
        sea.scale.set(waterBounds.width / sea.geometry.parameters.width, waterBounds.depth / sea.geometry.parameters.height, 1);
      }
      surface.deep.value.setHex(p.sea);
      surface.sky.value.setHex(p.sky);
      surface.sun.value.fromArray(p.sun).normalize();
      surface.eye.value.copy(camera.position).sub(cameraTarget).normalize();
      surface.phase.value = (seed % 997) / 53;
      scene.background = new THREE.Color(model ? palette.light.backdrop : p.sky);
      scene.fog = new THREE.FogExp2(p.sky, 0.005);
      sun.target.position.set(0, 0, 0);
      sun.position.fromArray(p.sun);
      camera.top = model ? (woodland ? 23 : 28) : p.span / 2;
    }
    scene.add(mesh);
    canvas.setAttribute("aria-label", mountain ? "A cabin on the wooded shoulder of a snowcapped mountain under a clouded sky" : woodland ? "A stream winding through woodland with a timber footbridge" : islandDescription);
    generate.textContent = mountain ? "New mountains" : woodland ? "New woods" : "New island";
    camera.lookAt(cameraTarget);
    camera.bottom = -camera.top;
    camera.right = camera.top * 16 / 9;
    camera.left = -camera.right;
    camera.updateProjectionMatrix();
    document.querySelector("#seed")!.textContent = (mountain ? "Mountains " : woodland ? "Woods " : "Island ") + seed;
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
    renderer.render(scene, activeCamera);
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
  if (new URLSearchParams(location.search).get("scene") === "woods") sceneSelect.value = "woods";
  update();
  new ResizeObserver(preview).observe(canvas);
}
