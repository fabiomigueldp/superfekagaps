export type DeathPose = 'deathImpact' | 'deathRecoil' | 'deathCrouch' | 'deathLaunch' | 'deathRise' | 'deathApex' | 'deathFall';

export const DEATH_HIT_STOP_MS = 65;
export const DEATH_BLACK_HOLD_MS = 200;

/** Subpixel motion is sampled from simulation time; only the atlas rounds to the pixel grid. */
export function playerDeathMotion(elapsedMs: number, grounded = true, direction = 1): {
  x: number; y: number; pose: DeathPose; alpha: number;
} {
  const t = Math.max(0, elapsedMs);
  const launch = grounded ? 130 : 70;
  const flight = Math.max(0, t - launch);
  const apex = launch + .22 / (.00037 * 2);
  let pose: DeathPose = 'deathImpact';
  if (t >= DEATH_HIT_STOP_MS) pose = 'deathRecoil';
  if (grounded && t >= 95) pose = 'deathCrouch';
  if (t >= launch) pose = 'deathLaunch';
  if (t >= launch + 70) pose = 'deathRise';
  if (t >= apex - 45) pose = 'deathApex';
  if (t >= apex + 100) pose = 'deathFall';
  return {
    x: direction * 18 * (1 - Math.exp(-flight / 500)),
    y: -.22 * flight + .00037 * flight * flight,
    pose,
    alpha: t < 1300 ? 1 : 0
  };
}

/** Leave a short, fully black beat before changing the camera and rebuilding the checkpoint. */
export function deathIrisProgress(elapsedMs: number, kind: 'hit' | 'fall', duration: number): number {
  const start = kind === 'fall' ? 300 : 920;
  return Math.max(0, Math.min(1, (elapsedMs - start) / (duration - DEATH_BLACK_HOLD_MS - start)));
}
