import * as THREE from "three";

const voxelTrace = `
      uniform highp sampler3D occupancy;
      uniform vec3 volumeOrigin;
      uniform float cellSize;
      float voxelHitDistance(vec3 start, vec3 dir, float reach) {
        vec3 pos = (start - volumeOrigin) / cellSize;
        ivec3 tile = ivec3(floor(pos)), size = textureSize(occupancy, 0);
        ivec3 stepDir = ivec3(sign(dir));
        vec3 delta = 1.0 / max(abs(dir), vec3(0.00001));
        vec3 edge = mix(fract(pos), 1.0-fract(pos), step(vec3(0.0), dir)) * delta;
        float t = 0.0;
        for (int i = 0; i < 80; i++) {
          if (any(lessThan(tile,ivec3(0))) || any(greaterThanEqual(tile,size)) || t*cellSize > reach) break;
          if (texelFetch(occupancy,tile,0).r > 0.0) return t*cellSize;
          if (edge.x <= edge.y && edge.x <= edge.z) { t=edge.x; edge.x+=delta.x; tile.x+=stepDir.x; }
          else if (edge.y <= edge.z) { t=edge.y; edge.y+=delta.y; tile.y+=stepDir.y; }
          else { t=edge.z; edge.z+=delta.z; tile.z+=stepDir.z; }
        }
        return reach;
      }
`;

// Cover every instance batch with one occupancy volume. Landscapes keep a
// cell no finer than a quarter of their grid scale, coarsening further when
// the landscape would exceed the largest volume the GPU accepts. Thin details
// smaller than a cell keep their ordinary raster lighting.
export function contactRays(
  mesh: THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshLambertMaterial>,
  grid?: number,
  maxCells = 256,
) {
  const bounds = new THREE.Box3().setFromObject(mesh);
  const extent = bounds.getSize(new THREE.Vector3());
  const cell =
    grid === undefined
      ? Math.max(1 / 32, extent.length() / 48)
      : Math.max(0.25, grid / 4, (Math.max(extent.x, extent.y, extent.z) + 4) / (maxCells - 4));
  const width = Math.ceil(extent.x / cell) + 4;
  const height = Math.ceil(extent.y / cell) + 4;
  const depth = Math.ceil(extent.z / cell) + 4;
  const origin = bounds.min.clone().addScalar(-2 * cell);
  const mask = new Uint8Array(width * height * depth);
  const matrix = new THREE.Matrix4();
  mesh.traverse(part => {
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
      for (let row = Math.max(0, Math.ceil(y - Math.abs(m[5]) / (2 * cell) - 0.5)); row < top; row++) {
        for (let slice = back; slice < front; slice++) {
          const offset = width * (row + height * slice);
          mask.fill(255, offset + left, offset + right);
        }
      }
    }
  });
  const volume = new THREE.Data3DTexture(mask, width, height, depth);
  volume.format = THREE.RedFormat;
  volume.needsUpdate = true;
  const uniforms = {
    occupancy: { value: volume },
    volumeOrigin: { value: origin },
    cellSize: { value: cell },
  };
  const material = mesh.material;
  material.onBeforeCompile = shader => {
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
      varyings +
      voxelTrace +
      `
      float visibility(vec3 start, vec3 dir) {
        return smoothstep(0.0, 3.5, voxelHitDistance(start, dir, 3.5));
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
    volume.dispose();
  };
}
