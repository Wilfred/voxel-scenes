import * as THREE from "three";
import { seededRandom } from "./voxels";
import type { weather } from "./weather";

// Bake one distant sky for the vista and the reflected rays on the water.
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
      fragmentShader: `uniform vec3 horizon, zenith, glow, sun; varying vec3 direction;
      void main(){
        vec3 d=normalize(direction);
        vec3 color=mix(horizon,zenith,smoothstep(0.0,0.5,d.y));
        float facing=max(dot(d,sun),0.0);
        color=mix(color,glow,0.35*pow(facing,9.0)*smoothstep(-0.01,0.02,d.y));
        color=mix(color,glow,0.92*smoothstep(0.99980,0.99995,facing));
        gl_FragColor=vec4(color,1.0);
      }`,
    }),
  );
  const sun = new THREE.DirectionalLight();
  const fill = new THREE.HemisphereLight();
  scene.add(dome, sun, fill);
  const target = new THREE.WebGLCubeRenderTarget(512, {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
  });
  const camera = new THREE.CubeCamera(0.1, 230, target);
  const clouds = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshLambertMaterial(), 24 * 4);
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
  return { texture: target.texture, update, drift };
}
