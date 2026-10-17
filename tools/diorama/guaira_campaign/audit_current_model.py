"""Read-only source/export, solid-mesh and walk-support audit of the current island.
Run with Blender -b <navigation.source> -P this.py -- --output-dir <new report folder>.
No historical reports, geometry, cameras or textures are modified.
"""
import argparse, hashlib, json, runpy, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[3]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output-dir', type=Path, required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
out = args.output_dir.resolve()
out.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
nav = json.loads(scene['native_navigation'])
published = json.loads((ROOT/'public/assets/world/map/guaira-campaign/guaira-navigation.json').read_text())
contracts = {key: nav[key] == published[key] for key in ('nodes', 'junctions', 'nodeDepths', 'routes', 'landmarks', 'depth')}
assert all(contracts.values()), contracts
bpy.context.view_layer.update()
inverse = scene.camera.matrix_world.inverted()
projection_errors, depth_errors = [], []
for route in nav['routes']:
    for world, projected, depth in zip(route['world'], route['points'], route['depths']):
        p = world_to_camera_view(scene, scene.camera, Vector(world))
        projection_errors.extend([abs(p.x-projected['x']), abs(1-p.y-projected['y'])])
        depth_errors.append(abs(-(inverse@Vector(world)).z-depth))
solids = []
for ob in scene.objects:
    if ob.hide_render or ob.type != 'MESH':
        continue
    # Water sheets and authored roof planes are intentionally open. Structural
    # terrain and the five subsequent solid-detail passes must be closed.
    if ob.name != 'Continuous clay island' and not ob.name.startswith(('Terrain v2 ', 'Landscape v3 ', 'Landmark v4 ', 'Finish v5 ', 'Path v6 ')):
        continue
    mesh = bmesh.new()
    mesh.from_mesh(ob.data)
    remaining, components = set(mesh.verts), 0
    while remaining:
        components += 1
        pending = [remaining.pop()]
        while pending:
            for edge in pending.pop().link_edges:
                for vertex in edge.verts:
                    if vertex in remaining:
                        remaining.remove(vertex)
                        pending.append(vertex)
    solids.append(dict(name=ob.name, components=components,
        nonManifoldEdges=sum(not e.is_manifold for e in mesh.edges),
        degenerateFaces=sum(f.calc_area()<1e-12 for f in mesh.faces), volume=mesh.calc_volume(signed=True)))
    mesh.free()
runpy.run_path(str(Path(__file__).with_name('audit_native_paths.py')), run_name='__main__')
walk = json.loads((out/'geometry-audit.json').read_text())
report = dict(source=bpy.data.filepath, sourceSHA256=hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),
    revision=published['revision'], exportContracts=contracts, closedMeshes=len(solids), meshes=solids,
    maximumProjectionError=max(projection_errors), maximumDepthErrorMeters=max(depth_errors),
    routeSamples=walk['routeSamples'], supportProbes=walk['supportProbes'],
    unsupported=walk['unsupported'], bodyContacts=walk['bodyContacts'], readOnly=True)
(out/'model-readiness.json').write_text(json.dumps(report, indent=2)+'\n')
assert solids and all(s['components']==1 and not s['nonManifoldEdges'] and not s['degenerateFaces'] and s['volume']>0 for s in solids)
assert max(projection_errors)<1e-6 and max(depth_errors)<1e-5
assert not walk['unsupported'] and not walk['bodyContacts']
print('CURRENT_MODEL_OK', len(solids), 'closed solids;', walk['routeSamples'], 'supported walk points; export coordinates and depth agree', flush=True)
