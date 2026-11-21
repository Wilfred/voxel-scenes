import * as THREE from "three";

const canvas = document.querySelector("canvas")!;
const context = canvas.getContext("webgl2", { antialias: true });

if (context) {
  const renderer = new THREE.WebGLRenderer({ canvas, context });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe8e7db);

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x78936a }),
  );
  scene.add(cube);

  const sun = new THREE.DirectionalLight(0xfff1d7, 2);
  sun.position.set(3, 6, 2);
  scene.add(sun, new THREE.HemisphereLight(0xffffff, 0x7b806e, 1.4));

  const camera = new THREE.OrthographicCamera();
  camera.position.set(3, 2.5, 4);
  camera.lookAt(cube.position);

  function render() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;

    const aspect = width / height;
    camera.top = 2 / Math.min(1, aspect);
    camera.bottom = -camera.top;
    camera.right = camera.top * aspect;
    camera.left = -camera.right;
    camera.updateProjectionMatrix();

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    renderer.render(scene, camera);
  }

  new ResizeObserver(render).observe(canvas);
} else {
  const message = document.createElement("p");
  message.textContent = "This preview requires WebGL 2. Check that hardware acceleration is enabled in your browser.";
  canvas.replaceWith(message);
}
