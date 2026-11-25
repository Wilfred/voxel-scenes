import type { daylight } from "./day";
import { palette } from "./palette";

export type WeatherPreset = {
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

export const weather = {
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
  overcast: {
    cloudCover: 0.98,
    cloudShade: 0x92a0a9,
    position: [-18, 29, 15],
    sunlight: 0xe6eced,
    sun: 0.62,
    ambient: 2.55,
    sky: 0xd4dcdb,
    horizon: 0xd6dedd,
    zenith: 0xb3c3c9,
    ripple: 0.8,
    haze: 0.006,
  },
  clearing: {
    cloudCover: 0.82,
    cloudShade: 0x81929e,
    position: [20, 25, 15],
    sunlight: 0xffe5c0,
    sun: 2.2,
    ambient: 1.15,
    sky: 0xb8cbd1,
    horizon: 0xe6dcc5,
    zenith: 0x879fae,
    ripple: 1.65,
    haze: 0.0065,
  },
} satisfies Record<Daylight | "overcast" | "clearing", WeatherPreset>;

export function weatherAt(light: Daylight, condition: string): WeatherPreset {
  const daylight = weather[light];
  if (condition !== "overcast" && condition !== "clearing") return daylight;

  const preset = weather[condition];
  const noon = weather.midday;
  return {
    ...preset,
    position: [
      preset.position[0] + daylight.position[0] - noon.position[0],
      preset.position[1] + daylight.position[1] - noon.position[1],
      preset.position[2] + daylight.position[2] - noon.position[2],
    ],
    sun: preset.sun * (daylight.sun / noon.sun),
    ambient: preset.ambient * (daylight.ambient / noon.ambient),
  };
}
