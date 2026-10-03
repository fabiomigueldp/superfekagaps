"""Earned water layer only. Run after build.py --region guaira.
blender -b /tmp/feka-guaira-campaign.blend -t 4 -P tools/diorama/guaira_campaign/build_restored_water.py
Existing terrain/props hold out the water, preserving every rim and occluder.
"""
import bpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
scene=bpy.context.scene
visible=[]
for name in ['Bairro public water SOURCE bowl water','Bairro public water SOURCE contained fall']:
    ob=bpy.data.objects[name];ob.hide_render=False;ob.hide_viewport=False;visible.append(ob)
# Short, understated highlights on the existing shared irrigation channels.
# These are at the source water elevations, not screen-space HUD marks.
for i,(x,y,z,length) in enumerate([(4.50,1.02,1.855,.25),(4.50,.52,1.840,.25),(5.45,-2.20,1.837,.16),(5.45,-3.25,1.837,.16),(3.85,-3.85,1.837,.22)]):
    curve=bpy.data.curves.new('Restored channel flow','CURVE');curve.dimensions='3D';curve.bevel_depth=.013;curve.bevel_resolution=2
    spline=curve.splines.new('POLY');spline.points.add(2)
    for p,co in zip(spline.points,[(x-length/2,y,z),(x,y-.024,z+.002),(x+length/2,y,z)]):p.co=(*co,1)
    ob=bpy.data.objects.new('Restored channel flow '+str(i),curve);scene.collection.objects.link(ob);curve.materials.append(bpy.data.materials['Foam']);visible.append(ob)
# Holdout uses the complete existing geometry for depth, including the trough rim.
hold=bpy.data.materials.new('Water restoration occluders');hold.use_nodes=True;nodes=hold.node_tree.nodes;nodes.clear();out=nodes.new('ShaderNodeOutputMaterial');shader=nodes.new('ShaderNodeHoldout');hold.node_tree.links.new(shader.outputs[0],out.inputs['Surface'])
for ob in scene.objects:
    if ob not in visible and ob.type in {'MESH','CURVE','FONT','SURFACE'}:
        ob.data=ob.data.copy();ob.data.materials.clear();ob.data.materials.append(hold)
scene.cycles.samples=32
scene.render.filepath=str(ROOT/'public/assets/world/map/guaira-campaign/guaira-water-restored.png')
bpy.ops.render.render(write_still=True)
# Package with: python -c "from PIL import Image; p='public/assets/world/map/guaira-campaign/guaira-water-restored'; Image.open(p+'.png').save(p+'.webp',lossless=True,method=6,exact=False)"
