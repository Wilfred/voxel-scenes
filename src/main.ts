import { dailySeed, orchardSeason } from "./day";
import { weather } from "./weather";
import { contactRays } from "./contact-rays";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { lightScene } from "./lighting";
import { palette } from "./palette";
import * as THREE from "three";
import { createWater } from "./water";
import { createSmoke } from "./smoke";
import { createShower } from "./rain";
import { createSky } from "./sky";
import { disposeLandscape, scenes, type Landscape } from "./scenes";

const canvas = document.querySelector("canvas")!;
const status = document.querySelector<HTMLElement>("#status")!;
const toolbox = document.querySelector<HTMLElement>(".toolbox")!;
const context = canvas.getContext("webgl2", { antialias: true });

// The vista camera stands back from its focus in proportion to the scene's
// model frame and the grid, so a larger grid shows more land at the same
// apparent size. It looks down at this pitch through a narrow lens.
const vistaDistance = 3.1;
const vistaPitch = THREE.MathUtils.degToRad(13);
const vistaFov = 36;

if (!context) {
  canvas.hidden = true;
  canvas.style.display = "none";
  document.querySelector<HTMLElement>(".scene-controls")!.hidden = true;
  toolbox.hidden = true;
  toolbox.style.display = "none";
  status.textContent = "This preview requires WebGL 2. Check that hardware acceleration is enabled in your browser.";
} else {
  const renderer = new THREE.WebGLRenderer({ canvas, context });
  const volumeLimit = Math.min(512, context.getParameter(context.MAX_3D_TEXTURE_SIZE));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const target = new THREE.Vector3();
  // A rectangular model reads as a miniature in parallel projection. A vista
  // needs perspective so the land can recede into haze under an open sky.
  const modelCamera = new THREE.OrthographicCamera();
  const vistaCamera = new THREE.PerspectiveCamera(vistaFov, 16 / 9);
  let camera: THREE.OrthographicCamera | THREE.PerspectiveCamera = vistaCamera;
  const sky = createSky(renderer);
  const { sea, surface, rays } = createWater(sky.texture);
  const rain = createShower();
  const smoke = createSmoke();
  scene.add(sea, rain.drops, smoke.plume);

  const sun = lightScene(scene);
  const skyLight = scene.children.find(light => light instanceof THREE.HemisphereLight)!;
  const weatherSelect = document.querySelector<HTMLSelectElement>("#weather")!;
  let clearRays: (() => void) | undefined;
  sun.castShadow = true;
  sun.shadow.normalBias = 0.035;
  const today = new Date();
  let seed = dailySeed(today);
  const sceneSelect = document.querySelector<HTMLSelectElement>("#scene")!;
  const resolution = document.querySelector<HTMLInputElement>("#resolution")!;
  const gridValue = document.querySelector<HTMLOutputElement>("#grid-value")!;
  const framing = document.querySelector<HTMLSelectElement>("#framing")!;
  const generate = document.querySelector<HTMLButtonElement>("#generate")!;
  let landscape: Landscape | undefined;
  const home = new THREE.Spherical(0);
  const orbit = new OrbitControls<THREE.Camera>(camera, canvas);
  orbit.enableZoom = orbit.enablePan = false;
  let started = 0;
  let frame = 0;
  let cameraMoved = false;
  function draw(now: number) {
    frame = 0;
    const elapsed = Math.max(0, now - started) / 1000;
    const coastal = sceneSelect.value === "island";
    surface.drift.value = coastal ? elapsed * 0.65 : 0;
    if (smoke.plume.visible) smoke.update(elapsed);
    const cloudsMoved = sky.drift(elapsed);
    if (cloudsMoved || coastal || smoke.plume.visible || cameraMoved) renderer.render(scene, camera);
    cameraMoved = false;
    frame = requestAnimationFrame(draw);
  }
  orbit.addEventListener("change", () => {
    cameraMoved = true;
    surface.eye.value.copy(camera.position).sub(orbit.target).normalize();
    if (!frame) frame = requestAnimationFrame(draw);
  });
  const zoomLevels = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 2.5, 3];
  const defaultZoom = zoomLevels.indexOf(1);
  let zoomIndex = defaultZoom;
  const zoomIn = document.querySelector<HTMLButtonElement>("#zoom-in")!;
  const zoomOut = document.querySelector<HTMLButtonElement>("#zoom-out")!;
  const zoomValue = document.querySelector<HTMLOutputElement>("#zoom-value")!;
  function setZoom(index: number) {
    zoomIndex = index;
    camera.zoom = zoomLevels[index];
    camera.updateProjectionMatrix();
    zoomValue.value = Math.round(camera.zoom * 100) + "%";
    zoomIn.disabled = index === zoomLevels.length - 1;
    zoomOut.disabled = index === 0;
    preview();
  }
  zoomIn.onclick = () => setZoom(zoomIndex + 1);
  zoomOut.onclick = () => setZoom(zoomIndex - 1);
  function resetView() {
    orbit.reset();
    setZoom(defaultZoom);
  }
  document.querySelector<HTMLButtonElement>("#reset-camera")!.onclick = resetView;
  canvas.addEventListener(
    "wheel",
    event => {
      if (event.ctrlKey || event.deltaY === 0) return;
      event.preventDefault();
      const next = zoomIndex - Math.sign(event.deltaY);
      if (next >= 0 && next < zoomLevels.length) setZoom(next);
    },
    { passive: false },
  );
  canvas.ondblclick = resetView;
  canvas.onkeydown = event => {
    switch (event.key) {
      case "ArrowLeft":
        orbit.rotateLeft(0.12);
        break;
      case "ArrowRight":
        orbit.rotateLeft(-0.12);
        break;
      case "ArrowUp":
        orbit.rotateUp(0.08);
        break;
      case "ArrowDown":
        orbit.rotateUp(-0.08);
        break;
      case "Home":
        resetView();
        break;
      default:
        return;
    }
    event.preventDefault();
    orbit.update();
  };
  function preview() {
    const width = Math.max(1, Math.round(canvas.clientWidth * Math.min(devicePixelRatio, 2)));
    renderer.setSize(width, Math.round((width * 9) / 16), false);
    renderer.render(scene, camera);
  }
  function distance() {
    return vistaDistance * (landscape?.modelHeight ?? 13) * surface.grid.value;
  }
  function applyWeather() {
    const preset = weather[weatherSelect.value as keyof typeof weather];
    const coastal = sceneSelect.value === "island";
    const horizon = coastal && weatherSelect.value === "clear" ? palette.light.coastalSky : preset.sky;
    const grid = surface.grid.value;
    const model = camera === modelCamera;
    sky.update(seed, preset, horizon);
    scene.background = model ? new THREE.Color(palette.light.backdrop) : sky.texture;
    rain.drops.visible = weatherSelect.value === "clearing";
    // Keep the focus crisp and let the haze close in on the far terrain.
    const reach = distance();
    scene.fog = model
      ? new THREE.FogExp2(horizon, preset.haze / grid)
      : new THREE.Fog(horizon, reach * 0.9, reach * (1 + 0.006 / preset.haze));
    sun.color.setHex(preset.sunlight);
    sun.intensity = preset.sun;
    skyLight.intensity = preset.ambient;
    skyLight.color.setHex(weatherSelect.value === "clear" ? palette.light.skyLight : preset.horizon);
    const light = new THREE.Vector3(...preset.position);
    sun.position.copy(light).multiplyScalar(grid).add(target);
    sun.target.position.copy(target);
    sun.target.updateMatrixWorld();
    surface.sun.value.copy(light).normalize();
    surface.ripple.value = preset.ripple;
    surface.rain.value = weatherSelect.value === "clearing" ? 1 : 0;
    fitShadow(light.length() * grid);
    renderer.shadowMap.needsUpdate = true;
  }
  // Cover the land the camera sees clearly, at about ten shadow texels per
  // metre-sized crown block where the GPU allows.
  function fitShadow(sunDistance: number) {
    const grid = surface.grid.value;
    const radius = camera === modelCamera ? 28 * grid : 0.9 * distance();
    const size = THREE.MathUtils.clamp(
      THREE.MathUtils.ceilPowerOfTwo((2 * radius) / 0.1),
      2048,
      Math.min(4096, renderer.capabilities.maxTextureSize),
    );
    if (sun.shadow.mapSize.x !== size) {
      sun.shadow.mapSize.set(size, size);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    Object.assign(sun.shadow.camera, {
      left: -radius,
      right: radius,
      top: radius,
      bottom: -radius,
      far: sunDistance + 2 * radius,
    });
    sun.shadow.camera.updateProjectionMatrix();
  }
  function update() {
    window.clearTimeout(pendingGrid);
    clearRays?.();
    clearRays = undefined;
    if (landscape) disposeLandscape(landscape, sea.material);

    const grid = Number(resolution.value) * 2;
    gridValue.value = resolution.value + "×";
    const model = framing.value === "model";
    const entry = scenes[sceneSelect.value];
    // Keep any orbit the viewer made relative to the opening angle.
    const yaw = home.radius > 0 ? orbit.getAzimuthalAngle() - home.theta : 0;
    const tilt = home.radius > 0 ? orbit.getPolarAngle() - home.phi : 0;
    landscape = entry.build({ seed, model, grid, season: orchardSeason(today), water: sea.material });
    scene.add(landscape.mesh, ...landscape.extras);
    started = performance.now();
    surface.coastal.value = sceneSelect.value === "island";
    surface.drift.value = 0;
    smoke.plume.visible = !!landscape.chimney;
    if (landscape.chimney) {
      smoke.plume.position.copy(landscape.chimney);
      smoke.update(0);
    }
    if (!frame) frame = requestAnimationFrame(draw);
    sea.visible = landscape.sea;
    sea.position.set(0, 0, 0);
    sea.scale.set(grid, grid, 1);
    const bounds = landscape.waterBounds;
    if (model && bounds) {
      sea.position.set(bounds.x, 0.002, bounds.z);
      sea.scale.set(bounds.width / sea.geometry.parameters.width, bounds.depth / sea.geometry.parameters.height, 1);
    }

    camera = model ? modelCamera : vistaCamera;
    orbit.object = camera;

    const facade = landscape.facade;
    // Orbit the front and both front corners while keeping the door joined to its path.
    orbit.minAzimuthAngle = landscape.frontOnly ? facade - Math.PI * 0.38 : -Infinity;
    orbit.maxAzimuthAngle = landscape.frontOnly ? facade + Math.PI * 0.38 : Infinity;
    const offset = new THREE.Vector3(16, model ? (landscape.modelRise ?? 30) : 0, 40).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      facade,
    );
    if (model) {
      target.copy(landscape.modelTarget);
      orbit.minPolarAngle = 0.3;
      orbit.maxPolarAngle = 1.02;
      const top = landscape.modelHeight * grid;
      Object.assign(modelCamera, {
        top,
        bottom: -top,
        right: (top * 16) / 9,
        left: (-top * 16) / 9,
        near: 0.1,
        far: 350 * grid,
      });
      offset.multiplyScalar(grid);
    } else {
      const distance = vistaDistance * landscape.modelHeight * grid;
      const azimuth = Math.atan2(offset.x, offset.z);
      offset.setFromSphericalCoords(distance, Math.PI / 2 - vistaPitch, azimuth);
      orbit.minPolarAngle = Math.PI / 2 - THREE.MathUtils.degToRad(34);
      orbit.maxPolarAngle = Math.PI / 2 - THREE.MathUtils.degToRad(12);
      target.copy(landscape.focus);
      if (landscape.thirds) {
        // Set the focus on a third, facing into the larger part of the frame.
        const right = new THREE.Vector3(Math.cos(azimuth), 0, -Math.sin(azimuth));
        const facing = new THREE.Vector3(Math.sin(facade), 0, Math.cos(facade)).dot(right);
        const halfWidth = (distance * Math.tan(THREE.MathUtils.degToRad(vistaFov / 2)) * 16) / 9;
        target.addScaledVector(right, ((facing < 0 ? -1 : 1) * halfWidth) / 3);
      }
      vistaCamera.near = 0.5;
      vistaCamera.far = distance * 8;
    }
    home.setFromVector3(offset);
    orbit.target.copy(target);
    camera.position.copy(offset).add(target);
    orbit.update();
    orbit.saveState();
    camera.position.setFromSpherical(new THREE.Spherical(home.radius, home.phi + tilt, home.theta + yaw)).add(target);
    orbit.update();
    camera.zoom = zoomLevels[zoomIndex];
    camera.updateProjectionMatrix();
    surface.eye.value.copy(camera.position).sub(target).normalize();

    surface.grid.value = grid;
    surface.depth.value = landscape.depth.texture;
    surface.depthExtent.value = landscape.depth.extent;
    surface.deep.value.setHex(landscape.deepWater);
    rain.place(seed, grid, model, landscape.modelTarget, landscape.waterBounds);
    applyWeather();
    clearRays = contactRays(landscape.mesh, grid, rays, volumeLimit);
    surface.phase.value = (seed % 997) / 53;
    canvas.setAttribute("aria-label", entry.description);
    generate.textContent = "New " + entry.name.toLowerCase();
    document.querySelector("#seed")!.textContent = entry.name + " " + seed;
    preview();
  }

  let pendingGrid = 0;
  resolution.oninput = () => {
    gridValue.value = resolution.value + "×";
    window.clearTimeout(pendingGrid);
    pendingGrid = window.setTimeout(update, 150);
  };
  framing.onchange = sceneSelect.onchange = update;
  weatherSelect.onchange = () => {
    applyWeather();
    preview();
  };
  generate.onclick = () => {
    seed = crypto.getRandomValues(new Uint32Array(1))[0];
    update();
  };
  document.querySelector<HTMLButtonElement>("#save")!.onclick = () => {
    if (surface.grid.value !== Number(resolution.value) * 2) update();
    const variant = `-${framing.value}-${resolution.value}x-${weatherSelect.value}`;
    const zoomSuffix = camera.zoom === 1 ? "" : `-zoom${Math.round(camera.zoom * 100)}`;
    const filename = `${sceneSelect.value}-${seed}${variant}${zoomSuffix}.png`;
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
  // Reproduce a shared composition from ?scene=, &framing=, &weather= and &seed=.
  const params = new URLSearchParams(location.search);
  for (const [select, key] of [
    [sceneSelect, "scene"],
    [framing, "framing"],
    [weatherSelect, "weather"],
  ] as const) {
    const value = params.get(key);
    if (value && [...select.options].some(option => option.value === value)) select.value = value;
  }
  if (params.get("scene") === "mountains") sceneSelect.value = "hillside";
  const requestedSeed = Number(params.get("seed") ?? NaN);
  if (Number.isInteger(requestedSeed) && requestedSeed >= 0) seed = requestedSeed >>> 0;
  update();
  // The overlays fade after a few idle seconds and return on movement.
  // Closing them keeps them away for a minute while the viewer turns the
  // scene, unless keyboard focus moves into the controls.
  const quietPeriod = 60_000;
  const overlays = [document.querySelector("header")!, toolbox];
  let idleTimer = 0;
  let quietUntil = 0;
  function wakeControls(event?: Event) {
    const intoControls = event?.type === "focusin" && overlays.some(o => o.contains(event.target as Node));
    if (intoControls) quietUntil = 0;
    else if (performance.now() < quietUntil) return;
    document.body.classList.remove("idle");
    clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => document.body.classList.add("idle"), 3200);
  }
  document.querySelector<HTMLButtonElement>("#hide-controls")!.onclick = () => {
    quietUntil = performance.now() + quietPeriod;
    clearTimeout(idleTimer);
    document.body.classList.add("idle");
    canvas.focus();
  };
  document.addEventListener("keydown", event => {
    if (event.code !== "Space" || event.defaultPrevented || performance.now() >= quietUntil) return;
    event.preventDefault();
    quietUntil = 0;
    wakeControls();
  });
  for (const event of ["pointermove", "pointerdown", "keydown", "focusin", "input", "change", "wheel"]) {
    document.addEventListener(event, wakeControls, { passive: true });
  }
  wakeControls();
  new ResizeObserver(preview).observe(canvas);
}
