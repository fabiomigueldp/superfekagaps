"""Continuous inhabited ground for the authored Guaíra diorama.

Executed after the craft, Bairro water and original terrace passes. The outline
is fitted to the village, civic building and working rice banks, rather than
stretching the houses or adding isolated display plinths. Route centers and all
landmark identities remain unchanged. Existing clay/sandstone materials are
reused; no camera, gameplay data or airport geometry is changed here.
"""
from random import Random

_terrain_rng = Random(6100526)
_terrain_materials = [bpy.data.materials[name] for name in (
    'Red orange clay', 'Terracotta sun faces', 'Iron-rich clay seams',
    'Fresh terracotta breaks')]


def _ground_mesh(name, vertices, faces, materials, bevel_width=0):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    for material in materials:
        data.materials.append(material)
    if bevel_width:
        edge = ob.modifiers.new('Small worn geological arris', 'BEVEL')
        edge.width = bevel_width
        edge.segments = 2
        ob.modifiers.new('Weighted geological normals', 'WEIGHTED_NORMAL')
    return ob


def _counterclockwise(points):
    area = sum(a[0] * b[1] - b[0] * a[1]
               for a, b in zip(points, points[1:] + points[:1]))
    return points if area > 0 else list(reversed(points))


# Local changes follow occupied ground: a village shoulder to the northwest,
# broad agricultural bench to the southeast, and earth under the reservoir.
# The western rural landing clearing is intentionally not enlarged or rebuilt.
GUAIRA_GROUND_OUTLINE = _counterclockwise([
    (6.62, .52), (6.88, -.25), (7.05, -1.55), (6.90, -2.85),
    (6.48, -4.33), (4.65, -4.78), (2.90, -4.85), (1.00, -4.75),
    (-1.60, -4.35), (-3.20, -3.90), (-4.65, -3.85), (-5.70, -3.55),
    (-6.15, -2.70), (-6.03, -1.60), (-6.15, .20), (-6.45, 1.65),
    (-6.35, 2.70), (-5.72, 3.38), (-4.45, 3.86), (-3.40, 4.03),
    (-1.90, 4.46), (.15, 4.99), (2.10, 5.00), (3.23, 4.70),
    (4.80, 4.75), (5.90, 4.35), (6.25, 3.20), (6.42, 1.83),
])
GUAIRA_CIVIC_OUTLINE = _counterclockwise([
    (2.65, 2.55), (2.74, 3.12), (2.35, 4.55), (1.60, 4.88),
    (.20, 4.92), (-1.20, 4.65), (-1.62, 4.15), (-1.62, 3.50),
    (-1.82, 2.75), (-.75, 1.75), (.30, 1.58), (1.23, 1.65),
    (1.68, 1.90), (2.07, 2.25),
])

# Replace the old narrow solid AND its fitted skin. Leaving the skin in place
# would strand a cliff line across the newly inhabitable shoulder.
for _ob in list(bpy.data.objects):
    if _ob.name in {'Continuous clay island', 'Civic terrace', 'Civic continuous earthen ascent'} or _ob.name.startswith((
        'Fitted fractured cliff ', 'Broken horizontal sediment seam',
        'Civic fitted retaining stone ')):
        bpy.data.objects.remove(_ob, do_unlink=True)


def _solid_ground(name, outline, center, top, bottom, swell):
    """One closed solid, with an uneven intermediate stratum and shared seams."""
    count = len(outline)
    top_ring = [(x, y, top) for x, y in outline]
    middle, foot = [], []
    for i, (x, y) in enumerate(outline):
        radial = Vector((x - center[0], y - center[1], 0)).normalized()
        middle.append((x + radial.x * swell, y + radial.y * swell,
                       bottom + (top - bottom) * (.43 + .055 * math.sin(i * 2.7))))
        foot.append((x - radial.x * swell * .55,
                     y - radial.y * swell * .55, bottom))
    faces = [tuple(range(count)), tuple(range(3 * count - 1, 2 * count - 1, -1))]
    for ring in range(2):
        for i in range(count):
            j = (i + 1) % count
            faces.append((ring * count + i, (ring + 1) * count + i,
                          (ring + 1) * count + j, ring * count + j))
    ob = _ground_mesh(name, top_ring + middle + foot, faces,
                      _terrain_materials, .016)
    for polygon in ob.data.polygons:
        polygon.material_index = 1 if polygon.index == 0 else 0
    return ob, top_ring, middle, foot


_ground, _top, _middle, _foot = _solid_ground(
    'Continuous clay island', GUAIRA_GROUND_OUTLINE, (0, 0), 1.75, .15, .30)

# Triangular fractured faces reuse the original warm strata. Panels share the
# closed core's contour, so chips never leave see-through cracks in the island.
for _edge, (_aa, _bb) in enumerate(zip(_top, _top[1:] + _top[:1])):
    _a, _b = Vector(_aa), Vector(_bb)
    _next = (_edge + 1) % len(_top)
    _ma, _mb = Vector(_middle[_edge]), Vector(_middle[_next])
    _fa, _fb = Vector(_foot[_edge]), Vector(_foot[_next])
    _length = (_b - _a).length
    _count = max(1, round(_length / 1.13))
    _cuts = [0] + [i / _count + _terrain_rng.uniform(-.09, .09) / _count
                  for i in range(1, _count)] + [1]
    for _bay, (_u, _v) in enumerate(zip(_cuts, _cuts[1:])):
        _p, _q = _a.lerp(_b, _u), _a.lerp(_b, _v)
        _m1, _m2 = _ma.lerp(_mb, _u), _ma.lerp(_mb, _v)
        _tangent = (_q - _p).normalized()
        _normal = Vector((_tangent.y, -_tangent.x, 0))
        # Broad interlocking fractures, with uneven strata rather than a row
        # of identical triangular teeth. The solid core closes the seams.
        _m1 += _normal * _terrain_rng.uniform(.01, .05)
        _m2 += _normal * _terrain_rng.uniform(.01, .05)
        _m1.z += _terrain_rng.uniform(-.18, .27)
        _m2.z += _terrain_rng.uniform(-.18, .27)
        _chip = _m1.lerp(_m2, _terrain_rng.uniform(.18, .82)) + _normal * _terrain_rng.uniform(.04, .23)
        _chip.z += _terrain_rng.uniform(-.18, .20)
        _f1, _f2 = _fa.lerp(_fb, _u), _fa.lerp(_fb, _v)
        _vertices = [_p, _q, _m2, _chip, _m1, _f1, _f2]
        _faces = [(0, 3, 1), (1, 3, 2), (0, 4, 3), (4, 5, 3), (3, 5, 6, 2)]
        # These are exposed open panels: point every face outward explicitly.
        _faces = [face if (_vertices[face[1]] - _vertices[face[0]]).cross(
                  _vertices[face[2]] - _vertices[face[0]]).dot(_normal) >= 0
                  else tuple(reversed(face)) for face in _faces]
        _panel = _ground_mesh('Fitted fractured cliff %02d %02d' % (_edge, _bay),
            [tuple(p) for p in _vertices], _faces, _terrain_materials, .008)
        _warm_break = (_edge * 3 + _bay) % 7 in (0, 1)
        for _poly in _panel.data.polygons:
            _poly.material_index = (3 if _warm_break and _poly.index < 2 else
                                    2 if (_edge + _bay) % 6 == 0 and _poly.index > 2 else 0)
        if _edge % 4 == 1 and _bay == 0:
            _seam = bpy.data.curves.new('Embedded broken sediment stratum', 'CURVE')
            _seam.dimensions = '3D'
            _seam.bevel_depth = .017
            _seam.bevel_resolution = 1
            _spline = _seam.splines.new('POLY')
            _spline.points.add(2)
            for _point, _co in zip(_spline.points, [_m1 + _normal * .018,
                                                  _chip + _normal * .018,
                                                  _m2 + _normal * .018]):
                _point.co = (*_co, 1)
            _seam.materials.append(_terrain_materials[2])
            _seam_ob = bpy.data.objects.new('Broken horizontal sediment seam', _seam)
            bpy.context.collection.objects.link(_seam_ob)

_civic, _civic_top, _civic_middle, _civic_foot = _solid_ground(
    'Civic terrace', GUAIRA_CIVIC_OUTLINE, (.6, 3.1), 2.40, 1.66, .09)

# The original walk was a thin suspended strip on the climb. The filled earthen
# shoulder below it follows every authored elevation and miter, merging into
# both continuous solids without moving the route or creating a raised curb.
_walk = bpy.data.objects['walk_3']
_walk_top = [(_walk.matrix_world @ vertex.co) for vertex in
             _walk.data.vertices[:len(_walk.data.vertices) // 2]]
_ramp_top = []
for _i in range(0, len(_walk_top), 2):
    _left, _right = _walk_top[_i], _walk_top[_i + 1]
    _center = (_left + _right) / 2
    for _edge_point in (_left, _right):
        _wide = _center + (_edge_point - _center) * 1.16
        _wide.z -= .080
        _ramp_top.append(tuple(_wide))
_ramp_vertices = _ramp_top + [(x, y, 1.67) for x, y, z in _ramp_top]
_ramp_count = len(_ramp_top)
_ramp_faces = []
for _i in range(0, _ramp_count - 2, 2):
    _j = _i + 2
    _ramp_faces.extend([(_i, _j, _j + 1, _i + 1),
                        (_i + _ramp_count, _i + 1 + _ramp_count,
                         _j + 1 + _ramp_count, _j + _ramp_count),
                        (_i, _i + _ramp_count, _j + _ramp_count, _j),
                        (_i + 1, _j + 1, _j + 1 + _ramp_count, _i + 1 + _ramp_count)])
_ramp_faces.extend([(0, 1, 1 + _ramp_count, _ramp_count),
                    (_ramp_count - 2, 2 * _ramp_count - 2, 2 * _ramp_count - 1, _ramp_count - 1)])
_ramp = _ground_mesh('Civic continuous earthen ascent', _ramp_vertices,
                     _ramp_faces, _terrain_materials)
for _poly in _ramp.data.polygons:
    _poly.material_index = 1 if _poly.index % 4 == 0 else 0

# Laid stone belongs to the front retaining slope, rather than wrapping the
# widened shelf into a ornamental pedestal. The entire approach stays open.
_facing_materials = [bpy.data.materials[name] for name in (
    'Civic retaining warm sandstone', 'Civic retaining sun sandstone',
    'Civic retaining iron sandstone')]
for _edge, (_aa, _bb) in enumerate(zip(GUAIRA_CIVIC_OUTLINE,
                                     GUAIRA_CIVIC_OUTLINE[1:] + GUAIRA_CIVIC_OUTLINE[:1])):
    _a, _b = Vector((*_aa, 0)), Vector((*_bb, 0))
    _middle_xy = (_a + _b) / 2
    if _middle_xy.y > 3.15:
        continue
    _tangent = (_b - _a).normalized()
    _normal = Vector((_tangent.y, -_tangent.x, 0))
    _length = (_b - _a).length
    for _row, (_low, _high) in enumerate([(1.755, 1.947), (1.964, 2.152), (2.169, 2.365)]):
        _count = max(2, round(_length / .47))
        _cuts = [0] + [min(.96, (i + (.38 if _row % 2 else 0)) / _count)
                      for i in range(1, _count)] + [1]
        for _bay, (_u, _v) in enumerate(zip(_cuts, _cuts[1:])):
            _left = _a.lerp(_b, _u + .010 / _length)
            _right = _a.lerp(_b, _v - .010 / _length)
            _middle_xy = (_left + _right) / 2
            if not clear(_middle_xy.x, _middle_xy.y, .82):
                continue
            _front = []
            for _point, _height in [(_left, _low), (_right, _low), (_right, _high), (_left, _high)]:
                _radial = Vector((_point.x - .6, _point.y - 3.1, 0)).normalized()
                _swell = .09 * (2.40 - _height) / .42 if _height > 1.98 else .09
                _front.append((_point + _radial * _swell + _normal * .038) + Vector((0, 0, _height)))
            _back = [p - _normal * .14 for p in _front]
            _ground_mesh('Civic fitted retaining stone %02d %d %02d' % (_edge, _row, _bay),
                [tuple(p) for p in _front + _back],
                [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1),
                 (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)],
                [_facing_materials[(_edge + _row + _bay) % 3]], .012)

print('GUAIRA_GROUND: continuous village/agricultural shoulders; civic shelf and filled ascent')
