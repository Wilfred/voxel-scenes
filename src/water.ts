import { rayUniforms, voxelTrace } from "./contact-rays";
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
  const rays = rayUniforms();
  const surface = {
    depth: { value: null as THREE.Texture | null },
    deep: { value: new THREE.Color() },
    sky: { value: new THREE.Color() },
    sun: { value: new THREE.Vector3() },
    eye: { value: new THREE.Vector3() },
    horizon: { value: new THREE.Color(palette.light.horizon) },
    zenith: { value: new THREE.Color(palette.light.zenith) },
    ripple: { value: 1 },
    rain: { value: 0 },
    grid: { value: 1 },
    phase: { value: 0 },
  };
  const material = new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, rays, {
      horizonTint: surface.horizon,
      zenithTint: surface.zenith, ripple: surface.ripple, rain: surface.rain,
      glintTint: { value: new THREE.Color(palette.light.sunGlint) },
      seabed: surface.depth, deepWater: surface.deep, skyTint: surface.sky,
      gridScale: surface.grid, sunlight: surface.sun, viewDirection: surface.eye, wavePhase: surface.phase,
    });
    shader.vertexShader = 'varying vec3 waterPoint, waterNormal;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nwaterPoint = (modelMatrix * vec4(position, 1.0)).xyz; waterNormal = normalize(mat3(modelMatrix) * normal);',
    );
    shader.fragmentShader = voxelTrace + `
      uniform sampler2D rayColors;
      uniform bool tracingEnabled;
      varying vec3 waterPoint, waterNormal;
      uniform sampler2D seabed;
      uniform vec3 horizonTint, zenithTint, glintTint;
      uniform vec3 deepWater, skyTint, sunlight, viewDirection;
      uniform float wavePhase, gridScale, ripple, rain;
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
      vec2 waveOctave(vec2 pos, vec2 frequency, vec2 footprint) {
        vec2 cycles = footprint * frequency;
        return waveSlope(pos, frequency) * (1.0 - smoothstep(0.15, 0.4, max(cycles.x, cycles.y)));
      }
    ` + shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec2 p = waterPoint.xz;
      float depthFraction = texture2D(seabed, p / (64.0 * gridScale) + 0.5).r;
      vec2 wind = vec2(0.92, 0.392);
      vec2 across = vec2(-wind.y, wind.x);
      vec2 uv = vec2(dot(p, wind), dot(p, across)) + wavePhase;
      // Fade each octave before its wavelength approaches two pixels.
      vec2 footprint = fwidth(uv);
      vec2 slope = 0.16 * waveOctave(uv, vec2(0.35, 0.6), footprint)
                 + 0.049 * waveOctave(uv + 12.1, vec2(1.1, 2.0), footprint)
                 + 0.014 * waveOctave(uv - 7.2, vec2(3.7, 8.8), footprint);
      vec2 tilt = (slope.x * wind + slope.y * across) * mix(0.10, 0.30, depthFraction);
      if (rain > 0.0) {
        vec2 rainCell = p * 0.65;
        float age = hashWave(floor(rainCell) + wavePhase);
        vec2 offset = fract(rainCell) - 0.5;
        float ring = length(offset) - 0.34 * age;
        tilt += 0.035 * normalize(offset + 0.00001) * sin(ring * 95.0) *
          exp(-ring * ring * 620.0) * (1.0 - age);
      }
      vec3 n = faceforward(normalize(waterNormal), -viewDirection, normalize(waterNormal));
      vec3 waveNormal = normalize(n + vec3(tilt.x, 0.0, tilt.y) * ripple);
      diffuseColor.rgb = deepWater;
    `).replace('#include <opaque_fragment>', `
      vec3 reflected = reflect(-viewDirection, waveNormal);
      float facing = clamp(dot(viewDirection, waveNormal), 0.0, 1.0);
      float fresnel = 0.035 + 0.965 * pow(1.0 - facing, 4.0);
      vec3 skyLight = mix(mix(skyTint, horizonTint, 0.65), zenithTint, smoothstep(0.05, 0.70, reflected.y));
      float sparkle = pow(max(dot(reflected, sunlight), 0.0), 90.0);
      if (tracingEnabled) {
        float travel; vec3 face;
        float reach = min(36.0, 54.0 * cellSize);
        float id = traceVoxel(waterPoint + n * (0.51 * cellSize), reflected, reach, travel, face);
        if (id > 0.0) {
          vec3 tint = texelFetch(rayColors, ivec2(int(round(id * 255.0)), 0), 0).rgb;
          vec3 bankLight = tint * (0.64 + 0.50 * max(dot(face, sunlight), 0.0));
          skyLight = mix(bankLight, skyLight, smoothstep(reach * 0.65, reach, travel));
          sparkle *= smoothstep(reach * 0.65, reach, travel);
        }
      }
      float pathLength = 6.0 * depthFraction / max(facing, 0.22);
      float body = abs(n.y) < 0.5 ? 0.43 : 1.0 - exp(-0.30 * pathLength);
      diffuseColor.a = fresnel + (1.0 - fresnel) * body;
      outgoingLight = (outgoingLight * body * (1.0 - fresnel) + skyLight * fresnel + glintTint * sparkle)
                    / max(diffuseColor.a, 0.001);
      #include <opaque_fragment>
    `);
  };
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), material);
  sea.rotation.x = -Math.PI / 2;
  sea.receiveShadow = true;
  return { sea, surface, rays };
}
