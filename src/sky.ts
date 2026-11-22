import * as THREE from "three";

// A gradient dome drawn at infinite depth around the camera. Below the
// horizon it matches the fog, so distant terrain dissolves into the haze.
export function createSky() {
  const uniforms = {
    horizon: { value: new THREE.Color() },
    zenith: { value: new THREE.Color() },
    sun: { value: new THREE.Vector3(0, 1, 0) },
    glow: { value: new THREE.Color() },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    depthWrite: false,
    side: THREE.BackSide,
    vertexShader: `
      varying vec3 direction;
      void main() {
        direction = position;
        vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
        gl_Position = clip.xyww;
      }`,
    fragmentShader: `
      uniform vec3 horizon, zenith, glow, sun;
      varying vec3 direction;
      void main() {
        vec3 d = normalize(direction);
        vec3 color = mix(horizon, zenith, smoothstep(0.0, 0.45, d.y));
        // A broad warm bloom on the sun's side of the sky.
        color = mix(color, glow, 0.35 * pow(max(dot(d, sun), 0.0), 6.0) * (1.0 - smoothstep(0.0, 0.6, d.y)));
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), material);
  dome.frustumCulled = false;
  dome.renderOrder = -1;
  return { dome, uniforms };
}
