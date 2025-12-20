#!/usr/bin/env python3
"""
Clean a green-screen sprite sheet and output a transparent PNG.

- Detects green background by chroma key thresholds
  and keeps only the regions connected to the image edges.
- Applies a small green "despill" on edge pixels to reduce halos.
"""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


def build_green_mask(rgb: np.ndarray, g_min: int, delta: int, ratio: float) -> np.ndarray:
    r = rgb[..., 0].astype(np.int16)
    g = rgb[..., 1].astype(np.int16)
    b = rgb[..., 2].astype(np.int16)
    max_rb = np.maximum(r, b)
    return (g >= g_min) & ((g - max_rb) >= delta) & (g >= (max_rb * ratio))


def flood_fill_from_edges(mask: np.ndarray) -> np.ndarray:
    h, w = mask.shape
    bg = np.zeros_like(mask, dtype=bool)
    q: deque[tuple[int, int]] = deque()

    def push(y: int, x: int) -> None:
        if 0 <= y < h and 0 <= x < w and mask[y, x] and not bg[y, x]:
            bg[y, x] = True
            q.append((y, x))

    for x in range(w):
        push(0, x)
        push(h - 1, x)
    for y in range(h):
        push(y, 0)
        push(y, w - 1)

    while q:
        y, x = q.popleft()
        push(y - 1, x)
        push(y + 1, x)
        push(y, x - 1)
        push(y, x + 1)

    return bg


def despill_edges(rgba: np.ndarray, background: np.ndarray) -> None:
    r = rgba[..., 0].astype(np.int16)
    g = rgba[..., 1].astype(np.int16)
    b = rgba[..., 2].astype(np.int16)

    neighbor_bg = (
        np.roll(background, 1, axis=0)
        | np.roll(background, -1, axis=0)
        | np.roll(background, 1, axis=1)
        | np.roll(background, -1, axis=1)
    )
    edge = (~background) & neighbor_bg

    max_rb = np.maximum(r, b)
    spill = edge & (g > max_rb)
    rgba[..., 1][spill] = max_rb[spill].astype(np.uint8)


def main() -> int:
    parser = argparse.ArgumentParser(description="Remove green background from a sprite sheet.")
    parser.add_argument(
        "input",
        nargs="?",
        default="public/assets/sprites/feka.png",
        help="Path to the input PNG.",
    )
    parser.add_argument(
        "-o",
        "--output",
        default="public/assets/sprites/feka_clean.png",
        help="Path to write the cleaned PNG.",
    )
    parser.add_argument("--g-min", type=int, default=None, help="Minimum green channel to key out.")
    parser.add_argument("--delta", type=int, default=None, help="Minimum (G - max(R,B)) to key out.")
    parser.add_argument(
        "--ratio",
        type=float,
        default=None,
        help="Minimum G / max(R,B) ratio to key out.",
    )
    parser.add_argument(
        "--mode",
        choices=("all-green", "background"),
        default="all-green",
        help="Remove all green pixels or only background connected to edges.",
    )
    parser.add_argument(
        "--no-despill",
        action="store_true",
        help="Disable green spill suppression on edge pixels.",
    )
    args = parser.parse_args()

    in_path = Path(args.input)
    out_path = Path(args.output)

    img = Image.open(in_path).convert("RGBA")
    rgba = np.array(img)
    rgb = rgba[..., :3]

    if args.mode == "all-green":
        g_min = 1 if args.g_min is None else args.g_min
        delta = 0 if args.delta is None else args.delta
        ratio = 1.0 if args.ratio is None else args.ratio
        background = build_green_mask(rgb, g_min, delta, ratio)
    else:
        g_min = 120 if args.g_min is None else args.g_min
        delta = 40 if args.delta is None else args.delta
        ratio = 1.25 if args.ratio is None else args.ratio
        key_mask = build_green_mask(rgb, g_min, delta, ratio)
        background = flood_fill_from_edges(key_mask)

    rgba[..., 3][background] = 0
    if not args.no_despill:
        despill_edges(rgba, background)

    Image.fromarray(rgba, mode="RGBA").save(out_path)

    total = rgba.shape[0] * rgba.shape[1]
    removed = int(background.sum())
    print(f"Input:  {in_path}")
    print(f"Output: {out_path}")
    print(f"Removed background pixels: {removed} / {total} ({removed / total:.2%})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
