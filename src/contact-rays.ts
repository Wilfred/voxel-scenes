import * as THREE from "three";

export function rayUniforms() {
  return {
    occupancy: { value: null as THREE.Data3DTexture | null },
    volumeOrigin: { value: new THREE.Vector3() },
    cellSize: { value: 1 },
    rayColors: { value: null as THREE.DataTexture | null },
    tracingEnabled: { value: false },
  };
}

export const voxelTrace = `
      uniform highp sampler3D occupancy;
      uniform vec3 volumeOrigin;
      uniform float cellSize;
      float traceVoxel(vec3 start, vec3 dir, float reach, out float distanceHit, out vec3 face) {
        vec3 pos = (start - volumeOrigin) / cellSize;
        ivec3 tile = ivec3(floor(pos)), size = textureSize(occupancy, 0);
        ivec3 stepDir = ivec3(sign(dir));
        vec3 delta = 1.0 / max(abs(dir), vec3(0.00001));
        vec3 edge = mix(fract(pos), 1.0-fract(pos), step(vec3(0.0), dir)) * delta;
        float t = 0.0; distanceHit = reach; face = -dir;
        for (int i = 0; i < 80; i++) {
          if (any(lessThan(tile,ivec3(0))) || any(greaterThanEqual(tile,size)) || t*cellSize > reach) break;
          float id = texelFetch(occupancy,tile,0).r;
          if (id > 0.0) { distanceHit = t*cellSize; return id; }
          if (edge.x <= edge.y && edge.x <= edge.z) { t=edge.x; edge.x+=delta.x; tile.x+=stepDir.x; face=vec3(-stepDir.x,0,0); }
          else if (edge.y <= edge.z) { t=edge.y; edge.y+=delta.y; tile.y+=stepDir.y; face=vec3(0,-stepDir.y,0); }
          else { t=edge.z; edge.z+=delta.z; tile.z+=stepDir.z; face=vec3(0,0,-stepDir.z); }
        }
        return 0.0;
      }
`;

// Use a bounded occupancy volume shared by all instance batches. Thin details
// smaller than a cell keep their ordinary raster lighting.
export function contactRays(
  mesh: THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshLambertMaterial>,
  grid?: number,
  uniforms = rayUniforms(),
) {
  const bounds = grid === undefined ? new THREE.Box3().setFromObject(mesh) : undefined;
  const extent = bounds?.getSize(new THREE.Vector3());
  const cell = extent ? Math.max(1 / 32, extent.length() / 48) : Math.max(0.25, grid! / 4);
  const width = extent ? Math.ceil(extent.x / cell) + 4 : 256;
  const height = extent ? Math.ceil(extent.y / cell) + 4 : Math.ceil(36 / cell);
  const depth = extent ? Math.ceil(extent.z / cell) + 4 : width;
  const origin = bounds ? bounds.min.clone().addScalar(-2 * cell)
    : new THREE.Vector3((-width * cell) / 2, -5, (-depth * cell) / 2);
  const mask = new Uint8Array(width * height * depth);
  const swatches = new Uint8Array(256 * 4);
  const colorIds = new Map<number, number>();
  const tint = new THREE.Color();
  const matrix = new THREE.Matrix4();
  mesh.traverse((part) => {
    if (!(part instanceof THREE.InstancedMesh)) return;
    for (let i = 0; i < part.count; i++) {
      part.getMatrixAt(i, matrix);
      const m = matrix.elements;
      const rx = (Math.abs(m[0]) + Math.abs(m[8])) / 2,
        rz = (Math.abs(m[2]) + Math.abs(m[10])) / 2;
      const x = (m[12] - origin.x) / cell,
        y = (m[13] - origin.y) / cell,
        z = (m[14] - origin.z) / cell;
      const left = Math.max(0, Math.ceil(x - rx / cell - 0.5)),
        right = Math.min(width, Math.ceil(x + rx / cell - 0.5));
      if (left >= right) continue;
      const top = Math.min(height, Math.ceil(y + Math.abs(m[5]) / (2 * cell) - 0.5));
      const back = Math.max(0, Math.ceil(z - rz / cell - 0.5)),
        front = Math.min(depth, Math.ceil(z + rz / cell - 0.5));
      part.getColorAt(i, tint);
      const rgb = tint.getHex();
      let id = colorIds.get(rgb);
      if (id === undefined) {
        id = colorIds.size + 1;
        colorIds.set(rgb, id);
        swatches.set([rgb >> 16, (rgb >> 8) & 255, rgb & 255, 255], id * 4);
      }
      for (let row = Math.max(0, Math.ceil(y - Math.abs(m[5]) / (2 * cell) - 0.5)); row < top; row++) {
        for (let slice = back; slice < front; slice++) {
          const offset = width * (row + height * slice);
          mask.fill(id, offset + left, offset + right);
        }
      }
    }
  });
  const volume = new THREE.Data3DTexture(mask, width, height, depth);
  volume.format = THREE.RedFormat;
  volume.needsUpdate = true;
  const colors = new THREE.DataTexture(swatches, 256, 1);
  colors.colorSpace = THREE.SRGBColorSpace;
  colors.needsUpdate = true;
  uniforms.occupancy.value = volume;
  uniforms.volumeOrigin.value.copy(origin);
  uniforms.cellSize.value = cell;
  uniforms.rayColors.value = colors;
  uniforms.tracingEnabled.value = true;
  const material = mesh.material;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    const varyings = "varying vec3 rayPos; varying vec3 rayNormal;\n";
    shader.vertexShader =
      varyings +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        `
      #include <begin_vertex>
      rayPos = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
      rayNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);`,
      );
    shader.fragmentShader =
      varyings + voxelTrace +
      `
      uniform bool tracingEnabled;
      float visibility(vec3 start, vec3 dir) {
        if (!tracingEnabled) return 1.0;
        float travel; vec3 face;
        traceVoxel(start, dir, 3.5, travel, face);
        return smoothstep(0.0, 3.5, travel);
      }
    ` +
      shader.fragmentShader.replace(
        "#include <lights_fragment_end>",
        `
      #include <lights_fragment_end>
      vec3 n = normalize(rayNormal);
      vec3 u = normalize(cross(n, abs(n.y)<0.8 ? vec3(0,1,0) : vec3(1,0,0)));
      vec3 v = cross(n,u);
      vec3 start = rayPos + n * (0.52 * cellSize);
      float open = visibility(start, normalize(n+1.3*u+0.4*v)) + visibility(start, normalize(n-1.3*u-0.4*v))
                 + visibility(start, normalize(n+1.3*v-0.4*u)) + visibility(start, normalize(n-1.3*v+0.4*u));
      reflectedLight.indirectDiffuse *= mix(0.38, 1.0, open*0.25);`,
      );
  };
  material.customProgramCacheKey = () => "voxel-contact-rays";
  material.needsUpdate = true;
  return () => {
    material.onBeforeCompile = THREE.Material.prototype.onBeforeCompile;
    material.customProgramCacheKey = THREE.Material.prototype.customProgramCacheKey;
    material.needsUpdate = true;
    uniforms.tracingEnabled.value = false;
    uniforms.occupancy.value = uniforms.rayColors.value = null;
    colors.dispose();
    volume.dispose();
  };
}
