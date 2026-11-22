import { palette } from "./palette";
import * as THREE from "three";

// Water samples the terrain on a grid-scaled square centred at the origin.
export function riverDepthMap(depthAt: (x: number, z: number) => number, grid = 1) {
  const size = Math.max(128, Math.ceil(64 * grid));
  const samples = new Uint8Array(size * size);
  for (let i = 0; i < samples.length; i++) {
    const x = Math.floor(((i % size + 0.5) * 64 / size - 32) * grid + 0.5);
    const z = Math.floor(((Math.floor(i / size) + 0.5) * 64 / size - 32) * grid + 0.5);
    samples[i] = Math.round(255 * THREE.MathUtils.clamp(depthAt(x, z) / 6, 0, 1));
  }
  const depth = new THREE.DataTexture(samples, size, size, THREE.RedFormat);
  depth.magFilter = depth.minFilter = THREE.LinearFilter;
  depth.needsUpdate = true;
  return depth;
}

// Retain Three's lighting and island shadows underneath the reflected sky.
export function createWater() {
  const surface = {
    depth: { value: null as THREE.Texture | null },
    deep: { value: new THREE.Color() },
    sky: { value: new THREE.Color() },
    sun: { value: new THREE.Vector3() },
    eye: { value: new THREE.Vector3() },
    grid: { value: 1 },
    phase: { value: 0 },
  };
  const material = new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, {
      horizonTint: { value: new THREE.Color(palette.light.horizon) },
      zenithTint: { value: new THREE.Color(palette.light.zenith) },
      glintTint: { value: new THREE.Color(palette.light.sunGlint) },
      seabed: surface.depth, deepWater: surface.deep, skyTint: surface.sky,
      gridScale: surface.grid, sunlight: surface.sun, viewDirection: surface.eye, wavePhase: surface.phase,
    });
    shader.vertexShader = 'varying vec2 oceanXZ;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\noceanXZ = (modelMatrix * vec4(position, 1.0)).xz;',
    );
    shader.fragmentShader = `
      varying vec2 oceanXZ;
      uniform sampler2D seabed;
      uniform vec3 horizonTint, zenithTint, glintTint;
      uniform vec3 deepWater, skyTint, sunlight, viewDirection;
      uniform float wavePhase, gridScale;
      float hashWave(vec2 cell) {
        vec3 q = fract(vec3(cell.xyx) * 0.1031);
        q += dot(q, q.yzx + 33.33);
        return fract((q.x + q.y) * q.z);
      }
      // Analytic slope of smooth noise, stretched along the wind direction.
      vec2 waveSlope(vec2 pos, vec2 frequency) {
        vec2 q = pos * frequency;
        vec2 cell = floor(q);
        vec2 f = fract(q);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = hashWave(cell);
        float b = hashWave(cell + vec2(1, 0));
        float c = hashWave(cell + vec2(0, 1));
        float d = hashWave(cell + 1.0);
        return frequency * 6.0 * f * (1.0 - f) *
          vec2(mix(b - a, d - c, u.y), mix(c - a, d - b, u.x));
      }
    ` + shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec2 p = oceanXZ;
      float depthFraction = texture2D(seabed, p / (64.0 * gridScale) + 0.5).r;
      vec2 wind = vec2(0.92, 0.392);
      vec2 across = vec2(-wind.y, wind.x);
      vec2 uv = vec2(dot(p, wind), dot(p, across)) + wavePhase;
      vec2 slope = 0.16 * waveSlope(uv, vec2(0.55, 1.3))
                 + 0.049 * waveSlope(uv + 12.1, vec2(1.4, 3.8))
                 + 0.014 * waveSlope(uv - 7.2, vec2(3.7, 8.8));
      vec2 tilt = (slope.x * wind + slope.y * across) * mix(0.20, 0.58, depthFraction);
      vec3 waveNormal = normalize(vec3(tilt.x, 1.0, tilt.y));
      diffuseColor.rgb = deepWater;
    `).replace('#include <opaque_fragment>', `
      vec3 reflected = reflect(-viewDirection, waveNormal);
      float facing = clamp(dot(viewDirection, waveNormal), 0.0, 1.0);
      float fresnel = 0.035 + 0.965 * pow(1.0 - facing, 4.0);
      vec3 skyLight = mix(mix(skyTint, horizonTint, 0.65), zenithTint, smoothstep(0.05, 0.70, reflected.y));
      float sparkle = pow(max(dot(reflected, sunlight), 0.0), 90.0);
      outgoingLight = mix(outgoingLight, skyLight, fresnel) + glintTint * sparkle;
      float pathLength = 6.0 * depthFraction / max(facing, 0.22);
      float transmission = exp(-0.30 * pathLength) * (1.0 - fresnel);
      diffuseColor.a = 1.0 - transmission;
      #include <opaque_fragment>
    `);
  };
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), material);
  sea.rotation.x = -Math.PI / 2;
  sea.receiveShadow = true;
  return { sea, surface };
}
