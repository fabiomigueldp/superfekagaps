"""Bounded, disjoint visible-mask crops; no fixed source-camera rectangles.

The four IDs are atlas bookkeeping, not navigation or saved-world identities.
A pixel belongs to exactly one source rectangle. Crops are packed without rotation
because the runtime copies them directly into source-image coordinates.
"""
from itertools import permutations
import numpy as np

REGION_IDS = ('reservoir', 'descent', 'paddies', 'cross-paddy')

def bounds(points):
    low, high = points.min(axis=0), points.max(axis=0) + 1
    return tuple(int(n) for n in (*low, *high))

def area(box):
    x0, y0, x1, y1 = box
    return (x1 - x0) * (y1 - y0)

def split_visible_mask(mask, count=4):
    """Greedily minimize transparent crop area using axis-aligned mask cuts."""
    yy, xx = np.nonzero(np.asarray(mask))
    if not len(xx):
        raise ValueError('Visible-water mask is empty')
    groups = [np.column_stack((xx, yy))]
    while len(groups) < count:
        choices = []
        for index, points in enumerate(groups):
            original = area(bounds(points))
            for axis in (0, 1):
                values = np.unique(points[:, axis])
                # Every occupied coordinate is considered; no old-camera boundaries.
                for cut in values[1:]:
                    left = points[points[:, axis] < cut]
                    right = points[points[:, axis] >= cut]
                    score = area(bounds(left)) + area(bounds(right))
                    choices.append((score - original, axis, int(cut), index))
        if not choices:
            raise ValueError('Too few visible pixels for the requested crop count')
        _, axis, cut, index = min(choices)
        points = groups.pop(index)
        groups.extend((points[points[:, axis] < cut], points[points[:, axis] >= cut]))
    # Stable top-to-bottom ordering; these labels do not choose runtime behavior.
    return sorted((bounds(p) for p in groups), key=lambda b: (b[1], b[0]))

def pack_regions(boxes):
    """Exhaustive four-rectangle shelf packing, with original pixel orientation."""
    sizes = [(b[2] - b[0], b[3] - b[1]) for b in boxes]
    best = None
    for order in permutations(range(len(boxes))):
        for breaks in range(1 << (len(boxes) - 1)):
            x = y = row_height = width = 0
            positions = {}
            for i, index in enumerate(order):
                if i and breaks & (1 << (i - 1)):
                    y += row_height; x = row_height = 0
                w, h = sizes[index]
                positions[index] = [x, y]
                x += w; row_height = max(row_height, h); width = max(width, x)
            height = y + row_height
            key = (width * height, max(width, height), width, tuple(order), breaks)
            if best is None or key < best[0]:
                best = (key, [width, height], positions)
    _, size, positions = best
    regions = [{'id': REGION_IDS[i], 'bounds': [b[0], b[1], *sizes[i]], 'atlas': positions[i]} for i, b in enumerate(boxes)]
    return regions, size
