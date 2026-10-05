"""Laid sandstone facing for the existing Casa da Vazão civic terrace.

Executed by build_guaira.py with its authored helpers in scope. The existing
nine-sided clay support, navigation meshes, water, camera and lights stay exact.
Each block follows the source terrace profile; this is a facing, not a new
platform, landmark or route. Its top stops below the unchanged walking surface.
"""
from random import Random

_terrace_rng = Random(61005)
_terrace = bpy.data.objects['Civic terrace']
_terrace_center = Vector((.6, 3.1, 0))
_terrace_ring = [Vector(v.co) for v in _terrace.data.vertices[:9]]
_terrace_stones = [
    mat('Civic retaining warm sandstone', 'B5A184'),
    mat('Civic retaining sun sandstone', 'C3AD8A'),
    mat('Civic retaining iron sandstone', 'AA9578'),
]


def _terrace_profile(point, z):
    # Exact radial scales and heights from the original rock() support.
    scale = 1 + .04 * (z - 1.5) / .36 if z <= 1.86 else 1.04 - .14 * (z - 1.86) / .54
    return Vector((.6 + (point.x - .6) * scale,
                   3.1 + (point.y - 3.1) * scale, z))


def _terrace_mesh(name, vertices, faces, material):
    # The earlier Bairro module intentionally uses its own naming wrapper.
    # Keep this pass independent of helper overrides in that shared namespace.
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    data.materials.append(material)
    edge = ob.modifiers.new('Soft crafted edge', 'BEVEL')
    edge.width = .013
    edge.segments = 2
    ob.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return ob


for _edge in range(9):
    _a, _b = _terrace_ring[_edge], _terrace_ring[(_edge + 1) % 9]
    _direction = _b - _a
    _direction.z = 0
    _length = _direction.length
    _tangent = _direction.normalized()
    _normal = Vector((_tangent.y, -_tangent.x, 0))
    # Front and side retaining faces only. Rear clay remains natural and the
    # existing approach ramp must never acquire a raised border or obstacle.
    if ((_a + _b) / 2).y > 3.3 or _edge == 8:
        continue
    for _row, (_bottom, _top) in enumerate([(1.755, 1.947), (1.964, 2.152), (2.169, 2.365)]):
        _count = max(2, round(_length / .48))
        _cuts = [0.0, 1.0]
        _cuts += [max(.06, min(.94, (i + (.43 if _row % 2 else 0)) / _count))
                  for i in range(1, _count)]
        _cuts.sort()
        for _bay, (_start, _end) in enumerate(zip(_cuts, _cuts[1:])):
            _start += .009 / _length
            _end -= .009 / _length
            _left, _right = _a.lerp(_b, _start), _a.lerp(_b, _end)
            _mid = (_left + _right) / 2
            # Keep the entire sloping access side open, including the walk's
            # miter corners. Facing never reaches into the route clearance.
            if not clear(_mid.x, _mid.y, .82):
                continue
            _lo = _bottom + _terrace_rng.uniform(-.004, .004)
            _hi = _top + _terrace_rng.uniform(-.004, .004)
            _front = [_terrace_profile(p, z) + _normal * .052
                      for p, z in [(_left, _lo), (_right, _lo), (_right, _hi), (_left, _hi)]]
            _back = [p - _normal * .12 for p in _front]
            _ob = _terrace_mesh('Civic fitted retaining stone %d %d %d' % (_edge, _row, _bay),
                       [tuple(p) for p in _front + _back],
                       [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1),
                        (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)],
                       _terrace_stones[(_edge + _row + _bay) % len(_terrace_stones)])

print('GUAIRA_TERRACE: fitted retaining sandstone; original terrace and routes preserved')
