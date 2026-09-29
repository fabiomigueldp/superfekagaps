/** A short hit stop, squash, then one continuous ballistic arc in native pixels. */
export function playerDeathMotion(elapsedMs: number): {
  x: number; y: number; pose: 'deathImpact' | 'deathCrouch' | 'deathRise' | 'deathFall'; alpha: number;
} {
  const t = Math.max(0, elapsedMs);
  const flight = Math.max(0, t - 150);
  return {
    x: Math.round(Math.min(7, flight * 0.006)),
    y: t < 150 ? Math.round(Math.max(0, t - 70) * 3 / 80)
      : Math.round(3 - 0.17 * flight + 0.000234 * flight * flight),
    pose: t < 70 ? 'deathImpact' : t < 150 ? 'deathCrouch'
      : t < 700 ? 'deathRise' : 'deathFall',
    alpha: Math.max(0, Math.min(1, (1280 - t) / 120))
  };
}
