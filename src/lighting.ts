import type { daylight } from "./day";
import * as THREE from "three";
import { palette } from "./palette";

export function lightScene(scene: THREE.Scene) {
  const sun = new THREE.DirectionalLight(palette.light.sun, 2.4);
  sun.position.set(-26, 21, 18);
  const sky = new THREE.HemisphereLight(palette.light.skyLight, palette.light.groundLight, 1.2);
  scene.add(sun, sun.target, sky);
  return sun;
}

export type LightingPreset = {
  position: [number, number, number];
  sunlight: number;
  sun: number;
  ambient: number;
  sky: number;
  horizon: number;
  zenith: number;
  ripple: number;
  haze: number;
  cloudCover: number;
  cloudShade: number;
};

type Daylight = (typeof daylight)[number]["key"];

export const lightingPresets = {
  midday: {
    cloudCover: 0.48,
    cloudShade: 0xb9c9ce,
    position: [-26, 21, 18],
    sunlight: palette.light.sun,
    sun: 2.4,
    ambient: 1.2,
    sky: palette.light.clearSky,
    horizon: palette.light.horizon,
    zenith: palette.light.zenith,
    ripple: 1,
    haze: 0.005,
  },
  morning: {
    cloudCover: 0.52,
    cloudShade: 0xc1b8af,
    position: [-30, 14, 10],
    sunlight: 0xffddb1,
    sun: 2.3,
    ambient: 1.1,
    sky: 0xf1d1b2,
    horizon: 0xffdcbb,
    zenith: 0x9cbbd1,
    ripple: 0.65,
    haze: 0.0055,
  },
  sunrise: {
    position: [-25, 3, -34],
    sunlight: 0xffd2a1,
    sun: 1.75,
    ambient: 1.62,
    sky: 0xf1c2ac,
    horizon: 0xffdec8,
    zenith: 0x93a6c5,
    ripple: 0.55,
    haze: 0.0058,
    cloudCover: 0.64,
    cloudShade: 0xbda4b6,
  },
  evening: {
    position: [30, 14, -2],
    sunlight: 0xffdbac,
    sun: 2.1,
    ambient: 1.35,
    sky: 0xe6c7ac,
    horizon: 0xf2d6ba,
    zenith: 0x91a9bc,
    ripple: 0.75,
    haze: 0.005,
    cloudCover: 0.48,
    cloudShade: 0xb0a6ac,
  },
  sunset: {
    position: [19, 3, -35],
    sunlight: 0xffbc82,
    sun: 1.78,
    ambient: 1.55,
    sky: 0xeeb195,
    horizon: 0xf4c2a5,
    zenith: 0x898cad,
    ripple: 0.68,
    haze: 0.0058,
    cloudCover: 0.68,
    cloudShade: 0xb295aa,
  },
} satisfies Record<Daylight, LightingPreset>;
