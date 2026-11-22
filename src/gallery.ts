import { contactRays } from "./contact-rays";
import { lightScene } from "./lighting";
import * as THREE from "three";
import { buildCottage } from "./cottage";
import { defaultDesigns, designNames, type Family } from "./designs";
import { palette } from "./palette";
import { treeStudy } from "./trees";
import { voxelBatch } from "./voxels";

export function designGallery(designs: typeof defaultDesigns, apply: () => void) {
  const panel = document.querySelector<HTMLDetailsElement>("#design-gallery")!;
  const selector = document.querySelector<HTMLSelectElement>("#family")!;
  const studies = document.querySelector<HTMLElement>("#studies")!;
  let renderer: THREE.WebGLRenderer | undefined;
  const images = new Map<Family, string[]>();

  function thumbnails(family: Family) {
    const existing = images.get(family);
    if (existing) return existing;
    renderer ??= new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(288, 216);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(palette.light.backdrop);
    lightScene(scene);
    const camera = new THREE.OrthographicCamera(-3.8, 3.8, 2.85, -2.85, 0.1, 100);
    camera.position.set(4, 4.7, 9);
    camera.lookAt(0, 1.85, 0);
    const previews = designNames[family].map((_, index) => {
      const { box, buildMesh } = voxelBatch();
      if (family === "cottage") buildCottage(box, index);
      else {
        treeStudy(box, family, index);
      }
      box(0, -0.125, 0, 5.25, 0.25, 3, palette.green.grass);
      const mesh = buildMesh();
      const disposeRays = contactRays(mesh);
      scene.add(mesh);
      renderer!.render(scene, camera);
      const url = renderer!.domElement.toDataURL();
      scene.remove(mesh);
      disposeRays();
      mesh.dispose(); mesh.geometry.dispose(); mesh.material.dispose();
      return url;
    });
    images.set(family, previews);
    return previews;
  }

  function show() {
    if (!panel.open) return;
    const family = selector.value as Family;
    const previews = thumbnails(family);
    studies.replaceChildren(...designNames[family].map((name, index) => {
      const button = document.createElement("button");
      const img = new Image();
      img.src = previews[index];
      img.alt = "";
      button.append(img, (index + 1) + ". " + name);
      button.setAttribute("aria-pressed", String(designs[family] === index));
      button.onclick = () => {
        designs[family] = index;
        for (const child of studies.children) child.setAttribute("aria-pressed", String(child === button));
        apply();
      };
      return button;
    }));
  }
  panel.ontoggle = show;
  selector.onchange = show;
}
