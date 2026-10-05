"""Earned water layer only. Run after build.py --region guaira.
blender -b /tmp/feka-guaira-campaign.blend -t 4 -P tools/diorama/guaira_campaign/build_restored_water.py
Existing terrain/props hold out the water, preserving every rim and occluder.
"""
import bpy, json, math, argparse, sys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output-dir',type=Path,default=ROOT/'public/assets/world/map/guaira-campaign')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
OUT=args.output_dir;OUT.mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene
visible=[]
for name in ['Bairro public water SOURCE bowl water','Bairro public water SOURCE contained fall']:
    ob=bpy.data.objects[name];ob.hide_render=False;ob.hide_viewport=False;visible.append(ob)
# Derive restrained glints from the final authored quad channels, including any
# lowered bridge water. No stale x/y/z coordinates can leave highlights in air.
for water in list(scene.objects):
    if water.type!='MESH' or 'flowing' not in water.name or water.name.startswith('Gravity'):continue
    if not any(m and m.name=='Clean turquoise water' for m in water.data.materials):continue
    vertices=[water.matrix_world@v.co for v in water.data.vertices]
    assert len(vertices)==4, f'Expected ordered channel quad: {water.name}'
    a,b=(vertices[0]+vertices[1])/2,(vertices[2]+vertices[3])/2
    edge=(vertices[1]-vertices[0]);width=edge.length;edge.normalize()
    along=(b-a).normalized()
    for u in ([.32,.70] if water.name.startswith('Shared field supply') else [.5]):
        center=a.lerp(b,u)+Vector((0,0,.009));half=min(.125,width*.32)
        curve=bpy.data.curves.new('Restored channel flow','CURVE');curve.dimensions='3D';curve.bevel_depth=.013;curve.bevel_resolution=2
        spline=curve.splines.new('POLY');spline.points.add(2)
        for p,co in zip(spline.points,[center-edge*half,center+along*.024+Vector((0,0,.002)),center+edge*half]):p.co=(*co,1)
        ob=bpy.data.objects.new('Restored '+water.name+' '+str(u),curve);scene.collection.objects.link(ob);curve.materials.append(bpy.data.materials['Foam']);visible.append(ob)
bpy.context.view_layer.update()
# Keep the first motion crop tied to the actual public receiver, not pixel guesses.
points=[]
for ob in visible[:2]:
    for v in ob.data.vertices:
        p=world_to_camera_view(scene,scene.camera,ob.matrix_world@v.co);points.append((p.x*1920,(1-p.y)*1200))
source={'bowlBounds':[math.floor(min(p[0] for p in points))-2,math.floor(min(p[1] for p in points))-2,math.ceil(max(p[0] for p in points))+2,math.ceil(max(p[1] for p in points))+2], 'channelGlints':len(visible)-2}
(OUT/'restored-water-source.json').write_text(json.dumps(source,indent=2)+'\n')
# Holdout uses the complete existing geometry for depth, including the trough rim.
hold=bpy.data.materials.new('Water restoration occluders');hold.use_nodes=True;nodes=hold.node_tree.nodes;nodes.clear();out=nodes.new('ShaderNodeOutputMaterial');shader=nodes.new('ShaderNodeHoldout');hold.node_tree.links.new(shader.outputs[0],out.inputs['Surface'])
for ob in scene.objects:
    if ob not in visible and ob.type in {'MESH','CURVE','FONT','SURFACE'}:
        ob.data=ob.data.copy();ob.data.materials.clear();ob.data.materials.append(hold)
scene.cycles.samples=32
scene.render.filepath=str(OUT/'guaira-water-restored.png')
bpy.ops.render.render(write_still=True)
# Package with: python tools/diorama/guaira_campaign/package_restored_water.py
