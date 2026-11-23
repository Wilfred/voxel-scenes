import * as THREE from "three";
import { seededRandom } from "./voxels";
import type { weather } from "./weather";

const skyShader = `
  uniform vec3 horizon, zenith, glow, sun;
  vec3 skyColor(vec3 d) {
    vec3 color=mix(horizon,zenith,smoothstep(0.0,0.5,d.y));
    float facing=max(dot(d,sun),0.0);
    color=mix(color,glow,0.35*pow(facing,9.0)*smoothstep(-0.01,0.02,d.y));
    color=mix(color,glow,0.92*smoothstep(0.99980,0.99995,facing));
    return color;
  }
`;

// Draw the vista sky at screen resolution and bake its reflection for the water.
// Translation and zoom never bring the cloud layer down into the landscape.
export function createSky(renderer: THREE.WebGLRenderer) {
  const scene = new THREE.Scene();
  const uniforms = {
    horizon: { value: new THREE.Color() },
    zenith: { value: new THREE.Color() },
    sun: { value: new THREE.Vector3() },
    glow: { value: new THREE.Color() },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(190, 32, 16),
    new THREE.ShaderMaterial({
      uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: `varying vec3 direction;
      void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:
        skyShader +
        `
      varying vec3 direction;
      void main(){
        gl_FragColor=vec4(skyColor(normalize(direction)),1.0);
        #include <colorspace_fragment>
      }`,
    }),
  );
  const sun = new THREE.DirectionalLight();
  const fill = new THREE.HemisphereLight();
  scene.add(dome, sun, fill);
  const target = new THREE.WebGLCubeRenderTarget(1024, {
    generateMipmaps: true,
    magFilter: THREE.NearestFilter,
    minFilter: THREE.LinearMipmapLinearFilter,
  });
  const camera = new THREE.CubeCamera(0.1, 230, target);
  // Blend the visible cloud face with its sky ray once. Opaque depth testing
  // hides the tiers behind that face, so their opacity never accumulates.
  const cloudMaterial = new THREE.MeshLambertMaterial();
  cloudMaterial.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader =
      "varying vec3 skyDirection;\n" +
      shader.vertexShader.replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nskyDirection = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;",
      );
    shader.fragmentShader =
      skyShader +
      "varying vec3 skyDirection;\n" +
      shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        "outgoingLight = mix(skyColor(normalize(skyDirection)), outgoingLight, 0.56);\n#include <opaque_fragment>",
      );
  };
  const clouds = new THREE.InstancedMesh(new THREE.BoxGeometry(), cloudMaterial, 24 * 4);
  const matrix = new THREE.Matrix4();
  scene.add(clouds);
  let previous = "";
  let lastCloudFrame = -1;
  // The distant layer moves less than a pixel between cube map updates.
  function drift(seconds: number) {
    const frame = Math.floor(seconds);
    if (frame === lastCloudFrame) return false;
    lastCloudFrame = frame;
    clouds.rotation.y = frame * 0.00009;
    camera.update(renderer, scene);
    return true;
  }
  function update(seed: number, preset: (typeof weather)[keyof typeof weather], horizon: number) {
    const key = [seed, preset.sky, horizon].join(",");
    if (key === previous) return;
    previous = key;
    const random = seededRandom(seed ^ 0x1e597c);
    uniforms.horizon.value.setHex(horizon);
    uniforms.zenith.value.setHex(preset.zenith);
    uniforms.glow.value.setHex(preset.sunlight);
    uniforms.sun.value.set(...(preset.position as [number, number, number])).normalize();
    sun.position.copy(uniforms.sun.value);
    sun.color.setHex(preset.sunlight);
    sun.intensity = 0.38 * preset.sun;
    fill.color.setHex(preset.horizon);
    fill.groundColor.setHex(preset.cloudShade);
    fill.intensity = 1.7;
    let count = 0;
    for (let i = 0; i < 24; i++) {
      const angle = ((i + random() * 0.6) * Math.PI) / 12;
      const radius = i % 2 ? 110 : 83;
      const x = Math.round(Math.cos(angle) * radius),
        z = Math.round(Math.sin(angle) * radius);
      const base = 2 + Math.floor(random() * 3) + (i % 2) * 2;
      const width = 7 + Math.floor(random() * 9),
        depth = 5 + Math.floor(random() * 7);
      const show = random() < preset.cloudCover;
      for (let tier = 0; tier < 4; tier++) {
        const offsetX = Math.floor(random() * 6) - 2,
          offsetZ = Math.floor(random() * 4) - 1;
        if (!show) continue;
        const w = width + (tier === 0 ? 4 : -tier),
          d = depth + 2 - tier;
        matrix.makeScale(w, 1, d).setPosition(x + tier * 2 + offsetX + w / 2, base + tier + 0.5, z + offsetZ + d / 2);
        clouds.setMatrixAt(count++, matrix);
      }
    }
    clouds.count = count;
    clouds.instanceMatrix.needsUpdate = true;
    clouds.computeBoundingSphere();
    lastCloudFrame = -1;
    drift(0);
  }
  const skyCamera = new THREE.PerspectiveCamera();
  skyCamera.far = 230;
  function renderVista(view: THREE.PerspectiveCamera) {
    skyCamera.quaternion.copy(view.quaternion);
    skyCamera.fov = view.fov;
    skyCamera.aspect = view.aspect;
    skyCamera.zoom = view.zoom;
    skyCamera.updateProjectionMatrix();
    renderer.render(scene, skyCamera);
  }
  return { texture: target.texture, update, drift, renderVista };
}
