import type { Rect } from '../types';

export const FLAG_SIZES = {
  checkpoint: { width: 14, height: 28 },
  goal: { width: 18, height: 34 }
} as const;

/** Pole, base and waving flag extent around the ground-contact anchor, in pixels. */
export function flagVisualRect(kind: keyof typeof FLAG_SIZES, x: number, y: number): Rect {
  const { width, height } = FLAG_SIZES[kind];
  return { x: x - 5, y: y - height - 1, width: width + 7, height: height + 1 };
}
