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
