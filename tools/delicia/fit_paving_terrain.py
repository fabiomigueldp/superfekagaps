"""Seat a triangulated height field under the actual paving footprint.

Shapely is used in the system Python, outside Blender. Compare the two linear
surfaces at every vertex of each triangle intersection: their greatest height
difference must occur at one of those vertices. Lower all three terrain corners
by the required clearance, taking the maximum correction across intersections.
This also catches thin edge intrusions that point sampling can miss.
"""
import json
import sys
from pathlib import Path

from shapely.geometry import Polygon
from shapely.strtree import STRtree

source, destination = map(Path, sys.argv[1:3])
data = json.loads(source.read_text(encoding='utf-8'))
vertices = data['terrain']['vertices']
faces = data['terrain']['triangles']
road_vertices = data['paving']['vertices']
road_faces = data['paving']['triangles']
CLEARANCE = .085
MINIMUM_TERRAIN_HEIGHT = data.get('minimumTerrainHeight', 1)


def plane(a, b, c):
    dx, dy, dz = [b[i] - a[i] for i in range(3)]
    ex, ey, ez = [c[i] - a[i] for i in range(3)]
    determinant = dx * ey - dy * ex
    if abs(determinant) < 1e-10:
        return None
    x = (dz * ey - dy * ez) / determinant
    y = (dx * ez - dz * ex) / determinant
    return (x, y, a[2] - x * a[0] - y * a[1])


def height(p, x, y):
    return p[0] * x + p[1] * y + p[2]


polygons = []
face_indices = []
planes = []
for index, face in enumerate(faces):
    points = [vertices[i] for i in face]
    p = plane(*points)
    if p is None or max(point[2] for point in points) < MINIMUM_TERRAIN_HEIGHT:
        continue
    polygons.append(Polygon([v[:2] for v in points]))
    face_indices.append(index)
    planes.append(p)
tree = STRtree(polygons)

contacts = []
lowering = {}
before_count = 0
before_max = float('-inf')
for face in road_faces:
    points = [road_vertices[i] for i in face]
    road_plane = plane(*points)
    if road_plane is None:
        continue
    road_polygon = Polygon([v[:2] for v in points])
    for index in tree.query(road_polygon, predicate='intersects'):
        intersection = polygons[index].intersection(road_polygon)
        if intersection.area < 1e-10:
            continue
        # Intersecting two triangles yields a single convex polygon.
        coordinates = list(intersection.exterior.coords)[:-1]
        terrain_plane = planes[index]
        intrusion = max(height(terrain_plane, x, y) - height(road_plane, x, y)
                        for x, y in coordinates)
        terrain_face = faces[face_indices[index]]
        contacts.append((terrain_face, coordinates, road_plane))
        before_max = max(before_max, intrusion)
        if intrusion > 0:
            before_count += 1
        if intrusion > -CLEARANCE + 1e-6:
            for vertex in terrain_face:
                lowering[vertex] = max(lowering.get(vertex, 0), intrusion + CLEARANCE)

adjusted = [list(v) for v in vertices]
for index, amount in lowering.items():
    adjusted[index][2] -= amount
after_max = float('-inf')
for face, coordinates, road_plane in contacts:
    terrain_plane = plane(*[adjusted[i] for i in face])
    after_max = max(after_max, *(height(terrain_plane, x, y) - height(road_plane, x, y)
                                 for x, y in coordinates))
assert after_max <= -CLEARANCE + 1e-6, f'Terrain still intersects paving: {after_max}'
result = {
    'vertices': {str(i): adjusted[i][2] for i in lowering},
    'audit': {
        'triangleContacts': len(contacts),
        'intersectionsBefore': before_count,
        'maxIntrusionBeforeMeters': round(max(0, before_max), 6),
        'minimumClearanceBeforeMeters': round(-before_max, 6),
        'intersectionsAfter': 0,
        'minimumClearanceMeters': round(-after_max, 6),
        'seatedVertices': len(lowering),
        'largestCorrectionMeters': round(max(lowering.values(), default=0), 6),
    },
}
destination.write_text(json.dumps(result, separators=(',', ':')), encoding='utf-8')
print(json.dumps(result['audit']), flush=True)
