import * as THREE from "three";

// Look at the cloud tiers along the sunlight direction. One depth comparison
// covers the whole silhouette, including where several tiers overlap.
export function cloudShadows(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  const size = 512;
  const depth = new THREE.DepthTexture(size, size);
  depth.compareFunction = THREE.LessEqualCompare;
  depth.minFilter = depth.magFilter = THREE.LinearFilter;
  const target = new THREE.WebGLRenderTarget(size, size, { depthTexture: depth });
  const camera = new THREE.OrthographicCamera(-150, 150, 150, -150, 1, 420);
  camera.layers.set(1);
  const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });
  const projection = new THREE.Matrix4();
  const worldToSky = new THREE.Matrix4();

  function update(sun: THREE.Vector3, grid: number) {
    camera.position.copy(sun).multiplyScalar(210);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    // Anchor the distant sky above the terrain, independently of the orbit.
    worldToSky.makeScale(3 / grid, 3 / grid, 3 / grid).setPosition(0, -54, 0);
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(worldToSky);
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    scene.overrideMaterial = depthOnly;
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    renderer.setRenderTarget(previous);
  }

  function receive(material: THREE.Material) {
    const compile = material.onBeforeCompile;
    const key = material.customProgramCacheKey();
    material.customProgramCacheKey = () => key + "-cloud-shadows";
    material.onBeforeCompile = (shader, renderer) => {
      compile.call(material, shader, renderer);
      shader.uniforms.cloudDepth = { value: depth };
      shader.uniforms.cloudProjection = { value: projection };
      const varying = "varying vec3 cloudCoord;\n";
      shader.vertexShader =
        varying +
        "uniform mat4 cloudProjection;\n" +
        shader.vertexShader.replace(
          "#include <project_vertex>",
          `#include <project_vertex>
        vec4 cloudReceiver = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          cloudReceiver = instanceMatrix * cloudReceiver;
        #endif
        cloudCoord = (cloudProjection * modelMatrix * cloudReceiver).xyz * 0.5 + 0.5;`,
        );
      shader.fragmentShader =
        varying +
        "uniform highp sampler2DShadow cloudDepth;\n" +
        shader.fragmentShader.replace(
          "#include <lights_fragment_end>",
          `#include <lights_fragment_end>
        float cloudSun = 1.0;
        if (all(greaterThan(cloudCoord, vec3(0.0))) && all(lessThan(cloudCoord, vec3(1.0)))) {
          cloudSun = mix(0.44, 1.0, texture(cloudDepth, cloudCoord));
        }
        reflectedLight.directDiffuse *= cloudSun;`,
        );
    };
    material.needsUpdate = true;
  }
  return { update, receive };
}
