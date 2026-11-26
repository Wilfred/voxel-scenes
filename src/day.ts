// Hash the civil date rather than an elapsed interval spanning time-zone or DST changes.
export function dailySeed(date: Date) {
  const key = [date.getFullYear(), date.getMonth() + 1, date.getDate()].join("-");
  let hash = 2166136261;
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function orchardSeason(date: Date) {
  const month = date.getMonth();
  if (month === 3 || month === 4) return "blossom";
  if (month === 11) return "wreath";
  return "harvest";
}

export const daylight = [
  { key: "sunrise", label: "Sunrise", before: 8 },
  { key: "morning", label: "Morning", before: 11 },
  { key: "midday", label: "Midday", before: 15 },
  { key: "evening", label: "Evening", before: 18 },
  { key: "sunset", label: "Sunset", before: 24 },
] as const;

export function daylightIndex(light: string | null, hour: number) {
  const index = daylight.findIndex(stop => (light === "auto" ? hour < stop.before : light === stop.key));
  return index >= 0 ? index : daylight.findIndex(stop => stop.key === "midday");
}
