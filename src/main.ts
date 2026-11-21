import * as THREE from "three";
import { buildIsland, styles, type Style } from "./island";

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
  const camera = new THREE.OrthographicCamera(-24, 24, 14, -14, 0.1, 350);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial());
  sea.rotation.x = -Math.PI / 2;
  sea.receiveShadow = true;
  scene.add(sea);

  const sun = new THREE.DirectionalLight(0xffeed5, 2.25);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 24, bottom: -24, far: 100 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.normalBias = 0.035;
  scene.add(sun, new THREE.HemisphereLight(0xfff7e9, 0xadb9bb, 1.55));

  let seed = 1846;
  let style: Style = "graphic";
  let island: ReturnType<typeof buildIsland>;
  function preview() {
    const width = Math.max(1, Math.round(canvas.clientWidth * Math.min(devicePixelRatio, 2)));
    renderer.setSize(width, Math.round(width * 9 / 16), false);
    renderer.render(scene, camera);
  }
  function update() {
    if (island) {
      scene.remove(island);
      island.dispose();
      island.geometry.dispose();
      island.material.dispose();
    }
    island = buildIsland(seed, style);
    scene.add(island);
    const p = styles[style];
    sea.material.color.setHex(p.sea);
    scene.background = new THREE.Color(p.sky);
    scene.fog = style === "vista" ? null : new THREE.FogExp2(p.sky, 0.005);
    sun.position.fromArray(p.sun);
    camera.position.fromArray(p.eye);
    camera.lookAt(0, 2, 0);
    camera.top = p.span / 2;
    camera.bottom = -camera.top;
    camera.right = camera.top * 16 / 9;
    camera.left = -camera.right;
    camera.updateProjectionMatrix();
    document.querySelector("#seed")!.textContent = "Island " + seed;
    preview();
  }

  const select = document.querySelector<HTMLSelectElement>("#style")!;
  select.onchange = () => { style = select.value as Style; update(); };
  document.querySelector<HTMLButtonElement>("#generate")!.onclick = () => {
    seed = crypto.getRandomValues(new Uint32Array(1))[0];
    update();
  };
  document.querySelector<HTMLButtonElement>("#save")!.onclick = () => {
    const filename = `island-${seed}-${style}.png`;
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
  update();
  new ResizeObserver(preview).observe(canvas);
}
