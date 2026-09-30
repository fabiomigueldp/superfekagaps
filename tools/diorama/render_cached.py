"""Quick final rendering of the temporary .blend cache written by render_costa.py.
Usage: blender -b /tmp/costa-diorama-source.blend -t 12 -P tools/diorama/render_cached.py
The cache is disposable; reproduce everything with render_costa.py instead.
"""
import bpy, os, sys, runpy
OUT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../../public/assets/world/map'))
scene=bpy.context.scene;scene.render.resolution_percentage=100;scene.cycles.samples=192;scene.cycles.use_denoising=False;scene.render.use_border=False;scene.render.use_crop_to_border=False
runpy.run_path(os.path.join(os.path.dirname(__file__),'check_clearance.py'),run_name='__main__')
scene.render.filepath=os.path.join(OUT,'costa-diorama.png');bpy.ops.render.render(write_still=True)
if '--art-only' not in sys.argv:
 for ob in list(scene.objects):
     if ob.type in {'MESH','CURVE'}: ob.visible_camera=False
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.04));shadow=bpy.context.object;shadow.name='separate contact shadow catcher';shadow.is_shadow_catcher=True
 m=bpy.data.materials.new('ocean shadow receiver');m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.07,.32,.36,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=1;shadow.data.materials.append(m)
 scene.cycles.samples=64;scene.render.filepath=os.path.join(OUT,'costa-shadow.png');bpy.ops.render.render(write_still=True)
 
 import runpy
 runpy.run_path(os.path.join(os.path.dirname(__file__),"polish_shadow.py"),run_name="__main__")
